/**
 * WindTunnelAnalysis — Right panel showing aerodynamic readouts
 */

import { useSimulationStore } from '../store/simulation';

function formatForce(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(2) + ' kN';
  return n.toFixed(1) + ' N';
}

function DownforceBar({ speed, maxSpeed }: { speed: number; maxSpeed: number }) {
  // Downforce grows with v² 
  const bars = 20;
  const filled = Math.round((speed / maxSpeed) ** 2 * bars);
  const bar = Array.from({ length: bars }, (_, i) => i < filled ? '█' : '░').join('');
  return <span className="readout-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '-1px' }}>{bar}</span>;
}

export default function WindTunnelAnalysis() {
  const config = useSimulationStore((s) => s.windTunnelConfig);
  const result = useSimulationStore((s) => s.windTunnelResult);

  const speedMs = config.windSpeed / 3.6;
  const q = 0.5 * 1.225 * speedMs * speedMs; // dynamic pressure

  return (
    <div className="analysis-panel wt-analysis">
      <h3>📊 Aerodynamic Analysis</h3>

      {/* Force Coefficients */}
      <div className="analysis-section">
        <h4>Force Coefficients</h4>
        <div className="readout-grid">
          <div className="readout">
            <span className="readout-label">Drag Coeff (C<sub>d</sub>)</span>
            <span className="readout-value">{result ? result.cd.toFixed(4) : '—'}</span>
          </div>
          <div className="readout">
            <span className="readout-label">Lift Coeff (C<sub>l</sub>)</span>
            <span className={`readout-value ${result && result.cl < 0 ? 'good' : ''}`}>
              {result ? result.cl.toFixed(4) : '—'}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">L/D Ratio</span>
            <span className="readout-value">
              {result ? (Math.abs(result.cl / result.cd)).toFixed(2) : '—'}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">Aero Efficiency</span>
            <span className={`readout-value ${result && Math.abs(result.cl / result.cd) > 4 ? 'good' : 'warn'}`}>
              {result ? (Math.abs(result.cl / result.cd) > 4 ? 'Good' : 'Moderate') : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Forces at Current Speed */}
      <div className="analysis-section">
        <h4>Forces @ {config.windSpeed} km/h</h4>
        <div className="readout-grid">
          <div className="readout">
            <span className="readout-label">Downforce</span>
            <span className="readout-value good">
              {result ? formatForce(result.downforce) : '—'}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">Drag Force</span>
            <span className="readout-value warn">
              {result ? formatForce(result.drag) : '—'}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">Side Force</span>
            <span className="readout-value">
              {result ? formatForce(result.sideForce) : '—'}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">Dynamic Pressure</span>
            <span className="readout-value">{q.toFixed(0)} Pa</span>
          </div>
        </div>
      </div>

      {/* Downforce vs Speed */}
      <div className="analysis-section">
        <h4>Downforce vs Speed</h4>
        <div className="readout-grid">
          {[100, 150, 200, 250, 300, 350].map((spd) => {
            const sMs = spd / 3.6;
            const qS = 0.5 * 1.225 * sMs * sMs;
            const cl = result ? result.cl : -4.5;
            const df = Math.abs(cl) * qS * 5.0;
            return (
              <div key={spd} className={`readout ${spd === config.windSpeed ? 'exotic' : ''}`}>
                <span className="readout-label">{spd} km/h</span>
                <span className="readout-value">{formatForce(df)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Downforce bar visualization */}
      <div className="analysis-section">
        <h4>Downforce Level</h4>
        <DownforceBar speed={config.windSpeed} maxSpeed={350} />
        <p className="hint" style={{ marginTop: '4px' }}>
          Downforce scales with velocity² — {config.windSpeed > 250 ? 'extreme grip zone' : config.windSpeed > 150 ? 'high downforce' : 'low speed, moderate grip'}
        </p>
      </div>

      {/* DRS / Active Aero Effect */}
      <div className="analysis-section">
        <h4>{config.carYear === 2026 ? 'Active Aero Status' : 'DRS Status'}</h4>
        <div className="readout-grid">
          <div className="readout">
            <span className="readout-label">{config.carYear === 2026 ? 'Mode' : 'Flap'}</span>
            <span className={`readout-value ${config.drsOpen ? 'warn' : 'good'}`}>
              {config.carYear === 2026
                ? (config.drsOpen ? '🟡 X-MODE' : '🟢 Z-MODE')
                : (config.drsOpen ? '🟡 OPEN' : '🟢 CLOSED')}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">Drag Δ</span>
            <span className="readout-value">
              {config.drsOpen
                ? (config.carYear === 2026 ? '−20-25%' : '−10-15%')
                : 'Baseline'}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">Downforce Δ</span>
            <span className="readout-value">
              {config.drsOpen
                ? (config.carYear === 2026 ? '−40-50%' : '−25-30%')
                : 'Maximum'}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">Top Speed Δ</span>
            <span className="readout-value">
              {config.drsOpen
                ? (config.carYear === 2026 ? '+20-25 km/h' : '+10-15 km/h')
                : 'Baseline'}
            </span>
          </div>
        </div>
      </div>

      {/* Pressure Range */}
      {result && (
        <div className="analysis-section">
          <h4>Pressure Field</h4>
          <div className="readout-grid">
            <div className="readout">
              <span className="readout-label">Max Pressure</span>
              <span className="readout-value">{result.maxPressure.toFixed(0)} Pa</span>
            </div>
            <div className="readout">
              <span className="readout-label">Min Pressure</span>
              <span className="readout-value">{result.minPressure.toFixed(0)} Pa</span>
            </div>
            <div className="readout">
              <span className="readout-label">Max Velocity</span>
              <span className="readout-value">{(result.maxVelocity * 3.6).toFixed(0)} km/h</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
