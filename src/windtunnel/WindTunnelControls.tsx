/**
 * WindTunnelControls — Left panel with year selector and wind tunnel configuration
 */

import { useSimulationStore } from '../store/simulation';
import { getYearInfo, type CarYear } from './F1CarGeometry';

const DENSITY_LABELS = ['Low', 'Medium', 'High'];
const YEARS: CarYear[] = [2024, 2025, 2026];

export default function WindTunnelControls() {
  const config = useSimulationStore((s) => s.windTunnelConfig);
  const setWindTunnelConfig = useSimulationStore((s) => s.setWindTunnelConfig);
  const isComputing = useSimulationStore((s) => s.isComputing);

  const update = (updates: Partial<typeof config>) => {
    setWindTunnelConfig(updates);
  };

  const yearInfo = getYearInfo(config.carYear as CarYear);
  const is2026 = config.carYear === 2026;

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h2>🏎 Wind Tunnel</h2>
        {isComputing && <span className="computing-badge">Computing...</span>}
      </div>

      {/* Year Selection */}
      <section className="control-section">
        <h3>Regulation Year</h3>
        <div className="mode-selector">
          {YEARS.map((yr) => (
            <button key={yr}
              className={`mode-btn ${config.carYear === yr ? 'active' : ''}`}
              onClick={() => update({ carYear: yr })}
            >
              {yr}
            </button>
          ))}
        </div>
        <p className="mode-description" style={{ marginTop: '6px' }}>
          <strong>{yearInfo.name}</strong><br />
          <em style={{ fontSize: '10px', opacity: 0.7 }}>{yearInfo.regs}</em>
        </p>
        <div className="spec-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {yearInfo.changes.slice(0, 4).map((change, i) => (
            <span key={i} style={{
              fontSize: '9px', padding: '2px 6px',
              background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
              color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {change}
            </span>
          ))}
        </div>
      </section>

      {/* Wind Speed */}
      <section className="control-section">
        <h3>Wind Speed</h3>
        <div className="slider-group">
          <label>
            <span className="slider-label">Airspeed</span>
            <span className="slider-value">{config.windSpeed} km/h</span>
          </label>
          <input type="range" min="50" max="350" step="5" value={config.windSpeed}
            onChange={(e) => update({ windSpeed: parseInt(e.target.value) })} />
          <div className="slider-labels"><span>50 km/h</span><span>350 km/h</span></div>
        </div>
        <p className="hint">{(config.windSpeed / 3.6).toFixed(1)} m/s · Mach {(config.windSpeed / 3.6 / 343).toFixed(3)}</p>
      </section>

      {/* Aerodynamic Angles */}
      <section className="control-section">
        <h3>Aero Angles</h3>
        <div className="slider-group">
          <label>
            <span className="slider-label">Yaw Angle</span>
            <span className="slider-value">{config.yawAngle.toFixed(1)}°</span>
          </label>
          <input type="range" min="-15" max="15" step="0.5" value={config.yawAngle}
            onChange={(e) => update({ yawAngle: parseFloat(e.target.value) })} />
          <div className="slider-labels"><span>-15°</span><span>+15°</span></div>
        </div>
        <div className="slider-group">
          <label>
            <span className="slider-label">Angle of Attack</span>
            <span className="slider-value">{config.attackAngle.toFixed(1)}°</span>
          </label>
          <input type="range" min="-5" max="10" step="0.5" value={config.attackAngle}
            onChange={(e) => update({ attackAngle: parseFloat(e.target.value) })} />
          <div className="slider-labels"><span>-5°</span><span>+10°</span></div>
        </div>
      </section>

      {/* DRS / Active Aero Toggle */}
      <section className="control-section">
        <div className="toggle-row">
          <label>{is2026 ? 'Active Aero (X/Z Mode)' : 'DRS (Drag Reduction System)'}</label>
          <button
            className={`toggle-btn ${config.drsOpen ? 'on' : 'off'}`}
            onClick={() => update({ drsOpen: !config.drsOpen })}
          >
            {config.drsOpen ? (is2026 ? 'X-MODE' : 'OPEN') : (is2026 ? 'Z-MODE' : 'CLOSED')}
          </button>
        </div>
        <p className="hint">
          {is2026
            ? (config.drsOpen
              ? 'X-Mode: low-drag configuration — front & rear wings flattened'
              : 'Z-Mode: high-downforce configuration — maximum cornering grip')
            : (config.drsOpen
              ? 'Rear wing flap open — reduced downforce & drag'
              : 'Rear wing flap closed — maximum downforce')}
        </p>
      </section>

      {/* Particle Density */}
      <section className="control-section">
        <h3>Particle Density</h3>
        <div className="mode-selector">
          {[0, 1, 2].map((density) => (
            <button key={density}
              className={`mode-btn ${config.particleDensity === density ? 'active' : ''}`}
              onClick={() => update({ particleDensity: density })}
            >
              {DENSITY_LABELS[density]}
            </button>
          ))}
        </div>
      </section>

      {/* Car Setup */}
      <section className="control-section">
        <h3>🔧 Car Setup</h3>

        <div className="slider-group">
          <label>
            <span className="slider-label">Ride Height</span>
            <span className="slider-value">{config.rideHeight ?? 40} mm</span>
          </label>
          <input type="range" min="30" max="60" step="1" value={config.rideHeight ?? 40}
            onChange={(e) => update({ rideHeight: parseInt(e.target.value) })} />
          <div className="slider-labels"><span>30mm (low)</span><span>60mm (high)</span></div>
        </div>
        <p className="hint">Lower = more ground effect downforce, risk of bottoming</p>

        <div className="slider-group">
          <label>
            <span className="slider-label">Front Wing Angle</span>
            <span className="slider-value">{config.frontWingAngle ?? 8}°</span>
          </label>
          <input type="range" min="0" max="15" step="0.5" value={config.frontWingAngle ?? 8}
            onChange={(e) => update({ frontWingAngle: parseFloat(e.target.value) })} />
          <div className="slider-labels"><span>0° (flat)</span><span>15° (max)</span></div>
        </div>

        <div className="slider-group">
          <label>
            <span className="slider-label">Rear Wing Angle</span>
            <span className="slider-value">{config.rearWingAngle ?? 22}°</span>
          </label>
          <input type="range" min="5" max="35" step="0.5" value={config.rearWingAngle ?? 22}
            onChange={(e) => update({ rearWingAngle: parseFloat(e.target.value) })} />
          <div className="slider-labels"><span>5° (low drag)</span><span>35° (max DF)</span></div>
        </div>

        <div className="slider-group">
          <label>
            <span className="slider-label">Tire Width</span>
            <span className="slider-value">×{(config.tireWidth ?? 1.0).toFixed(2)}</span>
          </label>
          <input type="range" min="0.8" max="1.2" step="0.02" value={config.tireWidth ?? 1.0}
            onChange={(e) => update({ tireWidth: parseFloat(e.target.value) })} />
          <div className="slider-labels"><span>0.80 (narrow)</span><span>1.20 (wide)</span></div>
        </div>
        <p className="hint">Wider tires = more drag but better grip</p>
      </section>

      {/* Visualization Toggles */}
      <section className="control-section">
        <h3>Visualization</h3>
        <div className="toggle-list">
          {([
            { key: 'showStreamlines' as const, label: 'Streamlines', icon: '💨' },
            { key: 'showPressureMap' as const, label: 'Pressure Map', icon: '🗺' },
            { key: 'showVortices' as const, label: 'Vortex Trails', icon: '🌀' },
            { key: 'showSmoke' as const, label: 'Smoke Effect', icon: '🌫' },
          ]).map(({ key, label, icon }) => (
            <div key={key}
              className={`toggle-item ${config[key] ? 'active' : ''}`}
              onClick={() => update({ [key]: !config[key] })}
            >
              <span className="toggle-icon">{icon}</span>
              <span className="toggle-label">{label}</span>
              <span className={`toggle-switch ${config[key] ? 'on' : 'off'}`}>
                {config[key] ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
