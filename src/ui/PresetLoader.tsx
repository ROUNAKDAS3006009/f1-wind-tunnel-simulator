/**
 * Preset Loader — Scenario selection
 */
import React from 'react';
import { useSimulationStore } from '../store/simulation';
import { PRESETS } from '../presets/scenarios';

export default function PresetLoader() {
  const activePreset = useSimulationStore((s) => s.activePreset);
  const loadPreset = useSimulationStore((s) => s.loadPreset);
  const current = PRESETS.find((p) => p.id === activePreset);
  return (
    <div className="preset-loader">
      <h3>🧪 Preset Scenarios</h3>
      <div className="preset-grid">
        {PRESETS.map((preset) => (
          <button key={preset.id} className={`preset-card ${activePreset === preset.id ? 'active' : ''}`}
            onClick={() => loadPreset(preset.id)}>
            <span className="preset-name">{preset.name}</span>
            <span className="preset-desc">{preset.description.slice(0, 80)}...</span>
          </button>
        ))}
      </div>
      {current && (
        <div className="preset-theory">
          <h4>Theoretical Basis</h4>
          <p>{current.theoreticalBasis}</p>
        </div>
      )}
    </div>
  );
}
