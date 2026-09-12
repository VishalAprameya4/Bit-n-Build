/**
 * FarmPanel — Floating farm status panel
 */
export default function FarmPanel({ simState, scenario }) {
  const { cropHarvestProgress, harvestActivity } = simState;
  const harvestPct = Math.round(cropHarvestProgress * 100);
  const estimatedYield = scenario?.expected_supply_t ?? 1200;

  return (
    <div className="hud-panel farm-panel">
      <div className="hud-panel-header">
        <span className="hud-panel-icon">🌱</span>
        <span className="hud-panel-title">Farm · Farmer Plot 01</span>
      </div>
      <div className="hud-panel-body">
        <div className="stat-row">
          <span className="stat-label">Crop</span>
          <span className="stat-value">Tomato · 4.2 acres</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Est. Yield</span>
          <span className="stat-value">{(estimatedYield / 100).toFixed(1)}T</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Growth Stage</span>
          <span className="stat-value" style={{ color: cropHarvestProgress > 0.6 ? '#4caf50' : '#ffc107' }}>
            {cropHarvestProgress > 0.8 ? 'Harvested' : cropHarvestProgress > 0.3 ? 'Harvesting' : 'Mature — Ready'}
          </span>
        </div>
        <div className="harvest-bar-wrap">
          <div className="harvest-bar-label">
            <span>Harvest Progress</span>
            <span style={{ color: '#7ec850', fontWeight: 700 }}>{harvestPct}%</span>
          </div>
          <div className="harvest-bar-track">
            <div className="harvest-bar-fill" style={{ width: `${harvestPct}%` }} />
          </div>
        </div>
        {harvestActivity > 0.05 && (
          <div className="activity-indicator">
            <span className="dot dot-green dot-pulse" />
            Harvest machinery active
          </div>
        )}
      </div>
    </div>
  );
}
