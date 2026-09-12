# 🌱 AGRI-FLOW

### Regional Agricultural Supply Intelligence & Autonomous Response Network

> **Detect the glut before it becomes a crisis.**

AGRI-FLOW is an **agentic AI-powered agricultural supply intelligence and response system** that detects emerging regional supply gluts and coordinates responses across markets, storage, processing, and logistics.

It combines **live agricultural market data, weather intelligence, multi-agent AI reasoning, optimization, validation, and an interactive Digital Twin** to move from fragmented signals to coordinated action.

---

## 🚨 Problem

Agricultural supply disruptions are often caused by a lack of coordination between:

- 🌾 Crop supply and harvest timing
- 🏪 Market absorption capacity
- 🌦️ Weather conditions
- 🧊 Storage availability
- 🏭 Processing capacity
- 🚚 Logistics

When large volumes of produce reach a region simultaneously, markets can become saturated, prices can decline rapidly, and available storage or processing capacity may remain underutilized.

**AGRI-FLOW addresses this regional coordination gap.**

---

## 💡 Solution

AGRI-FLOW continuously analyzes agricultural signals and detects emerging supply pressure.

When a potential glut is identified, specialized agents investigate different aspects of the situation. A central coordinator then synthesizes their findings, determines a response, optimizes the allocation, and validates the resulting plan.

~~~text
Live Market + Weather Data
            ↓
       Glut Detection
            ↓
     Specialist Agents
            ↓
     Coordinator Agent
            ↓
      Response Decision
            ↓
      OR-Tools Optimizer
            ↓
        Validation
            ↓
      Response Plan
            ↓
      Digital Twin
            ↓
   What-If Replanning
~~~

---

## 🤖 Agentic AI

AGRI-FLOW uses a **hybrid multi-agent architecture** combining LLM reasoning with deterministic engineering tools.

### 📈 Market Agent

Analyzes:

- Mandi arrivals
- Price trends
- Market saturation
- Alternative market capacity

### 🌦️ Weather Agent

Analyzes:

- Current weather
- Rainfall forecasts
- Temperature
- Precipitation probability
- Harvest pressure

### 🌾 Supply Agent

Analyzes:

- Historical arrival baselines
- Current supply
- Supply anomalies
- Harvest pressure
- Regional surplus

### 🏭 Resource Agent

Evaluates:

- Cold storage capacity
- Processing capacity
- Secondary market capacity
- Logistics constraints

### 🧠 Coordinator Agent

Powered by **Qwen through Ollama**, the coordinator:

- Interprets specialist findings
- Selects actions/tools
- Synthesizes evidence
- Determines the response strategy
- Coordinates optimization and validation
- Generates the final decision

Python tools handle deterministic calculations, while the LLM provides reasoning and coordination.

---

## ⚙️ Optimization

AGRI-FLOW uses **Google OR-Tools CP-SAT** to determine a cost-efficient response allocation.

The optimizer considers:

- Destination capacity
- Storage capacity
- Processing capacity
- Route constraints
- Fleet constraints
- Commodity compatibility
- Transportation cost

The objective is to find a **feasible, cost-efficient allocation** for the detected surplus.

---

## ✅ Validation

Every generated response plan is validated before being presented as actionable.

The validation layer checks:

- Destination availability
- Capacity constraints
- Route feasibility
- Truck limits
- Commodity compatibility
- Allocation feasibility
- Network bottlenecks

~~~text
Coordinator Decision
        ↓
   OR-Tools Solver
        ↓
   Proposed Plan
        ↓
      Validator
        ↓
   Validated Response
~~~

---

## 🌍 Digital Twin

AGRI-FLOW includes an interactive agricultural **Digital Twin** that visualizes the response as an operational scenario.

It represents:

- 🌾 Agricultural fields
- 🚜 Crop harvesting
- 🚚 Trucks and routes
- 🧊 Storage facilities
- 🏭 Processing units
- 🏪 Markets
- 🌧️ Weather events
- 📦 Produce movement

Instead of presenting only numbers and tables, the Digital Twin shows how the response unfolds across the regional agricultural network.

---

## 🔄 What-If Replanning

Agricultural networks are dynamic.

A route may become unavailable, a destination may lose capacity, or network conditions may change.

AGRI-FLOW supports disruption simulation and autonomous replanning.

~~~text
Existing Plan
      ↓
   Disruption
      ↓
 Re-evaluate Network
      ↓
 Coordinator Reasoning
      ↓
 Re-optimize
      ↓
  Validate
      ↓
 New Response Plan
~~~

This allows the system to adapt instead of relying on a static recommendation.

---

## 📡 Data Sources

### Live Data

**AGMARKNET / India OGD**

Used for:

- Mandi arrivals
- Minimum prices
- Maximum prices
- Modal prices
- Historical market trends

**Open-Meteo**

Used for:

- Current weather
- Temperature
- Rainfall
- Precipitation probability
- Forecast conditions

### Simulation Data

The prototype uses controlled simulation data for:

- Storage availability
- Processing capacity
- Secondary market capacity
- Logistics routes
- Fleet availability

Live observations and simulated operational data are explicitly separated.

---

## 🖥️ System Interface

### Overview

Provides a high-level view of the current agricultural situation, including:

- Supply conditions
- Market conditions
- Price movement
- Surplus
- Market saturation
- Weather pressure
- Recommended response

### Field Intelligence

Connects crop lifecycle and field conditions with:

- Expected harvest
- Crop maturity
- Weather forecasts
- Harvest windows
- Field-level recommendations

### Digital Twin

Visualizes:

- Harvesting
- Produce movement
- Storage
- Market dispatch
- Weather events
- Recovery

### Agent Brain

Makes the autonomous decision process visible:

~~~text
Live Data
    ↓
Specialist Agents
    ↓
Coordinator
    ↓
Decision
    ↓
Optimization
    ↓
Validation
    ↓
Response
~~~

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Frontend | React |
| Backend | Python + FastAPI |
| Agentic AI | Qwen + Ollama |
| Optimization | Google OR-Tools |
| Market Data | AGMARKNET / India OGD |
| Weather Data | Open-Meteo |
| Visualization | Interactive Digital Twin |
| Version Control | Git + GitHub |

---

## 📂 Project Structure

~~~text
AGRI-FLOW/
│
├── backend/
│   ├── agents/
│   ├── data/
│   ├── engine/
│   ├── routers/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   └── seed_data.py
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── data/
│   └── simulation/
│
├── .gitignore
└── README.md
~~~

---

## 🚀 Running Locally

### 1. Start Ollama

Make sure Ollama is installed and the configured Qwen model is available.

~~~bash
ollama ls
~~~

Run the model if required:

~~~bash
ollama run qwen3:8b
~~~

### 2. Start the Backend

From the project root:

~~~bash
python -m uvicorn backend.main:app --reload --port 8000
~~~

Backend:

~~~text
http://localhost:8000
~~~

### 3. Start the Frontend

~~~bash
cd frontend
npm install
npm run dev
~~~

Open the local URL provided by Vite.

---

## 🎯 Example Scenario

Consider a tomato-producing region experiencing rapidly increasing arrivals while market prices are declining.

AGRI-FLOW detects:

~~~text
Arrivals          ↑
Price             ↓
Market Saturation ↑
Weather Pressure  ↑
~~~

The specialist agents investigate the situation.

The Coordinator determines that the primary market cannot safely absorb the projected supply and recommends:

### **HARVEST + SPLIT DISPATCH**

The optimizer distributes the surplus across suitable destinations while minimizing freight cost.

The validator checks the resulting plan.

The Digital Twin then visualizes the response.

If a disruption occurs, AGRI-FLOW can re-evaluate the network and generate a new validated plan.

---

## 🌱 Key Differentiator

AGRI-FLOW is not simply a:

- Farmer marketplace
- Price prediction dashboard
- Chatbot
- Logistics tracker
- Static optimization algorithm

It combines:

**Real agricultural intelligence + multi-agent reasoning + deterministic tools + optimization + validation + simulation + autonomous replanning**

to transform fragmented agricultural signals into coordinated action.

> **From fragmented agricultural signals to coordinated action.**

---

## 🔮 Future Scope

- Real-time storage occupancy
- Live fleet tracking
- Farmer-level supply forecasting
- Commodity-specific demand forecasting
- Dynamic price forecasting
- Crop-specific spoilage prediction
- Multi-region coordination
- Additional agricultural IoT integrations
- Learning from historical response plans

---

# 👥 Team

VISHAL APRAMEYA
SHASHANK SREENIVAS
SMARAN K RAO
SRINIVAS SHANBAGH

---

### 🌱 AGRI-FLOW

**Regional Agricultural Supply Intelligence & Autonomous Response Network**

> **Detect the glut before it becomes a crisis.**
