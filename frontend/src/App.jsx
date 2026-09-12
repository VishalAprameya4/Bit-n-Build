/**
 * AGRI-FLOW — App Shell
 * Fullscreen 3D Digital Twin with floating HUD overlays.
 * Agent Brain accessible via secondary tab.
 */
import { useState, useEffect } from 'react';
import { useAppState }  from './useAppState';
import { useSimulation } from './useSimulation';
import AgriWorld    from './scene/AgriWorld';
import Timeline     from './hud/Timeline';
import WeatherPanel from './hud/WeatherPanel';
import FarmPanel    from './hud/FarmPanel';
import StoragePanel from './hud/StoragePanel';
import MarketPanel  from './hud/MarketPanel';
import InsightBar   from './hud/InsightBar';
import AgentPanel   from './components/AgentPanel';
import './index.css';

export default function App() {
  const appState = useAppState();
  const sim      = useSimulation(appState.scenario);
  const [activeTab, setActiveTab] = useState('twin');
  const [showPlan, setShowPlan]   = useState(false);

  // Load backend data on mount (non-blocking)
  useEffect(() => { appState.analyzeGlut(); }, []);

  return (
    <div className="agriflow-shell">
      {/* ── TOP NAV ─────────────────────────────────────────── */}
      <header className="agri-nav">
        <div className="agri-nav-brand">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#4caf50" strokeWidth="2.5"/>
            <path d="M10 22 Q16 8 22 22" stroke="#7ec850" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <circle cx="16" cy="14" r="3" fill="#7ec850"/>
          </svg>
          <span className="brand-name">AGRI-FLOW</span>
          <span className="brand-sub">Living Digital Twin</span>
        </div>

        <nav className="agri-nav-tabs">
          <button
            className={`nav-tab${activeTab === 'twin' ? ' active' : ''}`}
            onClick={() => setActiveTab('twin')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Digital Twin
          </button>
          <button
            className={`nav-tab${activeTab === 'agent' ? ' active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/><path d="M4 20 Q4 14 12 14 Q20 14 20 20"/>
            </svg>
            Agent Brain
          </button>
        </nav>

        <div className="agri-nav-meta">
          <span className="nav-location">📍 Kolar, Karnataka</span>
          <span className="nav-time">Sep 12, 2026</span>
          <div className={`nav-status${appState.backendOk ? ' status-live' : ' status-demo'}`}>
            <span className="dot dot-green dot-pulse" />
            {appState.backendOk ? 'Live' : 'Demo'}
          </div>
        </div>
      </header>

      {/* ── DIGITAL TWIN VIEW ────────────────────────────────── */}
      {activeTab === 'twin' && (
        <div className="twin-container">
          {/* Fullscreen 3D Canvas */}
          <div className="canvas-area">
            <AgriWorld
              simState={sim.simState}
              plan={appState.plan}
              scenario={appState.scenario}
            />
          </div>

          {/* HUD Overlays */}
          <div className="hud-layer">
            {/* Top-left: Weather */}
            <div className="hud-pos hud-tl">
              <WeatherPanel simState={sim.simState} scenario={appState.scenario} />
            </div>

            {/* Top-right: Market */}
            <div className="hud-pos hud-tr">
              <MarketPanel simState={sim.simState} scenario={appState.scenario} />
            </div>

            {/* Mid-left: Farm */}
            <div className="hud-pos hud-ml">
              <FarmPanel simState={sim.simState} scenario={appState.scenario} />
            </div>

            {/* Mid-right: Storage */}
            <div className="hud-pos hud-mr">
              <StoragePanel simState={sim.simState} scenario={appState.scenario} />
            </div>

            {/* Glut risk badge */}
            {appState.scenario && (
              <div className="hud-pos hud-glut-badge">
                <GlutBadge scenario={appState.scenario} simState={sim.simState} />
              </div>
            )}

            {/* Supply flow legend */}
            <div className="hud-pos hud-legend">
              <SupplyFlowLegend />
            </div>

            {/* Bottom: Timeline */}
            <div className="hud-pos hud-timeline">
              <Timeline
                t={sim.t}
                playing={sim.playing}
                speed={sim.speed}
                onPlay={sim.play}
                onPause={sim.pause}
                onSeek={sim.seekTo}
                onCycleSpeed={sim.cycleSpeed}
              />
            </div>

            {/* Bottom: Insight bar */}
            <div className="hud-pos hud-insight">
              <InsightBar
                simState={sim.simState}
                plan={appState.plan}
                scenario={appState.scenario}
                onViewPlan={() => setShowPlan(true)}
              />
            </div>
          </div>

          {/* Plan modal */}
          {showPlan && (
            <PlanModal
              plan={appState.plan}
              nodes={appState.nodes}
              onClose={() => setShowPlan(false)}
            />
          )}

          {/* Loading overlay */}
          {!appState.scenario && (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <span>Connecting to AGRI-FLOW backend…</span>
            </div>
          )}
        </div>
      )}

      {/* ── AGENT BRAIN VIEW ─────────────────────────────────── */}
      {activeTab === 'agent' && (
        <div className="agent-view">
          <AgentPanel trace={appState.trace} phase={appState.phase} />
          <div className="agent-controls">
            <button
              className="btn btn-primary"
              disabled={appState.phase === 'analyzing' || appState.phase === 'replanning'}
              onClick={appState.analyzeGlut}
            >
              {appState.phase === 'analyzing' ? 'Analyzing…' : 'Run Analysis'}
            </button>
            <button
              className="btn btn-danger"
              disabled={appState.phase !== 'active'}
              onClick={appState.simulateDisruption}
            >
              Simulate Disruption
            </button>
            <button className="btn btn-ghost" onClick={appState.reset}>
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline sub-components ─────────────────────────────────────────────────── */

function GlutBadge({ scenario, simState }) {
  const risk = scenario?.glut_risk_pct ?? 76;
  const displayRisk = Math.round(risk * (1 - simState.t * 0.45));
  const sev  = scenario?.severity ?? 'critical';
  const color = sev === 'critical' ? '#ff4444' : sev === 'high' ? '#ff9800' : '#ffc107';

  return (
    <div className="glut-badge" style={{ borderColor: color }}>
      <span style={{ color, fontWeight: 800, fontSize: 18 }}>{displayRisk}%</span>
      <span className="glut-badge-label">GLUT RISK</span>
      <span className="glut-badge-sev" style={{ color }}>
        {sev?.toUpperCase()}
      </span>
    </div>
  );
}

function SupplyFlowLegend() {
  return (
    <div className="supply-legend">
      <div className="legend-title">Supply Flow</div>
      {[
        { color: '#4caf50', label: 'Farm → Storage' },
        { color: '#ffc107', label: 'Farm → Market' },
        { color: '#4fc3f7', label: 'Storage → Market' },
      ].map(({ color, label }) => (
        <div key={label} className="legend-row">
          <div className="legend-line" style={{ background: color }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function PlanModal({ plan, nodes, onClose }) {
  if (!plan) return null;
  const allocs = plan.allocations || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Response Plan</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="plan-summary">
            <div className="plan-kv">
              <span>Surplus</span><strong>{plan.surplus_t}T</strong>
            </div>
            <div className="plan-kv">
              <span>Unallocated</span>
              <strong style={{ color: plan.unallocated_t > 0 ? '#ff6b6b' : '#4caf50' }}>
                {plan.unallocated_t}T
              </strong>
            </div>
            <div className="plan-kv">
              <span>Transport Cost</span>
              <strong>₹{(plan.total_transport_cost || 0).toLocaleString('en-IN')}</strong>
            </div>
          </div>
          <table className="plan-table">
            <thead>
              <tr>
                <th>Destination</th>
                <th>Type</th>
                <th>Allocated</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {allocs.map((a, i) => (
                <tr key={i}>
                  <td>{a.destination_id}</td>
                  <td className={`type-${a.destination_type}`}>{a.destination_type}</td>
                  <td>{a.allocated_t}T</td>
                  <td>₹{(a.transport_cost_total || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
