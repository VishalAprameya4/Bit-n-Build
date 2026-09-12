/**
 * MarketPanel — Floating market status panel
 */
export default function MarketPanel({ simState, scenario }) {
  const { marketPressure } = simState;
  const obs = scenario?.observed?.market || {};

  const price     = obs.modal_price     ?? scenario?.modal_price     ?? 1240;
  const arrivals  = obs.arrivals_t      ?? scenario?.current_arrivals_t ?? 1831;
  const trend7d   = obs.price_trend_7d_pct ?? scenario?.price_trend_7d_pct ?? -18.4;
  const loadPct   = Math.round(marketPressure * 130);

  const priceDisplay = Math.round(price * (1 + (1 - marketPressure) * 0.12));

  return (
    <div className="hud-panel market-panel">
      <div className="hud-panel-header">
        <span className="hud-panel-icon">📊</span>
        <span className="hud-panel-title">Market · Kolar APMC</span>
        <span className="hud-live-badge">LIVE</span>
      </div>
      <div className="hud-panel-body">
        <div className="market-price-row">
          <span className="market-price">₹{priceDisplay.toLocaleString('en-IN')}</span>
          <span className="market-unit">/quintal</span>
          <span className={`market-trend ${trend7d < 0 ? 'trend-down' : 'trend-up'}`}>
            {trend7d > 0 ? '▲' : '▼'} {Math.abs(trend7d).toFixed(1)}%
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Arrivals Today</span>
          <span className="stat-value">{Math.round(arrivals * (1 - simState.t * 0.35))}T</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Market Load</span>
          <span
            className="stat-value"
            style={{ color: loadPct > 100 ? '#ff6b6b' : loadPct > 80 ? '#ffc107' : '#4caf50' }}
          >
            {loadPct > 100 ? 'HIGH PRESSURE' : loadPct > 80 ? 'ELEVATED' : 'NORMAL'} ({loadPct}%)
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Glut Risk</span>
          <span className="stat-value" style={{ color: loadPct > 100 ? '#ff6b6b' : '#4caf50' }}>
            {Math.round(Math.max(18, loadPct * 0.76))}%
          </span>
        </div>
        <div className="harvest-bar-wrap">
          <div className="harvest-bar-label">
            <span>Load</span>
            <span style={{
              color: loadPct > 100 ? '#ff6b6b' : loadPct > 80 ? '#ffc107' : '#4caf50',
              fontWeight: 700
            }}>{loadPct}%</span>
          </div>
          <div className="harvest-bar-track">
            <div
              className="harvest-bar-fill"
              style={{
                width: `${Math.min(100, loadPct)}%`,
                background: loadPct > 100 ? '#ff4444' : loadPct > 80 ? '#ff9800' : '#4caf50',
              }}
            />
          </div>
        </div>
        {scenario?.observed?.market?.source_status === 'live' && (
          <div className="market-source">📡 AGMARKNET / OGD India</div>
        )}
      </div>
    </div>
  );
}
