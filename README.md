# 🌾 AGRI-FLOW

### Regional Agricultural Supply Intelligence & Autonomous Response Network

> **Detect the glut before it becomes a crisis.**

AGRI-FLOW is a multi-agent agricultural coordination system designed to detect **emerging regional supply gluts** and determine how excess agricultural produce can be redistributed across markets, processors, storage facilities, and logistics routes before oversupply causes severe price pressure and avoidable wastage.

Instead of simply predicting crop prices or telling an individual farmer where to sell, AGRI-FLOW looks at the **regional supply network as a whole** and continuously evaluates whether incoming harvest can be absorbed by available demand and infrastructure.

---

## 🚨 The Problem

Agricultural markets can experience sudden local supply surges when large numbers of farmers harvest the same crop around the same time.

When:

```text
Expected Supply > Local Absorption Capacity
```

the resulting surplus can lead to:

* Falling market prices
* Forced distress selling
* Underutilized storage
* Increased transportation pressure
* Produce deterioration and wastage
* Poor coordination between farmers, markets, processors and storage facilities

The challenge is not merely predicting that prices will fall.

The harder question is:

> **When a regional glut is forming, what should the agricultural supply network collectively do with the surplus?**

---

# 💡 Our Solution

AGRI-FLOW creates a **regional agricultural digital twin** that combines real market observations with operational constraints.

It:

1. Monitors agricultural market conditions
2. Detects abnormal supply increases
3. Estimates upcoming supply pressure
4. Evaluates alternative demand destinations
5. Checks storage and processing capacity
6. Calculates logistics feasibility
7. Coordinates multiple specialist agents
8. Generates an actionable response plan
9. Validates the plan against constraints
10. Dynamically replans when conditions change

### Core idea

```text
REAL-WORLD SIGNALS
       ↓
Supply + Market + Weather Data
       ↓
     GLUT RISK
       ↓
  MULTI-AGENT ANALYSIS
       ↓
Resource & Logistics Constraints
       ↓
  COORDINATED RESPONSE
       ↓
  VALIDATED ALLOCATION
       ↓
  LIVE DIGITAL TWIN
```

---

# 🌐 The AGRI-FLOW Digital Twin

The central interface represents the agricultural supply network as a live interactive network.

Instead of visualizing electricity flowing through a city, AGRI-FLOW visualizes **agricultural produce flowing through the regional supply chain**.

```text
                    🏭 PROCESSOR
                         ↑
                         │
🌾 FARMS → 🔴 KOLAR MANDI ─────→ 🏙️ BANGALORE
                         │
                         ↓
                    🧊 STORAGE
                         │
                         ↓
                    🚛 LOGISTICS
```

Nodes represent:

* Farming regions
* Agricultural markets
* Alternative markets
* Processing facilities
* Storage facilities

Edges represent:

* Produce movement
* Transportation routes
* Available capacity

The system dynamically changes the network when the agents generate or modify a response plan.

---

# 🤖 Multi-Agent Architecture

AGRI-FLOW uses a small number of specialized agents rather than one general-purpose chatbot.

## 1. Supply Agent 🌾

Determines whether incoming agricultural supply is abnormal.

### Responsibilities

* Analyze historical arrivals
* Compare current arrivals against baselines
* Estimate upcoming harvest pressure
* Identify synchronized supply surges

### Example

```text
Historical arrival baseline: 620T
Current arrival:             910T

Arrival anomaly: +47%
```

---

## 2. Market Agent 📈

Evaluates market absorption and price conditions.

### Responsibilities

* Monitor mandi prices
* Analyze price trends
* Compare nearby markets
* Identify potential alternative demand
* Estimate market saturation

---

## 3. Risk Agent 🌦️

Evaluates external conditions that can influence supply.

### Inputs

* Weather forecasts
* Temperature
* Rainfall
* Harvest conditions

### Example

```text
Heavy rainfall expected
        ↓
Potential harvest concentration
        ↓
Higher short-term arrival pressure
```

---

## 4. Resource Agent 🧊🚛

Evaluates the physical resources available to absorb or redirect surplus.

### Checks

* Storage capacity
* Processing capacity
* Transportation capacity
* Route feasibility
* Estimated transportation cost
* Holding constraints

---

## 5. Coordinator Agent 🧠

The Coordinator is responsible for synthesizing the specialist outputs.

It:

* Collects agent findings
* Resolves conflicting recommendations
* Selects feasible interventions
* Requests additional analysis when required
* Produces the response plan
* Triggers replanning when conditions change

The final recommendation is then passed through deterministic validation before being displayed.

---

# 🔄 Why Agents?

A conventional ML model could predict:

> "There is a high probability of a supply glut."

An optimization algorithm could calculate:

> "Send 120T to Market B."

But the real-world problem requires **continuous coordination between multiple changing factors**.

AGRI-FLOW therefore follows:

```text
Observe
   ↓
Investigate
   ↓
Reason
   ↓
Coordinate
   ↓
Act
   ↓
Observe changed conditions
   ↓
Replan
```

This allows the system to respond when assumptions change instead of producing a static recommendation.

---

# ⚡ Dynamic Replanning

One of AGRI-FLOW's core capabilities is **what-if simulation**.

After generating an initial plan, the user can introduce disruptions.

### Example

Initial plan:

```text
120T → Bangalore
90T  → Processor
80T  → Storage
60T  → Mysore
```

The user then disables the processor:

```text
🏭 PROCESSOR ❌ OFFLINE
```

AGRI-FLOW detects that the existing plan is no longer feasible.

The Coordinator triggers replanning:

```text
90T Processor allocation
        ↓
Alternative capacity search
        ↓
Storage + markets + logistics
        ↓
New validated plan
```

Other scenarios include:

* Transportation cost +30%
* Storage capacity reduced
* Alternative market becomes unavailable
* Expected supply increases
* Processing capacity changes

This demonstrates the system's ability to **adapt rather than simply predict**.

---

# 📊 Data Sources

AGRI-FLOW intentionally combines **real public agricultural observations** with a controlled operational simulation.

## Real Data

### AGMARKNET / data.gov.in

Used for agricultural market observations such as:

* Commodity
* Market / APMC
* Minimum price
* Maximum price
* Modal price
* Market arrivals where available
* Date

AGMARKNET provides public agricultural market information across Indian markets.

Source:

* Government of India
* data.gov.in
* AGMARKNET / e-NAM ecosystem

---

### Weather Data

Weather information is obtained through **Open-Meteo**.

Used variables include:

* Temperature
* Precipitation
* Forecast conditions
* Historical weather observations

Open-Meteo provides weather data through a free API and does not require an API key for its standard non-commercial usage.

---

# 🧪 Simulated Operational Data

Some information required for real-time supply coordination is generally not available through a single open public API.

Therefore AGRI-FLOW uses a controlled operational dataset for the prototype.

These include:

### Markets

```text
market_id
name
location
capacity
current_load
latitude
longitude
```

### Storage Facilities

```text
facility_id
capacity
available_capacity
holding_cost
location
```

### Processing Facilities

```text
processor_id
commodity
capacity
location
```

### Logistics

```text
origin
destination
distance
truck_capacity
transport_cost
available_trucks
```

These values are explicitly treated as **simulation inputs**, not claimed to represent live private logistics infrastructure.

---

# 🧮 Decision Engine

The LLM is **not responsible for numerical calculations**.

AGRI-FLOW separates reasoning from computation.

```text
                 DATA
                  ↓
        ┌──────────────────┐
        │ Deterministic    │
        │ Data Engine      │
        └────────┬─────────┘
                 ↓
       Supply / Market / Risk
                 ↓
        ┌──────────────────┐
        │ Optimization      │
        │ Engine            │
        └────────┬─────────┘
                 ↓
          Agent Coordinator
                 ↓
        ┌──────────────────┐
        │ Validation Layer │
        └────────┬─────────┘
                 ↓
          Final Response
```

Python handles:

* Statistical calculations
* Supply estimates
* Capacity constraints
* Transportation costs
* Feasibility checks
* Optimization

The LLM handles:

* Agent coordination
* Reasoning over specialist findings
* Explanation
* Decision synthesis
* Replanning triggers

This reduces hallucination risk and keeps the decision system deterministic where numerical correctness matters.

---

# 🧠 Local AI

AGRI-FLOW is designed to operate without paid proprietary LLM APIs.

The prototype uses a locally hosted model through:

**Ollama**

This means the core agentic workflow can operate without requiring:

* OpenAI API credits
* Claude API credits
* Gemini API credits
* Paid inference services

A deterministic fallback planner is also maintained so that the core demonstration does not depend entirely on successful LLM inference.

---

# 🏗️ Technology Stack

| Layer           | Technology                   |
| --------------- | ---------------------------- |
| Frontend        | React + Vite                 |
| Visualization   | Three.js / React Three Fiber |
| Backend         | Python + FastAPI             |
| Data Processing | Pandas                       |
| Database        | SQLite                       |
| Optimization    | Google OR-Tools              |
| Charts          | Recharts                     |
| Maps            | Leaflet                      |
| Local LLM       | Ollama + Qwen                |
| Market Data     | AGMARKNET / data.gov.in      |
| Weather         | Open-Meteo                   |

The visualization may use a lightweight SVG implementation if required for rapid prototyping, with Three.js used where time permits.

---

# 🖥️ Core Interface

The primary interface contains:

### Regional Network

Interactive visualization of:

* Farms
* Markets
* Processors
* Storage
* Transport routes

### Glut Monitor

```text
GLUT RISK

87% — HIGH
```

### Supply Overview

```text
Expected Supply       1,200T
Local Absorption        850T
Projected Surplus       350T
```

### Agent Activity

```text
✓ Supply Agent
✓ Market Agent
✓ Risk Agent
✓ Resource Agent
🧠 Coordinator
```

### Response Plan

```text
120T → Bangalore
90T  → Processor
80T  → Storage
60T  → Mysore
```

### What-If Controls

Users can dynamically modify:

* Storage availability
* Processing capacity
* Transport costs
* Market availability
* Expected supply

and observe the system replan.

---

# 🎬 Demonstration Flow

The intended demonstration follows a complete real-world scenario.

### Step 1 — Normal Conditions

The regional network operates normally.

Markets remain within their expected absorption levels.

---

### Step 2 — Supply Surge

The system receives abnormal arrival data and increased expected harvest.

```text
Supply ↑
Market absorption → limited
Price ↓
```

The system detects an emerging glut.

---

### Step 3 — Agent Investigation

Specialist agents activate.

```text
🌾 Supply Agent       → Supply anomaly detected
📈 Market Agent       → Market saturation detected
🌦️ Risk Agent         → Harvest risk identified
🧊 Resource Agent     → Alternative capacity found
🧠 Coordinator        → Response generated
```

---

### Step 4 — Digital Twin Reacts

The affected market turns red.

Surplus produce begins flowing toward feasible alternatives.

---

### Step 5 — Disruption

The judge disables a processor.

```text
🏭 PROCESSOR ❌
```

---

### Step 6 — Autonomous Replanning

AGRI-FLOW detects that the existing plan is invalid.

The Coordinator generates a new allocation.

---

### Step 7 — Second Disruption

Transportation cost is increased.

```text
Transport Cost
₹X → ₹1.3X
```

The system recalculates the economics and generates another plan.

---

### Step 8 — Final Result

The digital twin stabilizes around a new feasible allocation.

The system explains:

> **Why the original plan changed, which constraints caused the change, and what the new response achieves.**

---

# 🎯 Design Philosophy

AGRI-FLOW is intentionally **not**:

* A generic farmer chatbot
* A crop disease detector
* A simple crop price predictor
* A farmer marketplace
* A digital auction platform
* A payment platform
* A blockchain system

The focus is:

> **Regional supply-shock detection and coordinated response.**

---

# 🔐 Reliability Principles

AGRI-FLOW follows several safeguards:

### Deterministic numerical layer

Numerical decisions are calculated using deterministic code rather than generated by an LLM.

### Constraint validation

Every generated allocation is checked against:

* Capacity
* Transport availability
* Storage limits
* Processing limits
* Commodity compatibility

### LLM output schema

Agent outputs are structured and validated before being consumed by downstream components.

### Fallback planning

If the local LLM fails, the deterministic planner can still produce a valid response.

---

# 🚀 Future Scope

Potential extensions include:

* Integration with additional agricultural datasets
* Real-time FPO inventory
* Live logistics providers
* Processor procurement systems
* Crop-specific deterioration models
* Better regional demand estimation
* Multi-FPO coordination
* Predictive harvest modeling
* Integration with government agricultural platforms
* Historical glut event analysis

---

# 👥 Intended Users

AGRI-FLOW is primarily designed as a decision-support system for:

* Farmer Producer Organizations (FPOs)
* Agricultural cooperatives
* Market coordinators
* Procurement organizations
* Agricultural logistics planners
* Government agricultural planners

It is intended to support **collective coordination**, rather than replace individual farmers' decisions.

---

# 🌱 Impact

AGRI-FLOW aims to shift agricultural supply management from:

```text
Glut occurs
     ↓
Prices collapse
     ↓
Reactive intervention
```

toward:

```text
Early signals
     ↓
Glut risk detected
     ↓
Collective coordination
     ↓
Supply redistributed
     ↓
Reduced pressure on saturated markets
```

The system's reported impact metrics are **model estimates from the simulation**, not claims of measured real-world economic impact.

---

# 📌 Project Status

**Hackathon Prototype — Bit N Build: Around the World 2026**

The prototype prioritizes:

* Agentic coordination
* Real agricultural data
* Deterministic decision-making
* Dynamic replanning
* Interactive digital-twin visualization
* Zero-cost/local AI inference
* Demonstrable real-world utility

---

## ⚠️ Data Disclaimer

AGRI-FLOW is a prototype decision-support system.

Market observations are based on publicly available agricultural data. Storage, processing, transportation, and other operational capacities used in the prototype may be simulated for demonstration purposes.

Recommendations should not be treated as guaranteed financial, agricultural, or logistical advice.

---

# ⭐ Core Concept

> **AGRI-FLOW doesn't just predict that a glut is coming.**
>
> **It coordinates the network's response to it.**

```text
🌾 SUPPLY
    ↓
📊 DETECT
    ↓
🤖 INVESTIGATE
    ↓
🧠 COORDINATE
    ↓
🚛 REDISTRIBUTE
    ↓
🔄 REPLAN
    ↓
🌱 STABILIZE
```

**AGRI-FLOW — Detect the glut before it becomes a crisis.**
