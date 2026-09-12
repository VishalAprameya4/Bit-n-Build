"""
AGRI-FLOW Backend Configuration
All constants live here so every other module imports from one place.
"""
import os
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR        = Path(__file__).resolve().parent.parent   # project root
BACKEND_DIR     = Path(__file__).resolve().parent
SIM_DATA_DIR    = BASE_DIR / "data" / "simulation"
CACHE_DIR       = BACKEND_DIR / "data" / "cache"
DB_PATH         = BACKEND_DIR / "agriflow.db"

# ── Scenario defaults ─────────────────────────────────────────────────────────
DEFAULT_COMMODITY        = "tomato"
DEFAULT_PRIMARY_MARKET   = "KOLAR"

# Historical arrival baseline for Kolar tomato (tonnes / day).
# Used when no AGMARKNET data is available.
ARRIVAL_BASELINE_T       = 620.0

# Current arrivals (will be overridden by live data or what-if).
SIMULATED_CURRENT_ARRIVALS_T   = 910.0
SIMULATED_EXPECTED_SUPPLY_T    = 1200.0
SIMULATED_PRICE_TREND_7D_PCT   = -18.5   # negative = price falling
SIMULATED_MODAL_PRICE          = 800.0   # Rs/quintal

# ── Glut detection thresholds ────────────────────────────────────────────────
SURGE_THRESHOLD_PCT      = 20.0   # anomaly_pct above which a surge is flagged
GLUT_TRIGGER_PCT         = 40.0   # glut_risk_pct above which full pipeline runs

# glut_risk_pct weights (must sum to 1.0)
WEIGHT_ANOMALY           = 0.40
WEIGHT_SATURATION        = 0.30
WEIGHT_WEATHER           = 0.20
WEIGHT_PRICE_DROP        = 0.10

# Normalisation denominators for each component
ANOMALY_NORM             = 60.0   # 60 % anomaly → full score
SATURATION_NORM          = 100.0  # 100 % saturation → full score
PRICE_DROP_NORM          = 30.0   # 30 % price drop → full score

# Severity thresholds (percentage anomaly)
SEVERITY_THRESHOLDS = {
    "critical": 40.0,
    "high":     25.0,
    "medium":   10.0,
    "low":       0.0,
}

# ── Optimizer ────────────────────────────────────────────────────────────────
OPTIMIZER_UNIT_T         = 10.0   # allocation granularity in tonnes
OPTIMIZER_TIMEOUT_SEC    = 5      # OR-Tools CP-SAT wall-clock limit

# ── Validation ────────────────────────────────────────────────────────────────
# If feasible allocations cover less than this fraction of surplus,
# the fallback greedy planner is triggered.
VALIDATION_MIN_COVER_FRAC = 0.50

# ── Simulated weather (used when Open-Meteo is unavailable) ──────────────────
SIMULATED_WEATHER = {
    "weather_risk_score":          0.65,
    "rainfall_forecast_mm":        42.0,
    "temp_celsius":                26.0,
    "harvest_concentration_risk":  True,
    "additional_pressure_estimate_t": 35.0,
}

# ── Ollama (not used in this module — defined here for reference by agents) ───
OLLAMA_BASE_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL     = os.getenv("OLLAMA_MODEL",    "qwen2.5:7b")
OLLAMA_TIMEOUT   = int(os.getenv("OLLAMA_TIMEOUT", "15"))
