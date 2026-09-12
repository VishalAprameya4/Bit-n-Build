/**
 * StoragePanel — Floating cold storage status panel
 */
export default function StoragePanel({ simState }) {
  const { storageFill } = simState;
  const fillPct  = Math.round(storageFill * 100);
  const capacityT = 1200; // from backend seed data
  const usedT = Math.round(storageFill * capacityT);

  return (
    <div className="hud-panel storage-panel">
      <div className="hud-panel-header">
        <span className="hud-panel-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        </span>
        <span className="hud-panel-title">Cold Storage · Kolar S1</span>
      </div>
      <div className="hud-panel-body">
        <div className="stat-row">
          <span className="stat-label">Capacity</span>
          <span className="stat-value">{capacityT}T</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">In Use</span>
          <span className="stat-value">{usedT}T</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Available</span>
          <span className="stat-value">{capacityT - usedT}T</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Status</span>
          <span className="stat-value" style={{ color: fillPct > 80 ? '#ff9800' : '#4fc3f7' }}>
            {simState.t >= 0.58 && simState.t < 0.80 ? 'Holding Produce' : fillPct > 80 ? 'Near Capacity' : simState.t >= 0.80 ? 'Release Active' : 'Operational'}
          </span>
        </div>
        <div className="harvest-bar-wrap">
          <div className="harvest-bar-label">
            <span>Utilization</span>
            <span style={{ color: fillPct > 80 ? '#ff9800' : '#4fc3f7', fontWeight: 700 }}>{fillPct}%</span>
          </div>
          <div className="harvest-bar-track">
            <div
              className="harvest-bar-fill"
              style={{
                width: `${fillPct}%`,
                background: fillPct > 80
                  ? 'linear-gradient(90deg, #ff9800, #ff6b35)'
                  : 'linear-gradient(90deg, #1e88e5, #4fc3f7)',
              }}
            />
          </div>
        </div>
        <div className="stat-row" style={{ marginTop: 6 }}>
          <span className="stat-label">Temp</span>
          <span className="stat-value" style={{ color: '#4fc3f7' }}>4°C — Optimal</span>
        </div>
      </div>
    </div>
  );
}
