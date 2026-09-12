"""
engine/market.py
Deterministic market-side calculations.

Public API
----------
evaluate_absorption(snapshot: dict) -> dict
    Returns saturation, price trends, and available alternative markets.

build_available_markets(primary_market_id, overrides) -> list[dict]
    Queries DB and applies overrides to return market capacity data.
"""
import database as db
from config import DEFAULT_PRIMARY_MARKET


def build_available_markets(
    primary_market_id: str = DEFAULT_PRIMARY_MARKET,
    overrides: dict | None = None,
) -> list[dict]:
    """
    Query all markets except the primary (already saturated).
    Apply any in-memory what-if overrides.
    Returns list of dicts: {market_id, name, capacity_t, current_load_t, available_t,
                             latitude, longitude, is_active}
    """
    overrides = overrides or {}
    market_overrides: dict = overrides.get("markets", {})

    rows = db.query_all(
        "SELECT * FROM markets WHERE market_id != ?",
        (primary_market_id,),
    )

    result = []
    for r in rows:
        mid = r["market_id"]
        # Apply what-if override fields
        if mid in market_overrides:
            for field, val in market_overrides[mid].items():
                r[field] = val

        if not r["is_active"]:
            continue

        available_t = max(0.0, r["capacity_t"] - r["current_load_t"])
        result.append({
            "market_id":      mid,
            "name":           r["name"],
            "capacity_t":     r["capacity_t"],
            "current_load_t": r["current_load_t"],
            "available_t":    round(available_t, 1),
            "latitude":       r["latitude"],
            "longitude":      r["longitude"],
            "is_active":      r["is_active"],
        })
    return result


def evaluate_absorption(snapshot: dict) -> dict:
    """
    Evaluate market absorption capacity.

    Parameters
    ----------
    snapshot : dict
        Must contain:
          - primary_market_id   : str
          - current_arrivals_t  : float
          - local_absorption_t  : float  (primary market capacity)
          - price_trend_7d_pct  : float  (negative = falling)
          - available_markets   : list[dict]  (from build_available_markets)

    Returns
    -------
    dict with keys:
      saturation_pct, price_drop_7d_pct,
      alternative_markets_with_capacity,
      estimated_absorption_deficit_t
    """
    local_absorption_t: float = snapshot["local_absorption_t"]
    current_arrivals_t: float = snapshot["current_arrivals_t"]
    price_trend_7d_pct: float = snapshot.get("price_trend_7d_pct", 0.0)
    available_markets: list   = snapshot.get("available_markets", [])

    if local_absorption_t == 0:
        saturation_pct = 100.0
    else:
        saturation_pct = (current_arrivals_t / local_absorption_t) * 100.0

    # Deficit: how much of today's arrivals the primary market cannot absorb
    absorption_deficit_t = max(0.0, current_arrivals_t - local_absorption_t)

    alt_markets = [
        {
            "market_id":  m["market_id"],
            "available_t": m["available_t"],
        }
        for m in available_markets
        if m["available_t"] > 0
    ]

    return {
        "saturation_pct":                   round(saturation_pct, 1),
        "price_drop_7d_pct":                round(price_trend_7d_pct, 2),
        "alternative_markets_with_capacity": alt_markets,
        "estimated_absorption_deficit_t":    round(absorption_deficit_t, 1),
    }
