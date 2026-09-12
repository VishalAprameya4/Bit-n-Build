"""
engine/optimizer.py
Allocation planning: OR-Tools CP-SAT solver with greedy fallback.

Public API
----------
build_destinations(snapshot, overrides) -> list[dict]
    Query DB + apply overrides → list of viable allocation targets.

solve(snapshot, overrides=None) -> dict
    Primary entry-point. Tries OR-Tools; falls back to greedy.
    Returns an AllocationPlan dict (pre-validation).
"""
import math
import uuid
import datetime
from typing import Any

import database as db
from config import (
    OPTIMIZER_UNIT_T,
    OPTIMIZER_TIMEOUT_SEC,
    DEFAULT_COMMODITY,
)


# ── Destination builder ───────────────────────────────────────────────────────

def _apply_route_overrides(routes: list[dict], overrides: dict) -> list[dict]:
    route_ovr = overrides.get("logistics_routes", {})
    result = []
    for r in routes:
        rid = r["route_id"]
        if rid in route_ovr:
            for k, v in route_ovr[rid].items():
                r[k] = v
        result.append(r)
    return result


def build_destinations(
    snapshot: dict,
    overrides: dict | None = None,
) -> list[dict]:
    """
    Build a list of candidate allocation destinations, each with:
      destination_id, destination_type, available_t,
      route_id, effective_cost_per_t, max_route_t

    Only destinations that are active AND have a reachable route from the
    primary market are included.
    """
    overrides = overrides or {}
    primary = snapshot.get("primary_market_id", "KOLAR")
    commodity = snapshot.get("commodity", DEFAULT_COMMODITY)

    # --- Markets ---
    market_ovr = overrides.get("markets", {})
    alt_markets = snapshot.get("available_markets", [])

    # --- Storage ---
    stor_ovr = overrides.get("storage_facilities", {})
    storage_rows = db.query_all("SELECT * FROM storage_facilities WHERE is_active = 1")
    for s in storage_rows:
        fid = s["facility_id"]
        if fid in stor_ovr:
            for k, v in stor_ovr[fid].items():
                s[k] = v

    # --- Processors ---
    proc_ovr = overrides.get("processors", {})
    processor_rows = db.query_all(
        "SELECT * FROM processors WHERE is_active = 1 AND commodity = ?",
        (commodity,),
    )
    for p in processor_rows:
        pid = p["processor_id"]
        if pid in proc_ovr:
            for k, v in proc_ovr[pid].items():
                p[k] = v

    # --- Routes from primary market ---
    routes = db.query_all(
        "SELECT * FROM logistics_routes WHERE origin_id = ?",
        (primary,),
    )
    routes = _apply_route_overrides(routes, overrides)
    route_by_dest = {r["destination_id"]: r for r in routes}

    destinations: list[dict] = []

    # Alternative markets
    for m in alt_markets:
        mid = m["market_id"]
        if not m.get("is_active", 1):
            continue
        if mid in market_ovr:
            for k, v in market_ovr[mid].items():
                m[k] = v
        if not m.get("is_active", 1):
            continue
        available_t = m.get("available_t", 0.0)
        if available_t <= 0:
            continue
        route = route_by_dest.get(mid)
        if not route:
            continue
        eff_cost = route["base_cost_per_t"] * route["cost_multiplier"]
        max_route_t = route["available_trucks"] * route["truck_capacity_t"]
        destinations.append({
            "destination_id":    mid,
            "destination_type":  "market",
            "available_t":       available_t,
            "route_id":          route["route_id"],
            "effective_cost_per_t": eff_cost,
            "max_route_t":       max_route_t,
        })

    # Storage facilities
    for s in storage_rows:
        fid = s["facility_id"]
        if not s.get("is_active", 1):
            continue
        available_t = s.get("available_t", 0.0)
        if available_t <= 0:
            continue
        route = route_by_dest.get(fid)
        if not route:
            continue
        eff_cost = route["base_cost_per_t"] * route["cost_multiplier"]
        max_route_t = route["available_trucks"] * route["truck_capacity_t"]
        destinations.append({
            "destination_id":    fid,
            "destination_type":  "storage",
            "available_t":       available_t,
            "route_id":          route["route_id"],
            "effective_cost_per_t": eff_cost,
            "max_route_t":       max_route_t,
        })

    # Processors
    for p in processor_rows:
        pid = p["processor_id"]
        if not p.get("is_active", 1):
            continue
        available_t = p.get("capacity_t", 0.0)
        if available_t <= 0:
            continue
        route = route_by_dest.get(pid)
        if not route:
            continue
        eff_cost = route["base_cost_per_t"] * route["cost_multiplier"]
        max_route_t = route["available_trucks"] * route["truck_capacity_t"]
        destinations.append({
            "destination_id":    pid,
            "destination_type":  "processor",
            "available_t":       available_t,
            "route_id":          route["route_id"],
            "effective_cost_per_t": eff_cost,
            "max_route_t":       max_route_t,
        })

    return destinations


# ── OR-Tools CP-SAT solver ────────────────────────────────────────────────────

def _solve_ortools(
    surplus_t: float,
    destinations: list[dict],
    unit_t: float = OPTIMIZER_UNIT_T,
    timeout_sec: int = OPTIMIZER_TIMEOUT_SEC,
) -> list[dict] | None:
    """
    CP-SAT model:
      x[i] = integer units (1 unit = unit_t tonnes)
      Minimise total transport cost
      Subject to:
        sum(x) <= surplus_units          (soft — allow partial)
        x[i]   <= cap_units[i]          (destination capacity)
        x[i]   <= route_units[i]        (logistics capacity)
    Returns list of {destination_id, allocated_t} or None on failure.
    """
    try:
        from ortools.sat.python import cp_model
    except ImportError:
        return None  # OR-Tools not installed → fall back to greedy

    surplus_units = int(math.floor(surplus_t / unit_t))
    if surplus_units == 0:
        return []

    n = len(destinations)
    if n == 0:
        return []

    model = cp_model.CpModel()

    # Decision variables
    x = []
    cap_units = []
    for d in destinations:
        dest_cap  = int(math.floor(min(d["available_t"], d["max_route_t"]) / unit_t))
        var = model.NewIntVar(0, dest_cap, f"x_{d['destination_id']}")
        x.append(var)
        cap_units.append(dest_cap)

    # Objective: minimise cost (scale floats to integers × 100)
    cost_scaled = [int(d["effective_cost_per_t"] * 100) for d in destinations]
    model.Minimize(sum(cost_scaled[i] * x[i] for i in range(n)))

    # Constraint: total allocated <= surplus (soft upper bound)
    model.Add(sum(x) <= surplus_units)

    # Encourage full allocation via secondary constraint:
    # We add it as a soft constraint by maximising coverage — handled via objective,
    # but we also add a hard floor: at least cover min(surplus, total_cap)
    total_cap_units = sum(cap_units)
    target_units = min(surplus_units, total_cap_units)
    model.Add(sum(x) >= target_units)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout_sec
    solver.parameters.num_search_workers  = 1  # deterministic

    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    result = []
    for i, d in enumerate(destinations):
        units = solver.Value(x[i])
        if units > 0:
            result.append({
                "destination_id":   d["destination_id"],
                "allocated_t":      units * unit_t,
            })
    return result


# ── Greedy fallback ───────────────────────────────────────────────────────────

def _solve_greedy(
    surplus_t: float,
    destinations: list[dict],
    unit_t: float = OPTIMIZER_UNIT_T,
) -> list[dict]:
    """
    Greedy allocator from ARCHITECTURE.md §9.1:
      Sort by effective_cost_per_t ASC → allocate greedily.
    Always returns a (possibly partial) plan.
    """
    sorted_dests = sorted(destinations, key=lambda d: d["effective_cost_per_t"])
    remaining_t = surplus_t
    result = []

    for d in sorted_dests:
        if remaining_t <= 0:
            break
        max_t = min(d["available_t"], d["max_route_t"])
        # Round down to nearest unit
        allocatable = math.floor(min(remaining_t, max_t) / unit_t) * unit_t
        if allocatable <= 0:
            continue
        result.append({
            "destination_id": d["destination_id"],
            "allocated_t":    allocatable,
        })
        remaining_t -= allocatable

    return result


# ── Main solver entry ─────────────────────────────────────────────────────────

def solve(
    snapshot: dict,
    overrides: dict | None = None,
) -> dict:
    """
    Build destinations, attempt CP-SAT, fall back to greedy.
    Returns an AllocationPlan dict (not yet validated or persisted).

    Keys: plan_id, glut_risk_pct, surplus_t, allocations,
          unallocated_t, coordinator_reasoning, fallback_used, validation_errors
    """
    overrides = overrides or {}
    surplus_t: float = snapshot.get("surplus_t", 0.0)
    glut_risk: float = snapshot.get("glut_risk_pct", 0.0)

    destinations = build_destinations(snapshot, overrides)

    # --- Try OR-Tools ---
    allocation_result = _solve_ortools(surplus_t, destinations)
    fallback_used = False

    if allocation_result is None:
        # OR-Tools failed or unavailable → greedy
        allocation_result = _solve_greedy(surplus_t, destinations)
        fallback_used = True

    # --- Build destination lookup for cost calculation ---
    dest_lookup = {d["destination_id"]: d for d in destinations}

    allocations = []
    total_allocated = 0.0
    for item in allocation_result:
        did   = item["destination_id"]
        alloc = item["allocated_t"]
        dest  = dest_lookup.get(did, {})
        cost  = round(alloc * dest.get("effective_cost_per_t", 0.0), 2)
        allocations.append({
            "destination_id":      did,
            "destination_type":    dest.get("destination_type", "unknown"),
            "allocated_t":         alloc,
            "route_id":            dest.get("route_id", ""),
            "transport_cost_total": cost,
            "feasible":            True,  # preliminary; validator will update
        })
        total_allocated += alloc

    unallocated_t = round(max(0.0, surplus_t - total_allocated), 1)

    return {
        "plan_id":              str(uuid.uuid4()),
        "glut_risk_pct":        glut_risk,
        "surplus_t":            surplus_t,
        "allocations":          allocations,
        "unallocated_t":        unallocated_t,
        "coordinator_reasoning": None,
        "fallback_used":        fallback_used,
        "validation_errors":    [],
    }
