"""
agents/market_agent.py
Market Agent: Evaluates mandi saturation, price drops, and alternative market capacities.

Workflow:
1. Executes market_analysis_tool (deterministic engine/market.py)
2. Records activity trace event
3. Attempts Ollama structured call for natural language insight (or falls back deterministically)
4. Emits final structured AgentFinding
"""
from typing import Any
from agents.base import AgentFinding, make_event, ollama_structured_call
from engine import market


def market_analysis_tool(
    snapshot: dict[str, Any], overrides: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Deterministic tool wrapping engine/market.py evaluate_absorption."""
    snap = dict(snapshot)
    if overrides or "available_markets" not in snap:
        primary_id = snap.get("primary_market_id", "KOLAR")
        snap["available_markets"] = market.build_available_markets(primary_id, overrides)
    return market.evaluate_absorption(snap)


def _fallback_recommendation(
    saturation_pct: float,
    price_drop_7d_pct: float,
    primary_market_id: str,
    alt_count: int,
    deficit_t: float,
) -> str:
    if saturation_pct > 100.0:
        return (
            f"Primary mandi {primary_market_id} is over capacity at {saturation_pct:.1f}% "
            f"with a 7-day price drop of {price_drop_7d_pct:.1f}%. "
            f"Absorption deficit is {deficit_t:.0f}T; redirecting to {alt_count} alternative mandis recommended."
        )
    else:
        return (
            f"Primary market {primary_market_id} is operating at {saturation_pct:.1f}% capacity. "
            f"{alt_count} alternative markets currently available."
        )


class MarketAgent:
    name = "Market Agent"

    def analyze(
        self, snapshot: dict[str, Any], overrides: dict[str, Any] | None = None
    ) -> AgentFinding:
        events: list[dict[str, Any]] = []

        # Step 1: Deterministic analysis tool
        events.append(
            make_event(
                agent=self.name,
                action="EVALUATE_MARKET_ABSORPTION",
                status="running",
                summary="Calculating primary mandi saturation and scanning regional secondary mandis...",
                tool="market_analysis_tool",
                reason="Determine if primary mandi can absorb arrivals without severe price depression.",
                next_action="SCAN_SECONDARY_MANDIS",
            )
        )

        metrics = market_analysis_tool(snapshot, overrides)
        saturation_pct = metrics["saturation_pct"]
        price_drop = metrics["price_drop_7d_pct"]
        alt_markets = metrics["alternative_markets_with_capacity"]
        deficit_t = metrics["estimated_absorption_deficit_t"]
        primary_market_id = snapshot.get("primary_market_id", "KOLAR")

        is_overloaded = saturation_pct > 100.0
        severity = "critical" if saturation_pct > 130 else ("high" if saturation_pct > 100 else "low")

        events.append(
            make_event(
                agent=self.name,
                action="EVALUATE_MARKET_ABSORPTION",
                status="complete",
                summary=f"Primary market saturation is {saturation_pct:.1f}% (deficit {deficit_t:.0f}T). {len(alt_markets)} alternative markets identified.",
                tool="market_analysis_tool",
                reason=f"Current arrivals exceed primary mandi capacity; {deficit_t:.0f}T cannot be absorbed locally.",
                next_action="EMIT_FINDING",
            )
        )

        # Step 2: LLM Interpretation
        system_prompt = (
            "You are an agricultural market intelligence specialist. Respond only with valid JSON matching the schema."
        )
        user_message = (
            f"Market assessment for {primary_market_id}:\n"
            f"Saturation: {saturation_pct:.1f}%, 7-Day Price Trend: {price_drop:.1f}%.\n"
            f"Deficit volume: {deficit_t:.0f}T, Available alternative markets: {len(alt_markets)}.\n"
            f"In one concise sentence, assess the absorption constraints and recommend action.\n"
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
                    summary="Ollama Qwen provided market absorption commentary.",
                    tool="ollama_qwen",
                )
            )
        else:
            recommendation = _fallback_recommendation(
                saturation_pct, price_drop, primary_market_id, len(alt_markets), deficit_t
            )

        constraints: list[str] = []
        if is_overloaded:
            constraints.append(
                f"{primary_market_id} cannot absorb additional volume (deficit: {deficit_t:.0f}T)."
            )

        return AgentFinding(
            agent="market",
            anomaly_detected=is_overloaded,
            severity=severity,
            key_metrics={
                "saturation_pct": saturation_pct,
                "price_drop_7d_pct": price_drop,
                "alternative_markets_count": len(alt_markets),
                "estimated_absorption_deficit_t": deficit_t,
                "alternative_markets": alt_markets,
            },
            recommendation=recommendation,
            constraints=constraints,
            tool_events=events,
        )
