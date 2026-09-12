"""
test_pipeline.py
Standalone deterministic pipeline test -- runs without a server.
Verifies: SUPPLY -> GLUT DETECTION -> SURPLUS -> CAPACITY -> OPTIMIZATION -> VALIDATION

Run from backend/ directory:
    python test_pipeline.py
"""
import sys
import json
from pathlib import Path

# Ensure backend modules are importable
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
    ARRIVAL_BASELINE_T,
    GLUT_TRIGGER_PCT,
)
from engine import supply, market, risk, optimizer, validator


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


def run():
    all_passed = True

    # ── 0. Init DB ─────────────────────────────────────────────────────────
    section("0. Database Initialisation")
    db.init_db()
    counts = seed_data.run_all()
    ok = all(v > 0 for v in counts.values())
    all_passed &= check("Seed data loaded", ok, str(counts))

    # ── 1. Supply anomaly ──────────────────────────────────────────────────
    section("1. Supply Anomaly Detection")
    baseline_t = supply.historical_baseline(DEFAULT_PRIMARY_MARKET, DEFAULT_COMMODITY)
    print(f"     Baseline from DB : {baseline_t:.1f}T")

    anomaly_result = supply.compute_anomaly({
        "historical_baseline_t": baseline_t,
        "current_arrivals_t":    SIMULATED_CURRENT_ARRIVALS_T,
        "expected_supply_t":     SIMULATED_EXPECTED_SUPPLY_T,
    })
    print(f"     Anomaly result   : {json.dumps(anomaly_result, indent=4)}")
    all_passed &= check("Surge detected",         anomaly_result["surge_detected"])
    all_passed &= check("Anomaly > 20%",           anomaly_result["anomaly_pct"] > 20,
                        f"{anomaly_result['anomaly_pct']:.1f}%")
    all_passed &= check("Severity high/critical",  anomaly_result["severity"] in ("high", "critical"),
                        anomaly_result["severity"])

    # ── 2. Market absorption ───────────────────────────────────────────────
    section("2. Market Absorption Evaluation")
    primary_row = db.query_one("SELECT * FROM markets WHERE market_id = ?", (DEFAULT_PRIMARY_MARKET,))
    local_absorption_t = primary_row["capacity_t"]
    print(f"     Primary market capacity  : {local_absorption_t:.0f}T")
    print(f"     Current arrivals         : {SIMULATED_CURRENT_ARRIVALS_T:.0f}T")

    available_markets = market.build_available_markets(DEFAULT_PRIMARY_MARKET)
    print(f"     Alternative markets      : {len(available_markets)}")

    market_result = market.evaluate_absorption({
        "primary_market_id":  DEFAULT_PRIMARY_MARKET,
        "current_arrivals_t": SIMULATED_CURRENT_ARRIVALS_T,
        "local_absorption_t": local_absorption_t,
        "price_trend_7d_pct": SIMULATED_PRICE_TREND_7D_PCT,
        "available_markets":  available_markets,
    })
    print(f"     Market result    : {json.dumps(market_result, indent=4)}")
    all_passed &= check("Market saturated (>100%)", market_result["saturation_pct"] > 100,
                        f"{market_result['saturation_pct']:.1f}%")
    all_passed &= check("Alt markets with capacity",
                        len(market_result["alternative_markets_with_capacity"]) > 0)

    # ── 3. Weather / Risk ──────────────────────────────────────────────────
    section("3. Weather Risk Scoring")
    weather_data = risk.simulated_weather()
    weather_result = risk.score_weather(weather_data)
    print(f"     Weather metrics  : {json.dumps(weather_result, indent=4)}")
    all_passed &= check("Weather risk score in [0,1]",
                        0 <= weather_result["weather_risk_score"] <= 1,
                        f"{weather_result['weather_risk_score']:.3f}")

    # ── 4. Glut risk score ─────────────────────────────────────────────────
    section("4. Glut Risk Score")
    glut_risk = risk.glut_risk_pct(
        anomaly_pct=anomaly_result["anomaly_pct"],
        saturation_pct=market_result["saturation_pct"],
        weather_risk_score=weather_result["weather_risk_score"],
        price_drop_7d_pct=SIMULATED_PRICE_TREND_7D_PCT,
    )
    print(f"     Glut risk        : {glut_risk:.1f}%")
    all_passed &= check(f"Glut risk above trigger ({GLUT_TRIGGER_PCT}%)",
                        glut_risk >= GLUT_TRIGGER_PCT,
                        f"{glut_risk:.1f}%")

    # ── 5. Surplus calculation ─────────────────────────────────────────────
    section("5. Surplus Calculation")
    surplus_t = max(0.0, SIMULATED_EXPECTED_SUPPLY_T - local_absorption_t)
    print(f"     Expected supply  : {SIMULATED_EXPECTED_SUPPLY_T:.0f}T")
    print(f"     Local absorption : {local_absorption_t:.0f}T")
    print(f"     Surplus          : {surplus_t:.0f}T")
    all_passed &= check("Surplus > 0", surplus_t > 0, f"{surplus_t:.0f}T")

    # ── 6. Available capacity ──────────────────────────────────────────────
    section("6. Destination Capacity Enumeration")
    snapshot = {
        "commodity":             DEFAULT_COMMODITY,
        "primary_market_id":     DEFAULT_PRIMARY_MARKET,
        "historical_baseline_t": baseline_t,
        "current_arrivals_t":    SIMULATED_CURRENT_ARRIVALS_T,
        "expected_supply_t":     SIMULATED_EXPECTED_SUPPLY_T,
        "local_absorption_t":    local_absorption_t,
        "surplus_t":             surplus_t,
        "modal_price":           SIMULATED_MODAL_PRICE,
        "price_trend_7d_pct":    SIMULATED_PRICE_TREND_7D_PCT,
        "weather_risk_score":    weather_result["weather_risk_score"],
        "glut_risk_pct":         glut_risk,
        "available_markets":     available_markets,
    }
    destinations = optimizer.build_destinations(snapshot)
    total_cap = sum(min(d["available_t"], d["max_route_t"]) for d in destinations)
    print(f"     Destinations     : {len(destinations)}")
    for d in destinations:
        print(f"       {d['destination_id']:30s}  {d['destination_type']:10s}  "
              f"avail={d['available_t']:.0f}T  route_max={d['max_route_t']:.0f}T  "
              f"cost=Rs.{d['effective_cost_per_t']:.0f}/T")
    print(f"     Total redirect cap: {total_cap:.0f}T  vs  surplus {surplus_t:.0f}T")
    all_passed &= check("Total capacity >= surplus",
                        total_cap >= surplus_t,
                        f"{total_cap:.0f}T >= {surplus_t:.0f}T")

    # ── 7. Optimization ────────────────────────────────────────────────────
    section("7. Allocation Optimization")
    plan = optimizer.solve(snapshot)
    print(f"     Plan ID          : {plan['plan_id']}")
    print(f"     Fallback used    : {plan['fallback_used']}")
    print(f"     Unallocated      : {plan['unallocated_t']:.0f}T")
    for a in plan["allocations"]:
        print(f"       {a['destination_id']:30s}  {a['allocated_t']:.0f}T  "
              f"cost=Rs.{a['transport_cost_total']:.0f}")
    total_alloc = sum(a["allocated_t"] for a in plan["allocations"])
    all_passed &= check("Plan produced", len(plan["allocations"]) > 0,
                        f"{len(plan['allocations'])} allocations")
    all_passed &= check("Total allocation matches surplus",
                        abs(total_alloc + plan["unallocated_t"] - surplus_t) < 1.0,
                        f"{total_alloc:.0f}T + {plan['unallocated_t']:.0f}T unalloc = {surplus_t:.0f}T")

    # ── 8. Validation ─────────────────────────────────────────────────────
    section("8. Plan Validation")
    validated_plan = validator.validate(plan, snapshot)
    infeasible = [a for a in validated_plan["allocations"] if not a["feasible"]]
    print(f"     Validation errors: {validated_plan['validation_errors']}")
    print(f"     Infeasible allocs: {len(infeasible)}")
    all_passed &= check("No validation errors", len(validated_plan["validation_errors"]) == 0,
                        str(validated_plan["validation_errors"]))
    all_passed &= check("All allocations feasible", len(infeasible) == 0,
                        f"{len(infeasible)} infeasible")

    # ── 9. What-if: processor offline ─────────────────────────────────────
    section("9. What-If: Processor Offline")
    # Disable P1_KOLAR_SAUCE
    overrides = {
        "processors": {"P1_KOLAR_SAUCE": {"is_active": 0}},
    }
    plan_whatif = optimizer.solve(snapshot, overrides)
    plan_whatif = validator.validate(plan_whatif, snapshot, overrides)
    alloc_ids = {a["destination_id"] for a in plan_whatif["allocations"]}
    print(f"     Processor P1_KOLAR_SAUCE disabled")
    print(f"     New allocations  : {alloc_ids}")
    all_passed &= check("P1 removed from plan after disable",
                        "P1_KOLAR_SAUCE" not in alloc_ids)
    all_passed &= check("Plan still produced", len(plan_whatif["allocations"]) > 0)

    # ── Summary ────────────────────────────────────────────────────────────
    section("RESULT")
    if all_passed:
        print(f"\n  {PASS}  All pipeline stages passed.")
    else:
        print(f"\n  {FAIL}  One or more stages FAILED. Review output above.")
    print()
    return all_passed


if __name__ == "__main__":
    success = run()
    sys.exit(0 if success else 1)
