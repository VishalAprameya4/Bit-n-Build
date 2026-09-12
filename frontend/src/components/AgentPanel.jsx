import { useRef, useEffect } from 'react';
import { PHASE } from '../useAppState';
import './AgentPanel.css';

const AGENT_META = {
  'SUPPLY_AGENT':   { label: 'Supply Agent',   abbr: 'SA', color: '#5a9ad4' },
  'MARKET_AGENT':   { label: 'Market Agent',   abbr: 'MA', color: '#5ab49a' },
  'RISK_AGENT':     { label: 'Risk Agent',     abbr: 'RA', color: '#d4a030' },
  'RESOURCE_AGENT': { label: 'Resource Agent', abbr: 'RS', color: '#9a7ad4' },
  'COORDINATOR':    { label: 'Coordinator',    abbr: 'CO', color: '#4a7fc1' },
  'OPTIMIZER':      { label: 'Optimizer',      abbr: 'OP', color: '#c49a40' },
  'VALIDATOR':      { label: 'Validator',      abbr: 'VA', color: '#5aaa6a' },
};

function statusIcon(status) {
  if (status === 'completed') return { icon: '✓', cls: 'trace-ok' };
  if (status === 'warning')   return { icon: '!', cls: 'trace-warn' };
  if (status === 'running')   return { icon: '›', cls: 'trace-run' };
  if (status === 'error')     return { icon: '✕', cls: 'trace-err' };
  return { icon: '·', cls: 'trace-idle' };
}

function TraceEntry({ entry, index }) {
  const meta = AGENT_META[entry.agent?.toUpperCase()] || { label: entry.agent, abbr: '??', color: '#606070' };
  const { icon, cls } = statusIcon(entry.status);

  return (
    <div className={`trace-entry slide-in`} style={{ animationDelay: `${index * 0.02}s` }}>
      <div className="trace-avatar" style={{ borderColor: meta.color, color: meta.color }}>
        {meta.abbr}
      </div>
      <div className="trace-body">
        <div className="trace-header">
          <span className="trace-agent">{meta.label}</span>
          <span className={`trace-status-icon ${cls}`}>{icon}</span>
        </div>
        <div className="trace-summary">{entry.summary}</div>
      </div>
    </div>
  );
}

const PHASE_HEADER = {
  [PHASE.IDLE]:       'Agent Activity',
  [PHASE.ANALYZING]:  'Running Analysis...',
  [PHASE.ACTIVE]:     'Analysis Complete',
  [PHASE.DISRUPTION]: 'DISRUPTION DETECTED',
  [PHASE.REPLANNING]: 'Replanning...',
  [PHASE.REPLANNED]:  'Replan Complete',
};

export default function AgentPanel({ trace, phase }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [trace.length]);

  const isDisruptionPhase = phase === PHASE.DISRUPTION || phase === PHASE.REPLANNING || phase === PHASE.REPLANNED;

  return (
    <div className="agent-panel panel">
      <div className="panel-header">
        <span className="panel-title">{PHASE_HEADER[phase] || 'Agent Activity'}</span>
        {(phase === PHASE.ANALYZING || phase === PHASE.REPLANNING) && (
          <span className="spinner" />
        )}
        {isDisruptionPhase && phase !== PHASE.REPLANNED && (
          <span className="badge badge-critical">
            <span className="dot dot-red dot-pulse" />
            DISRUPTED
          </span>
        )}
        {phase === PHASE.REPLANNED && (
          <span className="badge badge-ok">
            <span className="dot dot-green" />
            VALIDATED
          </span>
        )}
      </div>

      <div className="agent-trace-list">
        {trace.length === 0 && (
          <div className="agent-empty">
            {phase === PHASE.IDLE
              ? 'Agents on standby'
              : 'Initializing agents...'}
          </div>
        )}

        {/* Separator if disruption entries are mixed in */}
        {(() => {
          const items = [];
          let shownSep = false;
          trace.forEach((entry, i) => {
            const isDisruptionEntry =
              entry.action === 'detect_disruption' ||
              entry.action === 'invalidate_plan' ||
              entry.action === 'replan_allocation' ||
              entry.action === 'validate_new_plan';

            if (isDisruptionEntry && !shownSep) {
              shownSep = true;
              items.push(
                <div key="sep-disruption" className="trace-disruption-sep fade-in">
                  <span className="dot dot-red dot-pulse" />
                  Disruption Event
                </div>
              );
            }
            items.push(<TraceEntry key={entry.key ?? i} entry={entry} index={i} />);
          });
          return items;
        })()}

        <div ref={bottomRef} />
      </div>

      {/* Workflow steps overview */}
      {phase !== PHASE.IDLE && (
        <div className="agent-steps">
          <WorkflowStepper phase={phase} />
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { id: 1, label: 'Investigate' },
  { id: 2, label: 'Identify' },
  { id: 3, label: 'Optimize' },
  { id: 4, label: 'Validate' },
  { id: 5, label: 'Respond' },
];

const PHASE_STEP = {
  [PHASE.IDLE]:       0,
  [PHASE.ANALYZING]:  1,
  [PHASE.ACTIVE]:     5,
  [PHASE.DISRUPTION]: 3,
  [PHASE.REPLANNING]: 3,
  [PHASE.REPLANNED]:  5,
};

function WorkflowStepper({ phase }) {
  const current = PHASE_STEP[phase] || 0;

  return (
    <div className="stepper">
      {STEPS.map((s, i) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <div key={s.id} className={`step-item ${done ? 'step-done' : ''} ${active ? 'step-active' : ''}`}>
            <div className="step-dot">
              {done ? '✓' : s.id}
            </div>
            <div className="step-label">{s.label}</div>
            {i < STEPS.length - 1 && (
              <div className={`step-line ${done ? 'step-line-done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
