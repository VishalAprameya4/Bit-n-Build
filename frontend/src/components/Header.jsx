import { PHASE } from '../useAppState';
import './Header.css';

const STATUS_LABELS = {
  [PHASE.IDLE]:       { text: 'STANDBY',     cls: 'status-idle' },
  [PHASE.ANALYZING]:  { text: 'ANALYZING',   cls: 'status-analyzing' },
  [PHASE.ACTIVE]:     { text: 'PLAN ACTIVE', cls: 'status-active' },
  [PHASE.DISRUPTION]: { text: 'DISRUPTION',  cls: 'status-disruption' },
  [PHASE.REPLANNING]: { text: 'REPLANNING',  cls: 'status-replanning' },
  [PHASE.REPLANNED]:  { text: 'REPLANNED',   cls: 'status-active' },
};

export default function Header({ phase, backendOk, onReset }) {
  const s = STATUS_LABELS[phase] || STATUS_LABELS[PHASE.IDLE];
  const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });

  return (
    <header className="hdr">
      <div className="hdr-left">
        <span className="hdr-logo">AGRI-FLOW</span>
        <span className="hdr-sep">|</span>
        <span className="hdr-sub">Regional Supply Intelligence Network</span>
      </div>

      <div className="hdr-center">
        <span className="hdr-region">Kolar · Karnataka · Tomato Season</span>
      </div>

      <div className="hdr-right">
        <div className={`sys-status ${s.cls}`}>
          <span className="sys-dot" />
          <span>{s.text}</span>
        </div>

        {backendOk === false && (
          <div className="demo-badge">DEMO MODE</div>
        )}
        {backendOk === true && (
          <div className="live-badge">LIVE API</div>
        )}

        <span className="hdr-clock mono">{ts} IST</span>

        {phase !== PHASE.IDLE && (
          <button className="btn btn-ghost btn-sm" onClick={onReset}>
            Reset
          </button>
        )}
      </div>
    </header>
  );
}
