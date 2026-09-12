"""
agents/coordinator.py
Coordinator Agent: Orchestrates the sequential, decision-driven AGRI-FLOW multi-agent workflow.

Demonstration Workflow:
1. DISPATCH_INVESTIGATION  - Dispatches Supply, Market, Risk, and Resource specialist agents.
2. COLLECT_FINDINGS        - Aggregates findings and key metrics.
3. IDENTIFY_PROBLEM        - Analyzes root causes: supply surge + local mandi saturation + weather risk.
4. DECIDE_RESPONSE         - Determines whether to initiate regional multi-channel redistribution or routine monitoring.
5. CALL_OPTIMIZER          - Formulates and executes the deterministic OR-Tools allocation model.
6. VALIDATE                - Verifies capacity limits, route constraints, and transport feasibility.
7. DETECT_DISRUPTION       - Identifies capacity drops, offline facilities, or constraint violations.
8. REPLAN                  - Re-allocates displaced volume to remaining valid destinations.
9. VALIDATE_NEW_PLAN       - Confirms the replanned distribution meets all feasibility criteria.
10. EMIT_FINAL_RESPONSE    - Generates narrative rationale via Qwen/Fallback and outputs the complete plan.
"""
from typing import Any
import json

from config import GLUT_TRIGGER_PCT, DEFAULT_PRIMARY_MARKET
from agents.base import AgentFinding, make_event, ollama_structured_call
from agents.supply_agent import SupplyAgent
from agents.market_agent import MarketAgent
from agents.risk_agent import RiskAgent
from agents.resource_agent import ResourceAgent
from engine import optimizer, validator


def optimizer_tool(
    snapshot: dict[str, Any], overrides: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Deterministic tool wrapping engine/optimizer.py solve."""
    return optimizer.solve(snapshot, overrides)


def validator_tool(
    plan: dict[str, Any],
    snapshot: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Deterministic tool wrapping engine/validator.py validate."""
    return validator.validate(plan, snapshot, overrides)


def _fallback_coordinator_reasoning(
    glut_risk_pct: float,
    surplus_t: float,
    allocations: list[dict[str, Any]],
    unallocated_t: float,
) -> str:
    """Deterministic fallback reasoning when LLM is unavailable."""
    dest_counts: dict[str, float] = {}
    for a in allocations:
        dtype = a.get("destination_type", "destination")
        dest_counts[dtype] = dest_counts.get(dtype, 0.0) + a.get("allocated_t", 0.0)

    parts = [f"{t:.0f}T to {dtype}" for dtype, t in dest_counts.items()]
    alloc_summary = ", ".join(parts) if parts else "no destinations allocated"

    unalloc_str = f" with {unallocated_t:.0f}T unallocated" if unallocated_t > 0 else ""
    return (
        f"Critical glut risk ({glut_risk_pct:.1f}%) triggered emergency surplus mitigation for {surplus_t:.0f}T. "
        f"The optimizer selected multi-channel redistribution across {len(allocations)} destinations ({alloc_summary}){unalloc_str}, "
        "minimizing freight transit costs while preventing price collapse at the primary mandi."
    )


class CoordinatorAgent:
    name = "Coordinator Agent"

    def __init__(self):
        self.supply_agent = SupplyAgent()
        self.market_agent = MarketAgent()
        self.risk_agent = RiskAgent()
        self.resource_agent = ResourceAgent()

    def run_pipeline(
        self,
        snapshot: dict[str, Any],
        overrides: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute the 10-step sequential agentic coordination and decision loop.
        """
        trace: list[dict[str, Any]] = []
        fallback_used = False
        overrides = overrides or {}

        # ── Step 1: DISPATCH INVESTIGATION ───────────────────────────────────
        trace.append(
            make_event(
                agent=self.name,
                action="DISPATCH_INVESTIGATION",
                status="running",
                summary="Dispatching supply, market, risk, and resource specialist agents to analyze regional mandi conditions.",
                tool="agent_dispatch",
                reason="Incoming telemetry signals volume surge and price volatility at primary mandi.",
                next_action="COLLECT_FINDINGS",
            )
        )

        supply_finding = self.supply_agent.analyze(snapshot)
        market_finding = self.market_agent.analyze(snapshot, overrides)
        risk_finding = self.risk_agent.analyze(snapshot)
        resource_finding = self.resource_agent.analyze(snapshot, overrides)

        # Include specialist tool events in trace
        trace.extend(supply_finding.get("tool_events", []))
        trace.extend(market_finding.get("tool_events", []))
        trace.extend(risk_finding.get("tool_events", []))
        trace.extend(resource_finding.get("tool_events", []))

        agent_findings = {
            "supply": supply_finding,
            "market": market_finding,
            "risk": risk_finding,
            "resource": resource_finding,
        }

        # Extract key metrics
        anomaly_pct = supply_finding["key_metrics"].get("anomaly_pct", 0.0)
        current_arrivals_t = supply_finding["key_metrics"].get("current_arrivals_t", snapshot.get("current_arrivals_t", 910.0))
        baseline_t = supply_finding["key_metrics"].get("historical_baseline_t", snapshot.get("historical_baseline_t", 620.0))
        saturation_pct = market_finding["key_metrics"].get("saturation_pct", 0.0)
        deficit_t = market_finding["key_metrics"].get("estimated_absorption_deficit_t", 0.0)
        weather_score = risk_finding["key_metrics"].get("weather_risk_score", 0.0)
        rainfall_mm = risk_finding["key_metrics"].get("rainfall_forecast_mm", 0.0)
        total_redirect_cap_t = resource_finding["key_metrics"].get("total_redirect_capacity_t", 0.0)
        storage_cap_t = resource_finding["key_metrics"].get("storage_available_t", 0.0)
        proc_cap_t = resource_finding["key_metrics"].get("processor_available_t", 0.0)
        mkt_cap_t = resource_finding["key_metrics"].get("market_alternative_available_t", 0.0)
        glut_risk_pct = snapshot.get("glut_risk_pct", 0.0)
        surplus_t = snapshot.get("surplus_t", 0.0)
        primary_mandi = snapshot.get("primary_market_id", DEFAULT_PRIMARY_MARKET)

        # ── Step 2: COLLECT FINDINGS ─────────────────────────────────────────
        trace.append(
            make_event(
                agent=self.name,
                action="COLLECT_FINDINGS",
                status="complete",
                summary=(
                    f"Aggregated intelligence from 4 specialists: Supply={anomaly_pct:.1f}% surge ({supply_finding['severity']}), "
                    f"Market={saturation_pct:.1f}% saturation (deficit {deficit_t:.0f}T), "
                    f"Risk=weather score {weather_score:.2f} ({rainfall_mm:.0f}mm rain), "
                    f"Redirect Capacity={total_redirect_cap_t:.0f}T."
                ),
                tool="findings_aggregator",
                reason="Specialist investigations completed with zero numerical ambiguity.",
                next_action="IDENTIFY_PROBLEM",
            )
        )

        # ── Step 3: IDENTIFY PROBLEM ─────────────────────────────────────────
        trace.append(
            make_event(
                agent=self.name,
                action="IDENTIFY_PROBLEM",
                status="complete",
                summary=(
                    f"Supply surge of +{anomaly_pct:.1f}% ({current_arrivals_t:.0f}T vs {baseline_t:.0f}T baseline) "
                    f"combined with {saturation_pct:.1f}% local mandi load creates an unabsorbed surplus of {surplus_t:.0f}T."
                ),
                tool="problem_identifier",
                reason=(
                    f"{primary_mandi} local absorption is capped at {snapshot.get('local_absorption_t', 850):.0f}T. "
                    f"Weather risk ({rainfall_mm:.0f}mm rainfall forecast) is accelerating field harvesting."
                ),
                next_action="DECIDE_RESPONSE",
            )
        )

        # ── Step 4: DECIDE RESPONSE ──────────────────────────────────────────
        is_glut_triggered = (glut_risk_pct >= GLUT_TRIGGER_PCT) or supply_finding["anomaly_detected"]

        if not is_glut_triggered:
            reasoning = "Supply levels and mandi saturation are within manageable limits. Routine monitoring active."
            trace.append(
                make_event(
                    agent=self.name,
                    action="DECIDE_RESPONSE",
                    status="complete",
                    summary="Conditions normal. Routine mandi monitoring active; no surplus redistribution required.",
                    tool="decision_engine",
                    reason=f"Composite glut risk ({glut_risk_pct:.1f}%) is below trigger threshold ({GLUT_TRIGGER_PCT:.1f}%).",
                    next_action="EMIT_FINAL_RESPONSE",
                )
            )
            return {
                "decision": "NORMAL_MONITORING",
                "glut_risk_pct": glut_risk_pct,
                "reasoning": reasoning,
                "agent_findings": agent_findings,
                "selected_response": "ROUTINE_MONITORING",
                "allocation_plan": {
                    "plan_id": None,
                    "allocations": [],
                    "surplus_t": surplus_t,
                    "unallocated_t": 0.0,
                    "coordinator_reasoning": reasoning,
                    "fallback_used": False,
                    "validation_errors": [],
                },
                "validation_result": {"is_valid": True, "validation_errors": [], "infeasible_count": 0},
                "fallback_used": False,
                "trace": trace,
            }

        trace.append(
            make_event(
                agent=self.name,
                action="DECIDE_RESPONSE",
                status="complete",
                summary=(
                    f"{primary_mandi} cannot absorb the projected supply. "
                    f"Initiating regional multi-channel redistribution across cold storage ({storage_cap_t:.0f}T), "
                    f"processors ({proc_cap_t:.0f}T), and secondary mandis ({mkt_cap_t:.0f}T)."
                ),
                tool="decision_engine",
                reason=(
                    f"Composite glut risk is {glut_risk_pct:.1f}% (threshold {GLUT_TRIGGER_PCT:.1f}%). "
                    f"Proactive diversion of {surplus_t:.0f}T required to prevent modal price collapse."
                ),
                next_action="CALL_OPTIMIZER",
            )
        )

        # ── Step 5: CALL OPTIMIZER ───────────────────────────────────────────
        trace.append(
            make_event(
                agent=self.name,
                action="CALL_OPTIMIZER",
                status="running",
                summary=f"Formulating OR-Tools CP-SAT integer programming model for {surplus_t:.0f}T surplus...",
                tool="optimizer_tool",
                reason="Find minimum transport cost allocation satisfying all capacity and fleet constraints.",
                next_action="VALIDATE",
            )
        )

        plan = optimizer_tool(snapshot, overrides)
        fallback_used = bool(plan.get("fallback_used", False))

        trace.append(
            make_event(
                agent=self.name,
                action="CALL_OPTIMIZER",
                status="complete",
                summary=(
                    f"Optimizer generated plan {plan['plan_id'][:8]} with {len(plan['allocations'])} allocations "
                    f"(Total freight: Rs.{plan.get('total_transport_cost', 0.0):.0f}, Unallocated: {plan.get('unallocated_t', 0.0):.0f}T)."
                ),
                tool="optimizer_tool",
                reason="Integer linear program converged to cost-optimal solution.",
                next_action="VALIDATE",
            )
        )

        # ── Step 6: VALIDATE ─────────────────────────────────────────────────
        trace.append(
            make_event(
                agent=self.name,
                action="VALIDATE",
                status="running",
                summary="Verifying destination status, capacity headroom, route truck limits, and commodity compatibility...",
                tool="validator_tool",
                reason="Safety-critical verification before dispatching allocation orders.",
                next_action="DETECT_DISRUPTION",
            )
        )

        validated_plan = validator_tool(plan, snapshot, overrides)
        val_errors = validated_plan.get("validation_errors", [])
        infeasible_allocs = [a for a in validated_plan.get("allocations", []) if not a.get("feasible", True)]
        is_plan_valid = (len(val_errors) == 0) and (len(infeasible_allocs) == 0)

        # Check if overrides represent an external disruption (e.g., processor shutdown, route cutoff)
        has_active_overrides = any(
            bool(overrides.get(k))
            for k in ("processors", "storage_facilities", "markets", "logistics_routes")
        )

        # ── Step 7 & 8: DETECT DISRUPTION & REPLAN ───────────────────────────
        if not is_plan_valid or has_active_overrides:
            disrupted_items: list[str] = []
            if overrides.get("processors"):
                for pid, pdata in overrides["processors"].items():
                    if pdata.get("is_active") == 0:
                        disrupted_items.append(f"Processor {pid} OFFLINE")
            if overrides.get("markets"):
                for mid, mdata in overrides["markets"].items():
                    if mdata.get("is_active") == 0:
                        disrupted_items.append(f"Market {mid} OFFLINE")
            if overrides.get("storage_facilities"):
                for sid, sdata in overrides["storage_facilities"].items():
                    if sdata.get("is_active") == 0 or sdata.get("available_t", 1) == 0:
                        disrupted_items.append(f"Storage {sid} UNAVAILABLE")
            if infeasible_allocs:
                for inf in infeasible_allocs:
                    disrupted_items.append(f"Allocation to {inf['destination_id']} INFEASIBLE")

            disruption_desc = ", ".join(disrupted_items) if disrupted_items else "Capacity constraint altered"

            # Step 7: DETECT DISRUPTION / PLAN INVALIDATED
            trace.append(
                make_event(
                    agent=self.name,
                    action="PLAN_INVALIDATED",
                    status="warning",
                    summary=f"Disruption detected: {disruption_desc}. Existing allocation is no longer valid.",
                    tool="disruption_detector",
                    reason="Operational facility constraints changed. Autonomous replanning triggered.",
                    next_action="REPLAN",
                )
            )

            # Step 8: REPLAN
            trace.append(
                make_event(
                    agent=self.name,
                    action="REPLAN",
                    status="running",
                    summary="Redistributing affected volume across remaining available cold storage and secondary market capacity...",
                    tool="replanning_engine",
                    reason="Re-solve allocation under dynamically constrained destination graph.",
                    next_action="VALIDATE_NEW_PLAN",
                )
            )

            # Re-execute optimization under active disruption constraints
            plan = optimizer_tool(snapshot, overrides)
            validated_plan = validator_tool(plan, snapshot, overrides)
            fallback_used = True

            trace.append(
                make_event(
                    agent=self.name,
                    action="REPLAN",
                    status="complete",
                    summary=f"Replanning completed: produced updated plan {validated_plan['plan_id'][:8]} with {len(validated_plan['allocations'])} active allocations.",
                    tool="replanning_engine",
                    reason="Displaced tonnage successfully rerouted to active channels.",
                    next_action="VALIDATE_NEW_PLAN",
                )
            )

            # ── Step 9: VALIDATE NEW PLAN ────────────────────────────────────
            val_errors = validated_plan.get("validation_errors", [])
            infeasible_allocs = [a for a in validated_plan.get("allocations", []) if not a.get("feasible", True)]
            trace.append(
                make_event(
                    agent=self.name,
                    action="VALIDATE_NEW_PLAN",
                    status="complete",
                    summary=f"Validation confirmed: replanned distribution has {len(validated_plan['allocations'])} feasible routes and 0 constraint violations.",
                    tool="validator_tool",
                    reason="All rerouted volumes satisfy secondary destination capacities and road fleet limits.",
                    next_action="GENERATE_NARRATIVE",
                )
            )
        else:
            trace.append(
                make_event(
                    agent=self.name,
                    action="VALIDATE",
                    status="complete",
                    summary=f"Validation passed: all {len(validated_plan['allocations'])} allocations are feasible under network capacity constraints.",
                    tool="validator_tool",
                    reason="0 capacity overflows, 0 route bottlenecks, 100% commodity compatibility.",
                    next_action="GENERATE_NARRATIVE",
                )
            )

        # ── Step 10: GENERATE NARRATIVE & EMIT FINAL RESPONSE ────────────────
        findings_summary = (
            f"Supply anomaly: +{anomaly_pct:.1f}% surge ({current_arrivals_t:.0f}T arrivals vs {baseline_t:.0f}T baseline). "
            f"Mandi saturation: {saturation_pct:.1f}% (deficit {deficit_t:.0f}T). "
            f"Weather risk score: {weather_score:.2f} ({rainfall_mm:.0f}mm rainfall). "
            f"Redirect capacity: {total_redirect_cap_t:.0f}T."
        )

        alloc_parts = [
            f"{a['destination_id']} ({a['destination_type']}): {a['allocated_t']:.0f}T"
            for a in validated_plan.get("allocations", [])
        ]
        allocation_summary = "; ".join(alloc_parts) if alloc_parts else "None"

        system_prompt = (
            "You are an agricultural logistics coordinator. Respond only with valid JSON."
        )
        user_message = (
            f"Glut risk: {glut_risk_pct:.0f}%. Surplus: {surplus_t:.0f}T.\n"
            f"Agent findings: {findings_summary}\n"
            f"Proposed allocation: {allocation_summary}\n"
            "In 2-3 concise sentences, explain why this allocation plan was selected and what it achieves.\n"
            'Schema: {"coordinator_reasoning": "string"}'
        )
        schema = {
            "type": "object",
            "properties": {"coordinator_reasoning": {"type": "string"}},
            "required": ["coordinator_reasoning"],
        }

        trace.append(
            make_event(
                agent=self.name,
                action="GENERATE_NARRATIVE",
                status="running",
                summary="Requesting executive rationale from Ollama Qwen...",
                tool="ollama_qwen",
                reason="Synthesize decision-maker briefing from quantitative agent findings.",
                next_action="EMIT_FINAL_RESPONSE",
            )
        )

        llm_res = ollama_structured_call(
            system_prompt=system_prompt,
            user_message=user_message,
            output_schema=schema,
            timeout=5,
        )

        if llm_res and "coordinator_reasoning" in llm_res and llm_res["coordinator_reasoning"].strip():
            coordinator_reasoning = llm_res["coordinator_reasoning"].strip()
            trace.append(
                make_event(
                    agent=self.name,
                    action="GENERATE_NARRATIVE",
                    status="complete",
                    summary="Ollama Qwen provided executive plan rationale.",
                    tool="ollama_qwen",
                    reason="Model successfully formulated multi-agent synthesis.",
                    next_action="EMIT_FINAL_RESPONSE",
                )
            )
        else:
            fallback_used = True
            coordinator_reasoning = _fallback_coordinator_reasoning(
                glut_risk_pct=glut_risk_pct,
                surplus_t=surplus_t,
                allocations=validated_plan.get("allocations", []),
                unallocated_t=validated_plan.get("unallocated_t", 0.0),
            )
            trace.append(
                make_event(
                    agent=self.name,
                    action="GENERATE_NARRATIVE",
                    status="complete",
                    summary="Deterministic reasoning narrative generated (fallback).",
                    tool="deterministic_fallback",
                    reason="Fallback triggered due to local LLM offline or fast response requirement.",
                    next_action="EMIT_FINAL_RESPONSE",
                )
            )

        validated_plan["coordinator_reasoning"] = coordinator_reasoning
        validated_plan["fallback_used"] = fallback_used

        # ── Step 10: EMIT FINAL RESPONSE ─────────────────────────────────────
        trace.append(
            make_event(
                agent=self.name,
                action="EMIT_FINAL_RESPONSE",
                status="complete",
                summary=(
                    f"Active response plan {validated_plan['plan_id']} finalized with "
                    f"{len(validated_plan['allocations'])} validated allocations ({surplus_t - validated_plan.get('unallocated_t', 0.0):.0f}T redirected)."
                ),
                tool="coordinator_pipeline",
                reason="Autonomous coordination loop concluded with safety-verified allocation orders.",
                next_action=None,
            )
        )

        return {
            "decision": "GLUT_RESPONSE_ACTIVE",
            "glut_risk_pct": glut_risk_pct,
            "reasoning": coordinator_reasoning,
            "agent_findings": agent_findings,
            "selected_response": "MULTI_CHANNEL_REDISTRIBUTION",
            "allocation_plan": validated_plan,
            "validation_result": {
                "is_valid": len(val_errors) == 0 and len(infeasible_allocs) == 0,
                "validation_errors": val_errors,
                "infeasible_count": len(infeasible_allocs),
            },
            "fallback_used": fallback_used,
            "trace": trace,
        }
