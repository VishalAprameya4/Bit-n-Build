"""
engine/risk.py
Deterministic weather and harvest-risk scoring.

Public API
----------
score_weather(weather_data: dict) -> dict
    Converts raw weather observations into a [0, 1] risk score.

simulated_weather() -> dict
    Returns the static simulated weather payload from config.

glut_risk_pct(anomaly_pct, saturation_pct, weather_risk_score, price_drop_7d_pct) -> float
    The canonical ARCHITECTURE.md weighted formula — returns 0–100.
"""
from config import (
    WEIGHT_ANOMALY,
    WEIGHT_SATURATION,
    WEIGHT_WEATHER,
    WEIGHT_PRICE_DROP,
    ANOMALY_NORM,
    SATURATION_NORM,
    PRICE_DROP_NORM,
    SIMULATED_WEATHER,
)


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def score_weather(weather_data: dict) -> dict:
    """
    Convert weather observations to a risk score.

    Expected keys in weather_data (all optional; defaults to low risk):
      rainfall_forecast_mm  : float
      temp_celsius          : float
      harvest_concentration_risk : bool

    Returns
    -------
    dict with keys:
      weather_risk_score, rainfall_forecast_mm, temp_celsius,
      harvest_concentration_risk, additional_pressure_estimate_t
    """
    rainfall_mm: float = float(weather_data.get("rainfall_forecast_mm", 0.0))
    temp_c:      float = float(weather_data.get("temp_celsius", 25.0))
    concentration_risk: bool = bool(weather_data.get("harvest_concentration_risk", False))

    # Rainfall component: 0 mm → 0.0, ≥ 60 mm → 1.0
    rain_score = _clamp(rainfall_mm / 60.0)

    # Temperature component: high temperatures accelerate deterioration (risk ↑)
    # 20°C → 0, 40°C → 1
    temp_score = _clamp((temp_c - 20.0) / 20.0)

    # Concentration risk flag: adds 0.3 base if True
    conc_score = 0.30 if concentration_risk else 0.0

    # Weighted composite (rain 50%, temp 20%, concentration 30%)
    raw_score = 0.50 * rain_score + 0.20 * temp_score + 0.30 * conc_score
    weather_risk_score = round(_clamp(raw_score), 3)

    # Estimate additional harvest pressure from weather
    additional_pressure_t = round(rainfall_mm * 0.8, 1)  # heuristic: 0.8T per mm

    return {
        "weather_risk_score":          weather_risk_score,
        "rainfall_forecast_mm":        rainfall_mm,
        "temp_celsius":                temp_c,
        "harvest_concentration_risk":  concentration_risk,
        "additional_pressure_estimate_t": additional_pressure_t,
    }


def simulated_weather() -> dict:
    """Return the static simulated weather payload (no API call)."""
    return dict(SIMULATED_WEATHER)


def glut_risk_pct(
    anomaly_pct:      float,
    saturation_pct:   float,
    weather_risk_score: float,
    price_drop_7d_pct:  float,
) -> float:
    """
    Canonical glut-risk formula from ARCHITECTURE.md §5:

        glut_risk_pct =
          0.40 × clamp(anomaly_pct / 60, 0, 1)
        + 0.30 × clamp(saturation_pct / 100, 0, 1)
        + 0.20 × weather_risk_score
        + 0.10 × clamp(price_drop_7d_pct / -30, 0, 1)

    Returns a percentage [0, 100].
    price_drop_7d_pct should be negative for a falling market.
    """
    a = WEIGHT_ANOMALY    * _clamp(anomaly_pct     / ANOMALY_NORM)
    b = WEIGHT_SATURATION * _clamp(saturation_pct  / SATURATION_NORM)
    c = WEIGHT_WEATHER    * _clamp(weather_risk_score)
    # Convert falling price (negative) to a positive 0–1 risk signal
    d = WEIGHT_PRICE_DROP * _clamp(-price_drop_7d_pct / PRICE_DROP_NORM)

    return round((a + b + c + d) * 100.0, 1)
