"""
backend/agents/weather_agent.py
Weather Agent: Dynamically retrieves real weather conditions and forecasts for Kolar from Open-Meteo.

Target Coordinates:
  Kolar agricultural region: Lat 13.1367 N, Lon 78.1348 E

Features:
- get_current_weather()
- get_weather_forecast()
- calculate_weather_risk()
- Normalized evidence model
- Robust last-known-good cache (backend/data/cache/weather_cache.json)
- Live -> Cache -> Simulation Fallback hierarchy
"""
import datetime
import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from agents.base import make_event

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
CACHE_FILE = CACHE_DIR / "weather_cache.json"

KOLAR_LAT = 13.1367
KOLAR_LON = 78.1348

# Simulation fallback values (guarantees 100% demo safety)
SIMULATION_FALLBACK = {
    "location": "Kolar, Karnataka, India",
    "latitude": KOLAR_LAT,
    "longitude": KOLAR_LON,
    "temp_celsius": 29.5,
    "humidity_pct": 74.0,
    "precipitation_mm": 18.0,
    "precipitation_probability_pct": 80.0,
    "weather_code": 61,
    "weather_description": "Rain / Showers",
    "wind_speed_kmh": 14.5,
    "observed_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:00"),
    "forecast_24h": {
        "rainfall_sum_mm": 24.5,
        "temp_max_c": 31.0,
        "temp_min_c": 21.0,
        "precipitation_probability_max": 85.0,
        "harvest_concentration_risk": True,
    },
    "forecast_72h": {
        "rainfall_sum_mm": 48.0,
        "harvest_risk_window_hours": 48,
    },
    "weather_risk_score": 0.65,
    "source": "Open-Meteo Forecast API",
    "source_status": "simulation_fallback",
    "confidence": 0.85,
    "freshness": "synthetic_baseline",
}

WMO_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


class WeatherAgent:
    name = "Weather Agent"

    def __init__(self):
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _load_cache(self) -> dict[str, Any] | None:
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    def _save_cache(self, data: dict[str, Any]) -> None:
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[WeatherAgent] Cache write warning: {e}")

    def fetch_live_weather(self, events: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
        """Fetch live conditions and multi-day forecast from Open-Meteo for Kolar."""
        if events is not None:
            events.append(
                make_event(
                    agent=self.name,
                    action="CONNECT_OPEN_METEO",
                    status="running",
                    summary=f"Connecting to Open-Meteo API for Kolar region ({KOLAR_LAT}°N, {KOLAR_LON}°E)...",
                    tool="open_meteo_client",
                    reason="Retrieve live temperature, humidity, precipitation, and 72-hour rainfall forecast.",
                    next_action="PARSE_WEATHER_RESPONSE",
                )
            )

        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={KOLAR_LAT}&longitude={KOLAR_LON}"
            f"&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
            f"&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max"
            f"&timezone=Asia%2FKolkata"
        )

        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "AGRI-FLOW-WeatherIntelligence/1.0", "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    raw = json.loads(resp.read().decode("utf-8"))
                    
                    current = raw.get("current", {})
                    daily = raw.get("daily", {})
                    hourly = raw.get("hourly", {})

                    now_str = datetime.datetime.utcnow().isoformat()
                    cur_temp = float(current.get("temperature_2m", 28.0))
                    cur_humidity = float(current.get("relative_humidity_2m", 65.0))
                    cur_precip = float(current.get("precipitation", 0.0))
                    cur_code = int(current.get("weather_code", 0))
                    cur_wind = float(current.get("wind_speed_10m", 12.0))
                    cur_time = current.get("time", now_str)

                    # 24h & 72h Aggregations
                    daily_precip = daily.get("precipitation_sum", [0.0, 0.0, 0.0])
                    precip_24h = float(daily_precip[0]) if len(daily_precip) > 0 else cur_precip
                    precip_72h = float(sum(daily_precip[:3])) if len(daily_precip) >= 3 else (precip_24h * 2)

                    temp_max = daily.get("temperature_2m_max", [cur_temp])[0] if daily.get("temperature_2m_max") else cur_temp
                    temp_min = daily.get("temperature_2m_min", [cur_temp - 8.0])[0] if daily.get("temperature_2m_min") else cur_temp - 8.0
                    precip_prob_max = daily.get("precipitation_probability_max", [60.0])[0] if daily.get("precipitation_probability_max") else 60.0

                    risk_metrics = self.calculate_weather_risk(
                        rainfall_24h_mm=precip_24h,
                        temp_c=cur_temp,
                        precip_prob=float(precip_prob_max or 50.0),
                    )

                    weather_desc = WMO_CODE_MAP.get(cur_code, "Partly cloudy")

                    if events is not None:
                        events.append(
                            make_event(
                                agent=self.name,
                                action="PARSE_WEATHER_RESPONSE",
                                status="complete",
                                summary=(
                                    f"Open-Meteo verified: {cur_temp:.1f}°C, {weather_desc}, "
                                    f"Humidity {cur_humidity:.0f}%, 24h Rain: {precip_24h:.1f}mm (Risk Score: {risk_metrics['weather_risk_score']:.2f})."
                                ),
                                tool="open_meteo_client",
                                reason="Live atmospheric telemetry successfully ingested.",
                                next_action="EMIT_WEATHER_EVIDENCE",
                            )
                        )

                    result = {
                        "location": "Kolar, Karnataka, India",
                        "latitude": KOLAR_LAT,
                        "longitude": KOLAR_LON,
                        "temp_celsius": cur_temp,
                        "humidity_pct": cur_humidity,
                        "precipitation_mm": cur_precip,
                        "precipitation_probability_pct": float(precip_prob_max or 50.0),
                        "weather_code": cur_code,
                        "weather_description": weather_desc,
                        "wind_speed_kmh": cur_wind,
                        "observed_at": cur_time,
                        "fetched_at": now_str,
                        "forecast_24h": {
                            "rainfall_sum_mm": round(precip_24h, 1),
                            "temp_max_c": round(float(temp_max), 1),
                            "temp_min_c": round(float(temp_min), 1),
                            "precipitation_probability_max": round(float(precip_prob_max or 50.0), 1),
                            "harvest_concentration_risk": risk_metrics["harvest_concentration_risk"],
                        },
                        "forecast_72h": {
                            "rainfall_sum_mm": round(precip_72h, 1),
                            "harvest_risk_window_hours": 48 if risk_metrics["harvest_concentration_risk"] else 72,
                        },
                        "weather_risk_score": risk_metrics["weather_risk_score"],
                        "additional_pressure_estimate_t": risk_metrics["additional_pressure_estimate_t"],
                        "source": "Open-Meteo Realtime Forecast API",
                        "source_status": "live",
                        "confidence": 0.95,
                        "freshness": "realtime_hourly",
                    }
                    return result
        except Exception as e:
            if events is not None:
                events.append(
                    make_event(
                        agent=self.name,
                        action="API_FALLBACK",
                        status="warning",
                        summary=f"Live Open-Meteo call failed ({type(e).__name__}); switching to cache.",
                        tool="open_meteo_client",
                        reason=str(e),
                        next_action="LOAD_CACHE",
                    )
                )
        return None

    def calculate_weather_risk(
        self, rainfall_24h_mm: float, temp_c: float, precip_prob: float = 50.0
    ) -> dict[str, Any]:
        """Compute harvest risk score and urgent supply pressure from precipitation and temperature."""
        def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
            return max(lo, min(hi, v))

        rain_score = _clamp(rainfall_24h_mm / 60.0)
        temp_score = _clamp((temp_c - 20.0) / 20.0)
        prob_score = _clamp(precip_prob / 100.0)

        harvest_risk = (rainfall_24h_mm >= 15.0) or (precip_prob >= 70.0)
        conc_score = 0.30 if harvest_risk else 0.0

        raw_score = 0.45 * rain_score + 0.15 * temp_score + 0.20 * prob_score + 0.20 * conc_score
        score = round(_clamp(raw_score), 3)

        # Baseline harvest rush pressure: ~0.8T per mm rain if risk present
        additional_pressure_t = round(max(0.0, rainfall_24h_mm * 1.2), 1)

        return {
            "weather_risk_score": score,
            "harvest_concentration_risk": harvest_risk,
            "additional_pressure_estimate_t": additional_pressure_t,
        }

    def get_latest_weather_data(
        self, events: list[dict[str, Any]] | None = None, force_refresh: bool = False
    ) -> dict[str, Any]:
        """Execute full hierarchy: LIVE API -> CACHED SNAPSHOT -> SIMULATION FALLBACK."""
        now_ts = datetime.datetime.utcnow()

        if not force_refresh:
            cached = self._load_cache()
            if cached and cached.get("source_status") == "live":
                cached_time_str = cached.get("fetched_at")
                if cached_time_str:
                    try:
                        cached_dt = datetime.datetime.fromisoformat(cached_time_str)
                        if (now_ts - cached_dt).total_seconds() < 900:  # 15 minutes TTL
                            if events is not None:
                                events.append(
                                    make_event(
                                        agent=self.name,
                                        action="USE_FRESH_CACHE",
                                        status="complete",
                                        summary=f"Weather Agent: using verified live cache ({cached.get('temp_celsius')}°C, {cached.get('weather_description')}).",
                                        tool="cache_reader",
                                        reason="Live cache is fresh under 15 minutes.",
                                        next_action="EMIT_WEATHER_EVIDENCE",
                                    )
                                )
                            return cached
                    except Exception:
                        pass

        # Try Live API
        live = self.fetch_live_weather(events)
        if live:
            self._save_cache(live)
            return live

        # Try Cached Snapshot
        cached = self._load_cache()
        if cached:
            cached["source_status"] = "cached"
            if events is not None:
                events.append(
                    make_event(
                        agent=self.name,
                        action="LOAD_CACHE",
                        status="complete",
                        summary=f"Weather Agent: retrieved last-known-good cache ({cached.get('temp_celsius')}°C).",
                        tool="cache_reader",
                        reason="External API unreachable; using cached snapshot.",
                        next_action="EMIT_WEATHER_EVIDENCE",
                    )
                )
            return cached

        # Simulation Fallback
        fallback = dict(SIMULATION_FALLBACK)
        fallback["fetched_at"] = now_ts.isoformat()
        if events is not None:
            events.append(
                make_event(
                    agent=self.name,
                    action="SIMULATION_FALLBACK",
                    status="warning",
                    summary=f"Weather Agent: active baseline simulation ({fallback['temp_celsius']}°C, {fallback['precipitation_mm']}mm rain).",
                    tool="simulation_engine",
                    reason="Both live API and disk cache unavailable; activating baseline simulation.",
                    next_action="EMIT_WEATHER_EVIDENCE",
                )
            )
        return fallback

    def get_current_weather(self) -> dict[str, Any]:
        data = self.get_latest_weather_data()
        return {
            "temp_celsius": data.get("temp_celsius"),
            "humidity_pct": data.get("humidity_pct"),
            "precipitation_mm": data.get("precipitation_mm"),
            "weather_description": data.get("weather_description"),
            "wind_speed_kmh": data.get("wind_speed_kmh"),
            "observed_at": data.get("observed_at"),
        }

    def get_weather_forecast(self) -> dict[str, Any]:
        data = self.get_latest_weather_data()
        return {
            "forecast_24h": data.get("forecast_24h", {}),
            "forecast_72h": data.get("forecast_72h", {}),
        }

    def get_normalized_evidence(self, events: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        """Produce the standardized evidence schema."""
        weather = self.get_latest_weather_data(events)
        return {
            "metric": "kolar_weather_risk",
            "value": weather.get("weather_risk_score", 0.65),
            "unit": "risk_index",
            "current": {
                "temp_celsius": weather.get("temp_celsius", 29.5),
                "humidity_pct": weather.get("humidity_pct", 74.0),
                "precipitation_mm": weather.get("precipitation_mm", 18.0),
                "weather_description": weather.get("weather_description", "Rain"),
                "wind_speed_kmh": weather.get("wind_speed_kmh", 14.5),
            },
            "forecast": {
                "forecast_24h": weather.get("forecast_24h", {}),
                "forecast_72h": weather.get("forecast_72h", {}),
            },
            "source": weather.get("source", "Open-Meteo Forecast API"),
            "source_status": weather.get("source_status", "live"),
            "observed_at": weather.get("observed_at", ""),
            "fetched_at": weather.get("fetched_at", ""),
            "confidence": weather.get("confidence", 0.95),
            "freshness": weather.get("freshness", "realtime_hourly"),
            "raw": weather,
        }
