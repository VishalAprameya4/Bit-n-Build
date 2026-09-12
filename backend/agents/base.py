"""
agents/base.py
Base abstractions, data contracts, and Ollama integration for AGRI-FLOW agents.

Contracts:
- AgentFinding: Standard output returned by all specialist agents.
- AgentTraceEvent: Activity trace item for UI visibility and explainability.
- ollama_structured_call: Safe, structured JSON caller for local Ollama/Qwen.
"""
import json
import urllib.request
import urllib.error
from typing import TypedDict, Any
from config import OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT


class AgentFinding(TypedDict):
    agent: str
    anomaly_detected: bool
    severity: str  # "low" | "medium" | "high" | "critical"
    key_metrics: dict[str, Any]
    recommendation: str
    constraints: list[str]
    tool_events: list[dict[str, Any]]


def make_event(
    agent: str,
    action: str,
    status: str,
    summary: str,
    tool: str,
    reason: str | None = None,
    next_action: str | None = None,
) -> dict[str, Any]:
    """Create a standardized trace event for UI consumption and agentic explainability."""
    evt: dict[str, Any] = {
        "agent": agent,
        "action": action,
        "status": status,
        "summary": summary,
        "tool": tool,
    }
    if reason:
        evt["reason"] = reason
    if next_action:
        evt["next_action"] = next_action
    return evt


import time

_OLLAMA_CACHE = {"available": None, "last_checked": 0.0}


def check_ollama_available(base_url: str = OLLAMA_BASE_URL, timeout: float = 0.5, force_refresh: bool = False) -> bool:
    """Check if local Ollama daemon is active and responsive with short TTL caching."""
    now = time.time()
    if not force_refresh and _OLLAMA_CACHE["available"] is not None and (now - _OLLAMA_CACHE["last_checked"] < 10.0):
        return bool(_OLLAMA_CACHE["available"])

    url = f"{base_url.rstrip('/')}/api/tags"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AGRI-FLOW/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            is_ok = (resp.status == 200)
            _OLLAMA_CACHE["available"] = is_ok
            _OLLAMA_CACHE["last_checked"] = now
            return is_ok
    except Exception:
        _OLLAMA_CACHE["available"] = False
        _OLLAMA_CACHE["last_checked"] = now
        return False


def ollama_structured_call(
    system_prompt: str,
    user_message: str,
    output_schema: dict[str, Any] | None = None,
    timeout: int = OLLAMA_TIMEOUT,
    model: str = OLLAMA_MODEL,
    base_url: str = OLLAMA_BASE_URL,
) -> dict[str, Any] | None:
    """
    Call Ollama /api/generate with format='json'.
    Returns parsed JSON dictionary on success, or None on failure/timeout/fallback.
    """
    if not check_ollama_available(base_url=base_url):
        return None

    url = f"{base_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "system": system_prompt,
        "prompt": user_message,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.1,  # Low temperature for deterministic/factual reasoning
        },
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json", "User-Agent": "AGRI-FLOW/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return None
            body = json.loads(resp.read().decode("utf-8"))
            raw_response = body.get("response", "")
            parsed = json.loads(raw_response)

            # Validate required schema keys if specified
            if output_schema and "required" in output_schema:
                for k in output_schema["required"]:
                    if k not in parsed:
                        return None
            return parsed
    except Exception:
        return None
