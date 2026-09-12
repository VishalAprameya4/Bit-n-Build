"""
AGRI-FLOW Backend — FastAPI Application
Regional Agricultural Supply Intelligence & Autonomous Response Network

Features:
- Live external mandi data ingestion (AGMARKNET / India OGD)
- Live atmospheric weather & forecast radar (Open-Meteo)
- Distinction between observed ground truth vs simulation assumptions
- Autonomous multi-agent coordination with Qwen tool-selection reasoning loop
- Deterministic OR-Tools CP-SAT optimizer & safety validator
- Endpoints:
    GET  /health
    GET  /scenario/current
    POST /data/refresh
    POST /plan/generate
    GET  /plan/current
    GET  /network/graph
    GET  /agents/activity
    POST /whatif/apply
    POST /whatif/reset
"""
import datetime
import hashlib
import json
import sys
from pathlib import Path

# Ensure the backend directory is on sys.path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import database as db
import seed_data
from config import (
    DEFAULT_COMMODITY,
    DEFAULT_PRIMARY_MARKET,
    ARRIVAL_BASELINE_T,
    SIMULATED_CURRENT_ARRIVALS_T,
    SIMULATED_EXPECTED_SUPPLY_T,
    SIMULATED_PRICE_TREND_7D_PCT,
    SIMULATED_MODAL_PRICE,
    GLUT_TRIGGER_PCT,
)
from engine import supply, market, risk, optimizer, validator
from agents import (
    CoordinatorAgent,
    MarketIntelligenceAgent,
    WeatherAgent,
    StorageAgent,
    check_ollama_available,
)

# ── App Definition ────────────────────────────────────────────────────────────
app = FastAPI(
    title="AGRI-FLOW Backend",
    description="Regional Agricultural Supply Intelligence & Autonomous Response Network",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-Memory Application State ───────────────────────────────────────────────
AppState: dict = {
    "scenario_overrides": {
        "processors": {},
        "storage_facilities": {},
        "markets": {},
        "logistics_routes": {},
        "expected_supply_override_t": None,
    },
    "current_plan_id": None,
    "pipeline_status": "idle",
    "llm_available": False,
    "agent_log": [],
    "last_findings": {},
    "last_observed_market": {},
    "last_observed_weather": {},
}

# Singletons for external agents
market_intel_agent = MarketIntelligenceAgent()
weather_agent = WeatherAgent()
storage_agent = StorageAgent()


# ── Startup Lifecycle ─────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    db.init_db()
    seed_data.run_all()
    AppState["llm_available"] = check_ollama_available()
    
    # Pre-fetch / warm cache for market and weather
    try:
        AppState["last_observed_market"] = market_intel_agent.get_latest_market_data()
        AppState["last_observed_weather"] = weather_agent.get_latest_weather_data()
    except Exception as e:
        print(f"[AGRI-FLOW] Startup warm-up note: {e}")

    print(f"[AGRI-FLOW] Backend ready. Ollama available: {AppState['llm_available']}")


# ── Helper: Snapshot Builder with Real Data Integration ────────────────────────
def _build_snapshot(overrides: dict | None = None, force_refresh: bool = False) -> dict:
    """
    Construct a full ScenarioSnapshot by uniting:
    1. REAL live/cached market data (AGMARKNET / OGD)
    2. REAL live/cached weather telemetry (Open-Meteo)
    3. Operational facility & logistics data (DB + overrides)
    4. Controlled simulation assumptions (clear separation)
    """
    overrides = overrides or AppState["scenario_overrides"]

    # 1. Fetch market intelligence (live -> cache -> simulation)
    market_data = market_intel_agent.get_latest_market_data(force_refresh=force_refresh)
    AppState["last_observed_market"] = market_data

    # 2. Fetch atmospheric weather (live -> cache -> simulation)
    weather_data = weather_agent.get_latest_weather_data(force_refresh=force_refresh)
    AppState["last_observed_weather"] = weather_data

    # Observed real-world values
    obs_arrivals_t = float(market_data.get("arrivals_t", SIMULATED_CURRENT_ARRIVALS_T))
    obs_modal_price = float(market_data.get("modal_price", SIMULATED_MODAL_PRICE))
    obs_price_trend = float(market_data.get("price_trend_7d_pct", SIMULATED_PRICE_TREND_7D_PCT))

    # Baseline calculations
    baseline_t = supply.historical_baseline(DEFAULT_PRIMARY_MARKET, DEFAULT_COMMODITY)

    # Expected supply incorporates simulation multiplier or explicit override
    # Multiplier of 1.318 models the peak harvest flush on top of current arrivals
    sim_multiplier = 1.318
    override_exp = overrides.get("expected_supply_override_t")
    if override_exp is not None:
        expected_t = float(override_exp)
    else:
        expected_t = round(obs_arrivals_t * sim_multiplier, 1)

    # Primary market capacity & local absorption
    primary_row = db.query_one(
        "SELECT * FROM markets WHERE market_id = ?", (DEFAULT_PRIMARY_MARKET,)
    )
    local_absorption_t = float(primary_row["capacity_t"]) if primary_row else 850.0
    surplus_t = max(0.0, round(expected_t - local_absorption_t, 1))

    # Alternative markets
    available_markets = market.build_available_markets(
        primary_market_id=DEFAULT_PRIMARY_MARKET,
        overrides=overrides,
    )

    # Weather scoring
    weather_risk_score = float(weather_data.get("weather_risk_score", 0.65))

    # Supply Anomaly
    snap_partial = {
        "historical_baseline_t": baseline_t,
        "current_arrivals_t": obs_arrivals_t,
        "expected_supply_t": expected_t,
    }
    anomaly_metrics = supply.compute_anomaly(snap_partial)
    anomaly_pct = anomaly_metrics["anomaly_pct"]

    # Market saturation
    snap_for_market = {
        "primary_market_id": DEFAULT_PRIMARY_MARKET,
        "current_arrivals_t": obs_arrivals_t,
        "local_absorption_t": local_absorption_t,
        "price_trend_7d_pct": obs_price_trend,
        "available_markets": available_markets,
    }
    market_metrics = market.evaluate_absorption(snap_for_market)
    saturation_pct = market_metrics["saturation_pct"]

    # Composite Glut Risk
    glut_risk = risk.glut_risk_pct(
        anomaly_pct=anomaly_pct,
        saturation_pct=saturation_pct,
        weather_risk_score=weather_risk_score,
        price_drop_7d_pct=obs_price_trend,
    )

    # Facilities status (DB + Overrides)
    facilities_state = storage_agent.get_facilities_status(
        snapshot={"primary_market_id": DEFAULT_PRIMARY_MARKET, "commodity": DEFAULT_COMMODITY},
        overrides=overrides,
    )

    available_storage = [
        {"facility_id": s["facility_id"], "available_t": s["available_capacity_t"]}
        for s in facilities_state["storage_facilities"]
        if s["is_active"]
    ]

    available_processors = [
        {"processor_id": p["processor_id"], "capacity_t": p["available_capacity_t"]}
        for p in facilities_state["processors"]
        if p["is_active"]
    ]

    # Logistics routes
    route_ovr = overrides.get("logistics_routes", {})
    route_rows = db.query_all(
        "SELECT * FROM logistics_routes WHERE origin_id = ?",
        (DEFAULT_PRIMARY_MARKET,),
    )
    available_routes = []
    for r in route_rows:
        rid = r["route_id"]
        trucks = route_ovr.get(rid, {}).get("available_trucks", r["available_trucks"])
        multiplier = route_ovr.get(rid, {}).get("cost_multiplier", r["cost_multiplier"])
        max_t = trucks * r["truck_capacity_t"]
        effective_cost = r["base_cost_per_t"] * multiplier
        available_routes.append({
            "route_id": rid,
            "origin_id": r["origin_id"],
            "destination_id": r["destination_id"],
            "distance_km": r["distance_km"],
            "max_t": round(max_t, 1),
            "effective_cost_per_t": round(effective_cost, 2),
        })

    snapshot = {
        # Core identification
        "commodity": DEFAULT_COMMODITY,
        "primary_market_id": DEFAULT_PRIMARY_MARKET,
        "historical_baseline_t": round(baseline_t, 1),
        "current_arrivals_t": round(obs_arrivals_t, 1),
        "expected_supply_t": round(expected_t, 1),
        "local_absorption_t": round(local_absorption_t, 1),
        "surplus_t": round(surplus_t, 1),
        "modal_price": round(obs_modal_price, 2),
        "price_trend_7d_pct": round(obs_price_trend, 1),
        "weather_risk_score": round(weather_risk_score, 3),
        "glut_risk_pct": round(glut_risk, 1),
        
        # Anomaly and saturation details
        "anomaly_pct": round(anomaly_pct, 1),
        "surge_detected": anomaly_metrics["surge_detected"],
        "severity": anomaly_metrics["severity"],
        "saturation_pct": round(saturation_pct, 1),

        # ── Explicit Separation: Observed vs Simulation Assumptions ──
        "observed": {
            "market": {
                "source": market_data.get("source", "AGMARKNET / OGD India"),
                "source_status": market_data.get("source_status", "live"),
                "observed_at": market_data.get("observed_at", ""),
                "fetched_at": market_data.get("fetched_at", ""),
                "confidence": market_data.get("confidence", 0.95),
                "freshness": market_data.get("freshness", "realtime_today"),
                "arrivals_t": obs_arrivals_t,
                "min_price": market_data.get("min_price", 1200),
                "modal_price": obs_modal_price,
                "max_price": market_data.get("max_price", 1800),
                "arrival_trend_7d_pct": market_data.get("arrival_trend_7d_pct", 46.8),
                "price_trend_7d_pct": obs_price_trend,
                "history": market_data.get("history", []),
            },
            "weather": {
                "source": weather_data.get("source", "Open-Meteo Realtime Forecast API"),
                "source_status": weather_data.get("source_status", "live"),
                "observed_at": weather_data.get("observed_at", ""),
                "fetched_at": weather_data.get("fetched_at", ""),
                "confidence": weather_data.get("confidence", 0.95),
                "freshness": weather_data.get("freshness", "realtime_hourly"),
                "temp_celsius": weather_data.get("temp_celsius", 29.5),
                "humidity_pct": weather_data.get("humidity_pct", 74.0),
                "precipitation_mm": weather_data.get("precipitation_mm", 18.0),
                "weather_description": weather_data.get("weather_description", "Rain"),
                "forecast_24h": weather_data.get("forecast_24h", {}),
                "forecast_72h": weather_data.get("forecast_72h", {}),
                "weather_risk_score": weather_risk_score,
            },
            "source_status": market_data.get("source_status", "live"),
        },
        "simulation": {
            "supply_pressure_multiplier": round(expected_t / obs_arrivals_t, 3) if obs_arrivals_t else sim_multiplier,
            "expected_supply_t": round(expected_t, 1),
            "storage_status": "simulation",
            "logistics_status": "simulation",
            "controlled_glut_scenario": "Kolar Tomato Regional Glut Response",
        },

        # Collections for routing and optimization
        "available_markets": available_markets,
        "available_storage": available_storage,
        "available_processors": available_processors,
        "available_routes": available_routes,
    }

    return snapshot


def _scenario_hash(snapshot: dict) -> str:
    key = json.dumps(
        {k: snapshot[k] for k in sorted(snapshot) if k not in ("available_markets", "observed", "simulation")},
        sort_keys=True, default=str,
    )
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _run_pipeline(overrides: dict | None = None) -> dict:
    """
    Execute full multi-agent pipeline:
      CoordinatorAgent runs external acquisition -> specialist agents -> Qwen reasoning loop -> OR-Tools -> Validator.
    """
    overrides = overrides or AppState["scenario_overrides"]
    snapshot = _build_snapshot(overrides)

    # Supersede previous active plans
    db.execute("UPDATE plans SET status = 'superseded' WHERE status = 'active'")

    # Run Coordinator Agent
    coordinator = CoordinatorAgent()
    coord_result = coordinator.run_pipeline(snapshot, overrides)
    plan = coord_result["allocation_plan"]

    # Persist activity trace and findings
    AppState["agent_log"] = coord_result["trace"]
    AppState["last_findings"] = coord_result["agent_findings"]

    # Persist active plan to SQLite
    now = datetime.datetime.utcnow().isoformat()
    db.execute(
        """
        INSERT INTO plans
            (plan_id, created_at, scenario_hash, status, glut_risk_pct,
             expected_supply_t, local_absorption_t, surplus_t,
             coordinator_reasoning, fallback_used)
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
        """,
        (
            plan["plan_id"], now, _scenario_hash(snapshot),
            snapshot["glut_risk_pct"],
            snapshot["expected_supply_t"],
            snapshot["local_absorption_t"],
            snapshot["surplus_t"],
            plan.get("coordinator_reasoning"),
            int(plan.get("fallback_used", False)),
        ),
    )
    for a in plan["allocations"]:
        db.execute(
            """
            INSERT INTO allocations
                (plan_id, destination_id, destination_type, allocated_t,
                 route_id, transport_cost_total, feasible)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                plan["plan_id"],
                a["destination_id"],
                a["destination_type"],
                a["allocated_t"],
                a.get("route_id", ""),
                a.get("transport_cost_total", 0.0),
                int(a.get("feasible", True)),
            ),
        )

    AppState["current_plan_id"] = plan["plan_id"]
    AppState["pipeline_status"] = "idle"

    return {"snapshot": snapshot, "plan": plan, "agent_response": coord_result}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "pipeline_status": AppState["pipeline_status"],
        "llm_available":   AppState["llm_available"],
        "current_plan_id": AppState["current_plan_id"],
        "data_sources": {
            "market": AppState.get("last_observed_market", {}).get("source_status", "unknown"),
            "weather": AppState.get("last_observed_weather", {}).get("source_status", "unknown"),
        },
    }


@app.get("/scenario/current")
def get_scenario():
    """
    Return the current comprehensive scenario state:
    - Real market observations, prices, arrivals, trends
    - Real weather current and forecasts
    - Storage and resource states
    - Distinction between observed reality vs simulation assumptions
    """
    snapshot = _build_snapshot()
    return snapshot


@app.post("/data/refresh")
def refresh_data():
    """
    Explicitly fetch fresh real-time mandi and weather data, update caches,
    and return the refreshed scenario snapshot.
    """
    snapshot = _build_snapshot(force_refresh=True)
    return {
        "status": "refreshed",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "market_source_status": snapshot.get("observed", {}).get("market", {}).get("source_status"),
        "weather_source_status": snapshot.get("observed", {}).get("weather", {}).get("source_status"),
        "snapshot": snapshot,
    }


@app.post("/plan/generate")
def generate_plan():
    """Execute the multi-agent investigation, tool reasoning, optimization, and validation."""
    if AppState["pipeline_status"] == "running":
        raise HTTPException(status_code=409, detail="Pipeline already running")
    AppState["pipeline_status"] = "running"
    try:
        result = _run_pipeline()
        return result["plan"]
    finally:
        AppState["pipeline_status"] = "idle"


@app.get("/plan/current")
def get_current_plan():
    """Retrieve the latest active allocation plan with detailed costs."""
    plan_id = AppState.get("current_plan_id")
    if not plan_id:
        row = db.query_one("SELECT plan_id FROM plans WHERE status = 'active' LIMIT 1")
        if not row:
            return {}
        plan_id = row["plan_id"]

    plan_row = db.query_one("SELECT * FROM plans WHERE plan_id = ?", (plan_id,))
    if not plan_row:
        return {}

    alloc_rows = db.query_all(
        "SELECT * FROM allocations WHERE plan_id = ?", (plan_id,)
    )
    allocs = [dict(a) for a in alloc_rows]
    total_allocated = sum(a["allocated_t"] for a in allocs)
    total_cost = sum(a.get("transport_cost_total", 0.0) for a in allocs)
    surplus_t = plan_row["surplus_t"] or 0.0
    unallocated_t = max(0.0, surplus_t - total_allocated)

    return {
        **dict(plan_row),
        "total_transport_cost": round(total_cost, 2),
        "unallocated_t": round(unallocated_t, 1),
        "allocations": allocs,
        "validation_errors": [],
    }


@app.get("/agents/activity")
def get_agents_activity():
    """Retrieve the full activity trace and findings from the latest multi-agent run."""
    return {
        "pipeline_status": AppState["pipeline_status"],
        "llm_available": AppState["llm_available"],
        "trace": AppState["agent_log"],
        "findings": AppState["last_findings"],
        "observed_market": AppState.get("last_observed_market", {}),
        "observed_weather": AppState.get("last_observed_weather", {}),
    }


@app.post("/whatif/apply")
def apply_whatif(patch: dict):
    """Accept a WhatIfPatch body, update scenario overrides, and autonomously replan."""
    if AppState["pipeline_status"] == "running":
        raise HTTPException(status_code=409, detail="Pipeline already running")

    raw_overrides = patch.get("overrides", {})
    ovr = AppState["scenario_overrides"]

    if "processors" in raw_overrides:
        for item in raw_overrides["processors"]:
            pid = item["processor_id"]
            ovr["processors"].setdefault(pid, {}).update(
                {k: v for k, v in item.items() if k != "processor_id"}
            )
    if "storage_facilities" in raw_overrides:
        for item in raw_overrides["storage_facilities"]:
            fid = item["facility_id"]
            ovr["storage_facilities"].setdefault(fid, {}).update(
                {k: v for k, v in item.items() if k != "facility_id"}
            )
    if "markets" in raw_overrides:
        for item in raw_overrides["markets"]:
            mid = item["market_id"]
            ovr["markets"].setdefault(mid, {}).update(
                {k: v for k, v in item.items() if k != "market_id"}
            )
    if "logistics_routes" in raw_overrides:
        for item in raw_overrides["logistics_routes"]:
            rid = item["route_id"]
            ovr["logistics_routes"].setdefault(rid, {}).update(
                {k: v for k, v in item.items() if k != "route_id"}
            )
    if "expected_supply_override_t" in raw_overrides:
        ovr["expected_supply_override_t"] = raw_overrides["expected_supply_override_t"]

    AppState["pipeline_status"] = "running"
    try:
        result = _run_pipeline(ovr)
        return {"plan_id": result["plan"]["plan_id"], "status": "completed", "plan": result["plan"]}
    finally:
        AppState["pipeline_status"] = "idle"


@app.post("/whatif/reset")
def reset_whatif():
    """Reset all scenario overrides to baseline and replan."""
    AppState["scenario_overrides"] = {
        "processors": {},
        "storage_facilities": {},
        "markets": {},
        "logistics_routes": {},
        "expected_supply_override_t": None,
    }
    AppState["pipeline_status"] = "running"
    try:
        result = _run_pipeline()
        return {"reset": True, "plan_id": result["plan"]["plan_id"], "plan": result["plan"]}
    finally:
        AppState["pipeline_status"] = "idle"


@app.get("/network/graph")
def get_network_graph():
    """Returns nodes + edges for the digital-twin SVG visualisation."""
    plan_id = AppState.get("current_plan_id")
    alloc_by_dest: dict = {}
    if plan_id:
        alloc_rows = db.query_all(
            "SELECT * FROM allocations WHERE plan_id = ? AND feasible = 1", (plan_id,)
        )
        for a in alloc_rows:
            alloc_by_dest[a["destination_id"]] = a["allocated_t"]

    nodes = []

    # Primary market
    pm = db.query_one("SELECT * FROM markets WHERE market_id = ?", (DEFAULT_PRIMARY_MARKET,))
    if pm:
        load_pct = (pm["current_load_t"] / pm["capacity_t"] * 100) if pm["capacity_t"] else 0
        nodes.append({
            "id": pm["market_id"],
            "type": "market",
            "label": pm["name"],
            "lat": pm["latitude"],
            "lng": pm["longitude"],
            "status": "overloaded" if load_pct > 100 else "normal",
            "load_pct": round(load_pct, 1),
            "is_active": pm["is_active"],
        })

    # Alt markets
    for r in db.query_all("SELECT * FROM markets WHERE market_id != ?", (DEFAULT_PRIMARY_MARKET,)):
        ovr = AppState["scenario_overrides"]["markets"].get(r["market_id"], {})
        is_active = ovr.get("is_active", r["is_active"])
        load_pct = (r["current_load_t"] / r["capacity_t"] * 100) if r["capacity_t"] else 0
        nodes.append({
            "id": r["market_id"],
            "type": "market",
            "label": r["name"],
            "lat": r["latitude"],
            "lng": r["longitude"],
            "status": "offline" if not is_active else ("overloaded" if load_pct > 100 else "normal"),
            "load_pct": round(load_pct, 1),
            "is_active": is_active,
        })

    # Storage
    for s in db.query_all("SELECT * FROM storage_facilities"):
        ovr = AppState["scenario_overrides"]["storage_facilities"].get(s["facility_id"], {})
        is_active = ovr.get("is_active", s["is_active"])
        nodes.append({
            "id": s["facility_id"],
            "type": "storage",
            "label": s["name"],
            "lat": s["latitude"],
            "lng": s["longitude"],
            "status": "offline" if not is_active else "storage",
            "load_pct": None,
            "is_active": is_active,
        })

    # Processors
    for p in db.query_all("SELECT * FROM processors"):
        ovr = AppState["scenario_overrides"]["processors"].get(p["processor_id"], {})
        is_active = ovr.get("is_active", p["is_active"])
        nodes.append({
            "id": p["processor_id"],
            "type": "processor",
            "label": p["name"],
            "lat": p["latitude"],
            "lng": p["longitude"],
            "status": "offline" if not is_active else "processor",
            "load_pct": None,
            "is_active": is_active,
        })

    # Edges from allocations
    edges = []
    for a in db.query_all(
        "SELECT * FROM allocations WHERE plan_id = ?", (plan_id,)
    ) if plan_id else []:
        edges.append({
            "source": DEFAULT_PRIMARY_MARKET,
            "target": a["destination_id"],
            "allocated_t": a["allocated_t"],
            "route_id": a["route_id"],
            "active": bool(a["feasible"]),
        })

    return {"nodes": nodes, "edges": edges}
