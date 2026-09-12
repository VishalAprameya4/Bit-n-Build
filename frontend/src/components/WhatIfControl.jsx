import { PHASE } from '../useAppState';
import './WhatIfControl.css';

export default function WhatIfControl({ phase, onAnalyze, onSimulate, onReset }) {
  const canAnalyze    = phase === PHASE.IDLE;
  const canSimulate   = phase === PHASE.ACTIVE || phase === PHASE.REPLANNED;
  const isAnalyzing   = phase === PHASE.ANALYZING;
  const isDisrupting  = phase === PHASE.DISRUPTION || phase === PHASE.REPLANNING;
  const hasReplanned  = phase === PHASE.REPLANNED;

  return (
    <div className="whatif-panel panel">
      <div className="panel-header">
        <span className="panel-title">Mission Control</span>
      </div>

      <div className="whatif-body">
        {/* Step 1 — Analyze */}
        <div className={`wi-step ${!canAnalyze && !isAnalyzing ? 'wi-step-done' : ''}`}>
          <div className="wi-step-num">01</div>
          <div className="wi-step-content">
            <div className="wi-step-label">Detect Glut</div>
            <div className="wi-step-desc">Run multi-agent analysis on Kolar supply data</div>
            <button
              className="btn btn-primary btn-sm wi-btn"
              onClick={onAnalyze}
              disabled={!canAnalyze || isAnalyzing}
              id="btn-analyze"
            >
              {isAnalyzing ? (
                <><span className="spinner" /> Analyzing...</>
              ) : (
                'Analyze Supply'
              )}
            </button>
          </div>
        </div>

        <div className="wi-connector">
          <div className={`wi-line ${phase !== PHASE.IDLE && !isAnalyzing ? 'wi-line-active' : ''}`} />
        </div>

        {/* Step 2 — Disrupt */}
        <div className={`wi-step ${hasReplanned ? 'wi-step-done' : ''} ${isDisrupting ? 'wi-step-active' : ''}`}>
          <div className={`wi-step-num ${isDisrupting ? 'wi-num-active' : ''}`}>02</div>
          <div className="wi-step-content">
            <div className="wi-step-label">Simulate Disruption</div>
            <div className="wi-step-desc">
              Disable <code className="wi-code">P1_KOLAR_SAUCE</code> processor
            </div>
            <button
              className="btn btn-danger btn-sm wi-btn"
              onClick={onSimulate}
              disabled={!canSimulate || isDisrupting}
              id="btn-disrupt"
            >
              {isDisrupting ? (
                <><span className="spinner" /> Replanning...</>
              ) : hasReplanned ? (
                'Replanned'
              ) : (
                'Simulate Disruption'
              )}
            </button>
          </div>
        </div>

        {hasReplanned && (
          <div className="wi-replan-badge fade-in">
            <span className="dot dot-green" />
            Autonomous replan complete
          </div>
        )}
      </div>
    </div>
  );
}
