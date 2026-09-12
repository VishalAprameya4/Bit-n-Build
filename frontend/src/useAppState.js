/**
 * Central application state hook
 * Manages live Kolar market/weather data, agent activity traces, plans, and disruption simulation
 */
import { useState, useCallback, useRef } from 'react';
import {
  api,
  DEMO_SCENARIO, DEMO_NODES,
  DEMO_EDGES_INITIAL, DEMO_EDGES_REPLANNED,
  DEMO_ALLOCATIONS_INITIAL, DEMO_ALLOCATIONS_REPLANNED,
  DEMO_TRACE_INITIAL, DEMO_TRACE_DISRUPTION,
} from './api';

// App phases drive the visual state machine
export const PHASE = {
  IDLE:         'idle',
  ANALYZING:    'analyzing',
  ACTIVE:       'active',
  DISRUPTION:   'disruption',
  REPLANNING:   'replanning',
  REPLANNED:    'replanned',
};

export function useAppState() {
  const [phase, setPhase]             = useState(PHASE.IDLE);
  const [scenario, setScenario]       = useState(null);
  const [nodes, setNodes]             = useState([]);
  const [edges, setEdges]             = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [trace, setTrace]             = useState([]);
  const [activity, setActivity]       = useState(null);
  const [plan, setPlan]               = useState(null);
  const [error, setError]             = useState(null);
  const [backendOk, setBackendOk]     = useState(null);
  const [refreshing, setRefreshing]   = useState(false);
  const traceTimers = useRef([]);

  const clearTimers = () => {
    traceTimers.current.forEach(clearTimeout);
    traceTimers.current = [];
  };

  // Drip-feed trace entries for live look
  const animateTrace = useCallback((entries, baseDelayMs = 0) => {
    entries.forEach((entry, i) => {
      const t = setTimeout(() => {
        setTrace(prev => [...prev, { ...entry, key: Date.now() + i }]);
      }, baseDelayMs + i * 500);
      traceTimers.current.push(t);
    });
  }, []);

  const mergeNodesFromGraph = useCallback((graphNodes) => {
    setNodes(graphNodes.length ? graphNodes : DEMO_NODES);
  }, []);

  // ── Phase 1: Analyze glut ────────────────────────────────────────────────
  const analyzeGlut = useCallback(async () => {
    if (phase !== PHASE.IDLE && phase !== PHASE.ACTIVE && phase !== PHASE.REPLANNED) return;
    clearTimers();
    setPhase(PHASE.ANALYZING);
    setTrace([]);
    setError(null);

    try {
      // Fetch live data & generate plan
      const [scenarioData, planData, graphData, activityData] = await Promise.all([
        api.scenario(),
        api.generatePlan(),
        api.networkGraph(),
        api.agentActivity(),
      ]);
      setBackendOk(true);
      setScenario(scenarioData);
      setActivity(activityData);
      mergeNodesFromGraph(graphData.nodes || []);
      setEdges(graphData.edges || []);
      setAllocations(planData.allocations || []);
      setPlan(planData);

      const traceEntries = (activityData.trace || []).map(t => ({
        agent:   t.agent,
        action:  t.action,
        status:  t.status || 'completed',
        summary: t.summary || t.reason || '',
        tool:    t.tool,
        reason:  t.reason,
      }));
      animateTrace(traceEntries.length ? traceEntries : DEMO_TRACE_INITIAL);
      const duration = (traceEntries.length || DEMO_TRACE_INITIAL.length) * 500 + 300;
      setTimeout(() => setPhase(PHASE.ACTIVE), duration);

    } catch (err) {
      // Demo fallback
      setBackendOk(false);
      setScenario(DEMO_SCENARIO);
      setNodes(DEMO_NODES);
      animateTrace(DEMO_TRACE_INITIAL);
      const duration = DEMO_TRACE_INITIAL.length * 500 + 300;
      setTimeout(() => {
        setEdges(DEMO_EDGES_INITIAL);
        setAllocations(DEMO_ALLOCATIONS_INITIAL);
        setPlan({ surplus_t: 350, unallocated_t: 0, total_transport_cost: 13800, allocations: DEMO_ALLOCATIONS_INITIAL });
        setPhase(PHASE.ACTIVE);
      }, duration);
    }
  }, [phase, animateTrace, mergeNodesFromGraph]);

  // ── Refresh Live Data ───────────────────────────────────────────────────
  const refreshLiveData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.refreshData();
      if (res?.snapshot) {
        setScenario(res.snapshot);
      }
      const activityData = await api.agentActivity().catch(() => null);
      if (activityData) setActivity(activityData);
      setBackendOk(true);
    } catch {
      // Ignore or keep previous
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Phase 2: Simulate disruption ─────────────────────────────────────────
  const simulateDisruption = useCallback(async () => {
    if (phase !== PHASE.ACTIVE) return;
    clearTimers();
    setPhase(PHASE.DISRUPTION);

    // Mark processor offline immediately
    setNodes(prev => prev.map(n =>
      n.id === 'P1_KOLAR_SAUCE'
        ? { ...n, status: 'offline', is_active: false }
        : n
    ));

    // Mark affected edge broken
    setEdges(prev => prev.map(e =>
      e.target === 'P1_KOLAR_SAUCE' ? { ...e, active: false, disrupted: true } : e
    ));

    // Drip disruption trace
    animateTrace(DEMO_TRACE_DISRUPTION.slice(0, 2));

    // After brief pause, enter replanning
    const t1 = setTimeout(async () => {
      setPhase(PHASE.REPLANNING);
      animateTrace(DEMO_TRACE_DISRUPTION.slice(2, 3), 0);

      try {
        const result = await api.applyWhatIf({
          overrides: {
            processors: [{ processor_id: 'P1_KOLAR_SAUCE', is_active: false, capacity_t: 0 }],
          },
        });
        const newPlan = result.plan || result;
        const [graphData, activityData] = await Promise.all([
          api.networkGraph(),
          api.agentActivity(),
        ]);

        setTimeout(() => {
          mergeNodesFromGraph(graphData.nodes || DEMO_NODES.map(n =>
            n.id === 'P1_KOLAR_SAUCE' ? { ...n, status: 'offline', is_active: false } : n
          ));
          setEdges(graphData.edges?.length ? graphData.edges : DEMO_EDGES_REPLANNED);
          setAllocations(newPlan.allocations || DEMO_ALLOCATIONS_REPLANNED);
          setPlan(newPlan);
          setActivity(activityData);
          animateTrace(DEMO_TRACE_DISRUPTION.slice(3), 0);
          setTimeout(() => setPhase(PHASE.REPLANNED), 1200);
        }, 1000);

      } catch {
        // Demo fallback
        setTimeout(() => {
          setNodes(prev => prev.map(n =>
            n.id === 'P1_KOLAR_SAUCE' ? { ...n, status: 'offline', is_active: false } : n
          ));
          setEdges(DEMO_EDGES_REPLANNED);
          setAllocations(DEMO_ALLOCATIONS_REPLANNED);
          setPlan({ surplus_t: 350, unallocated_t: 0, total_transport_cost: 19550, allocations: DEMO_ALLOCATIONS_REPLANNED });
          animateTrace(DEMO_TRACE_DISRUPTION.slice(3), 0);
          setTimeout(() => setPhase(PHASE.REPLANNED), 1200);
        }, 1500);
      }
    }, 1500);
    traceTimers.current.push(t1);
  }, [phase, animateTrace, mergeNodesFromGraph]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(async () => {
    clearTimers();
    setPhase(PHASE.IDLE);
    setTrace([]);
    setEdges([]);
    setAllocations([]);
    setNodes([]);
    setPlan(null);
    setScenario(null);
    setActivity(null);
    setError(null);
    try { await api.resetWhatIf(); } catch { /* ignore */ }
    try {
      const snap = await api.scenario();
      setScenario(snap);
      setBackendOk(true);
    } catch {
      setScenario(DEMO_SCENARIO);
    }
  }, []);

  return {
    phase, scenario, nodes, edges, allocations, trace, activity, plan, error, backendOk, refreshing,
    analyzeGlut, refreshLiveData, simulateDisruption, reset,
  };
}
