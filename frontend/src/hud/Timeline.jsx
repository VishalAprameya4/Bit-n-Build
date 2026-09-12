/**
 * Timeline HUD — play/pause, scrubber, speed selector, day labels
 */
import { TIMELINE_STEPS, SPEED_OPTIONS } from '../useSimulation';

export default function Timeline({ t, playing, speed, onPlay, onPause, onSeek, onCycleSpeed }) {
  const pct = t * 100;

  return (
    <div className="timeline-bar">
      {/* Play / Pause */}
      <button
        className="timeline-play-btn"
        onClick={playing ? onPause : onPlay}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        )}
      </button>

      {/* Scrubber */}
      <div className="timeline-track-area">
        {/* Day labels */}
        <div className="timeline-labels">
          {TIMELINE_STEPS.map(step => (
            <div
              key={step.t}
              className="timeline-label"
              style={{ left: `${step.t * 100}%` }}
            >
              <span className="tl-date">{step.label}</span>
              <span className="tl-sub">{step.sub}</span>
            </div>
          ))}
        </div>

        {/* Track */}
        <div className="timeline-track" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
        }}>
          {/* Filled region */}
          <div className="timeline-fill" style={{ width: `${pct}%` }} />
          {/* Thumb */}
          <div className="timeline-thumb" style={{ left: `${pct}%` }} />
          {/* Day tick marks */}
          {TIMELINE_STEPS.map(step => (
            <div
              key={step.t}
              className="timeline-tick"
              style={{ left: `${step.t * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Speed selector */}
      <div className="timeline-speed">
        <span className="tl-speed-label">Speed</span>
        {SPEED_OPTIONS.map(s => (
          <button
            key={s}
            className={`tl-speed-btn${speed === s ? ' active' : ''}`}
            onClick={() => {
              // call onCycleSpeed until we hit the right speed
              if (speed !== s) onCycleSpeed();
            }}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
