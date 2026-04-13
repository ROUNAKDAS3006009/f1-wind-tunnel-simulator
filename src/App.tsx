import { useEffect, useRef } from 'react';
import Scene from './visualization/Scene';
import ControlPanel from './ui/ControlPanel';
import VisualizationToggles from './ui/VisualizationToggles';
import AnalysisPanel from './ui/AnalysisPanel';
import PresetLoader from './ui/PresetLoader';
import Toolbar from './ui/Toolbar';
import WindTunnelScene from './windtunnel/WindTunnelScene';
import WindTunnelControls from './windtunnel/WindTunnelControls';
import WindTunnelAnalysis from './windtunnel/WindTunnelAnalysis';
import { useSimulationStore } from './store/simulation';
import type { WorkerResponse } from './physics/types';
import './App.css';

export default function App() {
  const workerRef = useRef<Worker | null>(null);
  const config = useSimulationStore((s) => s.config);
  const setFieldData = useSimulationStore((s) => s.setFieldData);
  const setIsComputing = useSimulationStore((s) => s.setIsComputing);
  const particles = useSimulationStore((s) => s.particles);
  const setParticles = useSimulationStore((s) => s.setParticles);
  const fieldData = useSimulationStore((s) => s.fieldData);
  const showGeodesics = useSimulationStore((s) => s.visualization.showGeodesics);
  const appMode = useSimulationStore((s) => s.appMode);
  const windTunnelConfig = useSimulationStore((s) => s.windTunnelConfig);
  const setWindTunnelResult = useSimulationStore((s) => s.setWindTunnelResult);
  const setFluidVelocity = useSimulationStore((s) => s.setFluidVelocity);

  useEffect(() => {
    const worker = new Worker(new URL('./physics/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'FIELD_COMPUTED': setFieldData(msg.data); setIsComputing(false); break;
        case 'GEODESICS_UPDATED': setParticles(msg.particles); break;
        case 'TEST_RESULTS':
          console.log('=== Physics Validation Tests ===');
          msg.results.forEach((r) => console.log(`${r.passed ? '✅' : '❌'} ${r.name}\n   Expected: ${r.expected}\n   Actual: ${r.actual}`));
          break;
        case 'WIND_TUNNEL_COMPUTED':
          setWindTunnelResult(msg.data);
          break;
        case 'FLUID_STEPPED':
          setFluidVelocity(msg.velX, msg.velY, msg.velZ, msg.pressure);
          break;
      }
    };
    workerRef.current = worker;
    (window as any).physicsWorker = worker; // Expose for F1CarModel MeshVoxelizer
    (window as any).__runPhysicsTests = () => worker.postMessage({ type: 'RUN_TESTS' });
    return () => {
      worker.terminate();
      (window as any).physicsWorker = undefined;
    };
  }, [setFieldData, setIsComputing, setParticles, setWindTunnelResult, setFluidVelocity]);

  // Compute field when config changes (simulator mode)
  useEffect(() => {
    if (!workerRef.current || appMode !== 'simulator') return;
    setIsComputing(true);
    workerRef.current.postMessage({ type: 'COMPUTE_FIELD', config });
  }, [config, setIsComputing, appMode]);

  // Compute wind tunnel when config changes (wind tunnel mode)
  useEffect(() => {
    if (!workerRef.current || appMode !== 'windtunnel') return;
    setIsComputing(true);
    workerRef.current.postMessage({ type: 'COMPUTE_WIND_TUNNEL', config: windTunnelConfig });
  }, [windTunnelConfig, setIsComputing, appMode]);

  // Geodesic integration loop
  useEffect(() => {
    if (!workerRef.current || !fieldData || !showGeodesics || appMode !== 'simulator') return;
    if (particles.length === 0 || particles.every((p) => !p.active)) return;
    const interval = setInterval(() => {
      if (!workerRef.current || !fieldData) return;
      workerRef.current.postMessage({ type: 'INTEGRATE_GEODESICS', particles, fieldData, config });
    }, 50);
    return () => clearInterval(interval);
  }, [fieldData, particles, showGeodesics, config, appMode]);

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        {appMode === 'simulator' ? (
          <>
            <div className="left-panel"><ControlPanel /><PresetLoader /></div>
            <div className="viewport"><Scene /></div>
            <div className="right-panel"><VisualizationToggles /><AnalysisPanel /></div>
          </>
        ) : (
          <>
            <div className="left-panel"><WindTunnelControls /></div>
            <div className="viewport"><WindTunnelScene /></div>
            <div className="right-panel"><WindTunnelAnalysis /></div>
          </>
        )}
      </div>
    </div>
  );
}
