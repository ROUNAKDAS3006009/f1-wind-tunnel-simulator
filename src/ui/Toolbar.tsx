/**
 * Toolbar — Top bar with app title, mode switcher, export, and quick actions
 */
import { useSimulationStore } from '../store/simulation';
import { exportFieldCSV, exportGeodesicsCSV, exportSimulationJSON, downloadFile } from '../utils/export';

export default function Toolbar() {
  const fieldData = useSimulationStore((s) => s.fieldData);
  const config = useSimulationStore((s) => s.config);
  const particles = useSimulationStore((s) => s.particles);
  const appMode = useSimulationStore((s) => s.appMode);
  const setAppMode = useSimulationStore((s) => s.setAppMode);

  const handleExportCSV = () => { if (!fieldData) return; downloadFile(exportFieldCSV(fieldData), 'field_data.csv', 'text/csv'); };
  const handleExportJSON = () => { if (!fieldData) return; downloadFile(exportSimulationJSON(config, fieldData, particles), 'simulation_state.json', 'application/json'); };
  const handleExportGeodesics = () => { if (particles.length === 0) return; downloadFile(exportGeodesicsCSV(particles), 'geodesic_paths.csv', 'text/csv'); };
  const handleExportPNG = () => { const canvas = document.querySelector('canvas'); if (!canvas) return; const url = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href = url; a.download = 'simulation_render.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a); };

  return (
    <div className="toolbar">
      <div className="toolbar-title">
        <span className="app-icon">🌌</span>
        <h1>Antigravity Field Simulator</h1>
        <span className="version">v1.1 · Phase 2</span>
      </div>

      {/* Mode Switcher */}
      <div className="mode-switcher">
        <button
          className={`mode-tab ${appMode === 'simulator' ? 'active' : ''}`}
          onClick={() => setAppMode('simulator')}
        >
          ⚛ Field Simulator
        </button>
        <button
          className={`mode-tab ${appMode === 'windtunnel' ? 'active' : ''}`}
          onClick={() => setAppMode('windtunnel')}
        >
          🏎 Wind Tunnel
        </button>
      </div>

      <div className="toolbar-actions">
        {appMode === 'simulator' && (
          <>
            <button className="export-btn" onClick={handleExportCSV} disabled={!fieldData} title="Export field data as CSV">📄 CSV</button>
            <button className="export-btn" onClick={handleExportJSON} disabled={!fieldData} title="Export full simulation state">📋 JSON</button>
            <button className="export-btn" onClick={handleExportGeodesics} disabled={particles.length === 0} title="Export geodesic paths">🔮 Geodesics</button>
          </>
        )}
        <button className="export-btn" onClick={handleExportPNG} title="Screenshot viewport">📸 PNG</button>
      </div>
    </div>
  );
}
