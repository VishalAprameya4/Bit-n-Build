import { PHASE } from '../useAppState';
import './GlutMonitor.css';

function Metric({ label, value, unit, status, sublabel }) {
  return (
    <div className={`metric metric-${status}`}>
      <div className="metric-label label">{label}</div>
      <div className="metric-value">
        <span className="metric-num">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {sublabel && <div className="metric-sub">{sublabel}</div>}
    </div>
  );
}

export default function GlutMonitor({ scenario, phase }) {
  const isActive = phase !== PHASE.IDLE;

  const glut = isActive ? (scenario?.glut_risk_pct ?? 76.7) : null;
  const surplus = isActive ? (scenario?.surplus_t ?? 350) : null;
  const anomaly = isActive ? (scenario?.anomaly_pct ?? 45.8) : null;
  const saturation = isActive ? (scenario?.saturation_pct ?? 107.1) : null;
  const price = isActive ? (scenario?.price_trend_7d_pct ?? -18.4) : null;

  const glutStatus = glut !== null
    ? (glut >= 70 ? 'critical' : glut >= 50 ? 'warning' : 'ok')
    : 'idle';

  return (
    <div className="glut-panel panel">
      <div className="panel-header">
        <span className="panel-title">Glut Monitor</span>
        {isActive && (
          <span className={`badge badge-${glutStatus === 'critical' ? 'critical' : glutStatus === 'warning' ? 'warning' : 'ok'}`}>
            <span className={`dot dot-${glutStatus === 'critical' ? 'red' : glutStatus === 'warning' ? 'amber' : 'green'} dot-pulse`} />
            {glutStatus.toUpperCase()}
          </span>
        )}
      </div>

      <div className="glut-body">
        {!isActive ? (
          <div className="glut-idle">
            <div className="glut-idle-icon">⬡</div>
            <div className="glut-idle-text">Awaiting analysis</div>
          </div>
        ) : (
          <>
            {/* Primary metric — glut risk */}
            <div className={`glut-primary ${glutStatus}`}>
              <div className="glut-primary-label label">Composite Glut Risk</div>
              <div className="glut-primary-value">{glut?.toFixed(1)}<span className="glut-pct">%</span></div>
              <div className={`glut-bar-track`}>
                <div
                  className={`glut-bar-fill ${glutStatus}`}
                  style={{ width: `${Math.min(100, glut)}%` }}
                />
              </div>
            </div>

            <hr className="sep" />

            <div className="metrics-grid">
              <Metric
                label="Surplus"
                value={surplus?.toFixed(0)}
                unit="T"
                status="critical"
              />
              <Metric
                label="Supply Anomaly"
                value={`+${anomaly?.toFixed(1)}`}
                unit="%"
                status="warning"
              />
              <Metric
                label="Market Load"
                value={saturation?.toFixed(1)}
                unit="%"
                status={saturation > 100 ? 'critical' : 'ok'}
              />
              <Metric
                label="Price Trend"
                value={price?.toFixed(1)}
                unit="%"
                status="critical"
                sublabel="7-day"
              />
            </div>

            <hr className="sep" />

            <div className="supply-detail">
              <div className="sd-row">
                <span className="sd-label">Arrivals (current)</span>
                <span className="sd-val mono">{scenario?.current_arrivals_t ?? 910}T</span>
              </div>
              <div className="sd-row">
                <span className="sd-label">Expected supply</span>
                <span className="sd-val mono">{scenario?.expected_supply_t ?? 1200}T</span>
              </div>
              <div className="sd-row">
                <span className="sd-label">Local absorption</span>
                <span className="sd-val mono">{scenario?.local_absorption_t ?? 850}T</span>
              </div>
              <div className="sd-row">
                <span className="sd-label">7-day baseline</span>
                <span className="sd-val mono">{scenario?.historical_baseline_t ?? 624.1}T</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
