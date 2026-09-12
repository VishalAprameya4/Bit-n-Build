import { useAppState, PHASE } from './useAppState';
import Header        from './components/Header';
import GlutMonitor   from './components/GlutMonitor';
import NetworkTwin   from './components/NetworkTwin';
import AgentPanel    from './components/AgentPanel';
import ResponsePlan  from './components/ResponsePlan';
import WhatIfControl from './components/WhatIfControl';
import './App.css';

export default function App() {
  const state = useAppState();

  return (
    <div className="app-shell">
      <Header
        phase={state.phase}
        backendOk={state.backendOk}
        onReset={state.reset}
      />

      <main className="app-body">
        {/* Left column */}
        <aside className="col-left">
          <GlutMonitor
            scenario={state.scenario}
            phase={state.phase}
          />
          <WhatIfControl
            phase={state.phase}
            onSimulate={state.simulateDisruption}
            onReset={state.reset}
            onAnalyze={state.analyzeGlut}
          />
        </aside>

        {/* Center column — digital twin */}
        <section className="col-center">
          <NetworkTwin
            nodes={state.nodes}
            edges={state.edges}
            phase={state.phase}
            scenario={state.scenario}
          />
        </section>

        {/* Right column */}
        <aside className="col-right">
          <AgentPanel
            trace={state.trace}
            phase={state.phase}
          />
        </aside>
      </main>

      {/* Bottom bar — response plan */}
      <footer className="app-footer">
        <ResponsePlan
          plan={state.plan}
          allocations={state.allocations}
          nodes={state.nodes}
          phase={state.phase}
        />
      </footer>
    </div>
  );
}
