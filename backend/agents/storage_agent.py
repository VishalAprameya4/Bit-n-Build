"""
backend/agents/storage_agent.py
Storage & Processing Facility Agent: Provides operational capacity, temperature suitability, and logistics routing.

Note:
  Operational storage capacity is simulated deterministically for the hackathon MVP.
  source_status is explicitly flagged as "simulation".
"""
from typing import Any
import database as db
from agents.base import AgentFinding, make_event
from config import DEFAULT_PRIMARY_MARKET, DEFAULT_COMMODITY


class StorageAgent:
    name = "Storage & Facility Agent"

    def __init__(self):
        pass

    def get_facilities_status(
        self, snapshot: dict[str, Any] | None = None, overrides: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Return structured state of all cold storages, processing facilities, and secondary mandis.
        All capacities and statuses are transparently tagged with source_status='simulation'.
        """
        overrides = overrides or {}
        stor_ovr = overrides.get("storage_facilities", {})
        proc_ovr = overrides.get("processors", {})
        mkt_ovr = overrides.get("markets", {})
        primary_id = (snapshot or {}).get("primary_market_id", DEFAULT_PRIMARY_MARKET)
        commodity = (snapshot or {}).get("commodity", DEFAULT_COMMODITY)

        # 1. Cold Storage Facilities
        storage_rows = db.query_all("SELECT * FROM storage_facilities")
        storage_facilities = []
        total_storage_avail = 0.0
        for s in storage_rows:
            fid = s["facility_id"]
            avail = stor_ovr.get(fid, {}).get("available_t", s["available_t"])
            active = stor_ovr.get(fid, {}).get("is_active", s["is_active"])
            storage_facilities.append({
                "facility_id": fid,
                "name": s["name"],
                "total_capacity_t": s["capacity_t"],
                "available_capacity_t": avail if active else 0.0,
                "holding_cost_per_t": s["holding_cost_per_t"],
                "suitability": "Cold Chain Grade A (Tomatoes 8-12°C)",
                "is_active": bool(active),
                "source_status": "simulation",
            })
            if active:
                total_storage_avail += avail

        # 2. Processing Plants
        proc_rows = db.query_all("SELECT * FROM processors WHERE commodity = ?", (commodity,))
        processors = []
        total_proc_avail = 0.0
        for p in proc_rows:
            pid = p["processor_id"]
            cap = proc_ovr.get(pid, {}).get("capacity_t", p["capacity_t"])
            active = proc_ovr.get(pid, {}).get("is_active", p["is_active"])
            processors.append({
                "processor_id": pid,
                "name": p["name"],
                "capacity_t": cap,
                "available_capacity_t": cap if active else 0.0,
                "product_type": "Tomato Paste / Canning",
                "is_active": bool(active),
                "source_status": "simulation",
            })
            if active:
                total_proc_avail += cap

        # 3. Secondary Markets
        mkt_rows = db.query_all("SELECT * FROM markets WHERE market_id != ?", (primary_id,))
        alternative_markets = []
        total_mkt_avail = 0.0
        for m in mkt_rows:
            mid = m["market_id"]
            cap = mkt_ovr.get(mid, {}).get("capacity_t", m["capacity_t"])
            load = mkt_ovr.get(mid, {}).get("current_load_t", m["current_load_t"])
            active = mkt_ovr.get(mid, {}).get("is_active", m["is_active"])
            avail = max(0.0, cap - load) if active else 0.0
            alternative_markets.append({
                "market_id": mid,
                "name": m["name"],
                "capacity_t": cap,
                "current_load_t": load,
                "available_capacity_t": avail,
                "is_active": bool(active),
                "source_status": "simulation",
            })
            total_mkt_avail += avail

        return {
            "total_available_capacity_t": total_storage_avail + total_proc_avail + total_mkt_avail,
            "storage_available_t": total_storage_avail,
            "processor_available_t": total_proc_avail,
            "market_available_t": total_mkt_avail,
            "storage_facilities": storage_facilities,
            "processors": processors,
            "alternative_markets": alternative_markets,
            "source_status": "simulation",
            "freshness": "operational_database",
        }

    def analyze(
        self, snapshot: dict[str, Any], overrides: dict[str, Any] | None = None
    ) -> AgentFinding:
        events: list[dict[str, Any]] = []

        events.append(
            make_event(
                agent=self.name,
                action="CHECK_STORAGE_CAPACITY",
                status="running",
                summary="Querying regional cold chain warehouses, pulp processors, and secondary mandi berths...",
                tool="facility_inventory_tool",
                reason="Assess physical destination headroom for surplus absorption.",
                next_action="SUMMARIZE_STORAGE_STATUS",
            )
        )

        res = self.get_facilities_status(snapshot, overrides)
        total_t = res["total_available_capacity_t"]
        storage_t = res["storage_available_t"]
        proc_t = res["processor_available_t"]
        mkt_t = res["market_available_t"]
        surplus_t = snapshot.get("surplus_t", 0.0)

        is_capacity_deficit = total_t < surplus_t

        events.append(
            make_event(
                agent=self.name,
                action="CHECK_STORAGE_CAPACITY",
                status="complete",
                summary=(
                    f"Storage & Facility check: {total_t:.0f}T total redirect headroom verified "
                    f"({storage_t:.0f}T cold storage, {proc_t:.0f}T processing, {mkt_t:.0f}T secondary mandis) [source: simulation]."
                ),
                tool="facility_inventory_tool",
                reason=f"Capacity of {total_t:.0f}T {'sufficient' if not is_capacity_deficit else 'insufficient'} for surplus of {surplus_t:.0f}T.",
                next_action="EMIT_FINDING",
            )
        )

        return AgentFinding(
            agent="storage",
            anomaly_detected=is_capacity_deficit,
            severity="critical" if is_capacity_deficit else "low",
            key_metrics=res,
            recommendation=(
                f"Sufficient regional facility headroom ({total_t:.0f}T vs {surplus_t:.0f}T surplus). Ready for multi-channel allocation."
                if not is_capacity_deficit
                else f"Deficit: available facilities can only take {total_t:.0f}T of {surplus_t:.0f}T surplus."
            ),
            constraints=[
                f"Cold storage capacity: {storage_t:.0f}T",
                f"Processor throughput: {proc_t:.0f}T",
                f"Secondary mandi headroom: {mkt_t:.0f}T",
            ],
            tool_events=events,
        )
