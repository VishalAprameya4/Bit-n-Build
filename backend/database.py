"""
AGRI-FLOW Database Layer
Uses plain sqlite3 — no ORM.
Provides:
  - get_conn()           : context-managed connection
  - init_db()            : create all tables (idempotent)
  - query_one / query_all: thin helpers
"""
import sqlite3
import contextlib
from pathlib import Path

from config import DB_PATH, CACHE_DIR


# ── Ensure cache directory exists ────────────────────────────────────────────
CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ── Connection factory ────────────────────────────────────────────────────────
@contextlib.contextmanager
def get_conn():
    """Yield a sqlite3 connection with row_factory set to Row."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Query helpers ─────────────────────────────────────────────────────────────
def query_all(sql: str, params: tuple = ()) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def query_one(sql: str, params: tuple = ()) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(sql, params).fetchone()
    return dict(row) if row else None


def execute(sql: str, params: tuple = ()) -> None:
    with get_conn() as conn:
        conn.execute(sql, params)


def executemany(sql: str, param_list: list[tuple]) -> None:
    with get_conn() as conn:
        conn.executemany(sql, param_list)


# ── Schema ────────────────────────────────────────────────────────────────────
_SCHEMA = """
-- Simulation tables (seeded from data/simulation/*.json)

CREATE TABLE IF NOT EXISTS markets (
    market_id       TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    capacity_t      REAL NOT NULL,
    current_load_t  REAL NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS storage_facilities (
    facility_id         TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    latitude            REAL NOT NULL,
    longitude           REAL NOT NULL,
    capacity_t          REAL NOT NULL,
    available_t         REAL NOT NULL,
    holding_cost_per_t  REAL NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS processors (
    processor_id    TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    commodity       TEXT NOT NULL,
    capacity_t      REAL NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS logistics_routes (
    route_id            TEXT PRIMARY KEY,
    origin_id           TEXT NOT NULL,
    destination_id      TEXT NOT NULL,
    distance_km         REAL NOT NULL,
    truck_capacity_t    REAL NOT NULL,
    available_trucks    INTEGER NOT NULL DEFAULT 0,
    base_cost_per_t     REAL NOT NULL,
    cost_multiplier     REAL NOT NULL DEFAULT 1.0
);

-- Live / derived tables

CREATE TABLE IF NOT EXISTS arrivals_cache (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id       TEXT NOT NULL,
    commodity       TEXT NOT NULL,
    arrival_date    TEXT NOT NULL,
    arrivals_t      REAL NOT NULL,
    modal_price     REAL,
    min_price       REAL,
    max_price       REAL,
    source          TEXT NOT NULL DEFAULT 'simulated',
    UNIQUE(market_id, commodity, arrival_date)
);

CREATE TABLE IF NOT EXISTS plans (
    plan_id                 TEXT PRIMARY KEY,
    created_at              TEXT NOT NULL,
    scenario_hash           TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'active',
    glut_risk_pct           REAL,
    expected_supply_t       REAL,
    local_absorption_t      REAL,
    surplus_t               REAL,
    coordinator_reasoning   TEXT,
    fallback_used           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS allocations (
    allocation_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id             TEXT NOT NULL REFERENCES plans(plan_id),
    destination_id      TEXT NOT NULL,
    destination_type    TEXT NOT NULL,
    allocated_t         REAL NOT NULL,
    route_id            TEXT NOT NULL,
    transport_cost_total REAL NOT NULL,
    feasible            INTEGER NOT NULL DEFAULT 1
);
"""


def init_db() -> None:
    """Create all tables (idempotent — safe to call on every startup)."""
    with get_conn() as conn:
        conn.executescript(_SCHEMA)
    print(f"[DB] Initialised at {DB_PATH}")
