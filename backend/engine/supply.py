"""
engine/supply.py
Deterministic supply-side calculations.

Public API
----------
compute_anomaly(snapshot: dict) -> dict
    Returns supply anomaly metrics from a ScenarioSnapshot.

historical_baseline(market_id, commodity) -> float
    Computes the 7-day rolling average baseline from arrivals_cache.
"""
import statistics
from typing import Any

import database as db
from config import (
    SURGE_THRESHOLD_PCT,
    SEVERITY_THRESHOLDS,
    DEFAULT_PRIMARY_MARKET,
    DEFAULT_COMMODITY,
    ARRIVAL_BASELINE_T,
)


def _severity(anomaly_pct: float) -> str:
    """Map anomaly percentage to a severity label."""
    if anomaly_pct >= SEVERITY_THRESHOLDS["critical"]:
        return "critical"
    if anomaly_pct >= SEVERITY_THRESHOLDS["high"]:
        return "high"
    if anomaly_pct >= SEVERITY_THRESHOLDS["medium"]:
        return "medium"
    return "low"


def historical_baseline(
    market_id: str = DEFAULT_PRIMARY_MARKET,
    commodity: str = DEFAULT_COMMODITY,
    days: int = 7,
) -> float:
    """
    Compute rolling average of the last `days` arrivals from arrivals_cache,
    excluding today (the most recent row).
    Falls back to ARRIVAL_BASELINE_T if insufficient data.
    """
    rows = db.query_all(
        """
        SELECT arrivals_t
        FROM   arrivals_cache
        WHERE  market_id = ? AND commodity = ?
        ORDER  BY arrival_date DESC
        LIMIT  ?
        """,
        (market_id, commodity, days + 1),  # +1 so we can skip today
    )
    # exclude the latest row (today's surge) for baseline
    values = [r["arrivals_t"] for r in rows[1:]]  # oldest days only
    if len(values) < 3:
        return ARRIVAL_BASELINE_T
    return statistics.mean(values)


def compute_anomaly(snapshot: dict) -> dict:
    """
    Compute supply anomaly metrics.

    Parameters
    ----------
    snapshot : dict
        Must contain:
          - current_arrivals_t  : float
          - historical_baseline_t : float (pre-calculated or from DB)
          - expected_supply_t   : float

    Returns
    -------
    dict with keys:
      anomaly_pct, surge_detected, severity,
      harvest_pressure_estimate_t
    """
    baseline_t: float = snapshot.get("historical_baseline_t", ARRIVAL_BASELINE_T)
    current_t: float  = snapshot["current_arrivals_t"]
    expected_t: float = snapshot["expected_supply_t"]

    if baseline_t == 0:
        anomaly_pct = 0.0
    else:
        anomaly_pct = ((current_t - baseline_t) / baseline_t) * 100.0

    surge_detected = anomaly_pct > SURGE_THRESHOLD_PCT
    severity = _severity(anomaly_pct)

    # Harvest pressure: difference between expected supply and baseline
    harvest_pressure_estimate_t = max(0.0, expected_t - baseline_t)

    return {
        "anomaly_pct": round(anomaly_pct, 2),
        "surge_detected": surge_detected,
        "severity": severity,
        "harvest_pressure_estimate_t": round(harvest_pressure_estimate_t, 1),
    }
