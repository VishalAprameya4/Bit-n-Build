"""
AGRI-FLOW Backend — FastAPI Application
Implements the deterministic backend foundation.

Endpoints (this file):
  GET  /health             — liveness probe
  GET  /scenario/current   — current ScenarioSnapshot
  POST /plan/generate      — run the full deterministic pipeline
  GET  /plan/current       — retrieve the latest active plan
  GET  /network/graph      — node/edge data for digital-twin visualisation
  POST /whatif/apply       — apply overrides and replan
  POST /whatif/reset       — reset overrides to baseline

NOT implemented here (later phases):
  - Ollama / LLM agent calls
  - SSE /plan/stream
  - AGMARKNET live fetch
  - Open-Meteo live fetch
  - Authentication
"""
import hashlib
import json
import sys
import datetime
from pathlib import Path

# Ensure the backend directory is on sys.path so local imports work
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
from agents import CoordinatorAgent, check_ollama_available


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AGRI-FLOW Backend",
    description="Deterministic agricultural supply intelligence engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory application state ───────────────────────────────────────────────
AppState: dict = {
    "scenario_overrides": {
        "processors":        {},
        "storage_facilities":{},
        "markets":           {},
        "logistics_routes":  {},
        "expected_supply_override_t": None,
    },
    "current_plan_id":   None,
    "pipeline_status":   "idle",
    "llm_available":     False,
    "agent_log":         [],
    "last_findings":     {},
}


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    db.init_db()
    seed_data.run_all()
    AppState["llm_available"] = check_ollama_available()
    print(f"[AGRI-FLOW] Backend ready. Ollama available: {AppState['llm_available']}")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_snapshot(overrides: dict | None = None) -> dict:
    """
    Construct a full ScenarioSnapshot from DB + simulated values + overrides.
    All numbers are deterministic.
    """
    overrides = overrides or AppState["scenario_overrides"]

    # Supply side
    baseline_t   = supply.historical_baseline(DEFAULT_PRIMARY_MARKET, DEFAULT_COMMODITY)
    current_t    = SIMULATED_CURRENT_ARRIVALS_T
    expected_t   = overrides.get("expected_supply_override_t") or SIMULATED_EXPECTED_SUPPLY_T
    price_trend  = SIMULATED_PRICE_TREND_7D_PCT
    modal_price  = SIMULATED_MODAL_PRICE

    # Primary market absorption = market capacity
    primary_row = db.query_one(
        "SELECT * FROM markets WHERE market_id = ?", (DEFAULT_PRIMARY_MARKET,)
    )
    local_absorption_t = primary_row["capacity_t"] if primary_row else baseline_t
    surplus_t = max(0.0, expected_t - local_absorption_t)

    # Alternative markets
    available_markets = market.build_available_markets(
        primary_market_id=DEFAULT_PRIMARY_MARKET,
        overrides=overrides,
    )

    # Weather
    weather_data     = risk.simulated_weather()
    weather_metrics  = risk.score_weather(weather_data)
    weather_risk_score = weather_metrics["weather_risk_score"]

    # Compute anomaly
    snap_partial = {
        "historical_baseline_t": baseline_t,
        "current_arrivals_t":    current_t,
        "expected_supply_t":     expected_t,
    }
    anomaly_metrics = supply.compute_anomaly(snap_partial)
    anomaly_pct     = anomaly_metrics["anomaly_pct"]

    # Market absorption metrics
    snap_for_market = {
        "primary_market_id":  DEFAULT_PRIMARY_MARKET,
        "current_arrivals_t": current_t,
        "local_absorption_t": local_absorption_t,
        "price_trend_7d_pct": price_trend,
        "available_markets":  available_markets,
    }
    market_metrics  = market.evaluate_absorption(snap_for_market)
    saturation_pct  = market_metrics["saturation_pct"]

    # Glut risk score
    glut_risk = risk.glut_risk_pct(
        anomaly_pct=anomaly_pct,
        saturation_pct=saturation_pct,
        weather_risk_score=weather_risk_score,
        price_drop_7d_pct=price_trend,
    )

    # Storage & processors (for snapshot metadata)
    stor_ovr  = overrides.get("storage_facilities", {})
    proc_ovr  = overrides.get("processors", {})

    storage_rows = db.query_all("SELECT * FROM storage_facilities WHERE is_active = 1")
    available_storage = []
    for s in storage_rows:
        fid = s["facility_id"]
        avail = stor_ovr.get(fid, {}).get("available_t", s["available_t"])
        available_storage.append({"facility_id": fid, "available_t": avail})

    proc_rows = db.query_all(
        "SELECT * FROM processors WHERE is_active = 1 AND commodity = ?",
        (DEFAULT_COMMODITY,),
    )
    available_processors = []
    for p in proc_rows:
        pid = p["processor_id"]
        cap = proc_ovr.get(pid, {}).get("capacity_t", p["capacity_t"])
        active = proc_ovr.get(pid, {}).get("is_active", p["is_active"])
        if active:
            available_processors.append({"processor_id": pid, "capacity_t": cap})

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
        "commodity":              DEFAULT_COMMODITY,
        "primary_market_id":      DEFAULT_PRIMARY_MARKET,
        "historical_baseline_t":  round(baseline_t, 1),
        "current_arrivals_t":     current_t,
        "expected_supply_t":      expected_t,
        "local_absorption_t":     local_absorption_t,
        "surplus_t":              round(surplus_t, 1),
        "modal_price":            modal_price,
        "price_trend_7d_pct":     price_trend,
        "weather_risk_score":     weather_risk_score,
        "glut_risk_pct":          glut_risk,
        # Supply anomaly sub-fields
        "anomaly_pct":            anomaly_pct,
        "surge_detected":         anomaly_metrics["surge_detected"],
        "severity":               anomaly_metrics["severity"],
        # Market sub-fields
        "saturation_pct":         saturation_pct,
        # Collections
        "available_markets":      available_markets,
        "available_storage":      available_storage,
        "available_processors":   available_processors,
        "available_routes":       available_routes,
    }
    return snapshot


def _scenario_hash(snapshot: dict) -> str:
    key = json.dumps(
        {k: snapshot[k] for k in sorted(snapshot) if k not in ("available_markets",)},
        sort_keys=True, default=str,
    )
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _run_pipeline(overrides: dict | None = None) -> dict:
    """
    Multi-agent pipeline execution:
      CoordinatorAgent dispatches specialist agents, invokes optimizer & validator,
      handles replanning on disruption, and produces explainable rationale.
    """
    overrides = overrides or AppState["scenario_overrides"]
    snapshot  = _build_snapshot(overrides)

    # Supersede previous active plan
    db.execute("UPDATE plans SET status = 'superseded' WHERE status = 'active'")

    # Run Coordinator Agent
    coordinator = CoordinatorAgent()
    coord_result = coordinator.run_pipeline(snapshot, overrides)
    plan = coord_result["allocation_plan"]

    # Persist agent trace and findings
    AppState["agent_log"] = coord_result["trace"]
    AppState["last_findings"] = coord_result["agent_findings"]

    # Persist to SQLite
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
    }


@app.get("/agents/activity")
def get_agents_activity():
    """Retrieve full activity trace from the latest multi-agent pipeline run."""
    return {
        "pipeline_status": AppState["pipeline_status"],
        "llm_available":   AppState["llm_available"],
        "trace":           AppState["agent_log"],
        "findings":        AppState["last_findings"],
    }


@app.get("/scenario/current")
def get_scenario():
    snapshot = _build_snapshot()
    return snapshot


@app.post("/plan/generate")
def generate_plan():
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
    plan_id = AppState.get("current_plan_id")
    if not plan_id:
        # Try DB
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


@app.post("/whatif/apply")
def apply_whatif(patch: dict):
    """
    Accept a WhatIfPatch body and replan.
    patch shape: { "overrides": { "processors": [...], ... } }
    """
    if AppState["pipeline_status"] == "running":
        raise HTTPException(status_code=409, detail="Pipeline already running")

    raw_overrides = patch.get("overrides", {})

    # Normalise list-of-dicts to keyed dicts
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
    AppState["scenario_overrides"] = {
        "processors":        {},
        "storage_facilities":{},
        "markets":           {},
        "logistics_routes":  {},
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
    """
    Returns nodes + edges for the digital-twin SVG visualisation.
    Node statuses are derived from current plan allocations + market loads.
    """
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
            "id":       pm["market_id"],
            "type":     "market",
            "label":    pm["name"],
            "lat":      pm["latitude"],
            "lng":      pm["longitude"],
            "status":   "overloaded" if load_pct > 100 else "normal",
            "load_pct": round(load_pct, 1),
            "is_active": pm["is_active"],
        })

    # Alt markets
    for r in db.query_all("SELECT * FROM markets WHERE market_id != ?", (DEFAULT_PRIMARY_MARKET,)):
        ovr = AppState["scenario_overrides"]["markets"].get(r["market_id"], {})
        is_active = ovr.get("is_active", r["is_active"])
        load_pct = (r["current_load_t"] / r["capacity_t"] * 100) if r["capacity_t"] else 0
        nodes.append({
            "id":       r["market_id"],
            "type":     "market",
            "label":    r["name"],
            "lat":      r["latitude"],
            "lng":      r["longitude"],
            "status":   "offline" if not is_active else ("overloaded" if load_pct > 100 else "normal"),
            "load_pct": round(load_pct, 1),
            "is_active": is_active,
        })

    # Storage
    for s in db.query_all("SELECT * FROM storage_facilities"):
        ovr = AppState["scenario_overrides"]["storage_facilities"].get(s["facility_id"], {})
        is_active = ovr.get("is_active", s["is_active"])
        nodes.append({
            "id":       s["facility_id"],
            "type":     "storage",
            "label":    s["name"],
            "lat":      s["latitude"],
            "lng":      s["longitude"],
            "status":   "offline" if not is_active else "storage",
            "load_pct": None,
            "is_active": is_active,
        })

    # Processors
    for p in db.query_all("SELECT * FROM processors"):
        ovr = AppState["scenario_overrides"]["processors"].get(p["processor_id"], {})
        is_active = ovr.get("is_active", p["is_active"])
        nodes.append({
            "id":       p["processor_id"],
            "type":     "processor",
            "label":    p["name"],
            "lat":      p["latitude"],
            "lng":      p["longitude"],
            "status":   "offline" if not is_active else "processor",
            "load_pct": None,
            "is_active": is_active,
        })

    # Edges from allocations
    edges = []
    for a in db.query_all(
        "SELECT * FROM allocations WHERE plan_id = ?", (plan_id,)
    ) if plan_id else []:
        edges.append({
            "source":      DEFAULT_PRIMARY_MARKET,
            "target":      a["destination_id"],
            "allocated_t": a["allocated_t"],
            "route_id":    a["route_id"],
            "active":      bool(a["feasible"]),
        })

    return {"nodes": nodes, "edges": edges}
