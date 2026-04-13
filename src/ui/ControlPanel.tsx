/**
 * Control Panel — Left sidebar with field controls
 */

import React from 'react';
import { useSimulationStore } from '../store/simulation';
import { SimulationMode } from '../physics/types';
import './ControlPanel.css';

const MODE_NAMES: Record<SimulationMode, string> = {
  [SimulationMode.NEWTONIAN]: 'Newtonian',
  [SimulationMode.PPN]: 'Post-Newtonian (PPN)',
  [SimulationMode.ALCUBIERRE]: 'Alcubierre Warp',
  [SimulationMode.FRAME_DRAG]: 'Frame Dragging',
  [SimulationMode.CASIMIR]: 'Casimir Cavity',
  [SimulationMode.WIND_TUNNEL]: 'Wind Tunnel',
};

const MODE_DESCRIPTIONS: Record<SimulationMode, string> = {
  [SimulationMode.NEWTONIAN]: 'Classical gravitational potential via Poisson equation ∇²Φ = 4πGρ',
  [SimulationMode.PPN]: 'Newtonian + first-order General Relativity correction (Φ²/c²)',
  [SimulationMode.ALCUBIERRE]: 'Warp drive metric with exotic energy shell — contracts space ahead, expands behind',
  [SimulationMode.FRAME_DRAG]: 'Lense-Thirring effect — rotating mass drags spacetime (gravitomagnetic vortex)',
  [SimulationMode.CASIMIR]: 'Quantum vacuum energy between parallel plates — source of negative energy density',
  [SimulationMode.WIND_TUNNEL]: 'Virtual F1 wind tunnel — CFD airflow simulation around a 2025 car',
};

export default function ControlPanel() {
  const config = useSimulationStore((s) => s.config);
  const setConfig = useSimulationStore((s) => s.setConfig);
  const setMode = useSimulationStore((s) => s.setMode);
  const addSource = useSimulationStore((s) => s.addSource);
  const removeSource = useSimulationStore((s) => s.removeSource);
  const updateSource = useSimulationStore((s) => s.updateSource);
  const analysisMode = useSimulationStore((s) => s.analysisMode);
  const setAnalysisMode = useSimulationStore((s) => s.setAnalysisMode);
  const isComputing = useSimulationStore((s) => s.isComputing);

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h2>⚛ Field Controls</h2>
        {isComputing && <span className="computing-badge">Computing...</span>}
      </div>

      <section className="control-section">
        <h3>Simulation Mode</h3>
        <div className="mode-selector">
          {Object.values(SimulationMode).map((mode) => (
            <button key={mode} className={`mode-btn ${config.mode === mode ? 'active' : ''}`}
              onClick={() => setMode(mode)} title={MODE_DESCRIPTIONS[mode]}>
              {MODE_NAMES[mode]}
            </button>
          ))}
        </div>
        <p className="mode-description">{MODE_DESCRIPTIONS[config.mode]}</p>
      </section>

      <section className="control-section">
        <div className="toggle-row">
          <label>Analysis Mode (512×512)</label>
          <button className={`toggle-btn ${analysisMode ? 'on' : 'off'}`}
            onClick={() => setAnalysisMode(!analysisMode)}>
            {analysisMode ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="hint">Higher resolution, slower computation</p>
      </section>

      <section className="control-section">
        <div className="section-header">
          <h3>Field Sources ({config.sources.length}/8)</h3>
          <button className="add-btn" onClick={() => addSource()} disabled={config.sources.length >= 8}>+ Add</button>
        </div>

        <div className="sources-list">
          {config.sources.map((src, idx) => (
            <div key={src.id} className="source-card">
              <div className="source-header">
                <span className={`source-indicator ${src.mass >= 0 ? 'positive' : 'negative'}`}>
                  {src.mass >= 0 ? '●' : '◆'}
                </span>
                <span className="source-label">Source {idx + 1}</span>
                <button className="remove-btn" onClick={() => removeSource(src.id)}>×</button>
              </div>

              <div className="slider-group">
                <label><span className="slider-label">Mass / Energy</span><span className="slider-value">{src.mass.toFixed(2)}</span></label>
                <input type="range" min="-10" max="10" step="0.1" value={src.mass}
                  onChange={(e) => updateSource(src.id, { mass: parseFloat(e.target.value) })}
                  className={src.mass >= 0 ? 'slider-positive' : 'slider-negative'} />
                <div className="slider-labels"><span>Exotic (−)</span><span>Normal (+)</span></div>
              </div>

              <div className="slider-group">
                <label><span className="slider-label">Position X</span><span className="slider-value">{src.x.toFixed(2)}</span></label>
                <input type="range" min="0.05" max="0.95" step="0.01" value={src.x}
                  onChange={(e) => updateSource(src.id, { x: parseFloat(e.target.value) })} />
              </div>

              <div className="slider-group">
                <label><span className="slider-label">Position Y</span><span className="slider-value">{src.y.toFixed(2)}</span></label>
                <input type="range" min="0.05" max="0.95" step="0.01" value={src.y}
                  onChange={(e) => updateSource(src.id, { y: parseFloat(e.target.value) })} />
              </div>

              {(config.mode === SimulationMode.FRAME_DRAG) && (
                <div className="slider-group">
                  <label><span className="slider-label">Angular Momentum</span><span className="slider-value">{src.angularMomentum.toFixed(2)}</span></label>
                  <input type="range" min="-20" max="20" step="0.5" value={src.angularMomentum}
                    onChange={(e) => updateSource(src.id, { angularMomentum: parseFloat(e.target.value) })} />
                </div>
              )}

              {config.mode === SimulationMode.CASIMIR && (
                <div className="slider-group">
                  <label><span className="slider-label">Coupling Constant</span><span className="slider-value">{src.exoticCoupling.toFixed(2)}</span></label>
                  <input type="range" min="0.1" max="5" step="0.1" value={src.exoticCoupling}
                    onChange={(e) => updateSource(src.id, { exoticCoupling: parseFloat(e.target.value) })} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {config.mode === SimulationMode.ALCUBIERRE && (
        <section className="control-section">
          <h3>Warp Bubble Parameters</h3>
          <div className="slider-group">
            <label><span className="slider-label">Bubble Radius</span><span className="slider-value">{config.alcubierreR.toFixed(3)}</span></label>
            <input type="range" min="0.03" max="0.3" step="0.005" value={config.alcubierreR}
              onChange={(e) => setConfig({ alcubierreR: parseFloat(e.target.value) })} />
          </div>
          <div className="slider-group">
            <label><span className="slider-label">Wall Thickness (σ)</span><span className="slider-value">{config.alcubierreSigma.toFixed(0)}</span></label>
            <input type="range" min="5" max="50" step="1" value={config.alcubierreSigma}
              onChange={(e) => setConfig({ alcubierreSigma: parseFloat(e.target.value) })} />
          </div>
          <div className="slider-group">
            <label><span className="slider-label">Bubble Velocity</span><span className="slider-value">{config.alcubierreVs.toFixed(2)}c</span></label>
            <input type="range" min="0.1" max="2.0" step="0.05" value={config.alcubierreVs}
              onChange={(e) => setConfig({ alcubierreVs: parseFloat(e.target.value) })} />
          </div>
        </section>
      )}

      {config.mode === SimulationMode.CASIMIR && (
        <section className="control-section">
          <h3>Casimir Cavity Parameters</h3>
          <div className="slider-group">
            <label><span className="slider-label">Plate Gap</span><span className="slider-value">{config.casimirPlateGap.toFixed(3)}</span></label>
            <input type="range" min="0.02" max="0.2" step="0.005" value={config.casimirPlateGap}
              onChange={(e) => setConfig({ casimirPlateGap: parseFloat(e.target.value) })} />
          </div>
          <div className="slider-group">
            <label><span className="slider-label">Plate Length</span><span className="slider-value">{config.casimirPlateLength.toFixed(2)}</span></label>
            <input type="range" min="0.1" max="0.8" step="0.05" value={config.casimirPlateLength}
              onChange={(e) => setConfig({ casimirPlateLength: parseFloat(e.target.value) })} />
          </div>
        </section>
      )}
    </div>
  );
}
