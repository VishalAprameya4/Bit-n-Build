import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { PHASE } from '../useAppState';
import './NetworkTwin.css';

/* ── Node layout in SVG coordinates ────────────────────── */
// We lay out nodes in a conceptual top-down hierarchy:
//   Farms → KOLAR → [Markets | Storage | Processors]
// Coordinates are in a 0–1000 x 0–600 space, then scaled to SVG viewport.

const NODE_POSITIONS = {
  'FARM_REGION':         { x: 500, y: 60 },  // virtual farm node
  'KOLAR':               { x: 500, y: 210 },
  'BANGALORE':           { x: 200, y: 400 },
  'MYSORE':              { x: 100, y: 520 },
  'TUMKUR':              { x: 320, y: 480 },
  'S1_KOLAR_COLD':       { x: 520, y: 410 },
  'S2_HOSAKOTE':         { x: 660, y: 470 },
  'P1_KOLAR_SAUCE':      { x: 800, y: 400 },
  'P2_BANGALROE_CANNERY':{ x: 900, y: 510 },
};

const NODE_COLORS = {
  market:    { fill: '#1a2535', stroke: '#2a5f9e', text: '#7aaed4', label: 'MKT' },
  storage:   { fill: '#1a2520', stroke: '#2a7060', text: '#5ab49a', label: 'STG' },
  processor: { fill: '#25201a', stroke: '#7a5a20', text: '#c49a40', label: 'PRC' },
  farm:      { fill: '#1e2018', stroke: '#3a5025', text: '#7a9a5a', label: 'FARM' },
};

const STATUS_OVERRIDES = {
  overloaded: { stroke: '#c94040', fill: '#2a1515', text: '#e06060' },
  offline:    { stroke: '#3a3a4a', fill: '#111118', text: '#505060' },
};

const VW = 1000;
const VH = 600;
const R  = 34;  // node radius

function getPos(id) {
  return NODE_POSITIONS[id] || { x: 500, y: 300 };
}

function NodeShape({ node, isKolar, allocated, disrupted }) {
  const pos = getPos(node.id);
  const baseColors = NODE_COLORS[node.type] || NODE_COLORS.market;
  const statusOverride = STATUS_OVERRIDES[node.status];
  const colors = statusOverride ? { ...baseColors, ...statusOverride } : baseColors;

  const isOffline = node.status === 'offline' || !node.is_active;
  const isOverloaded = node.status === 'overloaded';

  const r = isKolar ? R + 8 : R;

  return (
    <g className={`node-group ${disrupted ? 'node-disrupted' : ''}`} transform={`translate(${pos.x},${pos.y})`}>
      {/* Outer ring for Kolar */}
      {isKolar && (
        <circle
          r={r + 10}
          fill="none"
          stroke={isOverloaded ? '#c94040' : '#2a5f9e'}
          strokeWidth="1"
          strokeOpacity={isOverloaded ? 0.4 : 0.2}
          strokeDasharray={isOverloaded ? '4 4' : 'none'}
          className={isOverloaded ? 'kolar-ring-critical' : 'kolar-ring'}
        />
      )}

      {/* Main circle */}
      <circle
        r={r}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={isKolar ? 2 : 1.5}
        opacity={isOffline ? 0.4 : 1}
      />

      {/* Load indicator arc for overloaded */}
      {isOverloaded && (
        <circle
          r={r - 4}
          fill="none"
          stroke="#c94040"
          strokeWidth="3"
          strokeOpacity="0.35"
          strokeDasharray={`${2 * Math.PI * (r - 4) * 1.07} 999`}
          strokeDashoffset="0"
          transform="rotate(-90)"
        />
      )}

      {/* Type badge */}
      <rect
        x={-14} y={-r - 12}
        width={28} height={14}
        rx={2}
        fill={colors.stroke}
        opacity={isOffline ? 0.4 : 0.9}
      />
      <text
        x={0} y={-r - 2}
        textAnchor="middle"
        fill="white"
        fontSize="8"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="600"
        opacity={isOffline ? 0.4 : 1}
      >
        {isOffline ? 'OFFLINE' : colors.label}
      </text>

      {/* Center label */}
      <text
        x={0} y={4}
        textAnchor="middle"
        fill={colors.text}
        fontSize={isKolar ? 12 : 10}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="700"
        opacity={isOffline ? 0.4 : 1}
      >
        {isKolar ? 'KOLAR' : (node.id === 'P1_KOLAR_SAUCE' ? 'P1' : node.id === 'P2_BANGALROE_CANNERY' ? 'P2' : node.id.split('_')[0].slice(0, 6))}
      </text>

      {/* Allocated tonnage */}
      {allocated > 0 && !isOffline && (
        <text
          x={0} y={17}
          textAnchor="middle"
          fill={colors.text}
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          opacity="0.85"
        >
          {allocated}T
        </text>
      )}

      {/* Name label below */}
      <text
        x={0} y={r + 14}
        textAnchor="middle"
        fill={isOffline ? '#404050' : '#707088'}
        fontSize="9"
        fontFamily="Inter, sans-serif"
        fontWeight="500"
      >
        {node.label?.split(' ').slice(0, 2).join(' ')}
      </text>
    </g>
  );
}

function FlowEdge({ edge, nodes, phase }) {
  const src = getPos(edge.source);
  const tgt = getPos(edge.target);

  const isDisrupted = edge.disrupted || !edge.active;
  const isReplanned = phase === PHASE.REPLANNED;

  // Mid-point control for bezier
  const mx = (src.x + tgt.x) / 2;
  const my = (src.y + tgt.y) / 2 - 30;
  const d = `M${src.x},${src.y} Q${mx},${my} ${tgt.x},${tgt.y}`;

  if (isDisrupted) {
    return (
      <path
        d={d}
        fill="none"
        stroke="#c94040"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        opacity="0.5"
        strokeLinecap="round"
      />
    );
  }

  const color = isReplanned ? '#4a7fc1' : '#2a6040';
  const strokeWidth = Math.min(5, Math.max(1.5, (edge.allocated_t || 0) / 50));

  return (
    <g>
      {/* Static base path */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        opacity="0.25"
        strokeLinecap="round"
      />
      {/* Animated flow */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        opacity="0.85"
        strokeLinecap="round"
        strokeDasharray="8 12"
        className="flow-dash"
      />
    </g>
  );
}

// Farm upstream edges (static decorative)
function FarmEdges() {
  const farmPos = getPos('FARM_REGION');
  const kolarPos = getPos('KOLAR');
  return (
    <line
      x1={farmPos.x} y1={farmPos.y}
      x2={kolarPos.x} y2={kolarPos.y}
      stroke="#2a4a2a"
      strokeWidth="2"
      strokeDasharray="5 6"
      opacity="0.6"
    />
  );
}

const PHASE_LABELS = {
  [PHASE.IDLE]:       null,
  [PHASE.ANALYZING]:  { text: 'ANALYZING SUPPLY NETWORK...', cls: 'overlay-analyzing' },
  [PHASE.ACTIVE]:     { text: 'PLAN ACTIVE — REDISTRIBUTION IN PROGRESS', cls: 'overlay-active' },
  [PHASE.DISRUPTION]: { text: 'PROCESSOR OFFLINE — PLAN INVALIDATED', cls: 'overlay-disruption' },
  [PHASE.REPLANNING]: { text: 'AUTONOMOUS REPLANNING...', cls: 'overlay-replanning' },
  [PHASE.REPLANNED]:  { text: 'REPLANNED — NEW ROUTES ACTIVE', cls: 'overlay-active' },
};

export default function NetworkTwin({ nodes, edges, phase, scenario }) {
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  useLayoutEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    if (svgRef.current) obs.observe(svgRef.current.parentElement);
    return () => obs.disconnect();
  }, []);

  const overlay = PHASE_LABELS[phase];
  const hasNodes = nodes && nodes.length > 0;
  const hasEdges = edges && edges.length > 0;

  // Build allocation map
  const allocByDest = {};
  if (edges) {
    edges.forEach(e => { if (e.active !== false) allocByDest[e.target] = e.allocated_t; });
  }

  // Construct farm node
  const farmNode = { id: 'FARM_REGION', type: 'farm', label: 'Farm Clusters', status: 'normal', is_active: true };
  const allNodes = hasNodes ? [farmNode, ...nodes] : [farmNode];

  // Disrupted node IDs
  const disruptedNodeIds = new Set(
    (nodes || []).filter(n => !n.is_active || n.status === 'offline').map(n => n.id)
  );

  return (
    <div className="network-wrap panel">
      <div className="panel-header">
        <span className="panel-title">Digital Twin — Supply Network</span>
        <div className="network-legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: '#2a5f9e' }} />Market</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#2a7060' }} />Storage</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#7a5a20' }} />Processor</span>
          {(phase === PHASE.DISRUPTION || phase === PHASE.REPLANNING || phase === PHASE.REPLANNED) && (
            <span className="legend-item"><span className="legend-dot" style={{ background: '#c94040' }} />Offline</span>
          )}
        </div>
      </div>

      <div className="network-svg-wrap" ref={svgRef}>
        {/* Grid background */}
        <svg className="network-grid" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a2a" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Main SVG */}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          className="network-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="node-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Farm supply line */}
          <FarmEdges />

          {/* Allocation flow edges */}
          {hasEdges && edges.map((e, i) => (
            <FlowEdge key={i} edge={e} nodes={nodes} phase={phase} />
          ))}

          {/* Nodes */}
          {allNodes.map(node => (
            <NodeShape
              key={node.id}
              node={node}
              isKolar={node.id === 'KOLAR'}
              allocated={allocByDest[node.id] || 0}
              disrupted={disruptedNodeIds.has(node.id)}
            />
          ))}

          {/* Farm node (virtual) */}
        </svg>

        {/* Phase overlay banner */}
        {overlay && (
          <div className={`network-overlay-banner ${overlay.cls} fade-in`}>
            {(phase === PHASE.ANALYZING || phase === PHASE.REPLANNING) && (
              <span className="spinner" />
            )}
            <span>{overlay.text}</span>
          </div>
        )}

        {/* Empty state */}
        {phase === PHASE.IDLE && (
          <div className="network-idle-state">
            <div className="network-idle-text">
              Supply network ready. Run analysis to activate digital twin.
            </div>
          </div>
        )}

        {/* Kolar critical badge */}
        {(phase === PHASE.ACTIVE || phase === PHASE.DISRUPTION || phase === PHASE.REPLANNING || phase === PHASE.REPLANNED) && scenario && (
          <div className="kolar-badge">
            <span className="dot dot-red dot-pulse" />
            Kolar APMC — {scenario.saturation_pct?.toFixed(1) ?? 107.1}% capacity
          </div>
        )}
      </div>
    </div>
  );
}
