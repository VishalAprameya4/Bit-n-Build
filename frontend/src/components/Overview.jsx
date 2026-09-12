/**
 * AGRI-FLOW — Overview (Modern Agricultural Intelligence Command Center)
 * Live Kolar market & weather feeds with clean responsive layout
 */
import React from 'react';

export default function Overview({ scenario, plan, onNavigate, onRefresh, refreshing }) {
  const obsMkt = scenario?.observed?.market || {};
  const obsWth = scenario?.observed?.weather || {};

  // Live market metrics (from backend)
  const arrivalsT    = obsMkt.arrivals_t ?? scenario?.current_arrivals_t ?? 910.0;
  const rawModal     = obsMkt.modal_price ?? scenario?.modal_price ?? 2500;
  const modalPrice   = rawModal < 100 ? rawModal * 100 : rawModal;
  const minPrice     = obsMkt.min_price ?? Math.round(modalPrice * 0.8);
  const maxPrice     = obsMkt.max_price ?? Math.round(modalPrice * 1.2);
  const arrivalTrend = obsMkt.arrival_trend_7d_pct ?? 47.1;
  const priceTrend   = obsMkt.price_trend_7d_pct ?? scenario?.price_trend_7d_pct ?? -21.9;

  // Live weather metrics (from backend)
  const tempC        = obsWth.temp_celsius ?? 25.3;
  const humidity     = obsWth.humidity_pct ?? 62.0;
  const precipMm     = obsWth.precipitation_mm ?? 0.0;
  const weatherDesc  = obsWth.weather_description || 'Overcast';
  const rainSum24h   = obsWth.forecast_24h?.rainfall_sum_mm ?? 0.4;
  const rainProb24h  = obsWth.forecast_24h?.precipitation_probability_max ?? 12.0;
  const rainSum72h   = obsWth.forecast_72h?.rainfall_sum_mm ?? 8.3;

  // Glut & planning metrics
  const glutRiskPct  = scenario?.glut_risk_pct ?? 76.7;
  const saturationPct= scenario?.saturation_pct ?? 107.1;
  const surplusT     = scenario?.surplus_t ?? 350.0;
  const expectedT    = scenario?.expected_supply_t ?? 1200.0;
  const localCapT    = scenario?.local_absorption_t ?? 850.0;
  const history      = obsMkt.history || [];

  return (
    <div className="overview-light-container">
      {/* ── HEADER STRIP ─────────────────────────────────────── */}
      <div className="view-header-strip">
        <div className="header-left">
          <div className="status-badge-row">
            <span className="live-chip">
              <span className="dot dot-green dot-pulse" />
              LIVE TELEMETRY
            </span>
            <span className="location-chip">📍 Kolar APMC Yard, Karnataka</span>
            <span className="crop-chip">Tomato (Hybrid / Local)</span>
          </div>
          <h1 className="view-title">Regional Agricultural Supply Intelligence</h1>
        </div>

        <div className="header-actions">
          <button
            className="btn-light-secondary"
            onClick={onRefresh}
            disabled={refreshing}
            title="Fetch latest data from AGMARKNET & Open-Meteo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={refreshing ? 'spin-icon' : ''}>
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            {refreshing ? 'Syncing...' : 'Refresh Live Feeds'}
          </button>
          <button className="btn-light-primary" onClick={() => onNavigate('agent')}>
            Inspect Agent Brain →
          </button>
        </div>
      </div>

      {/* ── HERO BANNER: TOMATO SUPPLY GLUT DETECTED (CYBER PCB GLASS) ─────────── */}
      <div className="glut-hero-card glass-sheen-wrap">
        <div className="glass-reflection-streak" />
        <div className="glut-hero-top-capsule">
          <div className="glut-hero-title-wrap">
            <span className="alert-pill-glow">CRITICAL ALERT</span>
            <h2 className="glut-headline">TOMATO SUPPLY GLUT DETECTED</h2>
          </div>

          {/* Circuit PCB Trace Line */}
          <div className="circuit-trace-svg-wrap">
            <svg className="circuit-trace-svg" viewBox="0 0 360 28" fill="none" preserveAspectRatio="none">
              <path d="M0 14 H45 L65 6 H140 L160 20 H250 L270 14 H360" stroke="#4ade80" strokeWidth="1.6" opacity="0.6" />
              <path d="M20 14 L35 22 H115 L135 14 H210 L230 6 H310 L325 14 H360" stroke="#22c55e" strokeWidth="1.2" opacity="0.4" strokeDasharray="3 3" />
              <circle cx="45" cy="14" r="2.5" fill="#4ade80" />
              <circle cx="65" cy="6" r="2.5" fill="#86efac" />
              <circle cx="140" cy="6" r="2.5" fill="#4ade80" />
              <circle cx="160" cy="20" r="3" fill="#22c55e" />
              <circle cx="250" cy="20" r="2.5" fill="#86efac" />
              <circle cx="270" cy="14" r="3" fill="#4ade80" />
              <circle cx="115" cy="22" r="2" fill="#22c55e" />
              <circle cx="230" cy="6" r="2" fill="#4ade80" />
            </svg>
          </div>

          {/* Cybernetic HUD Risk Box */}
          <div className="glut-risk-cyber-box">
            <span className="hud-corner-tl" />
            <span className="hud-corner-tr" />
            <span className="hud-corner-bl" />
            <span className="hud-corner-br" />
            <span className="glut-risk-num-cyber">{glutRiskPct}%</span>
            <span className="glut-risk-txt-cyber">GLUT RISK</span>
          </div>
        </div>

        {/* Compact Metric Row with Glowing Sparklines */}
        <div className="hero-metrics-row-cyber">
          {/* 1. Arrivals */}
          <div className="h-metric-item">
            <div className="h-metric-text">
              <span className="h-metric-label">ARRIVALS</span>
              <strong className="h-metric-val">{arrivalsT} T</strong>
              <span className="h-trend-up">+{arrivalTrend}% (7d)</span>
            </div>
            {/* Bar Chart Sparkline */}
            <div className="metric-sparkline-wrap">
              <svg width="60" height="32" viewBox="0 0 60 32" fill="none">
                <rect x="4" y="18" width="5" height="14" rx="1.5" fill="rgba(74, 222, 128, 0.45)" />
                <rect x="14" y="14" width="5" height="18" rx="1.5" fill="rgba(74, 222, 128, 0.6)" />
                <rect x="24" y="10" width="5" height="22" rx="1.5" fill="rgba(74, 222, 128, 0.75)" />
                <rect x="34" y="15" width="5" height="17" rx="1.5" fill="rgba(74, 222, 128, 0.65)" />
                <rect x="44" y="6" width="5" height="26" rx="1.5" fill="#4ade80" />
                <rect x="54" y="2" width="5" height="30" rx="1.5" fill="#86efac" />
              </svg>
            </div>
          </div>

          <div className="h-metric-sep-cyber" />

          {/* 2. Modal Price */}
          <div className="h-metric-item">
            <div className="h-metric-text">
              <span className="h-metric-label">MODAL PRICE</span>
              <strong className="h-metric-val">₹{modalPrice.toLocaleString('en-IN')}/Q</strong>
              <span className="h-trend-down">{priceTrend}% (7d)</span>
            </div>
            {/* Trend Wave Sparkline */}
            <div className="metric-sparkline-wrap">
              <svg width="60" height="32" viewBox="0 0 60 32" fill="none">
                <path d="M2 8 C 12 10, 20 18, 30 16 C 40 14, 48 26, 58 28" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 8 C 12 10, 20 18, 30 16 C 40 14, 48 26, 58 28 L58 32 L2 32 Z" fill="url(#redGradSpark)" opacity="0.3" />
                <defs>
                  <linearGradient id="redGradSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="h-metric-sep-cyber" />

          {/* 3. Surplus */}
          <div className="h-metric-item">
            <div className="h-metric-text">
              <span className="h-metric-label">SURPLUS</span>
              <strong className="h-metric-val text-amber">{surplusT} T</strong>
              <span className="h-sub">vs {localCapT}T local cap</span>
            </div>
            {/* Area Mountain Sparkline */}
            <div className="metric-sparkline-wrap">
              <svg width="60" height="32" viewBox="0 0 60 32" fill="none">
                <path d="M2 28 C 15 24, 25 10, 38 12 C 48 14, 52 4, 58 2" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 28 C 15 24, 25 10, 38 12 C 48 14, 52 4, 58 2 L58 32 L2 32 Z" fill="url(#greenGradSpark)" opacity="0.35" />
                <defs>
                  <linearGradient id="greenGradSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="h-metric-sep-cyber" />

          {/* 4. Mandi Saturation */}
          <div className="h-metric-item">
            <div className="h-metric-text">
              <span className="h-metric-label">MANDI SATURATION</span>
              <strong className="h-metric-val text-red">{saturationPct}%</strong>
              <span className="h-sub">Overloaded</span>
            </div>
            {/* Histogram Sparkline */}
            <div className="metric-sparkline-wrap">
              <svg width="60" height="32" viewBox="0 0 60 32" fill="none">
                <rect x="4" y="20" width="6" height="12" rx="1.5" fill="rgba(74, 222, 128, 0.4)" />
                <rect x="15" y="16" width="6" height="16" rx="1.5" fill="rgba(74, 222, 128, 0.6)" />
                <rect x="26" y="12" width="6" height="20" rx="1.5" fill="rgba(251, 191, 36, 0.7)" />
                <rect x="37" y="6" width="6" height="26" rx="1.5" fill="rgba(239, 68, 68, 0.8)" />
                <rect x="48" y="2" width="6" height="30" rx="1.5" fill="#ef4444" />
              </svg>
            </div>
          </div>
        </div>

        {/* Why & Recommended Response Two-Column Box */}
        <div className="hero-verdict-grid">
          <div className="verdict-card verdict-why-cyber">
            <span className="verdict-label-cyber">WHY?</span>
            <p className="verdict-text-cyber">
              Supply is rising rapidly (+{arrivalTrend}%) while modal prices are collapsing ({priceTrend}%). Approaching rain ({rainSum72h} mm / 72h) is forcing premature harvest across regional farms.
            </p>
          </div>
          <div className="verdict-card verdict-action-cyber">
            <span className="verdict-label-cyber text-green-glow">RECOMMENDED RESPONSE</span>
            <strong className="verdict-action-title-cyber">HARVEST + SPLIT DISPATCH</strong>
            <p className="verdict-text-cyber">
              Harvest immediately before rain rot; autonomously divert {surplusT}T surplus to regional cold storage and secondary processing units.
            </p>
          </div>
        </div>
      </div>

      {/* ── TWO CLEAN LIVE DATA PANELS: MARKET + WEATHER ──────── */}
      <div className="live-panels-grid">
        {/* ── LEFT PANEL: KOLAR MARKET ── */}
        <div className="panel-card glass-sheen-wrap">
          <div className="glass-reflection-streak" />
          <div className="panel-card-header">
            <div className="panel-title-group">
              <span className="panel-icon icon-market">📈</span>
              <div>
                <h3 className="panel-title">KOLAR TOMATO MARKET</h3>
                <span className="panel-source">APMC Mandi Yard • Hybrid & Local Varieties</span>
              </div>
            </div>
            <span className="live-pill live-market-pill">LIVE • AGMARKNET</span>
          </div>

          <div className="panel-metrics-grid">
            <div className="pm-box-cyber">
              <span className="pm-label">Today's Arrivals</span>
              <div className="pm-val-wrap">
                <span className="pm-val">{arrivalsT}</span>
                <span className="pm-unit">Tonnes</span>
              </div>
              <span className="pm-sub text-red">↑ +{arrivalTrend}% surge</span>
            </div>

            <div className="pm-box-cyber">
              <span className="pm-label">Modal Price</span>
              <div className="pm-val-wrap">
                <span className="pm-val">₹{modalPrice.toLocaleString('en-IN')}</span>
                <span className="pm-unit">/ Quintal</span>
              </div>
              <span className="pm-sub text-amber">↓ {priceTrend}% in 7 days</span>
            </div>

            <div className="pm-box-cyber">
              <div className="pm-box-content">
                <span className="pm-label">Price Range</span>
                <div className="pm-val-wrap">
                  <span className="pm-val">₹{minPrice} – ₹{maxPrice}</span>
                </div>
                <span className="pm-sub">Min / Max bounds</span>
              </div>
              <div className="pm-spark-mini">
                <svg width="70" height="24" viewBox="0 0 70 24" fill="none">
                  <path d="M2 14 L12 8 L22 18 L32 10 L44 16 L56 6 L68 12" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="56" cy="6" r="2" fill="#86efac" />
                </svg>
              </div>
            </div>

            <div className="pm-box-cyber">
              <span className="pm-label">Market Load</span>
              <div className="pm-val-wrap">
                <span className="pm-val text-red">{saturationPct}%</span>
              </div>
              <div className="bar-track-cyber">
                <div className="bar-fill-cyber bg-neon-glow" style={{ width: `${Math.min(100, saturationPct)}%` }}>
                  <div className="bar-glow-thumb" />
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Divergence Table */}
          <div className="history-strip">
            <div className="history-header">
              <span>7-Day Volume vs Price Divergence</span>
              <span className="history-note">Rising arrivals + falling prices trigger glut intervention</span>
            </div>
            <div className="mini-table-scroll-cyber">
              <table className="clean-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Arrivals</th>
                    <th>Modal Price</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(-5).map((h, i) => {
                    const isToday = i === history.slice(-5).length - 1;
                    return (
                      <tr key={h.date || i} className={isToday ? 'today-row' : ''}>
                        <td className="font-mono">{h.date} {isToday ? '★' : ''}</td>
                        <td className="font-semibold">{h.arrivals_t} T</td>
                        <td className="font-semibold">₹{h.modal_price?.toLocaleString('en-IN')}/Q</td>
                        <td>
                          <span className={h.modal_price < 2700 ? 'badge-down' : 'badge-up'}>
                            {h.modal_price < 2700 ? 'Falling' : 'Stable'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: KOLAR WEATHER ── */}
        <div className="panel-card">
          <div className="panel-card-header">
            <div className="panel-title-group">
              <span className="panel-icon icon-weather">🌦</span>
              <div>
                <h3 className="panel-title">KOLAR ATMOSPHERIC WEATHER</h3>
                <span className="panel-source">High-Resolution Radar Telemetry</span>
              </div>
            </div>
            <span className="live-pill live-weather-pill">LIVE • OPEN-METEO</span>
          </div>

          <div className="weather-hero-row">
            <div className="wh-left">
              <span className="wh-temp">{tempC}°C</span>
              <div className="wh-condition">
                <span className="wh-icon">⛅</span>
                <span>{weatherDesc}</span>
              </div>
            </div>
            <div className="wh-right">
              <div className="wh-stat">
                <span className="stat-name">Humidity</span>
                <strong className="stat-val">{humidity}%</strong>
              </div>
              <div className="wh-stat">
                <span className="stat-name">Precipitation</span>
                <strong className="stat-val">{precipMm} mm</strong>
              </div>
              <div className="wh-stat">
                <span className="stat-name">24h Rain Prob</span>
                <strong className="stat-val text-amber">{rainProb24h}%</strong>
              </div>
            </div>
          </div>

          <div className="forecast-blocks-grid">
            <div className="f-box f-24h">
              <div className="f-box-tag">24-HOUR FORECAST</div>
              <div className="f-box-val-row">
                <span>Expected Rain:</span>
                <strong>{rainSum24h} mm</strong>
              </div>
              <p className="f-box-desc">
                ✓ Dry ground window remains open for manual and mechanical harvesting today.
              </p>
            </div>

            <div className="f-box f-72h">
              <div className="f-box-tag text-red">72-HOUR RADAR RISK</div>
              <div className="f-box-val-row">
                <span>Cumulative Rain:</span>
                <strong className="text-red">{rainSum72h} mm</strong>
              </div>
              <p className="f-box-desc text-danger">
                ⚠ Heavy downpour creates urgent harvest compulsion to avoid field waterlogging.
              </p>
            </div>
          </div>

          <div className="weather-bottom-note">
            <strong>Key Insight:</strong> Rain in 48–72h compresses picking schedules, flooding the market with {expectedT}T against {localCapT}T capacity.
          </div>
        </div>
      </div>
    </div>
  );
}
