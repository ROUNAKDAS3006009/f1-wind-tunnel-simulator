/**
 * Visualization Toggles Panel
 */
import React from 'react';
import { useSimulationStore, type VisualizationState } from '../store/simulation';

const TOGGLE_INFO: Record<keyof VisualizationState, { label: string; icon: string; description: string }> = {
  showCurvature: { label: 'Spacetime Curvature', icon: '🌊', description: '3D mesh showing gravitational potential as surface deformation' },
  showHeatmap: { label: 'Potential Heatmap', icon: '🗺', description: '2D false-color map of Φ(x,y) — turbo colormap' },
  showFieldLines: { label: 'Field Lines', icon: '⚡', description: 'Gravitational force direction and magnitude vectors' },
  showGeodesics: { label: 'Geodesic Paths', icon: '🔮', description: 'Click viewport to launch test particles that follow curved space paths' },
  showExoticEnergy: { label: 'Exotic Energy', icon: '💜', description: 'Negative energy density regions required for antigravity geometries' },
  showFrameDrag: { label: 'Frame Dragging', icon: '🌀', description: 'Spacetime dragged rotationally by spinning masses (Lense-Thirring)' },
  showMetricOverlay: { label: 'Metric Coefficients', icon: '📐', description: 'g_tt and g_rr components — space compression/expansion' },
};

export default function VisualizationToggles() {
  const vis = useSimulationStore((s) => s.visualization);
  const toggle = useSimulationStore((s) => s.toggleVisualization);
  const clearParticles = useSimulationStore((s) => s.clearParticles);
  return (
    <div className="viz-toggles">
      <h3>🎨 Visualization Layers</h3>
      <div className="toggle-list">
        {(Object.keys(TOGGLE_INFO) as Array<keyof VisualizationState>).map((key) => {
          const info = TOGGLE_INFO[key];
          return (
            <div key={key} className={`toggle-item ${vis[key] ? 'active' : ''}`}
              onClick={() => toggle(key)} title={info.description}>
              <span className="toggle-icon">{info.icon}</span>
              <span className="toggle-label">{info.label}</span>
              <span className={`toggle-switch ${vis[key] ? 'on' : 'off'}`}>{vis[key] ? 'ON' : 'OFF'}</span>
            </div>
          );
        })}
      </div>
      {vis.showGeodesics && (
        <div className="geodesic-controls">
          <p className="hint">Click on the field to launch test particles</p>
          <button className="clear-btn" onClick={clearParticles}>Clear All Particles</button>
        </div>
      )}
    </div>
  );
}
