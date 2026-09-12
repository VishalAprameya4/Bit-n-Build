/**
 * AGRI-FLOW — App Shell
 * Multi-view Agricultural Supply Intelligence & Autonomous Response Network
 * Tabs:
 * 1. Overview (Live Kolar Mandi & Weather Command Center)
 * 2. Field Intelligence (Farmer Plot Telemetry & Harvest Risk Timeline)
 * 3. Digital Twin (Preserved 2.5D Living Simulation & HUDs - UNTOUCHED)
 * 4. Agent Brain (Visual Reasoning Pipeline Flow Diagram)
 */
import { useState, useEffect } from 'react';
import { useAppState }  from './useAppState';
import { useSimulation } from './useSimulation';
import CinematicTwin from './scene/CinematicTwin';
import Timeline     from './hud/Timeline';
import WeatherPanel from './hud/WeatherPanel';
import FarmPanel    from './hud/FarmPanel';
import StoragePanel from './hud/StoragePanel';
import MarketPanel  from './hud/MarketPanel';
import InsightBar   from './hud/InsightBar';
import Overview     from './components/Overview';
import FieldIntelligence from './components/FieldIntelligence';
import AgentBrain   from './components/AgentBrain';
import './index.css';

export default function App() {
  const appState = useAppState();
  const sim      = useSimulation(appState.scenario);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPlan, setShowPlan]   = useState(false);

  // Load backend data on mount (Telemetry ready, pipeline idle)
  useEffect(() => {
    appState.init();
  }, []);

  return (
    <div className="agriflow-shell">
      {/* ── TOP NAVIGATION BAR ───────────────────────────────── */}
      <header className="agri-nav">
        <div className="agri-nav-brand" onClick={() => setActiveTab('overview')} style={{ cursor: 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#22c55e" strokeWidth="2.5"/>
            <path d="M10 22 Q16 8 22 22" stroke="#4ade80" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <circle cx="16" cy="14" r="3" fill="#4ade80"/>
          </svg>
          <div className="brand-text-block">
            <span className="brand-name">AGRI-FLOW</span>
            <span className="brand-sub">Regional Supply Intelligence</span>
          </div>
        </div>

        <nav className="agri-nav-tabs">
          <button
            className={`nav-tab${activeTab === 'overview' ? ' active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Overview
          </button>

          <button
            className={`nav-tab${activeTab === 'field' ? ' active' : ''}`}
            onClick={() => setActiveTab('field')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Field Intelligence
          </button>

          <button
            className={`nav-tab${activeTab === 'twin' ? ' active' : ''}`}
            onClick={() => setActiveTab('twin')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Digital Twin
          </button>

          <button
            className={`nav-tab${activeTab === 'agent' ? ' active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 3"/>
            </svg>
            Agent Brain
          </button>
        </nav>

        <div className="agri-nav-meta">
          <span className="nav-location">Kolar, Karnataka</span>
          <div className={`nav-status${appState.backendOk ? ' status-live' : ' status-demo'}`}>
            <span className="dot dot-green dot-pulse" />
            {appState.backendOk ? 'Live Data Connected' : 'Demo Mode'}
          </div>
        </div>
      </header>

      {/* ── 1. OVERVIEW VIEW ─────────────────────────────────── */}
      {activeTab === 'overview' && (
        <Overview
          scenario={appState.scenario}
          plan={appState.plan}
          onNavigate={setActiveTab}
          onRefresh={appState.refreshLiveData}
          refreshing={appState.refreshing}
        />
      )}

      {/* ── 2. FIELD INTELLIGENCE VIEW ───────────────────────── */}
      {activeTab === 'field' && (
        <FieldIntelligence
          scenario={appState.scenario}
          plan={appState.plan}
          onNavigate={setActiveTab}
        />
      )}

      {/* ── 3. DIGITAL TWIN VIEW (COMPLETELY UNTOUCHED) ──────── */}
      {activeTab === 'twin' && (
        <div className="twin-container">
          {/* Fullscreen 2.5D cinematic map */}
          <div className="canvas-area">
            <CinematicTwin
              simState={sim.simState}
              plan={appState.plan}
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

      {/* ── 4. AGENT BRAIN VIEW (VISUAL FLOW PIPELINE) ────────── */}
      {activeTab === 'agent' && (
        <AgentBrain
          scenario={appState.scenario}
          plan={appState.plan}
          trace={appState.trace}
          activity={appState.activity}
          phase={appState.phase}
          onAnalyze={appState.analyzeGlut}
          onDisruption={appState.simulateDisruption}
          onReset={appState.reset}
        />
      )}
    </div>
  );
}

/* ── Inline sub-components for Digital Twin (Preserved) ─────────────────────── */

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
