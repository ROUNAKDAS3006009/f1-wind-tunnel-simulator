/**
 * Analysis Panel — Real-time readouts and calculations
 */
import React from 'react';
import { useSimulationStore } from '../store/simulation';
import { SimulationMode, C_SIM } from '../physics/types';

export default function AnalysisPanel() {
  const cursorReadout = useSimulationStore((s) => s.cursorReadout);
  const fieldData = useSimulationStore((s) => s.fieldData);
  const config = useSimulationStore((s) => s.config);
  const particles = useSimulationStore((s) => s.particles);
  const c2 = C_SIM * C_SIM;

  return (
    <div className="analysis-panel">
      <h3>📊 Analysis</h3>
      {fieldData && (
        <section className="analysis-section">
          <h4>Solver Status</h4>
          <div className="readout-grid">
            <div className="readout"><span className="readout-label">Grid Size</span><span className="readout-value">{fieldData.gridSize}×{fieldData.gridSize}</span></div>
            <div className="readout"><span className="readout-label">Iterations</span><span className="readout-value">{fieldData.solverIterations}</span></div>
            <div className="readout"><span className="readout-label">Converged</span><span className={`readout-value ${fieldData.converged ? 'good' : 'warn'}`}>{fieldData.converged ? '✓ Yes' : '⚠ No'}</span></div>
            <div className="readout"><span className="readout-label">Φ Range</span><span className="readout-value">[{fieldData.minPotential.toFixed(3)}, {fieldData.maxPotential.toFixed(3)}]</span></div>
          </div>
        </section>
      )}
      {cursorReadout && (
        <section className="analysis-section">
          <h4>Cursor Probe</h4>
          <div className="readout-grid">
            <div className="readout"><span className="readout-label">Position</span><span className="readout-value">({cursorReadout.x.toFixed(3)}, {cursorReadout.y.toFixed(3)})</span></div>
            <div className="readout"><span className="readout-label">Potential (Φ)</span><span className="readout-value">{cursorReadout.potential.toExponential(3)}</span></div>
            <div className="readout"><span className="readout-label">Field Strength</span><span className="readout-value">{cursorReadout.fieldMagnitude.toExponential(3)}</span></div>
            <div className="readout"><span className="readout-label">Time Dilation (τ/t)</span><span className="readout-value">{cursorReadout.timeDilation.toFixed(6)}</span></div>
            <div className="readout"><span className="readout-label">g_tt</span><span className="readout-value">{cursorReadout.gtt.toFixed(6)}</span></div>
            <div className="readout"><span className="readout-label">g_rr</span><span className="readout-value">{cursorReadout.grr.toFixed(6)}</span></div>
            {Math.abs(cursorReadout.exoticEnergy) > 1e-15 && (
              <div className="readout exotic"><span className="readout-label">Exotic Energy</span><span className="readout-value">{cursorReadout.exoticEnergy.toExponential(3)}</span></div>
            )}
          </div>
        </section>
      )}
      {cursorReadout && cursorReadout.potential < 0 && (
        <section className="analysis-section">
          <h4>Derived Quantities</h4>
          <div className="readout-grid">
            <div className="readout"><span className="readout-label">Escape Velocity</span><span className="readout-value">{Math.sqrt(Math.abs(2*cursorReadout.potential)).toFixed(4)}</span></div>
            <div className="readout"><span className="readout-label">2Φ/c²</span><span className="readout-value">{(2*Math.abs(cursorReadout.potential)/c2).toExponential(3)}</span></div>
          </div>
        </section>
      )}
      {config.mode === SimulationMode.ALCUBIERRE && fieldData && (
        <section className="analysis-section">
          <h4>Warp Bubble Analysis</h4>
          <div className="readout-grid">
            <div className="readout exotic"><span className="readout-label">Total Exotic Energy</span><span className="readout-value">{Math.abs(fieldData.minExotic*fieldData.gridSize*fieldData.gridSize*0.001).toExponential(3)}</span></div>
            <div className="readout"><span className="readout-label">Bubble Radius</span><span className="readout-value">{config.alcubierreR.toFixed(3)}</span></div>
            <div className="readout"><span className="readout-label">Bubble Velocity</span><span className="readout-value">{config.alcubierreVs.toFixed(2)}c</span></div>
          </div>
        </section>
      )}
      {particles.length > 0 && (
        <section className="analysis-section">
          <h4>Active Particles ({particles.filter(p => p.active).length}/{particles.length})</h4>
          <div className="particle-list">
            {particles.slice(0,6).map((p) => (
              <div key={p.id} className={`particle-info ${p.active ? '' : 'inactive'}`}>
                <span className={p.isLight ? 'light-particle' : 'mass-particle'}>{p.isLight ? '☀' : '●'}</span>
                <span className="particle-pos">({p.x.toFixed(2)}, {p.y.toFixed(2)})</span>
                <span className="particle-energy">E={p.energy.toExponential(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
