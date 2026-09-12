"""
agents/risk_agent.py
Risk Agent: Analyzes weather forecasts, rainfall severity, and harvest rush risk.

Workflow:
1. Executes risk_analysis_tool (deterministic engine/risk.py)
2. Records activity trace event
3. Attempts Ollama structured call for natural language risk assessment
4. Emits final structured AgentFinding
"""
from typing import Any
from agents.base import AgentFinding, make_event, ollama_structured_call
from engine import risk


def risk_analysis_tool(weather_data: dict[str, Any] | None = None) -> dict[str, Any]:
    """Deterministic tool wrapping engine/risk.py score_weather."""
    return risk.score_weather(weather_data)


def _fallback_recommendation(
    weather_risk_score: float,
    rainfall_mm: float,
    harvest_risk: bool,
    pressure_t: float,
) -> str:
    if weather_risk_score >= 0.5:
        return (
            f"Adverse weather condition detected (score {weather_risk_score:.2f}, rainfall {rainfall_mm:.1f}mm). "
            f"Precipitation triggers harvest acceleration, adding ~{pressure_t:.0f}T urgent supply pressure."
        )
    else:
        return (
            f"Weather risk is mild (score {weather_risk_score:.2f}, rainfall {rainfall_mm:.1f}mm). "
            "No urgent weather-driven harvest rush detected."
        )


class RiskAgent:
    name = "Risk Agent"

    def analyze(self, snapshot: dict[str, Any]) -> AgentFinding:
        events: list[dict[str, Any]] = []

        events.append(
            make_event(
                agent=self.name,
                action="SCORE_WEATHER_RISK",
                status="running",
                summary="Evaluating rainfall forecasts and harvest concentration risk...",
                tool="risk_analysis_tool",
                reason="Precipitation forces accelerated harvesting and increases post-harvest spoilage risks.",
                next_action="COMPUTE_WEATHER_MULTIPLIER",
            )
        )

        weather_data = snapshot.get("weather_data") or risk.simulated_weather()
        metrics = risk_analysis_tool(weather_data)
        score = metrics["weather_risk_score"]
        rainfall_mm = metrics["rainfall_forecast_mm"]
        temp_c = metrics["temp_celsius"]
        harvest_risk = metrics["harvest_concentration_risk"]
        pressure_t = metrics["additional_pressure_estimate_t"]

        is_high_risk = score >= 0.5
        severity = "high" if score >= 0.6 else ("medium" if score >= 0.3 else "low")

        events.append(
            make_event(
                agent=self.name,
                action="SCORE_WEATHER_RISK",
                status="complete",
                summary=f"Weather risk score: {score:.2f} ({rainfall_mm:.0f}mm rainfall forecast, {pressure_t:.0f}T additional harvest rush).",
                tool="risk_analysis_tool",
                reason=f"Rainfall forecast of {rainfall_mm:.0f}mm increases urgent field clearing pressure by ~{pressure_t:.0f}T.",
                next_action="EMIT_FINDING",
            )
        )

        # LLM interpretation
        system_prompt = (
            "You are an agricultural risk analyst. Respond only with valid JSON matching the schema."
        )
        user_message = (
            f"Weather Risk Assessment:\n"
            f"Score: {score:.2f}, Rainfall: {rainfall_mm:.1f}mm, Temp: {temp_c:.1f}C.\n"
            f"Harvest concentration risk: {harvest_risk}, Extra volume: {pressure_t:.0f}T.\n"
            f"In one concise sentence, summarize the risk impact on harvest timing.\n"
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
                    summary="Ollama Qwen provided weather risk narrative.",
                    tool="ollama_qwen",
                )
            )
        else:
            recommendation = _fallback_recommendation(
                score, rainfall_mm, harvest_risk, pressure_t
            )

        constraints: list[str] = []
        if harvest_risk:
            constraints.append(
                f"Rainfall of {rainfall_mm:.0f}mm forces early harvest; tomatoes must be moved within 24-48h to prevent rot."
            )

        return AgentFinding(
            agent="risk",
            anomaly_detected=is_high_risk,
            severity=severity,
            key_metrics={
                "weather_risk_score": score,
                "rainfall_forecast_mm": rainfall_mm,
                "temp_celsius": temp_c,
                "harvest_concentration_risk": harvest_risk,
                "additional_pressure_estimate_t": pressure_t,
            },
            recommendation=recommendation,
            constraints=constraints,
            tool_events=events,
        )
