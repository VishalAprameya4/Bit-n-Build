/**
 * AGRI-FLOW API Client
 * Connects to FastAPI backend on port 8000
 * Falls back to demo data if backend is unreachable
 */

const BASE = 'http://localhost:8000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  health:          () => apiFetch('/health'),
  scenario:        () => apiFetch('/scenario/current'),
  refreshData:     () => apiFetch('/data/refresh', { method: 'POST' }),
  generatePlan:    () => apiFetch('/plan/generate', { method: 'POST' }),
  currentPlan:     () => apiFetch('/plan/current'),
  networkGraph:    () => apiFetch('/network/graph'),
  agentActivity:   () => apiFetch('/agents/activity'),
  applyWhatIf:     (patch) => apiFetch('/whatif/apply', {
    method: 'POST',
    body: JSON.stringify(patch),
  }),
  resetWhatIf:     () => apiFetch('/whatif/reset', { method: 'POST' }),
};


/* ── Demo fallback data ─────────────────────────────────── */

export const DEMO_SCENARIO = {
  commodity: 'tomato',
  primary_market_id: 'KOLAR',
  historical_baseline_t: 624.1,
  current_arrivals_t: 910.0,
  expected_supply_t: 1200.0,
  local_absorption_t: 850.0,
  surplus_t: 350.0,
  modal_price: 12.5,
  price_trend_7d_pct: -18.4,
  weather_risk_score: 0.42,
  glut_risk_pct: 76.7,
  anomaly_pct: 45.8,
  surge_detected: true,
  severity: 'critical',
  saturation_pct: 107.1,
};

export const DEMO_NODES = [
  { id: 'KOLAR',               type: 'market',    label: 'Kolar APMC Mandi',         status: 'overloaded', load_pct: 107.1, is_active: true,  lat: 13.1367, lng: 78.1297 },
  { id: 'BANGALORE',           type: 'market',    label: 'Bangalore (KR Market)',    status: 'normal',     load_pct: 74.0,  is_active: true,  lat: 12.9716, lng: 77.5946 },
  { id: 'MYSORE',              type: 'market',    label: 'Mysore APMC',              status: 'normal',     load_pct: 80.0,  is_active: true,  lat: 12.2958, lng: 76.6394 },
  { id: 'TUMKUR',              type: 'market',    label: 'Tumkur APMC',              status: 'normal',     load_pct: 75.0,  is_active: true,  lat: 13.3409, lng: 77.1010 },
  { id: 'S1_KOLAR_COLD',       type: 'storage',   label: 'Kolar Cold Storage',       status: 'storage',    load_pct: null,  is_active: true,  lat: 13.1450, lng: 78.1350 },
  { id: 'S2_HOSAKOTE',         type: 'storage',   label: 'Hosakote Warehouse',       status: 'storage',    load_pct: null,  is_active: true,  lat: 13.0700, lng: 77.7900 },
  { id: 'P1_KOLAR_SAUCE',      type: 'processor', label: 'Kolar Processing Unit',    status: 'processor',  load_pct: null,  is_active: true,  lat: 13.1600, lng: 78.1100 },
  { id: 'P2_BANGALROE_CANNERY',type: 'processor', label: 'Bangalore Cannery',        status: 'processor',  load_pct: null,  is_active: true,  lat: 12.9800, lng: 77.5700 },
];

export const DEMO_EDGES_INITIAL = [
  { source: 'KOLAR', target: 'BANGALORE',           allocated_t: 60,  route_id: 'KOLAR_BANGALORE',           active: true },
  { source: 'KOLAR', target: 'S1_KOLAR_COLD',       allocated_t: 80,  route_id: 'KOLAR_S1_KOLAR_COLD',       active: true },
  { source: 'KOLAR', target: 'S2_HOSAKOTE',         allocated_t: 120, route_id: 'KOLAR_S2_HOSAKOTE',         active: true },
  { source: 'KOLAR', target: 'P1_KOLAR_SAUCE',      allocated_t: 90,  route_id: 'KOLAR_P1_KOLAR_SAUCE',      active: true },
];

export const DEMO_EDGES_REPLANNED = [
  { source: 'KOLAR', target: 'BANGALORE',             allocated_t: 80,  route_id: 'KOLAR_BANGALORE',             active: true },
  { source: 'KOLAR', target: 'S1_KOLAR_COLD',         allocated_t: 80,  route_id: 'KOLAR_S1_KOLAR_COLD',         active: true },
  { source: 'KOLAR', target: 'S2_HOSAKOTE',           allocated_t: 120, route_id: 'KOLAR_S2_HOSAKOTE',           active: true },
  { source: 'KOLAR', target: 'P2_BANGALROE_CANNERY',  allocated_t: 70,  route_id: 'KOLAR_P2_BANGALROE_CANNERY',  active: true },
];

export const DEMO_ALLOCATIONS_INITIAL = [
  { destination_id: 'BANGALORE',      destination_type: 'market',    allocated_t: 60,  route_id: 'KOLAR_BANGALORE',      transport_cost_total: 4800,  feasible: 1 },
  { destination_id: 'S1_KOLAR_COLD',  destination_type: 'storage',   allocated_t: 80,  route_id: 'KOLAR_S1_KOLAR_COLD',  transport_cost_total: 1200,  feasible: 1 },
  { destination_id: 'S2_HOSAKOTE',    destination_type: 'storage',   allocated_t: 120, route_id: 'KOLAR_S2_HOSAKOTE',    transport_cost_total: 6000,  feasible: 1 },
  { destination_id: 'P1_KOLAR_SAUCE', destination_type: 'processor', allocated_t: 90,  route_id: 'KOLAR_P1_KOLAR_SAUCE', transport_cost_total: 1800,  feasible: 1 },
];

export const DEMO_ALLOCATIONS_REPLANNED = [
  { destination_id: 'BANGALORE',           destination_type: 'market',    allocated_t: 80,  route_id: 'KOLAR_BANGALORE',           transport_cost_total: 6400,  feasible: 1 },
  { destination_id: 'S1_KOLAR_COLD',       destination_type: 'storage',   allocated_t: 80,  route_id: 'KOLAR_S1_KOLAR_COLD',       transport_cost_total: 1200,  feasible: 1 },
  { destination_id: 'S2_HOSAKOTE',         destination_type: 'storage',   allocated_t: 120, route_id: 'KOLAR_S2_HOSAKOTE',         transport_cost_total: 6000,  feasible: 1 },
  { destination_id: 'P2_BANGALROE_CANNERY',destination_type: 'processor', allocated_t: 70,  route_id: 'KOLAR_P2_BANGALROE_CANNERY',transport_cost_total: 5950,  feasible: 1 },
];

export const DEMO_TRACE_INITIAL = [
  { agent: 'SUPPLY_AGENT',    action: 'analyze_supply',        status: 'completed', summary: 'Supply anomaly detected: +45.8% above 7-day baseline. Current arrivals 910T vs baseline 624.1T.' },
  { agent: 'MARKET_AGENT',    action: 'evaluate_absorption',   status: 'completed', summary: 'Primary market saturation at 107.1%. Kolar APMC operating beyond capacity. Price trend -18.4%.' },
  { agent: 'RISK_AGENT',      action: 'assess_risk',           status: 'completed', summary: 'Composite glut risk: 76.7% (CRITICAL). Weather risk score 0.42. Monsoon tail risk elevated.' },
  { agent: 'RESOURCE_AGENT',  action: 'discover_capacity',     status: 'completed', summary: '590T redirect capacity identified across 2 markets, 2 storage, 2 processors.' },
  { agent: 'COORDINATOR',     action: 'decide_response',       status: 'completed', summary: 'Intervention required. Surplus of 350T must be redistributed within 48 hours.' },
  { agent: 'OPTIMIZER',       action: 'generate_allocation',   status: 'completed', summary: 'Optimal allocation: 350T across 4 destinations. Total cost ₹13,800.' },
  { agent: 'VALIDATOR',       action: 'validate_plan',         status: 'completed', summary: 'Plan validated. All capacity constraints satisfied. 0T unallocated.' },
];

export const DEMO_TRACE_DISRUPTION = [
  { agent: 'COORDINATOR',  action: 'detect_disruption',    status: 'warning',   summary: 'P1_KOLAR_SAUCE offline. 90T allocation affected. Plan invalidated.' },
  { agent: 'COORDINATOR',  action: 'invalidate_plan',      status: 'warning',   summary: 'Existing plan invalidated. Initiating autonomous replan.' },
  { agent: 'OPTIMIZER',    action: 'replan_allocation',    status: 'running',   summary: 'Recalculating allocation across remaining capacity...' },
  { agent: 'OPTIMIZER',    action: 'replan_allocation',    status: 'completed', summary: 'New allocation: 350T across 4 destinations via alternative routes.' },
  { agent: 'VALIDATOR',    action: 'validate_new_plan',    status: 'completed', summary: 'Replanned allocation validated. All constraints satisfied. 0T unallocated.' },
];
