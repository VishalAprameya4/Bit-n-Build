"""
AGRI-FLOW Seed Data Loader
Reads JSON files from data/simulation/ and populates the SQLite tables.
Safe to call multiple times — uses INSERT OR REPLACE (upsert).
"""
import json
from pathlib import Path

import database as db
from config import SIM_DATA_DIR, DEFAULT_COMMODITY, DEFAULT_PRIMARY_MARKET
from config import (
    SIMULATED_CURRENT_ARRIVALS_T,
    SIMULATED_EXPECTED_SUPPLY_T,
    SIMULATED_PRICE_TREND_7D_PCT,
    SIMULATED_MODAL_PRICE,
    ARRIVAL_BASELINE_T,
)


def _load_json(filename: str) -> list[dict]:
    path = SIM_DATA_DIR / filename
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_markets() -> int:
    rows = _load_json("markets.json")
    sql = """
        INSERT OR REPLACE INTO markets
            (market_id, name, latitude, longitude, capacity_t, current_load_t, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    params = [
        (r["market_id"], r["name"], r["latitude"], r["longitude"],
         r["capacity_t"], r["current_load_t"], r["is_active"])
        for r in rows
    ]
    db.executemany(sql, params)
    return len(rows)


def seed_storage() -> int:
    rows = _load_json("storage.json")
    sql = """
        INSERT OR REPLACE INTO storage_facilities
            (facility_id, name, latitude, longitude, capacity_t, available_t,
             holding_cost_per_t, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = [
        (r["facility_id"], r["name"], r["latitude"], r["longitude"],
         r["capacity_t"], r["available_t"], r["holding_cost_per_t"], r["is_active"])
        for r in rows
    ]
    db.executemany(sql, params)
    return len(rows)


def seed_processors() -> int:
    rows = _load_json("processors.json")
    sql = """
        INSERT OR REPLACE INTO processors
            (processor_id, name, latitude, longitude, commodity, capacity_t, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    params = [
        (r["processor_id"], r["name"], r["latitude"], r["longitude"],
         r["commodity"], r["capacity_t"], r["is_active"])
        for r in rows
    ]
    db.executemany(sql, params)
    return len(rows)


def seed_logistics() -> int:
    rows = _load_json("logistics.json")
    sql = """
        INSERT OR REPLACE INTO logistics_routes
            (route_id, origin_id, destination_id, distance_km,
             truck_capacity_t, available_trucks, base_cost_per_t, cost_multiplier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = [
        (r["route_id"], r["origin_id"], r["destination_id"], r["distance_km"],
         r["truck_capacity_t"], r["available_trucks"], r["base_cost_per_t"],
         r["cost_multiplier"])
        for r in rows
    ]
    db.executemany(sql, params)
    return len(rows)


def seed_arrivals_cache() -> int:
    """
    Seed a representative week of historical arrivals for Kolar tomato.
    Baseline ~ 620T/day, with the latest day being the surge (910T).
    These values align with ARCHITECTURE.md demonstration scenario.
    """
    import datetime

    today = datetime.date.today()
    historical = [
        # (days_ago, arrivals_t, modal_price)
        (7, 598.0,  920.0),
        (6, 612.0,  910.0),
        (5, 635.0,  900.0),
        (4, 608.0,  895.0),
        (3, 641.0,  875.0),
        (2, 630.0,  850.0),
        (1, 645.0,  820.0),
        (0, 910.0,  800.0),   # ← today: the surge
    ]

    sql = """
        INSERT OR REPLACE INTO arrivals_cache
            (market_id, commodity, arrival_date, arrivals_t, modal_price,
             min_price, max_price, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = [
        (
            DEFAULT_PRIMARY_MARKET,
            DEFAULT_COMMODITY,
            str(today - datetime.timedelta(days=d)),
            arrivals_t,
            modal_price,
            modal_price * 0.85,
            modal_price * 1.10,
            "simulated",
        )
        for d, arrivals_t, modal_price in historical
    ]
    db.executemany(sql, params)
    return len(params)


def run_all() -> dict:
    """Seed all tables and return counts."""
    counts = {
        "markets":    seed_markets(),
        "storage":    seed_storage(),
        "processors": seed_processors(),
        "logistics":  seed_logistics(),
        "arrivals":   seed_arrivals_cache(),
    }
    print(f"[SEED] Loaded: {counts}")
    return counts


if __name__ == "__main__":
    db.init_db()
    run_all()
