import { PHASE } from '../useAppState';
import './ResponsePlan.css';

const TYPE_META = {
  market:    { label: 'Market',    color: '#2a5f9e', icon: 'M' },
  storage:   { label: 'Storage',   color: '#2a7060', icon: 'S' },
  processor: { label: 'Processor', color: '#7a5a20', icon: 'P' },
};

const DEST_LABELS = {
  'BANGALORE':            'Bangalore KR Market',
  'MYSORE':               'Mysore APMC',
  'TUMKUR':               'Tumkur APMC',
  'S1_KOLAR_COLD':        'Kolar Cold Storage',
  'S2_HOSAKOTE':          'Hosakote Warehouse',
  'P1_KOLAR_SAUCE':       'Kolar Processing Unit',
  'P2_BANGALROE_CANNERY': 'Bangalore Cannery',
};

const ROUTE_DIST = {
  'KOLAR_BANGALORE':           '100 km',
  'KOLAR_MYSORE':              '195 km',
  'KOLAR_TUMKUR':              '90 km',
  'KOLAR_S1_KOLAR_COLD':       '8 km',
  'KOLAR_S2_HOSAKOTE':         '60 km',
  'KOLAR_P1_KOLAR_SAUCE':      '12 km',
  'KOLAR_P2_BANGALROE_CANNERY':'105 km',
};

function AllocationRow({ alloc, isDisrupted, isNew }) {
  const type = TYPE_META[alloc.destination_type] || TYPE_META.market;
  const label = DEST_LABELS[alloc.destination_id] || alloc.destination_id;
  const dist = ROUTE_DIST[alloc.route_id] || '—';
  const cost = alloc.transport_cost_total;
  const infeasible = !alloc.feasible || alloc.feasible === 0;

  return (
    <div className={`alloc-row ${infeasible ? 'alloc-infeasible' : ''} ${isNew ? 'alloc-new' : ''} ${isDisrupted ? 'alloc-disrupted' : ''}`}>
      <div className="alloc-type-badge" style={{ borderColor: type.color, color: type.color }}>
        {type.icon}
      </div>

      <div className="alloc-dest">
        <div className="alloc-dest-name">{label}</div>
        <div className="alloc-route">{alloc.route_id?.replace(/_/g, ' ') || '—'} · {dist}</div>
      </div>

      <div className="alloc-tonnage">
        <span className="alloc-t">{alloc.allocated_t?.toFixed(0)}</span>
        <span className="alloc-unit">T</span>
      </div>

      <div className="alloc-cost">
        ₹{cost?.toLocaleString('en-IN') ?? '—'}
      </div>

      <div className="alloc-status">
        {infeasible
          ? <span className="badge badge-offline">Infeasible</span>
          : isDisrupted
          ? <span className="badge badge-critical">Disrupted</span>
          : isNew
          ? <span className="badge badge-info">Replanned</span>
          : <span className="badge badge-ok">Active</span>
        }
      </div>
    </div>
  );
}

const PHASE_TITLES = {
  [PHASE.IDLE]:       'Response Plan',
  [PHASE.ANALYZING]:  'Generating Redistribution Plan...',
  [PHASE.ACTIVE]:     'Active Redistribution Plan',
  [PHASE.DISRUPTION]: 'Plan Invalidated — Processing Disruption',
  [PHASE.REPLANNING]: 'Autonomous Replan in Progress...',
  [PHASE.REPLANNED]:  'Replanned — New Allocation Active',
};

export default function ResponsePlan({ plan, allocations, nodes, phase }) {
  const hasData = allocations && allocations.length > 0;

  const disruptedNodeIds = new Set(
    (nodes || []).filter(n => !n.is_active || n.status === 'offline').map(n => n.id)
  );

  const isReplanned = phase === PHASE.REPLANNED;
  const isDisruption = phase === PHASE.DISRUPTION || phase === PHASE.REPLANNING;

  const totalT = allocations?.reduce((s, a) => s + (a.allocated_t || 0), 0) || 0;
  const totalCost = plan?.total_transport_cost ?? (allocations?.reduce((s, a) => s + (a.transport_cost_total || 0), 0) || 0);
  const unallocated = plan?.unallocated_t ?? 0;
  const surplus = plan?.surplus_t ?? 350;

  return (
    <div className="rp-panel panel">
      <div className="panel-header rp-header">
        <div className="rp-title-wrap">
          <span className="panel-title">{PHASE_TITLES[phase] || 'Response Plan'}</span>
          {isReplanned && (
            <span className="badge badge-ok" style={{ marginLeft: 8 }}>
              <span className="dot dot-green" />
              Validated
            </span>
          )}
          {isDisruption && (
            <span className="badge badge-critical" style={{ marginLeft: 8 }}>
              <span className="dot dot-red dot-pulse" />
              Replanning
            </span>
          )}
        </div>

        {hasData && (
          <div className="rp-summary">
            <div className="rp-metric">
              <span className="rp-metric-val">{surplus}T</span>
              <span className="rp-metric-label">Surplus</span>
            </div>
            <div className="rp-metric-sep" />
            <div className="rp-metric">
              <span className="rp-metric-val">{totalT.toFixed(0)}T</span>
              <span className="rp-metric-label">Allocated</span>
            </div>
            <div className="rp-metric-sep" />
            <div className="rp-metric">
              <span className={`rp-metric-val ${unallocated > 0 ? 'rp-val-warn' : 'rp-val-ok'}`}>
                {unallocated.toFixed(0)}T
              </span>
              <span className="rp-metric-label">Unallocated</span>
            </div>
            <div className="rp-metric-sep" />
            <div className="rp-metric">
              <span className="rp-metric-val">₹{totalCost?.toLocaleString('en-IN')}</span>
              <span className="rp-metric-label">Transport Cost</span>
            </div>
          </div>
        )}
      </div>

      <div className="rp-body">
        {!hasData && phase === PHASE.IDLE && (
          <div className="rp-empty">
            No active plan. Run supply analysis to generate redistribution plan.
          </div>
        )}

        {!hasData && phase === PHASE.ANALYZING && (
          <div className="rp-empty">
            <span className="spinner" style={{ marginRight: 8 }} />
            Generating optimal redistribution plan...
          </div>
        )}

        {hasData && (
          <div className="alloc-list">
            <div className="alloc-list-header">
              <span>Destination</span>
              <span style={{ marginLeft: 'auto' }}>Volume</span>
              <span>Cost</span>
              <span>Status</span>
            </div>
            {allocations.map((a, i) => (
              <AllocationRow
                key={i}
                alloc={a}
                isDisrupted={disruptedNodeIds.has(a.destination_id)}
                isNew={isReplanned}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
