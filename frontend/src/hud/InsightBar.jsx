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
        <div className="insight-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <div className="insight-content">
          <span className="insight-label">Current Insight</span>
          <p className="insight-text">{insight}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="insight-divider" />

      {/* Recommended Action */}
      <div className="insight-segment insight-segment--action">
        <div className="insight-icon insight-icon--green">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
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
        <div className="insight-icon insight-icon--blue">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
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
