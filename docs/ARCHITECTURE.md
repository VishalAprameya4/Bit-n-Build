# AGRI-FLOW — Architecture Document

> Minimum viable architecture for a 4-person, 24-hour hackathon build.  
> Spec source: `README.md` (Bit N Build: Around the World 2026).

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [Backend / Frontend Boundary](#2-backend--frontend-boundary)
3. [Data Schemas](#3-data-schemas)
4. [Agent Responsibilities & Tool Contracts](#4-agent-responsibilities--tool-contracts)
5. [Glut Detection → Optimization → Validation Flow](#5-glut-detection--optimization--validation-flow)
6. [What-If / Replanning State Model](#6-what-if--replanning-state-model)
7. [API Contracts](#7-api-contracts)
8. [Local Ollama / Qwen Interface](#8-local-ollama--qwen-interface)
9. [Deterministic Fallback](#9-deterministic-fallback)
10. [Implementation Order & Critical Risks](#10-implementation-order--critical-risks)

---

## 1. Repository Structure

```
agri-flow/
├── README.md
├── docs/
│   └── ARCHITECTURE.md          ← this file
│
├── backend/
│   ├── main.py                  ← FastAPI app entry point
│   ├── config.py                ← constants, paths, Ollama URL
│   ├── database.py              ← SQLite init + helpers (sqlite3, no ORM)
│   ├── seed_data.py             ← populate simulation tables on startup
│   │
│   ├── data/
│   │   ├── agmarknet.py         ← fetch/cache AGMARKNET CSV (data.gov.in)
│   │   ├── weather.py           ← fetch Open-Meteo forecast & history
│   │   └── cache/               ← on-disk JSON caches (TTL = 1 h)
│   │
│   ├── engine/
│   │   ├── supply.py            ← deterministic supply anomaly calculations
│   │   ├── market.py            ← deterministic market saturation calculations
│   │   ├── risk.py              ← deterministic weather/harvest risk scoring
│   │   ├── optimizer.py         ← OR-Tools CP-SAT allocation solver
│   │   └── validator.py         ← constraint validation of any allocation plan
│   │
│   ├── agents/
│   │   ├── base.py              ← shared Ollama call + schema parse helpers
│   │   ├── supply_agent.py
│   │   ├── market_agent.py
│   │   ├── risk_agent.py
│   │   ├── resource_agent.py
│   │   └── coordinator.py       ← orchestrates all agents, calls optimizer
│   │
│   └── routers/
│       ├── scenario.py          ← GET /scenario/current
│       ├── plan.py              ← POST /plan/generate, GET /plan/current
│       ├── whatif.py            ← POST /whatif/apply
│       └── network.py           ← GET /network/graph
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js        ← thin fetch wrapper for backend API
│       ├── components/
│       │   ├── NetworkGraph.jsx  ← SVG digital-twin visualization
│       │   ├── GlutMonitor.jsx
│       │   ├── SupplyOverview.jsx
│       │   ├── AgentActivity.jsx
│       │   ├── ResponsePlan.jsx
│       │   └── WhatIfPanel.jsx
│       └── store/
│           └── appStore.js      ← lightweight Zustand state
│
├── data/
│   └── simulation/
│       ├── markets.json
│       ├── storage.json
│       ├── processors.json
│       └── logistics.json
│
└── requirements.txt
```

**Rule:** no code lives outside `backend/` or `frontend/`. The `data/simulation/` directory is read-only seed data; the backend never writes there.

---

## 2. Backend / Frontend Boundary

```
┌─────────────────────────────────────────┐
│              FRONTEND (React + Vite)     │
│                                          │
│  NetworkGraph  GlutMonitor  WhatIfPanel  │
│  AgentActivity  SupplyOverview  Plan     │
└────────────────────┬────────────────────┘
                     │  HTTP/JSON  (port 5173 → proxy → 8000)
                     │  Polling: GET /plan/current every 2 s
                     │  SSE:     GET /plan/stream (agent progress)
┌────────────────────┴────────────────────┐
│              BACKEND (FastAPI, port 8000)│
│                                          │
│  Routers → Agents → Engine → DB         │
│                    ↕                     │
│            Ollama  (port 11434)          │
│            AGMARKNET  Open-Meteo         │
└─────────────────────────────────────────┘
```

**Strict rules:**
- The frontend performs **zero numerical computation**. All numbers it displays come verbatim from the backend.
- The backend never exposes raw LLM text; it only exposes validated, schema-conformant JSON.
- CORS is open for `localhost` only.
- A single SQLite file (`agriflow.db`) is the only persistent store.

---

## 3. Data Schemas

All schemas are plain Python `TypedDict` / `dataclass` structures (no Pydantic to keep dependencies light). SQLite tables mirror the same fields.

### 3.1 Simulation Tables (seeded on startup)

#### `markets`
| Column | Type | Notes |
|---|---|---|
| `market_id` | TEXT PK | e.g. `"KOLAR"` |
| `name` | TEXT | Human label |
| `latitude` | REAL | |
| `longitude` | REAL | |
| `capacity_t` | REAL | Max daily absorption in tonnes |
| `current_load_t` | REAL | Current load (mutable by what-if) |
| `is_active` | INTEGER | 1=active, 0=disabled by what-if |

#### `storage_facilities`
| Column | Type | Notes |
|---|---|---|
| `facility_id` | TEXT PK | |
| `name` | TEXT | |
| `latitude` | REAL | |
| `longitude` | REAL | |
| `capacity_t` | REAL | |
| `available_t` | REAL | Mutable |
| `holding_cost_per_t` | REAL | Rs/tonne/day |
| `is_active` | INTEGER | |

#### `processors`
| Column | Type | Notes |
|---|---|---|
| `processor_id` | TEXT PK | |
| `name` | TEXT | |
| `latitude` | REAL | |
| `longitude` | REAL | |
| `commodity` | TEXT | Crop this processor handles |
| `capacity_t` | REAL | |
| `is_active` | INTEGER | Mutable |

#### `logistics_routes`
| Column | Type | Notes |
|---|---|---|
| `route_id` | TEXT PK | `origin_id + "_" + dest_id` |
| `origin_id` | TEXT | |
| `destination_id` | TEXT | |
| `distance_km` | REAL | |
| `truck_capacity_t` | REAL | Per truck |
| `available_trucks` | INTEGER | Mutable |
| `base_cost_per_t` | REAL | Rs/tonne |
| `cost_multiplier` | REAL | Default 1.0; what-if adjusts this |

### 3.2 Live / Derived Tables

#### `arrivals_cache`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `market_id` | TEXT | |
| `commodity` | TEXT | |
| `arrival_date` | TEXT | ISO-8601 |
| `arrivals_t` | REAL | |
| `modal_price` | REAL | Rs/quintal |
| `min_price` | REAL | |
| `max_price` | REAL | |
| `source` | TEXT | `"agmarknet"` or `"simulated"` |

#### `plans`
| Column | Type | Notes |
|---|---|---|
| `plan_id` | TEXT PK | UUID |
| `created_at` | TEXT | ISO-8601 timestamp |
| `scenario_hash` | TEXT | SHA-256 of scenario inputs |
| `status` | TEXT | `"active"` or `"superseded"` |
| `glut_risk_pct` | REAL | 0–100 |
| `expected_supply_t` | REAL | |
| `local_absorption_t` | REAL | |
| `surplus_t` | REAL | |
| `coordinator_reasoning` | TEXT | LLM narrative (may be null for fallback) |
| `fallback_used` | INTEGER | 0/1 |

#### `allocations`
| Column | Type | Notes |
|---|---|---|
| `allocation_id` | INTEGER PK AUTOINCREMENT | |
| `plan_id` | TEXT FK → plans | |
| `destination_id` | TEXT | market / storage / processor id |
| `destination_type` | TEXT | `"market"`, `"storage"`, or `"processor"` |
| `allocated_t` | REAL | |
| `route_id` | TEXT FK → logistics_routes | |
| `transport_cost_total` | REAL | |
| `feasible` | INTEGER | 1=passed validation |

### 3.3 JSON Transfer Schemas

These are the exact shapes passed over HTTP and between agents internally.

#### `ScenarioSnapshot`
```json
{
  "commodity": "tomato",
  "primary_market_id": "KOLAR",
  "historical_baseline_t": 620.0,
  "current_arrivals_t": 910.0,
  "expected_supply_t": 1200.0,
  "local_absorption_t": 850.0,
  "surplus_t": 350.0,
  "modal_price": 800.0,
  "price_trend_7d_pct": -18.5,
  "weather_risk_score": 0.65,
  "available_markets": ["..."],
  "available_storage": ["..."],
  "available_processors": ["..."],
  "available_routes": ["..."]
}
```

#### `AgentFinding`
```json
{
  "agent": "supply|market|risk|resource",
  "anomaly_detected": true,
  "severity": "low|medium|high|critical",
  "key_metrics": { "...": "..." },
  "recommendation": "string",
  "constraints": ["string"]
}
```

#### `AllocationPlan`
```json
{
  "plan_id": "uuid",
  "glut_risk_pct": 87.0,
  "surplus_t": 350.0,
  "allocations": [
    {
      "destination_id": "BANGALORE",
      "destination_type": "market",
      "allocated_t": 120.0,
      "route_id": "KOLAR_BANGALORE",
      "transport_cost_total": 9600.0,
      "feasible": true
    }
  ],
  "unallocated_t": 0.0,
  "coordinator_reasoning": "string or null",
  "fallback_used": false,
  "validation_errors": []
}
```

#### `WhatIfPatch`
```json
{
  "overrides": {
    "processors": [{ "processor_id": "P1", "is_active": 0 }],
    "logistics_routes": [{ "route_id": "KOLAR_BANGALORE", "cost_multiplier": 1.3 }],
    "storage_facilities": [{ "facility_id": "S1", "available_t": 40.0 }],
    "markets": [{ "market_id": "MYSORE", "is_active": 0 }],
    "expected_supply_override_t": 1400.0
  }
}
```

---

## 4. Agent Responsibilities & Tool Contracts

Each agent is a Python function. It receives a `ScenarioSnapshot`, calls the deterministic engine functions for numbers, optionally calls Ollama for reasoning, and returns an `AgentFinding`.

### 4.1 Supply Agent

**Input:** `ScenarioSnapshot`  
**Calls (deterministic):** `engine.supply.compute_anomaly(snapshot)`  
**Calls (LLM, optional):** Ollama with the anomaly metrics for a 1-sentence interpretation  
**Output:** `AgentFinding`

`engine.supply.compute_anomaly` must return:
```python
{
    "anomaly_pct": float,          # (current - baseline) / baseline * 100
    "surge_detected": bool,        # anomaly_pct > threshold (default 20%)
    "severity": str,               # "low|medium|high|critical"
    "harvest_pressure_estimate_t": float
}
```

### 4.2 Market Agent

**Input:** `ScenarioSnapshot`  
**Calls (deterministic):** `engine.market.evaluate_absorption(snapshot)`  
**Calls (LLM, optional):** Ollama for market comparison narrative  
**Output:** `AgentFinding`

`engine.market.evaluate_absorption` must return:
```python
{
    "saturation_pct": float,       # current_load / capacity * 100
    "price_drop_7d_pct": float,
    "alternative_markets_with_capacity": [
        {"market_id": str, "available_t": float, "distance_km": float}
    ],
    "estimated_absorption_deficit_t": float
}
```

### 4.3 Risk Agent

**Input:** `ScenarioSnapshot` + Open-Meteo payload  
**Calls (deterministic):** `engine.risk.score_weather(weather_data)`  
**Calls (LLM, optional):** Ollama for narrative interpretation  
**Output:** `AgentFinding`

`engine.risk.score_weather` must return:
```python
{
    "weather_risk_score": float,   # 0.0–1.0
    "rainfall_forecast_mm": float,
    "temp_celsius": float,
    "harvest_concentration_risk": bool,
    "additional_pressure_estimate_t": float
}
```
**Rule:** weather risk score is a simple weighted formula, not LLM-generated.

### 4.4 Resource Agent

**Input:** `ScenarioSnapshot`  
**Calls (deterministic):** queries DB for available capacity directly  
**No LLM call** (pure capacity lookup)  
**Output:** `AgentFinding`

Must enumerate:
```python
{
    "storage_available_t": float,
    "processor_available_t": float,
    "market_alternative_available_t": float,
    "total_redirect_capacity_t": float,
    "logistics_constraints": [
        {"route_id": str, "max_t": float, "effective_cost_per_t": float}
    ]
}
```

### 4.5 Coordinator Agent

**Input:** `[AgentFinding x4]` + `ScenarioSnapshot`  
**Calls (deterministic):** `engine.optimizer.solve(snapshot, findings)` → raw `AllocationPlan`  
**Calls (LLM):** Ollama to generate `coordinator_reasoning` string (narrative only)  
**Calls (deterministic):** `engine.validator.validate(plan, snapshot)` → validated `AllocationPlan`  
**Output:** `AllocationPlan` (persisted to DB)

The Coordinator **never** lets the LLM determine tonnage numbers. It only asks the LLM:

> "Given these agent findings and this allocation plan, explain in 2–3 sentences why this plan was selected."

The LLM response is stored as `coordinator_reasoning` and displayed in the UI. If LLM fails, this field is `null`.

---

## 5. Glut Detection → Optimization → Validation Flow

```
┌──────────────────────────────────────────────────────┐
│ 1. DATA INGESTION                                      │
│    agmarknet.py  →  arrivals_cache (SQLite)           │
│    weather.py    →  ScenarioSnapshot.weather_data     │
└─────────────────────────┬────────────────────────────┘
                           │
┌─────────────────────────▼────────────────────────────┐
│ 2. GLUT DETECTION  (engine/supply.py, engine/market.py)│
│                                                        │
│  surplus_t = expected_supply_t - local_absorption_t   │
│  anomaly_pct = (current - baseline) / baseline x 100  │
│  glut_risk_pct = weighted combination:                 │
│    0.40 x clamp(anomaly_pct/60, 0, 1)                 │
│  + 0.30 x clamp(saturation_pct/100, 0, 1)             │
│  + 0.20 x weather_risk_score                           │
│  + 0.10 x clamp(price_drop_7d_pct/-30, 0, 1)          │
│                                                        │
│  If glut_risk_pct < 40  →  return "normal" status     │
│  If glut_risk_pct >= 40 →  trigger agent pipeline     │
└─────────────────────────┬────────────────────────────┘
                           │
┌─────────────────────────▼────────────────────────────┐
│ 3. AGENT PIPELINE  (parallel execution, asyncio)       │
│                                                        │
│  supply_agent()  ──┐                                  │
│  market_agent()  ──┤→ [AgentFinding x4]               │
│  risk_agent()    ──┤                                  │
│  resource_agent()──┘                                  │
│                                                        │
│  Each agent runs its deterministic engine call first.  │
│  Ollama call is a best-effort enrichment only.         │
└─────────────────────────┬────────────────────────────┘
                           │
┌─────────────────────────▼────────────────────────────┐
│ 4. OPTIMIZATION  (engine/optimizer.py, OR-Tools)       │
│                                                        │
│  Inputs:                                               │
│    surplus_t to distribute                             │
│    destinations: markets, processors, storage          │
│    routes with effective_cost_per_t                    │
│    capacity constraints per destination                │
│                                                        │
│  Model: CP-SAT integer programming                     │
│    Variables: allocated_t[d] (integer, nearest 10T)    │
│    Objective: minimize total transport cost            │
│    Constraints:                                        │
│      sum(allocated_t) == surplus_t                     │
│      allocated_t[d] <= capacity[d]  for all d         │
│      allocated_t[d] == 0  if destination inactive      │
│      allocated_t[d] <= route_max_t[d]  for all d      │
│                                                        │
│  Solver timeout: 5 seconds                             │
│  If infeasible: allow unallocated_t > 0 (soft target)  │
└─────────────────────────┬────────────────────────────┘
                           │
┌─────────────────────────▼────────────────────────────┐
│ 5. VALIDATION  (engine/validator.py)                   │
│                                                        │
│  For each allocation in plan:                          │
│    - destination is_active == 1                        │
│    - allocated_t <= destination.available_capacity     │
│    - route exists between primary market & destination │
│    - route has sufficient trucks                       │
│    - commodity matches processor.commodity             │
│    - transport_cost_total calculated deterministically  │
│                                                        │
│  If any allocation fails: mark feasible=0              │
│  If sum(feasible) < surplus_t x 0.5:                  │
│    trigger fallback planner                            │
└─────────────────────────┬────────────────────────────┘
                           │
┌─────────────────────────▼────────────────────────────┐
│ 6. PERSIST + RESPOND                                   │
│    Insert plan + allocations into SQLite               │
│    Mark previous plan status = "superseded"            │
│    Return AllocationPlan JSON to frontend              │
└──────────────────────────────────────────────────────┘
```

---

## 6. What-If / Replanning State Model

### State Machine

```
         ┌──────────────┐
    ─────►  NORMAL       │  glut_risk_pct < 40
         └──────┬───────┘
                │ glut_risk_pct >= 40
         ┌──────▼───────┐
         │  DETECTING   │  agent pipeline running
         └──────┬───────┘
                │ plan generated + validated
         ┌──────▼───────┐
    ┌────►  ACTIVE_PLAN  │◄──── what-if returns no new disruption
    │    └──────┬───────┘
    │           │ POST /whatif/apply received
    │    ┌──────▼───────┐
    │    │  REPLANNING  │  what-if patch applied, re-run pipeline
    └────┴──────────────┘
```

State is stored in memory in the FastAPI process (a single `AppState` dict). It is not persisted; refresh always re-derives from DB.

### What-If Application Rules

1. `POST /whatif/apply` receives a `WhatIfPatch`.
2. Backend applies overrides to **in-memory shadow copies** of DB rows (never modifies seed tables). These shadows live in `AppState["overrides"]`.
3. A `ScenarioSnapshot` is rebuilt from the current DB rows merged with overrides.
4. The full pipeline (steps 2–5 above) is re-run.
5. A new `AllocationPlan` is saved to DB with `status="active"`; previous plan becomes `status="superseded"`.
6. The frontend detects the new plan via polling `GET /plan/current` or SSE.

### Shadow Override Store (in-memory)

```python
AppState = {
    "scenario_overrides": {
        "processors": {},          # processor_id -> {field: value}
        "storage_facilities": {},
        "markets": {},
        "logistics_routes": {},
        "expected_supply_override_t": None
    },
    "current_plan_id": "uuid",
    "pipeline_status": "idle|running",
    "agent_log": []               # list of {agent, status, timestamp}
}
```

**Reset:** `POST /whatif/reset` clears `scenario_overrides` and re-runs the baseline pipeline.

---

## 7. API Contracts

All requests/responses are `Content-Type: application/json`. No authentication for prototype.

### 7.1 `GET /scenario/current`

Returns the current `ScenarioSnapshot` reflecting all active overrides.

**Response 200:**
```json
{
  "commodity": "tomato",
  "primary_market_id": "KOLAR",
  "historical_baseline_t": 620.0,
  "current_arrivals_t": 910.0,
  "expected_supply_t": 1200.0,
  "local_absorption_t": 850.0,
  "surplus_t": 350.0,
  "modal_price": 800.0,
  "price_trend_7d_pct": -18.5,
  "weather_risk_score": 0.65,
  "glut_risk_pct": 87.0,
  "available_markets": [
    {"market_id": "BANGALORE", "available_t": 130.0, "distance_km": 100.0}
  ],
  "available_storage": [
    {"facility_id": "S1", "available_t": 80.0}
  ],
  "available_processors": [
    {"processor_id": "P1", "capacity_t": 90.0}
  ],
  "available_routes": [
    {"route_id": "KOLAR_BANGALORE", "max_t": 240.0, "effective_cost_per_t": 80.0}
  ]
}
```

---

### 7.2 `POST /plan/generate`

Triggers full agent pipeline + optimization. Idempotent if the scenario hash is unchanged (returns cached plan).

**Request body:** `{}` (uses current scenario)

**Response 202:**
```json
{ "plan_id": "uuid", "status": "running" }
```

Progress available via SSE (see §7.5).

---

### 7.3 `GET /plan/current`

Returns the current active `AllocationPlan`.

**Response 200:** `AllocationPlan` JSON (see §3.3)  
**Response 204:** No plan exists yet.

---

### 7.4 `POST /whatif/apply`

Applies a `WhatIfPatch` and triggers replanning.

**Request body:** `WhatIfPatch` JSON (see §3.3)

**Response 202:**
```json
{ "plan_id": "uuid-new", "status": "running" }
```

---

### 7.5 `GET /plan/stream` (SSE)

Server-Sent Events stream emitting agent progress during pipeline execution.

**Event types:**
```
event: agent_update
data: {"agent": "supply", "status": "done", "severity": "high"}

event: agent_update
data: {"agent": "market", "status": "done", "severity": "high"}

event: agent_update
data: {"agent": "risk", "status": "done", "severity": "medium"}

event: agent_update
data: {"agent": "resource", "status": "done", "severity": "low"}

event: agent_update
data: {"agent": "coordinator", "status": "done"}

event: plan_ready
data: {"plan_id": "uuid"}
```

---

### 7.6 `GET /network/graph`

Returns graph data for the digital-twin visualization.

**Response 200:**
```json
{
  "nodes": [
    {
      "id": "KOLAR",
      "type": "market",
      "label": "Kolar Mandi",
      "lat": 13.13,
      "lng": 78.13,
      "status": "overloaded",
      "load_pct": 107.0
    }
  ],
  "edges": [
    {
      "source": "KOLAR",
      "target": "BANGALORE",
      "allocated_t": 120.0,
      "route_id": "KOLAR_BANGALORE",
      "active": true
    }
  ]
}
```

Node `status` values: `"normal"` | `"overloaded"` | `"offline"` | `"storage"` | `"processor"` | `"farm"`

---

### 7.7 `POST /whatif/reset`

Clears all what-if overrides and returns to baseline scenario.

**Response 200:** `{ "reset": true }`

---

## 8. Local Ollama / Qwen Interface

### 8.1 Configuration

```python
# config.py
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL    = "qwen2.5:7b"          # fallback: "qwen2.5:3b" if VRAM limited
OLLAMA_TIMEOUT  = 15                    # seconds; if exceeded, use deterministic fallback
```

### 8.2 Call Pattern (`agents/base.py`)

All agent Ollama calls go through a single helper:

```python
def ollama_structured_call(
    system_prompt: str,
    user_message: str,
    output_schema: dict,        # JSON Schema dict
    timeout: int = OLLAMA_TIMEOUT
) -> dict | None:
    """
    POST to Ollama /api/generate with format='json'.
    Validate response against output_schema.
    Return parsed dict, or None on timeout/parse failure.
    """
```

**Implementation details:**
- Uses `requests.post` (sync) with `stream=False`.
- Response expected as a single JSON object matching `output_schema`.
- If response cannot be parsed as valid JSON, or required fields are missing: return `None`.
- Caller treats `None` as "LLM unavailable"; deterministic values are already computed before the call.

### 8.3 Prompt Templates

Each agent has a fixed, minimal prompt. No chain-of-thought or multi-turn conversation.

**Supply Agent prompt:**
```
System: You are an agricultural supply analyst. Respond only with valid JSON matching the schema.
User:   Supply anomaly detected at {market} for {commodity}.
        Baseline: {baseline_t}T, Current: {current_t}T, Anomaly: {anomaly_pct:.1f}%.
        In one sentence, describe the supply situation severity.
        Schema: {"recommendation": "string"}
```

**Coordinator Agent prompt:**
```
System: You are an agricultural logistics coordinator. Respond only with valid JSON.
User:   Glut risk: {glut_risk_pct:.0f}%. Surplus: {surplus_t}T.
        Agent findings: {findings_summary}
        Proposed allocation: {allocation_summary}
        In 2-3 sentences, explain why this allocation plan was selected and what it achieves.
        Schema: {"coordinator_reasoning": "string"}
```

### 8.4 Structured Output Enforcement

- Ollama is called with `"format": "json"` in the request body.
- After parsing, the response dict is checked against a required-keys list.
- If any required key is missing or value type is wrong: treat as `None`.
- LLM is **never** asked to produce numbers, IDs, or allocation values.

### 8.5 Ollama Availability Check

On FastAPI startup, `GET http://localhost:11434/api/tags` is called. If it fails:
- Log a warning.
- Set `AppState["llm_available"] = False`.
- All agents skip Ollama calls and use fallback reasoning strings.
- Frontend displays a `"⚠ Local LLM offline — deterministic mode"` banner.

---

## 9. Deterministic Fallback

The fallback activates automatically when:
- Ollama is unavailable (startup check failed).
- Ollama call times out (exceeds `OLLAMA_TIMEOUT` seconds).
- Ollama returns unparseable JSON.
- OR-Tools solver returns `INFEASIBLE` or times out.

### 9.1 Fallback Planner (`engine/optimizer.py`)

If OR-Tools times out or returns infeasible, a greedy fallback runs:

```
Algorithm:
  Sort destinations by effective_cost_per_t ASC
  remaining_t = surplus_t
  For each destination in sorted order:
    allocate = min(remaining_t, destination.available_t)
    if allocate > 0 and route exists and destination.is_active:
      add to plan
      remaining_t -= allocate
    if remaining_t == 0: break
  unallocated_t = remaining_t
```

This is O(N log N), fully deterministic, always returns a plan (even if partial).

### 9.2 Fallback Reasoning Strings

When LLM is unavailable, each agent returns a pre-composed string parameterized by the deterministic metrics:

```python
# supply_agent.py
def fallback_recommendation(anomaly_pct: float) -> str:
    if anomaly_pct > 40:
        return f"Supply surge of {anomaly_pct:.1f}% above baseline — critical glut risk."
    elif anomaly_pct > 20:
        return f"Elevated arrivals at {anomaly_pct:.1f}% above baseline — moderate glut risk."
    else:
        return f"Arrivals {anomaly_pct:.1f}% above baseline — monitor closely."
```

Similar templates exist for market, risk, and resource agents.

### 9.3 Fallback Plan Flag

`AllocationPlan.fallback_used = true` whenever the greedy algorithm or pre-composed strings were used. The frontend renders a subtle `"Deterministic mode"` indicator in the Response Plan panel.

---

## 10. Implementation Order & Critical Risks

### 10.1 Implementation Order

```
HOUR 0–2  — Foundation (all 4 members)
  [A] Backend bootstrap: FastAPI skeleton + SQLite init + seed_data.py
  [B] Simulation data: write markets.json, storage.json, processors.json, logistics.json
  [C] Frontend scaffold: Vite + React + Zustand + API client stub
  [D] Ollama setup: pull qwen2.5:7b, verify /api/generate works

HOUR 2–6  — Core engine (2 backend members)
  [E] engine/supply.py  — anomaly detection, glut_risk_pct formula
  [F] engine/market.py  — saturation, price trend, alternative markets
  [G] engine/risk.py    — weather score from Open-Meteo payload
  [H] engine/validator.py — constraint checks (safety-critical)
  [I] data/agmarknet.py — fetch AGMARKNET CSV, normalize, cache
  [J] data/weather.py   — fetch Open-Meteo for Kolar lat/lng, cache

HOUR 6–10 — Agents + Optimizer (1 backend + 1 fullstack)
  [K] engine/optimizer.py — OR-Tools CP-SAT model + greedy fallback
  [L] agents/base.py + supply/market/risk/resource agents
  [M] agents/coordinator.py — orchestrate, call optimizer, call LLM
  [N] routers/ — wire all 7 endpoints, SSE stream

HOUR 10–16 — Frontend UI (2 frontend members)
  [O] NetworkGraph.jsx — SVG nodes + edges from /network/graph
  [P] GlutMonitor.jsx + SupplyOverview.jsx
  [Q] AgentActivity.jsx — SSE consumer, live status dots
  [R] ResponsePlan.jsx — allocation table
  [S] WhatIfPanel.jsx — sliders/toggles → POST /whatif/apply

HOUR 16–20 — Integration + What-If (all 4)
  [T] Connect frontend to live backend, fix CORS
  [U] Test what-if scenarios: processor offline, cost +30%, supply increase
  [V] Verify replanning produces a new valid AllocationPlan
  [W] Color-code network nodes by status (red=overloaded, green=normal)

HOUR 20–22 — Polish + Demo Script
  [X] Prepare 8-step demo scenario with fixed seed data
  [Y] Ensure demonstration runs without internet (cache AGMARKNET + weather)
  [Z] Test fallback path: kill Ollama, verify system still produces plan

HOUR 22–24 — Buffer / Bug Fixes
  Reserve for blockers found during final rehearsal.
```

### 10.2 Parallel Work Allocation

| Member | Hours 0–6 | Hours 6–12 | Hours 12–18 | Hours 18–24 |
|---|---|---|---|---|
| **M1 (Backend Lead)** | A, E, F, G | K, L, M | N, integration | U, V, Z |
| **M2 (Backend)** | B, H, I, J | L (agents) | N (routers) | U, V |
| **M3 (Frontend Lead)** | C | O, P | Q, R, S | T, W, X |
| **M4 (Fullstack)** | D, B | M (partial), N | T, W | Y, Z, X |

### 10.3 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AGMARKNET API unavailable or changed format | Medium | High | Cache a static CSV snapshot of recent Kolar tomato data; agmarknet.py checks cache first |
| OR-Tools solver infeasible on demo data | Low | High | Tune simulation data so surplus <= total redirect capacity; greedy fallback always produces a partial plan |
| Ollama too slow on demo hardware (>15 s) | Medium | Medium | Set `OLLAMA_TIMEOUT=15`; fallback reasoning strings are indistinguishable in the demo |
| qwen2.5:7b too large for available VRAM | Medium | Medium | Pre-pull qwen2.5:3b as second option; set model in config.py |
| SSE blocks frontend during replanning | Low | Medium | Use `asyncio.create_task` for pipeline; SSE emits incremental events |
| What-if state corrupts between rapid requests | Medium | Medium | Use `asyncio.Lock` — reject new `/whatif/apply` if pipeline is already running |
| Frontend SVG graph layout unreadable | Low | High | Hardcode node positions from lat/lng scaled to SVG viewport; no force-directed layout needed |
| CORS issues between ports 5173 and 8000 | Low | Medium | Add `CORSMiddleware(allow_origins=["http://localhost:5173"])` on startup |

### 10.4 Minimum Viable Demo Guarantee

If time is critically short, the following subset is sufficient for a compelling demonstration:

1. `engine/supply.py` + `engine/market.py` + `engine/validator.py` — glut detection works
2. `engine/optimizer.py` with greedy fallback — allocation plan always produced
3. `GET /plan/current` + `POST /whatif/apply` — the core what-if loop works
4. `NetworkGraph.jsx` (SVG, hardcoded positions) + `WhatIfPanel.jsx` — visual + interactive
5. Seed data for 1 commodity (tomato), 1 primary market (Kolar), 4 destinations

Ollama/Qwen, OR-Tools CP-SAT, Open-Meteo live fetch, and AGMARKNET live fetch are all **progressive enhancements** — the system demonstrates correctly without any of them.

---

*Document prepared for Bit N Build: Around the World 2026 hackathon. Last updated: 2026-09-12.*
