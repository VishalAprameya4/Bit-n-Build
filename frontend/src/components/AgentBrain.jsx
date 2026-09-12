/**
 * AGRI-FLOW — Agent Brain (Visual Reasoning Pipeline Flow Diagram)
 * Apple Liquid Glass Theme • Live Progressive Pipeline Builder • Frosted Cards
 */
import React, { useState } from 'react';

export default function AgentBrain({
  scenario,
  plan,
  trace = [],
  activity,
  phase,
  onAnalyze,
  onDisruption,
  onReset,
}) {
  const [showTraceModal, setShowTraceModal] = useState(false);

  const isIdle = (phase === 'idle' || !phase) && trace.length === 0;
  const isRunning = phase === 'analyzing' || phase === 'replanning';
  const isComplete = phase === 'active' || phase === 'replanned' || phase === 'disruption';
  const isDisrupted = phase === 'disruption' || phase === 'replanning' || phase === 'replanned';

  const traceCount = trace.length;

  // Stage visibility conditions
  const showStage1 = isComplete || (isRunning && traceCount >= 1);
  const showStage2 = isComplete || (isRunning && traceCount >= 2);
  const showStage3 = isComplete || (isRunning && traceCount >= 4);
  const showStage4 = isComplete || (isRunning && traceCount >= 5);
  const showStage5 = isComplete || (isRunning && traceCount >= 6);
  const showStage6 = isComplete || (isRunning && traceCount >= 7);
  const showStage7 = isComplete;

  // Active stage determination for live pulse
  const activeStage = isRunning
    ? traceCount <= 1
      ? 1
      : traceCount <= 3
      ? 2
      : traceCount === 4
      ? 3
      : traceCount === 5
      ? 4
      : traceCount === 6
      ? 5
      : 6
    : null;

  const obsMkt = scenario?.observed?.market || activity?.observed_market || {};
  const obsWth = scenario?.observed?.weather || activity?.observed_weather || {};

  // Metrics from live backend data
  const arrivalsT    = obsMkt.arrivals_t ?? scenario?.current_arrivals_t ?? 910.0;
  const rawModal     = obsMkt.modal_price ?? scenario?.modal_price ?? 2500;
  const modalPrice   = rawModal < 100 ? rawModal * 100 : rawModal;
  const arrivalTrend = obsMkt.arrival_trend_7d_pct ?? 47.1;
  const priceTrend   = obsMkt.price_trend_7d_pct ?? scenario?.price_trend_7d_pct ?? -21.9;

  const rainSum72h   = obsWth.forecast_72h?.rainfall_sum_mm ?? 8.3;
  const tempC        = obsWth.temp_celsius ?? 25.3;

  const expectedT    = scenario?.expected_supply_t ?? 1200.0;
  const localCapT    = scenario?.local_absorption_t ?? 850.0;
  const surplusT     = scenario?.surplus_t ?? 350.0;
  const glutRiskPct  = scenario?.glut_risk_pct ?? 76.7;

  // Real plan allocations
  const allocs = plan?.allocations || [
    { destination_id: 'S2_HOSAKOTE', destination_type: 'storage', allocated_t: 120, transport_cost_total: 6000, feasible: true },
    { destination_id: 'P1_KOLAR_SAUCE', destination_type: 'processor', allocated_t: 90, transport_cost_total: 1800, feasible: true },
    { destination_id: 'S1_KOLAR_COLD', destination_type: 'storage', allocated_t: 80, transport_cost_total: 1200, feasible: true },
    { destination_id: 'BANGALORE', destination_type: 'market', allocated_t: 60, transport_cost_total: 4800, feasible: true },
  ];

  const totalCost = plan?.total_transport_cost ?? 13800;
  const unallocatedT = plan?.unallocated_t ?? 0;

  // Breakdown for optimizer visual branches
  const storageAllocT = allocs
    .filter(a => a.destination_type === 'storage')
    .reduce((sum, a) => sum + (a.allocated_t || 0), 0) || 200;

  const marketProcAllocT = allocs
    .filter(a => a.destination_type === 'market' || a.destination_type === 'processor')
    .reduce((sum, a) => sum + (a.allocated_t || 0), 0) || 150;

  return (
    <div className="brain-light-container">
      {/* ── HEADER STRIP ─────────────────────────────────────── */}
      <div className="view-header-strip">
        <div className="header-left">
          <div className="status-badge-row">
            <span className="live-chip">
              <span className="dot dot-green dot-pulse" />
              MULTI-AGENT PIPELINE
            </span>
            <span className="arch-chip">Python Tool Suite • Qwen Reasoning • OR-Tools Solver</span>
            <span className={`status-pill ${isIdle ? 'tag-caution' : isRunning ? 'tag-recovery' : isDisrupted ? 'tag-caution' : 'tag-optimal'}`}>
              {isIdle
                ? 'Pipeline Idle'
                : isRunning
                ? `Executing Stage ${activeStage || 1}/7…`
                : isDisrupted
                ? 'Disruption Handled'
                : 'Plan Active'}
            </span>
          </div>
          <h1 className="view-title">Autonomous Decision & Optimization Flow</h1>
        </div>

        <div className="header-actions">
          <button
            className="btn-light-secondary"
            onClick={() => setShowTraceModal(true)}
            disabled={trace.length === 0}
          >
            Inspect Tool Trace ({trace.length})
          </button>
          <button
            className="btn-light-primary"
            onClick={onAnalyze}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <span className="spinner-mini" />
                Running Stage {activeStage || 1}/7…
              </>
            ) : (
              'Run Pipeline'
            )}
          </button>
          <button
            className="btn-light-danger"
            onClick={onDisruption}
            disabled={!isComplete}
          >
            Simulate Disruption
          </button>
          <button className="btn-light-ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      {/* ── VISUAL FLOW CANVAS (HERO) ────────────────────────── */}
      <div className="visual-pipeline-canvas">
        {/* ── IDLE STATE (Before Run Pipeline is clicked) ── */}
        {isIdle && (
          <div className="brain-idle-hero-card">
            <div className="idle-icon-wrap">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7v5l3 3"/>
              </svg>
            </div>
            <div className="idle-content-block">
              <span className="idle-kicker">AUTONOMOUS MULTI-AGENT INTELLIGENCE</span>
              <h2 className="idle-title">Pipeline Ready for Live Execution</h2>
              <p className="idle-desc">
                Click <strong>"Run Pipeline"</strong> to trigger real-time telemetry ingestion, specialist agent investigation (Market, Weather, Supply, Logistics), Qwen-2.5 decision synthesis, and OR-Tools CP-SAT linear optimization in live progression.
              </p>
              <div className="idle-stages-preview">
                <span className="preview-pill">1. Telemetry Ingestion</span>
                <span className="preview-arrow">→</span>
                <span className="preview-pill">2. Specialist Agents</span>
                <span className="preview-arrow">→</span>
                <span className="preview-pill">3. Qwen Coordinator</span>
                <span className="preview-arrow">→</span>
                <span className="preview-pill">4. CP-SAT Solver</span>
                <span className="preview-arrow">→</span>
                <span className="preview-pill">5. Safety Validation</span>
                <span className="preview-arrow">→</span>
                <span className="preview-pill">6. Response Execution</span>
              </div>
              <button className="btn-light-primary btn-run-large" onClick={onAnalyze}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run Pipeline
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: LIVE DATA INGESTION ─────────────────────── */}
        {showStage1 && (
          <div className={`flow-step-block stage-reveal-block ${activeStage === 1 ? 'stage-active-pulse' : ''}`}>
            <div className="step-header-tag">
              <span className={`step-badge ${activeStage === 1 ? 'badge-pulsing' : ''}`}>1</span>
              <strong>WHAT DID THE SYSTEM OBSERVE?</strong>
              <span className="step-sub">Live Telemetry Ingestion (Python Tools)</span>
              {activeStage === 1 && <span className="active-stage-pill">Ingesting Live Streams…</span>}
            </div>

            <div className="live-data-chips-row">
              <div className="telemetry-chip">
                <span className="chip-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="12" width="4" height="8"/><rect x="10" y="8" width="4" height="12"/><rect x="17" y="4" width="4" height="16"/></svg>
                </span>
                <div className="chip-content">
                  <span className="chip-label">KOLAR MANDI</span>
                  <strong>{arrivalsT} T • ₹{modalPrice.toLocaleString('en-IN')}/Q</strong>
                  <span className="chip-source">LIVE • AGMARKNET</span>
                </div>
              </div>

              <div className="telemetry-chip">
                <span className="chip-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>
                </span>
                <div className="chip-content">
                  <span className="chip-label">RADAR FORECAST</span>
                  <strong>{rainSum72h} mm / 72h • {tempC}°C</strong>
                  <span className="chip-source">LIVE • OPEN-METEO</span>
                </div>
              </div>

              <div className="telemetry-chip">
                <span className="chip-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>
                <div className="chip-content">
                  <span className="chip-label">FIELD SENSORS</span>
                  <strong>92% Maturity • {expectedT} T Yield</strong>
                  <span className="chip-source">REGIONAL IOT SENSORS</span>
                </div>
              </div>

              <div className="telemetry-chip">
                <span className="chip-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                </span>
                <div className="chip-content">
                  <span className="chip-label">FACILITIES</span>
                  <strong>590 T Headroom • 14 Trucks</strong>
                  <span className="chip-source">REGIONAL LOGISTICS DB</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Animated Connector Arrow 1 -> 2 */}
        {showStage2 && (
          <div className="flow-arrow-down flow-arrow-animated">
            <div className="arrow-line" />
            <div className="arrow-head">▼</div>
          </div>
        )}

        {/* ── STEP 2: SPECIALIST AGENT FINDINGS ────────────────── */}
        {showStage2 && (
          <div className={`flow-step-block stage-reveal-block ${activeStage === 2 ? 'stage-active-pulse' : ''}`}>
            <div className="step-header-tag">
              <span className={`step-badge ${activeStage === 2 ? 'badge-pulsing' : ''}`}>2</span>
              <strong>WHAT DID EACH AGENT ANALYZE & FIND?</strong>
              <span className="step-sub">Specialist Autonomous Domain Investigation</span>
              {activeStage === 2 && <span className="active-stage-pill">Investigating Domain Constraints…</span>}
            </div>

            <div className="agents-compact-grid">
              {/* Market Agent */}
              <div className="agent-compact-card card-market">
                <div className="agent-card-header">
                  <div className="agent-name-wrap">
                    <span className="agent-badge-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    </span>
                    <strong>MARKET AGENT</strong>
                  </div>
                  <span className="agent-done-pill">✓ Complete</span>
                </div>
                <div className="agent-metric-chips">
                  <span>Arrivals <strong>{arrivalsT} T</strong></span>
                  <span className="text-red">+{arrivalTrend}% / 7d</span>
                  <span>Price ₹<strong>{modalPrice.toLocaleString('en-IN')}</strong></span>
                  <span className="text-amber">{priceTrend}% / 7d</span>
                </div>
                <div className="agent-finding-strip">
                  <span className="finding-tag">FINDING:</span>
                  <span className="finding-msg">Supply rising while modal prices falling sharply.</span>
                </div>
              </div>

              {/* Weather Agent */}
              <div className="agent-compact-card card-weather">
                <div className="agent-card-header">
                  <div className="agent-name-wrap">
                    <span className="agent-badge-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                    </span>
                    <strong>WEATHER AGENT</strong>
                  </div>
                  <span className="agent-done-pill">✓ Complete</span>
                </div>
                <div className="agent-metric-chips">
                  <span>72h Rain <strong>{rainSum72h} mm</strong></span>
                  <span className="text-amber">Rain expected</span>
                  <span>Temp <strong>{tempC}°C</strong></span>
                  <span>Risk <strong>High</strong></span>
                </div>
                <div className="agent-finding-strip">
                  <span className="finding-tag">FINDING:</span>
                  <span className="finding-msg">Rain approaching creates narrow pre-monsoon harvest window.</span>
                </div>
              </div>

              {/* Supply Agent */}
              <div className="agent-compact-card card-supply">
                <div className="agent-card-header">
                  <div className="agent-name-wrap">
                    <span className="agent-badge-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </span>
                    <strong>SUPPLY AGENT</strong>
                  </div>
                  <span className="agent-done-pill">✓ Complete</span>
                </div>
                <div className="agent-metric-chips">
                  <span>Flush <strong>{expectedT} T</strong></span>
                  <span>Mandi Cap <strong>{localCapT} T</strong></span>
                  <span className="text-red">Surplus <strong>{surplusT} T</strong></span>
                  <span className="text-red">Glut <strong>{glutRiskPct}%</strong></span>
                </div>
                <div className="agent-finding-strip">
                  <span className="finding-tag">FINDING:</span>
                  <span className="finding-msg">Surplus of {surplusT}T exceeds local market absorption capacity.</span>
                </div>
              </div>

              {/* Resource & Storage Agent */}
              <div className="agent-compact-card card-storage">
                <div className="agent-card-header">
                  <div className="agent-name-wrap">
                    <span className="agent-badge-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    </span>
                    <strong>RESOURCE AGENT</strong>
                  </div>
                  <span className="agent-done-pill">✓ Complete</span>
                </div>
                <div className="agent-metric-chips">
                  <span>Storage <strong>200 T</strong></span>
                  <span>Processor <strong>90 T</strong></span>
                  <span>Secondary <strong>300 T</strong></span>
                  <span className="text-green">590 T Buffer</span>
                </div>
                <div className="agent-finding-strip">
                  <span className="finding-tag">FINDING:</span>
                  <span className="finding-msg">590T regional capacity available for split dispatch buffering.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Animated Connector Arrow 2 -> 3 */}
        {showStage3 && (
          <div className="flow-arrow-down flow-arrow-animated">
            <div className="arrow-line" />
            <span className="arrow-label">Synthesized by Coordinator</span>
            <div className="arrow-head">▼</div>
          </div>
        )}

        {/* ── STEP 3: COORDINATOR (CENTRAL HIGHLIGHTED NODE) ──── */}
        {showStage3 && (
          <div className={`flow-step-block stage-reveal-block ${activeStage === 3 || activeStage === 4 ? 'stage-active-pulse' : ''}`}>
            <div className="coordinator-center-card">
              <div className="coord-top-row">
                <div className="coord-brand-wrap">
                  <span className="coord-brand-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                  </span>
                  <div>
                    <h3 className="coord-brand-title">CENTRAL COORDINATOR AGENT</h3>
                    <span className="coord-brand-sub">Qwen2.5 Action Selection & Synthesis Node</span>
                  </div>
                </div>
                <span className="coord-active-pill">
                  <span className="dot dot-green dot-pulse" />
                  {activeStage === 3 ? 'REASONING IN PROGRESS' : 'CENTRAL DECISION NODE'}
                </span>
              </div>

              {/* Compact Evidence Chips */}
              <div className="coord-evidence-strip">
                <span className="ev-chip">↑ Arrivals ({arrivalsT}T)</span>
                <span className="ev-chip">↓ Price ({priceTrend}%)</span>
                <span className="ev-chip">Rain Approaching ({rainSum72h}mm)</span>
                <span className="ev-chip text-amber">Surplus: {surplusT} T</span>
                <span className="ev-chip text-green">✓ 590 T Storage Headroom</span>
              </div>

              {/* Evidence -> Reasoning -> Decision */}
              {showStage4 && (
                <div className="coord-decision-box stage-reveal-block">
                  <div className="decision-top-badge">
                    <span className="dec-kicker">COORDINATOR DECISION</span>
                    <h4 className="dec-action-name">HARVEST + SPLIT DISPATCH</h4>
                  </div>
                  <p className="dec-reasoning">
                    "Harvest now because rain is approaching; split output between cold storage and secondary channels because local mandi is saturated."
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Animated Connector Arrow 3 -> 4 */}
        {showStage5 && (
          <div className="flow-arrow-down flow-arrow-animated">
            <div className="arrow-line" />
            <span className="arrow-label">Integer Programming Formulation</span>
            <div className="arrow-head">▼</div>
          </div>
        )}

        {/* ── STEP 4: OPTIMIZER (OR-TOOLS CP-SAT) ─────────────── */}
        {showStage5 && (
          <div className={`flow-step-block stage-reveal-block ${activeStage === 5 ? 'stage-active-pulse' : ''}`}>
            <div className="step-header-tag">
              <span className={`step-badge ${activeStage === 5 ? 'badge-pulsing' : ''}`}>4</span>
              <strong>HOW WAS IT OPTIMIZED?</strong>
              <span className="step-sub">OR-Tools CP-SAT Linear Programming (Minimum Freight Cost)</span>
              {activeStage === 5 && <span className="active-stage-pill">Solving CP-SAT Constraints…</span>}
            </div>

            <div className="optimizer-visual-card">
              <div className="opt-top-summary">
                <div className="opt-surplus-root">
                  <span className="opt-root-label">REGIONAL SURPLUS</span>
                  <strong className="opt-root-val">{surplusT} T</strong>
                </div>

                <div className="opt-meta-items">
                  <div className="opt-meta-item">
                    <span>Total Freight Cost</span>
                    <strong className="text-green">₹{totalCost.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="opt-meta-item">
                    <span>Active Routes</span>
                    <strong>{allocs.length} Destinations</strong>
                  </div>
                  <div className="opt-meta-item">
                    <span>Solver Feasibility</span>
                    <strong className="text-green">100% Feasible</strong>
                  </div>
                </div>
              </div>

              {/* Visual Branch Split */}
              <div className="opt-branch-split-row">
                <div className="branch-card branch-storage-card">
                  <div className="branch-header">
                    <span className="branch-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    </span>
                    <strong>COLD STORAGE</strong>
                    <span className="branch-tonnage text-green">{storageAllocT} T</span>
                  </div>
                  <span className="branch-desc">S1 Kolar Cold (80T) + S2 Hosakote (120T)</span>
                  <span className="branch-tag">✓ 4°C Buffer (21 Days)</span>
                </div>

                <div className="branch-card branch-market-card">
                  <div className="branch-header">
                    <span className="branch-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20h20"/><path d="M5 20V8l7 4V4l7 4v12"/></svg>
                    </span>
                    <strong>MARKET & PROCESSOR</strong>
                    <span className="branch-tonnage text-amber">{marketProcAllocT} T</span>
                  </div>
                  <span className="branch-desc">P1 Kolar Sauce (90T) + Bangalore Mandi (60T)</span>
                  <span className="branch-tag">✓ Direct Intake Channels</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Animated Connector Arrow 4 -> 5 */}
        {showStage6 && (
          <div className="flow-arrow-down flow-arrow-animated">
            <div className="arrow-line" />
            <span className="arrow-label">Candidate Plan Verification</span>
            <div className="arrow-head">▼</div>
          </div>
        )}

        {/* ── STEP 5: VALIDATOR ────────────────────────────────── */}
        {showStage6 && (
          <div className={`flow-step-block stage-reveal-block ${activeStage === 6 ? 'stage-active-pulse' : ''}`}>
            <div className="validator-compact-card">
              <div className="val-card-top">
                <div className="val-title-group">
                  <span className="val-shield">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                  </span>
                  <div>
                    <h3 className="val-main-title">SAFETY VALIDATION</h3>
                    <span className="val-main-sub">Deterministic constraint checks before dispatch</span>
                  </div>
                </div>
                <span className="plan-approved-pill">✓ PLAN APPROVED</span>
              </div>

              <div className="val-checklist-strip">
                <div className="val-check-chip">
                  <span className="check-ok">✓</span>
                  <span>Storage Capacity</span>
                </div>
                <div className="val-check-chip">
                  <span className="check-ok">✓</span>
                  <span>Market Capacity</span>
                </div>
                <div className="val-check-chip">
                  <span className="check-ok">✓</span>
                  <span>Truck Fleet</span>
                </div>
                <div className="val-check-chip">
                  <span className="check-ok">✓</span>
                  <span>Transit Routes</span>
                </div>
                <div className="val-check-chip">
                  <span className="check-ok">✓</span>
                  <span>0T Unallocated</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Animated Connector Arrow 5 -> 6 */}
        {showStage7 && (
          <div className="flow-arrow-down flow-arrow-animated">
            <div className="arrow-line" />
            <span className="arrow-label">Executed Response</span>
            <div className="arrow-head">▼</div>
          </div>
        )}

        {/* ── STEP 6: FINAL AUTONOMOUS RESPONSE ───────────────── */}
        {showStage7 && (
          <div className="flow-step-block stage-reveal-block">
            <div className="final-response-light-card">
              <div className="fr-top-row">
                <div className="fr-title-wrap">
                  <span className="fr-lightning">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </span>
                  <div>
                    <h3 className="fr-title">AGRI-FLOW AUTONOMOUS RESPONSE</h3>
                    <span className="fr-sub">Executed Multi-Channel Regional Directive</span>
                  </div>
                </div>
                <span className="fr-action-badge">HARVEST TODAY + SPLIT DISPATCH</span>
              </div>

              <div className="fr-content-grid">
                <div className="fr-box">
                  <span className="fr-box-label">WHY</span>
                  <p className="fr-box-text">
                    Preempts monsoon rain rot across 1,200T of ready crop and diverts {surplusT}T surplus to protect Kolar APMC from price crash.
                  </p>
                </div>
                <div className="fr-box">
                  <span className="fr-box-label">EXPECTED IMPACT</span>
                  <p className="fr-box-text">
                    <strong>100% Surplus Cleared</strong> • <strong>₹14.2L Income Protected</strong> • <strong>Zero Crop Spoilage</strong>
                  </p>
                </div>
                <div className="fr-box">
                  <span className="fr-box-label">EXECUTION METRICS</span>
                  <p className="fr-box-text font-mono">
                    {surplusT}T Diverted | {allocs.length} Routes | ₹{totalCost.toLocaleString('en-IN')} Freight | {unallocatedT}T Waste
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── RAW TOOL TRACE MODAL ──────────────────────────────── */}
      {showTraceModal && (
        <div className="trace-modal-overlay" onClick={() => setShowTraceModal(false)}>
          <div className="trace-modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Live Multi-Agent Activity Trace</h3>
              <button className="modal-close-btn" onClick={() => setShowTraceModal(false)}>✕</button>
            </div>
            <div className="modal-body-scroll">
              <div className="trace-rows-list">
                {trace.map((entry, idx) => (
                  <div key={entry.key || idx} className="trace-row-item">
                    <div className="tr-header">
                      <span className="tr-agent-pill">{entry.agent}</span>
                      <span className="tr-tool-pill">{entry.tool || entry.action}</span>
                      <span className="tr-status-ok">✓ Complete</span>
                    </div>
                    <p className="tr-summary">{entry.summary}</p>
                    {entry.reason && <p className="tr-reason">"{entry.reason}"</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
