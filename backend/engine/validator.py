"""
engine/validator.py
Independent constraint validation of an AllocationPlan.

Public API
----------
validate(plan: dict, snapshot: dict, overrides: dict) -> dict
    Returns a new plan dict with each allocation's `feasible` flag updated
    and `validation_errors` populated.
"""
import database as db
from config import DEFAULT_COMMODITY, VALIDATION_MIN_COVER_FRAC


def _get_dest_capacity(dest_id: str, dest_type: str, overrides: dict) -> float | None:
    """Return effective available capacity for a given destination."""
    if dest_type == "market":
        ovr = overrides.get("markets", {}).get(dest_id, {})
        row = db.query_one("SELECT * FROM markets WHERE market_id = ?", (dest_id,))
        if not row:
            return None
        capacity  = ovr.get("capacity_t",      row["capacity_t"])
        load      = ovr.get("current_load_t",  row["current_load_t"])
        return max(0.0, capacity - load)

    if dest_type == "storage":
        ovr = overrides.get("storage_facilities", {}).get(dest_id, {})
        row = db.query_one("SELECT * FROM storage_facilities WHERE facility_id = ?", (dest_id,))
        if not row:
            return None
        return max(0.0, ovr.get("available_t", row["available_t"]))

    if dest_type == "processor":
        ovr = overrides.get("processors", {}).get(dest_id, {})
        row = db.query_one("SELECT * FROM processors WHERE processor_id = ?", (dest_id,))
        if not row:
            return None
        return max(0.0, ovr.get("capacity_t", row["capacity_t"]))

    return None


def _get_route(origin_id: str, dest_id: str, overrides: dict) -> dict | None:
    """Return the route dict for origin → dest, with overrides applied."""
    route_id = f"{origin_id}_{dest_id}"
    row = db.query_one("SELECT * FROM logistics_routes WHERE route_id = ?", (route_id,))
    if not row:
        # Also try querying by origin + destination columns
        row = db.query_one(
            "SELECT * FROM logistics_routes WHERE origin_id = ? AND destination_id = ?",
            (origin_id, dest_id),
        )
    if not row:
        return None

    r = dict(row)
    ovr = overrides.get("logistics_routes", {}).get(r["route_id"], {})
    for k, v in ovr.items():
        r[k] = v
    return r


def _is_dest_active(dest_id: str, dest_type: str, overrides: dict) -> bool:
    """Check if a destination is still active (considering overrides)."""
    if dest_type == "market":
        ovr = overrides.get("markets", {}).get(dest_id, {})
        row = db.query_one("SELECT is_active FROM markets WHERE market_id = ?", (dest_id,))
        if not row:
            return False
        return bool(ovr.get("is_active", row["is_active"]))

    if dest_type == "storage":
        ovr = overrides.get("storage_facilities", {}).get(dest_id, {})
        row = db.query_one(
            "SELECT is_active FROM storage_facilities WHERE facility_id = ?", (dest_id,)
        )
        if not row:
            return False
        return bool(ovr.get("is_active", row["is_active"]))

    if dest_type == "processor":
        ovr = overrides.get("processors", {}).get(dest_id, {})
        row = db.query_one(
            "SELECT is_active FROM processors WHERE processor_id = ?", (dest_id,)
        )
        if not row:
            return False
        return bool(ovr.get("is_active", row["is_active"]))

    return False


def _commodity_matches(dest_id: str, commodity: str) -> bool:
    """Processors must handle the commodity being allocated."""
    row = db.query_one(
        "SELECT commodity FROM processors WHERE processor_id = ?", (dest_id,)
    )
    if not row:
        return True  # not a processor — no commodity constraint
    return row["commodity"].lower() == commodity.lower()


def validate(
    plan: dict,
    snapshot: dict,
    overrides: dict | None = None,
) -> dict:
    """
    Validate every allocation in `plan` against physical constraints.

    Checks (per allocation):
      1. Destination is active.
      2. allocated_t <= destination available capacity.
      3. A route exists from the primary market to the destination.
      4. Route has sufficient truck capacity.
      5. Processor commodity compatibility.
      6. Recalculate transport_cost_total deterministically.

    Updates plan['allocations'][i]['feasible'] and plan['validation_errors'].
    Also triggers greedy re-allocation for infeasible items (if needed).
    """
    import importlib
    optimizer = importlib.import_module("engine.optimizer")

    overrides = overrides or {}
    commodity  = snapshot.get("commodity", DEFAULT_COMMODITY)
    primary    = snapshot.get("primary_market_id", "KOLAR")
    surplus_t  = plan.get("surplus_t", 0.0)

    errors: list[str] = []
    validated_allocations: list[dict] = []
    feasible_total = 0.0

    for alloc in plan.get("allocations", []):
        alloc = dict(alloc)  # copy
        did   = alloc["destination_id"]
        dtype = alloc["destination_type"]
        amt   = alloc["allocated_t"]
        errs  = []

        # Check 1: active
        if not _is_dest_active(did, dtype, overrides):
            errs.append(f"{did}: destination is inactive")

        # Check 2: capacity
        cap = _get_dest_capacity(did, dtype, overrides)
        if cap is None:
            errs.append(f"{did}: destination not found in DB")
        elif amt > cap + 0.01:  # allow 0.01T floating-point tolerance
            errs.append(f"{did}: allocated {amt}T exceeds available {cap:.1f}T")

        # Check 3 & 4: route existence and truck capacity
        route = _get_route(primary, did, overrides)
        if route is None:
            errs.append(f"{did}: no route found from {primary}")
        else:
            max_route_t = route["available_trucks"] * route["truck_capacity_t"]
            if amt > max_route_t + 0.01:
                errs.append(
                    f"{did}: route capacity {max_route_t}T insufficient for {amt}T"
                )
            # Check 6: recalculate cost
            eff_cost = route["base_cost_per_t"] * route["cost_multiplier"]
            alloc["transport_cost_total"] = round(amt * eff_cost, 2)

        # Check 5: commodity compatibility
        if dtype == "processor" and not _commodity_matches(did, commodity):
            errs.append(f"{did}: processor commodity mismatch for '{commodity}'")

        if errs:
            alloc["feasible"] = False
            errors.extend(errs)
        else:
            alloc["feasible"] = True
            feasible_total += amt

        validated_allocations.append(alloc)

    plan["allocations"]      = validated_allocations
    plan["validation_errors"] = errors

    # Recalculate unallocated
    plan["unallocated_t"] = round(max(0.0, surplus_t - feasible_total), 1)

    plan["total_transport_cost"] = round(
        sum(a.get("transport_cost_total", 0.0) for a in validated_allocations if a.get("feasible", True)), 2
    )

    return plan
