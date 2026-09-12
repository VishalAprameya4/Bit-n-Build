"""
agents/supply_agent.py
Supply Agent: Analyzes incoming arrivals, baseline deviation, and harvest pressure.

Workflow:
1. Executes supply_analysis_tool (deterministic engine/supply.py)
2. Records activity trace event
3. Attempts Ollama structured call for natural language insight (or falls back deterministically)
4. Emits final structured AgentFinding
"""
from typing import Any
from agents.base import AgentFinding, make_event, ollama_structured_call
from engine import supply


def supply_analysis_tool(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Deterministic tool wrapping engine/supply.py compute_anomaly."""
    return supply.compute_anomaly(snapshot)


def _fallback_recommendation(
    anomaly_pct: float,
    current_t: float,
    baseline_t: float,
    harvest_pressure_t: float,
) -> str:
    if anomaly_pct >= 40.0:
        return (
            f"Critical supply surge of {anomaly_pct:.1f}% detected "
            f"({current_t:.0f}T arrivals vs {baseline_t:.0f}T baseline). "
            f"Immediate redistribution recommended for estimated harvest pressure of {harvest_pressure_t:.0f}T."
        )
    elif anomaly_pct >= 20.0:
        return (
            f"Elevated arrivals of {current_t:.0f}T ({anomaly_pct:.1f}% above baseline). "
            f"Moderate glut risk flagged; monitor alternative channels."
        )
    else:
        return f"Arrivals of {current_t:.0f}T are within normal baseline range ({anomaly_pct:.1f}% anomaly)."


class SupplyAgent:
    name = "Supply Agent"

    def analyze(self, snapshot: dict[str, Any]) -> AgentFinding:
        events: list[dict[str, Any]] = []

        # Step 1: Execute deterministic tool
        events.append(
            make_event(
                agent=self.name,
                action="ANALYZE_SUPPLY",
                status="running",
                summary="Querying historical arrivals and computing volume anomaly...",
                tool="supply_analysis_tool",
                reason="Assess whether current arrivals deviate significantly from the 7-day rolling baseline.",
                next_action="EVALUATE_ANOMALY",
            )
        )

        metrics = supply_analysis_tool(snapshot)
        anomaly_pct = metrics["anomaly_pct"]
        surge = metrics["surge_detected"]
        severity = metrics["severity"]
        harvest_pressure_t = metrics["harvest_pressure_estimate_t"]
        baseline_t = snapshot.get("historical_baseline_t", 620.0)
        current_t = snapshot.get("current_arrivals_t", 910.0)
        commodity = snapshot.get("commodity", "tomato")
        market_id = snapshot.get("primary_market_id", "KOLAR")

        events.append(
            make_event(
                agent=self.name,
                action="ANALYZE_SUPPLY",
                status="complete",
                summary=f"Arrivals at {market_id} are {anomaly_pct:.1f}% above 7-day baseline ({severity} severity, +{harvest_pressure_t:.0f}T harvest pressure).",
                tool="supply_analysis_tool",
                reason=f"Arrivals of {current_t:.0f}T exceed baseline of {baseline_t:.0f}T by {anomaly_pct:.1f}%.",
                next_action="EMIT_FINDING",
            )
        )

        # Step 2: LLM Interpretation (optional enrichment)
        system_prompt = (
            "You are an agricultural supply analyst. Respond only with valid JSON matching the schema."
        )
        user_message = (
            f"Supply anomaly detected at {market_id} for {commodity}.\n"
            f"Baseline: {baseline_t:.1f}T, Current: {current_t:.1f}T, Anomaly: {anomaly_pct:.1f}%.\n"
            f"Estimated harvest pressure: {harvest_pressure_t:.1f}T.\n"
            f"In one concise sentence, summarize the supply situation and severity.\n"
            'Schema: {"recommendation": "string"}'
        )
        schema = {
            "type": "object",
            "properties": {"recommendation": {"type": "string"}},
            "required": ["recommendation"],
        }

        llm_res = ollama_structured_call(
            system_prompt=system_prompt,
            user_message=user_message,
            output_schema=schema,
            timeout=5,
        )

        if llm_res and "recommendation" in llm_res and llm_res["recommendation"].strip():
            recommendation = llm_res["recommendation"].strip()
            events.append(
                make_event(
                    agent=self.name,
                    action="GENERATE_INSIGHT",
                    status="complete",
                    summary="Ollama Qwen provided contextual narrative for supply surge.",
                    tool="ollama_qwen",
                )
            )
        else:
            recommendation = _fallback_recommendation(
                anomaly_pct, current_t, baseline_t, harvest_pressure_t
            )

        constraints: list[str] = []
        if surge:
            constraints.append(
                f"Surge volume of ~{harvest_pressure_t:.0f}T exceeds local baseline capacity."
            )

        return AgentFinding(
            agent="supply",
            anomaly_detected=surge,
            severity=severity,
            key_metrics={
                "anomaly_pct": anomaly_pct,
                "surge_detected": surge,
                "historical_baseline_t": baseline_t,
                "current_arrivals_t": current_t,
                "harvest_pressure_estimate_t": harvest_pressure_t,
            },
            recommendation=recommendation,
            constraints=constraints,
            tool_events=events,
        )
