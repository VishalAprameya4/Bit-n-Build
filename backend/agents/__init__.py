"""
agents package
Multi-agent intelligence layer for AGRI-FLOW.
"""
from agents.base import AgentFinding, make_event, ollama_structured_call, check_ollama_available
from agents.supply_agent import SupplyAgent
from agents.market_agent import MarketAgent
from agents.risk_agent import RiskAgent
from agents.resource_agent import ResourceAgent
from agents.coordinator import CoordinatorAgent

__all__ = [
    "AgentFinding",
    "make_event",
    "ollama_structured_call",
    "check_ollama_available",
    "SupplyAgent",
    "MarketAgent",
    "RiskAgent",
    "ResourceAgent",
    "CoordinatorAgent",
]
