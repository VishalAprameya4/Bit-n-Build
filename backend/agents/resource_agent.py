"""
agents/resource_agent.py
Resource Agent: Inspects available cold storage, food processing plants, and freight routes.

Responsibility:
- Pure deterministic lookup and validation of resource availability.
- No LLM required (exact operational truth from database and overrides).
- Emits structured AgentFinding and UI trace events.
"""
from typing import Any
from agents.base import AgentFinding, make_event
import database as db
from config import DEFAULT_PRIMARY_MARKET, DEFAULT_COMMODITY


def resource_lookup_tool(
    snapshot: dict[str, Any], overrides: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Deterministic tool querying storage, processors, and logistics routes
    incorporating any in-memory shadow overrides.
    """
    overrides = overrides or {}
    stor_ovr = overrides.get("storage_facilities", {})
    proc_ovr = overrides.get("processors", {})
    mkt_ovr = overrides.get("markets", {})
    route_ovr = overrides.get("logistics_routes", {})
    primary_id = snapshot.get("primary_market_id", DEFAULT_PRIMARY_MARKET)
    commodity = snapshot.get("commodity", DEFAULT_COMMODITY)

    # 1. Active Storage
    storage_rows = db.query_all("SELECT * FROM storage_facilities WHERE is_active = 1")
    available_storage: list[dict[str, Any]] = []
    total_storage_t = 0.0
    for s in storage_rows:
        fid = s["facility_id"]
        avail = stor_ovr.get(fid, {}).get("available_t", s["available_t"])
        is_active = stor_ovr.get(fid, {}).get("is_active", s["is_active"])
        if is_active and avail > 0:
            available_storage.append({
                "facility_id": fid,
                "name": s["name"],
                "available_t": avail,
                "holding_cost_per_t": s["holding_cost_per_t"],
            })
            total_storage_t += avail

    # 2. Active Processors
    proc_rows = db.query_all(
        "SELECT * FROM processors WHERE is_active = 1 AND commodity = ?", (commodity,)
    )
    available_processors: list[dict[str, Any]] = []
    total_proc_t = 0.0
    for p in proc_rows:
        pid = p["processor_id"]
        cap = proc_ovr.get(pid, {}).get("capacity_t", p["capacity_t"])
        is_active = proc_ovr.get(pid, {}).get("is_active", p["is_active"])
        if is_active and cap > 0:
            available_processors.append({
                "processor_id": pid,
                "name": p["name"],
                "capacity_t": cap,
            })
            total_proc_t += cap

    # 3. Alternative Markets
    mkt_rows = db.query_all("SELECT * FROM markets WHERE is_active = 1 AND market_id != ?", (primary_id,))
    available_markets: list[dict[str, Any]] = []
    total_mkt_t = 0.0
    for m in mkt_rows:
        mid = m["market_id"]
        cap = mkt_ovr.get(mid, {}).get("capacity_t", m["capacity_t"])
        load = mkt_ovr.get(mid, {}).get("current_load_t", m["current_load_t"])
        is_active = mkt_ovr.get(mid, {}).get("is_active", m["is_active"])
        avail = max(0.0, cap - load)
        if is_active and avail > 0:
            available_markets.append({
                "market_id": mid,
                "name": m["name"],
                "available_t": avail,
            })
            total_mkt_t += avail

    # 4. Logistics Constraints
    routes = db.query_all("SELECT * FROM logistics_routes WHERE origin_id = ?", (primary_id,))
    constraints_list: list[dict[str, Any]] = []
    for r in routes:
        rid = r["route_id"]
        trucks = route_ovr.get(rid, {}).get("available_trucks", r["available_trucks"])
        multiplier = route_ovr.get(rid, {}).get("cost_multiplier", r["cost_multiplier"])
        max_t = trucks * r["truck_capacity_t"]
        effective_cost = r["base_cost_per_t"] * multiplier
        constraints_list.append({
            "route_id": rid,
            "destination_id": r["destination_id"],
            "max_t": max_t,
            "effective_cost_per_t": effective_cost,
        })

    total_redirect_capacity_t = total_storage_t + total_proc_t + total_mkt_t

    return {
        "storage_available_t": total_storage_t,
        "processor_available_t": total_proc_t,
        "market_alternative_available_t": total_mkt_t,
        "total_redirect_capacity_t": total_redirect_capacity_t,
        "available_storage": available_storage,
        "available_processors": available_processors,
        "available_markets": available_markets,
        "logistics_constraints": constraints_list,
    }


class ResourceAgent:
    name = "Resource Agent"

    def analyze(
        self, snapshot: dict[str, Any], overrides: dict[str, Any] | None = None
    ) -> AgentFinding:
        events: list[dict[str, Any]] = []

        events.append(
            make_event(
                agent=self.name,
                action="INSPECT_RESOURCES",
                status="running",
                summary="Enumerating available cold storage, active processors, and freight capacity...",
                tool="resource_lookup_tool",
                reason="Determine total regional absorption headroom and route truck constraints.",
                next_action="SUMMARIZE_REDIRECT_CAPACITY",
            )
        )

        res = resource_lookup_tool(snapshot, overrides)
        storage_t = res["storage_available_t"]
        proc_t = res["processor_available_t"]
        mkt_t = res["market_alternative_available_t"]
        total_t = res["total_redirect_capacity_t"]
        surplus_t = snapshot.get("surplus_t", 0.0)

        is_capacity_deficit = total_t < surplus_t
        severity = "critical" if is_capacity_deficit else "low"

        events.append(
            make_event(
                agent=self.name,
                action="INSPECT_RESOURCES",
                status="complete",
                summary=(
                    f"Identified {total_t:.0f}T total redirect capacity "
                    f"({storage_t:.0f}T storage, {proc_t:.0f}T processing, {mkt_t:.0f}T secondary mandis)."
                ),
                tool="resource_lookup_tool",
                reason=f"Total capacity ({total_t:.0f}T) {'exceeds' if not is_capacity_deficit else 'falls short of'} surplus ({surplus_t:.0f}T).",
                next_action="EMIT_FINDING",
            )
        )

        recommendation = (
            f"Sufficient redirect capacity available ({total_t:.0f}T vs surplus {surplus_t:.0f}T). "
            f"Multi-channel routing across cold storage ({storage_t:.0f}T), processors ({proc_t:.0f}T), "
            f"and secondary mandis ({mkt_t:.0f}T) is feasible."
            if not is_capacity_deficit
            else (
                f"Capacity shortage: total redirect capacity of {total_t:.0f}T is less than "
                f"surplus of {surplus_t:.0f}T ({surplus_t - total_t:.0f}T unallocatable)."
            )
        )

        constraints: list[str] = [
            f"Cold storage limit: {storage_t:.0f}T",
            f"Processing limit: {proc_t:.0f}T",
            f"Alternative markets limit: {mkt_t:.0f}T",
        ]

        return AgentFinding(
            agent="resource",
            anomaly_detected=is_capacity_deficit,
            severity=severity,
            key_metrics=res,
            recommendation=recommendation,
            constraints=constraints,
            tool_events=events,
        )
