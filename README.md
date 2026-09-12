# 🌱 AGRI-FLOW
## Regional Agricultural Supply Intelligence & Autonomous Response Network

> **Detect the glut before it becomes a crisis.**

AGRI-FLOW is an **agentic AI-powered agricultural supply intelligence and response system** that detects emerging regional supply gluts and coordinates responses across markets, storage, processing, and logistics.

Instead of reacting after markets become overloaded and prices collapse, AGRI-FLOW combines **live agricultural market data, weather intelligence, multi-agent reasoning, optimization, validation, and an interactive Digital Twin** to determine what is happening, why it is happening, and what action should be taken.

---

## 🚨 The Problem

Agricultural supply disruptions are often caused by a lack of coordination between:

- Crop supply and harvest timing
- Market absorption capacity
- Weather conditions
- Storage availability
- Processing capacity
- Logistics

When large volumes of produce reach a region simultaneously, local markets can become saturated, prices can decline, and available storage or processing capacity may remain underutilized.

**AGRI-FLOW addresses this regional coordination gap.**

---

## 💡 The Solution

AGRI-FLOW continuously analyzes regional agricultural signals and detects emerging supply pressure.

When a potential glut is identified, specialized agents investigate the situation and a coordinator determines an appropriate response.

```text
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

🤖 Agentic AI

AGRI-FLOW uses a hybrid agentic architecture.

Specialist Agents

Market Agent

Analyzes mandi arrivals
Tracks price trends
Evaluates market saturation
Identifies alternative markets

Weather Agent

Analyzes current and forecast weather
Evaluates rainfall and harvest pressure
Identifies weather-driven risks

Supply Agent

Compares current arrivals with historical baselines
Detects abnormal supply surges
Estimates regional supply pressure

Resource Agent

Checks storage capacity
Evaluates processing capacity
Checks secondary market availability
Evaluates operational constraints
Coordinator Agent

The central coordinator uses Qwen running through Ollama to:

Interpret evidence from specialist agents
Select the next action/tool
Synthesize findings
Determine a response strategy
Generate the final decision

Python tools handle deterministic calculations, while the LLM handles coordination and reasoning.

⚙️ Optimization & Validation

Once a response strategy is selected, AGRI-FLOW uses Google OR-Tools CP-SAT to determine a cost-efficient allocation.

The optimizer considers:

Destination capacity
Storage capacity
Processing capacity
Route constraints
Fleet constraints
Commodity compatibility
Transportation cost

The resulting plan is passed through a validation layer before being presented as the final response.

Coordinator Decision
        ↓
   OR-Tools Solver
        ↓
   Feasible Plan
        ↓
      Validator
        ↓
   Final Response
🌍 Agricultural Digital Twin

AGRI-FLOW includes an interactive Digital Twin that visualizes the agricultural response as an operational scenario.

It represents:

Agricultural fields
Crop harvesting
Trucks and routes
Storage facilities
Processing units
Markets
Weather events
Produce movement

The Digital Twin allows users to understand the response visually instead of relying only on tables and metrics.

🔄 What-If Disruption & Replanning

Agricultural networks are dynamic.

A route may become unavailable, market capacity may change, or a facility may become constrained.

AGRI-FLOW allows disruptions to be introduced into the simulated network.

The system then:

Existing Plan
      ↓
   Disruption
      ↓
 Re-evaluate
      ↓
 Coordinator
      ↓
 Re-optimize
      ↓
  Validate
      ↓
 New Response Plan

This demonstrates that AGRI-FLOW can adapt its response instead of relying on a static recommendation.

📡 Data Sources
Live Data

AGMARKNET / India OGD

Mandi arrivals
Minimum price
Maximum price
Modal price
Historical market trends

Open-Meteo

Current weather
Temperature
Rainfall
Precipitation probability
Forecast conditions
Simulation Data

The prototype uses controlled simulation data for:

Storage availability
Processing capacity
Secondary market capacity
Logistics routes
Fleet availability

Live observations and simulated operational data are kept separate.

🖥️ System Interface
Overview

Provides a real-time view of:

Supply conditions
Market conditions
Price movement
Surplus
Market saturation
Weather pressure
Recommended response
Field Intelligence

Connects crop lifecycle and field conditions with weather and harvest decisions.

Digital Twin

Visualizes harvesting, transportation, storage, market dispatch, weather events, and recovery.

Agent Brain

Makes the multi-agent decision process visible:

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
🛠️ Tech Stack
Component	Technology
Frontend	React
Backend	Python + FastAPI
Agentic AI	Qwen + Ollama
Optimization	Google OR-Tools
Market Data	AGMARKNET / India OGD
Weather Data	Open-Meteo
Visualization	Interactive Digital Twin
Version Control	Git + GitHub
📂 Project Structure
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
🚀 Running Locally
1. Start Ollama

Make sure Ollama is installed and the configured Qwen model is available.

ollama ls

Run the model if required:

ollama run qwen3:8b
2. Start the Backend

From the project root:

python -m uvicorn backend.main:app --reload --port 8000

Backend:

http://localhost:8000
3. Start the Frontend
cd frontend
npm install
npm run dev

Open the local URL provided by Vite.

🎯 Example Scenario

A tomato-producing region begins experiencing rapidly increasing arrivals while market prices decline.

AGRI-FLOW detects:

Arrivals ↑
Prices ↓
Market Saturation ↑
Weather Pressure ↑

The specialist agents investigate the situation.

The Coordinator determines that the primary market cannot safely absorb the projected supply and recommends:

HARVEST + SPLIT DISPATCH

The optimizer distributes the surplus across suitable destinations while minimizing freight cost.

The validator verifies the resulting plan.

The Digital Twin then visualizes the response.

If a disruption occurs, AGRI-FLOW can re-evaluate the network and generate a new validated plan.

🌱 Key Differentiator

AGRI-FLOW is not simply a:

Farmer marketplace
Price prediction dashboard
Chatbot
Logistics tracker
Static optimization algorithm

It combines:

Real agricultural intelligence + multi-agent reasoning + deterministic tools + optimization + validation + simulation + autonomous replanning

to turn fragmented agricultural signals into coordinated action.

From fragmented signals to coordinated agricultural action.

🔮 Future Scope
Real-time storage occupancy
Live fleet tracking
Farmer-level supply forecasting
Commodity-specific demand forecasting
Dynamic price forecasting
Crop-specific spoilage prediction
Multi-region coordination
More agricultural IoT integrations
Learning from historical response plans
👥 Team
VISHAL APRAMEYA
SHASHANK SREENIVAS
SMARAN K RAO
SRINIVAS SHANBAGH
🌱 AGRI-FLOW

Regional Agricultural Supply Intelligence & Autonomous Response Network

Detect the glut before it becomes a crisis.