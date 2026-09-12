/**
 * InsightBar — Bottom bar with current insight, recommended action, expected impact
 */
export default function InsightBar({ simState, plan, scenario, onViewPlan }) {
  const { insight, action, impact } = simState;
  const surplus = plan?.surplus_t ?? scenario?.surplus_t ?? 350;
  const cost    = plan?.total_transport_cost ?? 13800;

  return (
    <div className="insight-bar">
      {/* Current Insight */}
      <div className="insight-segment insight-segment--info">
        <div className="insight-icon">✦</div>
        <div className="insight-content">
          <span className="insight-label">Current Insight</span>
          <p className="insight-text">{insight}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="insight-divider" />

      {/* Recommended Action */}
      <div className="insight-segment insight-segment--action">
        <div className="insight-icon insight-icon--green">🚜</div>
        <div className="insight-content">
          <span className="insight-label">Recommended Action</span>
          <p className="insight-action">{action}</p>
        </div>
        {plan && (
          <button className="insight-view-btn" onClick={onViewPlan}>
            View Plan →
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="insight-divider" />

      {/* Expected Impact */}
      <div className="insight-segment insight-segment--impact">
        <div className="insight-icon insight-icon--blue">📈</div>
        <div className="insight-content">
          <span className="insight-label">Expected Impact</span>
          <p className="insight-text">{impact}</p>
          {plan && (
            <span className="impact-cost">Transport: ₹{cost.toLocaleString('en-IN')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
