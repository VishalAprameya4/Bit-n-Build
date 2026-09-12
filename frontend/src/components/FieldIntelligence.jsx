/**
 * AGRI-FLOW — Field Intelligence (Farmer & Crop Advisory View)
 * White / Light Theme • Clean frosted glass cards • 4-Day Visual Harvest Timeline
 */
import React from 'react';

export default function FieldIntelligence({ scenario, plan, onNavigate }) {
  const obsWth = scenario?.observed?.weather || {};
  const obsMkt = scenario?.observed?.market || {};

  const currentTemp   = obsWth.temp_celsius ?? 25.3;
  const rawModal      = obsMkt.modal_price ?? scenario?.modal_price ?? 2500;
  const modalPrice    = rawModal < 100 ? rawModal * 100 : rawModal;
  const rainSum72h    = obsWth.forecast_72h?.rainfall_sum_mm ?? 8.3;

  // 4-Day Visual Weather Timeline
  const timelineDays = [
    {
      day: 'TODAY',
      date: 'Sep 12',
      status: 'Optimal',
      statusClass: 'tag-optimal',
      temp: `${Math.round(currentTemp)}°C`,
      condition: 'Partly Cloudy',
      rain: '0.4 mm',
      action: 'Prime picking window',
      isHero: true,
    },
    {
      day: 'TOMORROW',
      date: 'Sep 13',
      status: 'Caution',
      statusClass: 'tag-caution',
      temp: '27°C',
      condition: 'Showers',
      rain: '4.2 mm',
      action: 'Afternoon rain',
      isHero: false,
    },
    {
      day: '+2 DAYS',
      date: 'Sep 14',
      status: 'Critical',
      statusClass: 'tag-critical',
      temp: '24°C',
      condition: 'Downpour',
      rain: '18.5 mm',
      action: 'Severe rain risk',
      isHero: false,
    },
    {
      day: '+3 DAYS',
      date: 'Sep 15',
      status: 'Recovery',
      statusClass: 'tag-recovery',
      temp: '26°C',
      condition: 'Scattered',
      rain: '6.0 mm',
      action: 'Soil waterlogged',
      isHero: false,
    },
  ];

  return (
    <div className="field-light-container">
      {/* ── HEADER STRIP ─────────────────────────────────────── */}
      <div className="view-header-strip">
        <div className="header-left">
          <div className="status-badge-row">
            <span className="live-chip">
              <span className="dot dot-green dot-pulse" />
              PLOT SENSOR NETWORK
            </span>
            <span className="location-chip">Kolar Cluster #4 • Plot KLR-088</span>
            <span className="crop-chip">Tomato (Arka Rakshak)</span>
          </div>
          <h1 className="view-title">Farmer & Crop Field Intelligence</h1>
        </div>

        <div className="header-actions">
          <button className="btn-light-primary" onClick={() => onNavigate('agent')}>
            Inspect Agent Brain Pipeline →
          </button>
        </div>
      </div>

      {/* ── HERO ACTION CARD: HARVEST TODAY ──────────────────── */}
      <div className="field-action-hero-card">
        <div className="hero-action-badge">
          <span className="action-kicker">RECOMMENDED ACTION</span>
          <h2 className="action-main-title">HARVEST TODAY</h2>
          <span className="action-window-pill">Window: Next 24–36 Hours</span>
        </div>

        <div className="hero-action-body">
          <div className="hero-stat-strip">
            <div className="hero-stat-item">
              <span className="h-stat-label">CROP MATURITY</span>
              <strong className="h-stat-val text-green">92% Ready</strong>
            </div>
            <div className="h-stat-sep" />
            <div className="hero-stat-item">
              <span className="h-stat-label">EXPECTED YIELD</span>
              <strong className="h-stat-val">42.0 T</strong>
            </div>
            <div className="h-stat-sep" />
            <div className="hero-stat-item">
              <span className="h-stat-label">PLOT ACREAGE</span>
              <strong className="h-stat-val">12.5 Acres</strong>
            </div>
            <div className="h-stat-sep" />
            <div className="hero-stat-item">
              <span className="h-stat-label">WEATHER STATUS</span>
              <strong className="h-stat-val text-amber">Rain in 48h ({rainSum72h}mm)</strong>
            </div>
          </div>

          <div className="hero-why-box">
            <span className="why-label">WHY HARVEST NOW?</span>
            <p className="why-text">
              Crop is at peak 92% maturity and heavy monsoon rain ({rainSum72h} mm) arrives in 48 hours. Delaying picking causes fruit cracking and field waterlogging.
            </p>
          </div>
        </div>
      </div>

      {/* ── 4-DAY VISUAL WEATHER TIMELINE ────────────────────── */}
      <div className="timeline-section-card">
        <div className="timeline-section-header">
          <div>
            <h3 className="section-title">4-DAY HARVEST RISK WEATHER TIMELINE</h3>
            <span className="section-sub">Microclimate radar forecast for Kolar farm clusters</span>
          </div>
          <span className="live-pill live-weather-pill">LIVE • OPEN-METEO</span>
        </div>

        <div className="timeline-cards-row">
          {timelineDays.map((d) => (
            <div key={d.day} className={`timeline-card ${d.isHero ? 'timeline-hero-card' : ''}`}>
              <div className="tc-top">
                <span className="tc-day">{d.day}</span>
                <span className={`status-pill ${d.statusClass}`}>{d.status}</span>
              </div>
              <div className="tc-icon-temp">
                <span className="tc-temp">{d.temp}</span>
                <span className="tc-cond-label">{d.condition}</span>
              </div>
              <div className="tc-rain-row">
                <span>Rain:</span>
                <strong>{d.rain}</strong>
              </div>
              <span className="tc-action">{d.action}</span>
              {d.isHero && <span className="tc-hero-badge">OPTIMAL HARVEST</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── 2-COLUMN BOTTOM GRID: PLOT PROFILE & EVIDENCE ────── */}
      <div className="field-bottom-grid">
        {/* Plot Profile & Storage Booking */}
        <div className="panel-card">
          <div className="panel-card-header">
            <div className="panel-title-group">
              <span className="panel-icon icon-crop">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>
              <div>
                <h3 className="panel-title">FARM PLOT & DISPATCH PROFILE</h3>
                <span className="panel-source">Farmer Plot KLR-088 • Cluster Supply: 1,200 T</span>
              </div>
            </div>
            <span className="status-pill tag-optimal">READY</span>
          </div>

          <div className="plot-props-grid">
            <div className="prop-box">
              <span className="prop-lbl">Variety</span>
              <strong className="prop-val">Hybrid Arka Rakshak</strong>
            </div>
            <div className="prop-box">
              <span className="prop-lbl">Crop Stage</span>
              <strong className="prop-val text-green">Maturity (92%)</strong>
            </div>
            <div className="prop-box">
              <span className="prop-lbl">Current Realization</span>
              <strong className="prop-val">₹{modalPrice.toLocaleString('en-IN')}/Q</strong>
            </div>
            <div className="prop-box">
              <span className="prop-lbl">Autonomous Booking</span>
              <strong className="prop-val text-green">24T Cold Storage (S1)</strong>
            </div>
          </div>

          <div className="maturity-bar-card">
            <div className="mb-header">
              <span>Maturity Curve</span>
              <strong className="text-green">92% Optimal Pick</strong>
            </div>
            <div className="bar-track-thick">
              <div className="bar-fill-gradient" style={{ width: '92%' }} />
            </div>
          </div>
        </div>

        {/* 4 Concise Evidence Points */}
        <div className="panel-card">
          <div className="panel-card-header">
            <div className="panel-title-group">
              <span className="panel-icon icon-evidence">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
              </span>
              <div>
                <h3 className="panel-title">DECISION EVIDENCE</h3>
                <span className="panel-source">Scientific basis for immediate harvest</span>
              </div>
            </div>
            <span className="status-pill tag-optimal">VERIFIED</span>
          </div>

          <div className="evidence-list-compact">
            <div className="evidence-item">
              <div className="ev-num">1</div>
              <div className="ev-content">
                <strong>Crop Maturity at 92%:</strong>
                <span>Fruits are fully formed. Delaying beyond 48 hours causes over-ripening and skin softening.</span>
              </div>
            </div>

            <div className="evidence-item">
              <div className="ev-num">2</div>
              <div className="ev-content">
                <strong>Heavy Rainfall (8.3 mm in 72h):</strong>
                <span>Incoming rain on Sep 14 creates waterlogging, preventing truck field entry and causing fruit rot.</span>
              </div>
            </div>

            <div className="evidence-item">
              <div className="ev-num">3</div>
              <div className="ev-content">
                <strong>Price Protection (₹{modalPrice.toLocaleString('en-IN')}/Q):</strong>
                <span>Harvesting now locks in current price before post-rain glut flood depresses mandi rates further.</span>
              </div>
            </div>

            <div className="evidence-item">
              <div className="ev-num">4</div>
              <div className="ev-content">
                <strong>Autonomous Cold Storage Buffer:</strong>
                <span>Slots at Kolar & Hosakote cold storage are pre-reserved to preserve unsold yield for up to 21 days.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
