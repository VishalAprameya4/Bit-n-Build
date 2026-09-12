"""
test_agents.py
Test suite for AGRI-FLOW Multi-Agent Reasoning Layer.

Verifies:
1. SupplyAgent finding structure, metrics, and trace events.
2. MarketAgent finding structure, saturation deficit, and alternative markets.
3. RiskAgent finding structure and weather scoring.
4. ResourceAgent deterministic capacity enumeration.
5. CoordinatorAgent multi-agent orchestration, optimizer invocation, validation,
   trace generation, and explainability narrative.
6. What-If disruption handling: processor disabled -> replanning trigger -> updated plan.
7. Fallback behavior when Ollama is offline.
"""
import sys
import json
from pathlib import Path

# Ensure backend directory is in path
sys.path.insert(0, str(Path(__file__).parent))

import database as db
import seed_data
from config import (
    DEFAULT_COMMODITY,
    DEFAULT_PRIMARY_MARKET,
    SIMULATED_CURRENT_ARRIVALS_T,
    SIMULATED_EXPECTED_SUPPLY_T,
    SIMULATED_PRICE_TREND_7D_PCT,
    SIMULATED_MODAL_PRICE,
)
from engine import supply, market, risk
from agents.base import check_ollama_available
from agents.supply_agent import SupplyAgent
from agents.market_agent import MarketAgent
from agents.risk_agent import RiskAgent
from agents.resource_agent import ResourceAgent
from agents.coordinator import CoordinatorAgent

PASS = "PASS"
FAIL = "FAIL"


def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def check(label: str, condition: bool, detail: str = ""):
    icon = PASS if condition else FAIL
    print(f"  {icon}  {label}", end="")
    if detail:
        print(f"  ->  {detail}", end="")
    print()
    return condition


def run_tests():
    all_passed = True

    # ── Step 0: Setup DB & Snapshot ──────────────────────────────────────────
    section("0. Environment & Database Setup")
    db.init_db()
    counts = seed_data.run_all()
    ollama_online = check_ollama_available()
    print(f"     Ollama status    : {'ONLINE' if ollama_online else 'OFFLINE (using deterministic fallback)'}")
    all_passed &= check("Database ready", all(v > 0 for v in counts.values()))

    # Build standard demonstration snapshot
    baseline_t = supply.historical_baseline(DEFAULT_PRIMARY_MARKET, DEFAULT_COMMODITY)
    local_absorption_t = 850.0
    surplus_t = max(0.0, SIMULATED_EXPECTED_SUPPLY_T - local_absorption_t)
    available_markets = market.build_available_markets(DEFAULT_PRIMARY_MARKET)
    weather_data = risk.simulated_weather()
    weather_metrics = risk.score_weather(weather_data)
    anomaly_metrics = supply.compute_anomaly({
        "historical_baseline_t": baseline_t,
        "current_arrivals_t": SIMULATED_CURRENT_ARRIVALS_T,
        "expected_supply_t": SIMULATED_EXPECTED_SUPPLY_T,
    })
    market_metrics = market.evaluate_absorption({
        "primary_market_id": DEFAULT_PRIMARY_MARKET,
        "current_arrivals_t": SIMULATED_CURRENT_ARRIVALS_T,
        "local_absorption_t": local_absorption_t,
        "price_trend_7d_pct": SIMULATED_PRICE_TREND_7D_PCT,
        "available_markets": available_markets,
    })
    glut_risk = risk.glut_risk_pct(
        anomaly_pct=anomaly_metrics["anomaly_pct"],
        saturation_pct=market_metrics["saturation_pct"],
        weather_risk_score=weather_metrics["weather_risk_score"],
        price_drop_7d_pct=SIMULATED_PRICE_TREND_7D_PCT,
    )

    snapshot = {
        "commodity": DEFAULT_COMMODITY,
        "primary_market_id": DEFAULT_PRIMARY_MARKET,
        "historical_baseline_t": baseline_t,
        "current_arrivals_t": SIMULATED_CURRENT_ARRIVALS_T,
        "expected_supply_t": SIMULATED_EXPECTED_SUPPLY_T,
        "local_absorption_t": local_absorption_t,
        "surplus_t": surplus_t,
        "modal_price": SIMULATED_MODAL_PRICE,
        "price_trend_7d_pct": SIMULATED_PRICE_TREND_7D_PCT,
        "weather_risk_score": weather_metrics["weather_risk_score"],
        "glut_risk_pct": glut_risk,
        "available_markets": available_markets,
        "weather_data": weather_data,
    }

    # ── Step 1: Supply Agent ─────────────────────────────────────────────────
    section("1. Supply Agent Test")
    supply_agent = SupplyAgent()
    supply_finding = supply_agent.analyze(snapshot)
    print(f"     Recommendation   : {supply_finding['recommendation']}")
    print(f"     Trace Events     : {len(supply_finding['tool_events'])}")
    all_passed &= check("Supply finding has agent='supply'", supply_finding["agent"] == "supply")
    all_passed &= check("Supply anomaly flagged", supply_finding["anomaly_detected"] is True)
    all_passed &= check("Supply metrics present", "anomaly_pct" in supply_finding["key_metrics"])
    all_passed &= check("Supply tool events emitted", len(supply_finding["tool_events"]) >= 1)

    # ── Step 2: Market Agent ─────────────────────────────────────────────────
    section("2. Market Agent Test")
    market_agent = MarketAgent()
    market_finding = market_agent.analyze(snapshot)
    print(f"     Recommendation   : {market_finding['recommendation']}")
    print(f"     Trace Events     : {len(market_finding['tool_events'])}")
    all_passed &= check("Market finding has agent='market'", market_finding["agent"] == "market")
    all_passed &= check("Market overload flagged", market_finding["anomaly_detected"] is True)
    all_passed &= check("Alt markets identified", market_finding["key_metrics"]["alternative_markets_count"] > 0)
    all_passed &= check("Market tool events emitted", len(market_finding["tool_events"]) >= 1)

    # ── Step 3: Risk Agent ───────────────────────────────────────────────────
    section("3. Risk Agent Test")
    risk_agent = RiskAgent()
    risk_finding = risk_agent.analyze(snapshot)
    print(f"     Recommendation   : {risk_finding['recommendation']}")
    print(f"     Trace Events     : {len(risk_finding['tool_events'])}")
    all_passed &= check("Risk finding has agent='risk'", risk_finding["agent"] == "risk")
    all_passed &= check("Weather risk metrics present", "weather_risk_score" in risk_finding["key_metrics"])
    all_passed &= check("Risk tool events emitted", len(risk_finding["tool_events"]) >= 1)

    # ── Step 4: Resource Agent ───────────────────────────────────────────────
    section("4. Resource Agent Test")
    resource_agent = ResourceAgent()
    resource_finding = resource_agent.analyze(snapshot)
    res_metrics = resource_finding["key_metrics"]
    print(f"     Redirect Capacity: {res_metrics['total_redirect_capacity_t']:.0f}T "
          f"({res_metrics['storage_available_t']:.0f}T storage, "
          f"{res_metrics['processor_available_t']:.0f}T proc, "
          f"{res_metrics['market_alternative_available_t']:.0f}T mandis)")
    all_passed &= check("Resource finding has agent='resource'", resource_finding["agent"] == "resource")
    all_passed &= check("Storage available > 0", res_metrics["storage_available_t"] > 0)
    all_passed &= check("Processors available > 0", res_metrics["processor_available_t"] > 0)
    all_passed &= check("Logistics constraints enumerated", len(res_metrics["logistics_constraints"]) > 0)

    # ── Step 5: Coordinator Agent Pipeline ───────────────────────────────────
    section("5. Coordinator Agent Pipeline Test")
    coordinator = CoordinatorAgent()
    coord_response = coordinator.run_pipeline(snapshot)
    print(f"     Decision         : {coord_response['decision']}")
    print(f"     Reasoning        : {coord_response['reasoning']}")
    print(f"     Fallback Used    : {coord_response['fallback_used']}")
    print(f"     Total Trace Steps: {len(coord_response['trace'])}")

    plan = coord_response["allocation_plan"]
    all_passed &= check("Decision is GLUT_RESPONSE_ACTIVE", coord_response["decision"] == "GLUT_RESPONSE_ACTIVE")
    all_passed &= check("Plan has allocations", len(plan["allocations"]) > 0, f"{len(plan['allocations'])} allocs")
    all_passed &= check("Validation passed", coord_response["validation_result"]["is_valid"] is True)
    all_passed &= check("Reasoning generated", len(coord_response["reasoning"]) > 10)
    all_passed &= check("Trace events recorded", len(coord_response["trace"]) >= 5)

    # ── Step 6: What-If Disruption & Replanning ──────────────────────────────
    section("6. What-If Disruption & Replanning")
    # Simulate P1 processor going offline
    overrides = {
        "processors": {"P1_KOLAR_SAUCE": {"is_active": 0}},
    }
    replan_response = coordinator.run_pipeline(snapshot, overrides)
    replan_plan = replan_response["allocation_plan"]
    dest_ids = {a["destination_id"] for a in replan_plan["allocations"]}
    print(f"     Disabled P1_KOLAR_SAUCE")
    print(f"     Re-allocated To  : {dest_ids}")
    all_passed &= check("P1_KOLAR_SAUCE excluded from replanned allocations", "P1_KOLAR_SAUCE" not in dest_ids)
    all_passed &= check("Replanned plan valid", replan_response["validation_result"]["is_valid"] is True)
    all_passed &= check("Replanning produced allocations", len(replan_plan["allocations"]) > 0)

    # ── Summary ──────────────────────────────────────────────────────────────
    section("AGENT SUITE RESULT")
    if all_passed:
        print(f"\n  {PASS}  All agent reasoning and pipeline tests PASSED.\n")
    else:
        print(f"\n  {FAIL}  One or more agent tests FAILED.\n")

    return all_passed


if __name__ == "__main__":
    ok = run_tests()
    sys.exit(0 if ok else 1)
