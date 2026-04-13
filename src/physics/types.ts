/**
 * Antigravity Field Simulation — Core Physics Types
 * 
 * Theoretical basis: Linearized General Relativity (post-Newtonian approximation),
 * Alcubierre metric (M. Alcubierre, 1994), Gravitoelectromagnetism (GEM formalism).
 */

// ─── Physical Constants ───────────────────────────────────────────────
export const G = 6.674e-11;       // Gravitational constant (m³/kg/s²)
export const c = 3e8;             // Speed of light (m/s)
export const hbar = 1.055e-34;    // Reduced Planck constant (J·s)

// For simulation we use normalized units where G=1, c=1
// This keeps numerical values manageable on the grid
export const G_SIM = 1.0;
export const C_SIM = 10.0;        // Normalized c — keeps GR corrections visible

// ─── Simulation Modes ─────────────────────────────────────────────────
export enum SimulationMode {
  NEWTONIAN = 'NEWTONIAN',
  PPN = 'PPN',
  ALCUBIERRE = 'ALCUBIERRE',
  FRAME_DRAG = 'FRAME_DRAG',
  CASIMIR = 'CASIMIR',
  WIND_TUNNEL = 'WIND_TUNNEL',
}

// ─── Field Source ─────────────────────────────────────────────────────
export interface FieldSource {
  id: string;
  x: number;              // position x (grid-normalized, 0..1)
  y: number;              // position y (grid-normalized, 0..1)
  mass: number;           // mass/energy density (negative for exotic matter)
  angularMomentum: number; // spin (for frame dragging)
  velocityX: number;      // source velocity x (for gravitomagnetic effects)
  velocityY: number;      // source velocity y
  exoticCoupling: number; // coupling constant for exotic energy
  type: 'point' | 'ring' | 'plate'; // source geometry
}

// ─── Simulation Configuration ─────────────────────────────────────────
export interface SimulationConfig {
  mode: SimulationMode;
  gridSize: number;            // NxN grid resolution
  sources: FieldSource[];
  convergenceTolerance: number; // SOR convergence criterion
  maxIterations: number;        // max SOR iterations
  omega: number;                // SOR relaxation parameter
  softeningRadius: number;      // point mass softening (grid units)
  // Alcubierre-specific
  alcubierreR: number;          // bubble radius
  alcubierreSigma: number;      // wall thickness parameter
  alcubierreVs: number;         // bubble velocity
  // Casimir-specific
  casimirPlateGap: number;      // plate separation
  casimirPlateLength: number;   // plate length
  // Geodesic
  geodesicDt: number;           // integration timestep
  geodesicSteps: number;        // steps per frame
}

// ─── Computed Field Data ──────────────────────────────────────────────
export interface FieldData {
  potential: Float64Array;        // Φ(x,y) gravitational potential
  exoticEnergy: Float64Array;     // negative energy density regions
  frameDragX: Float64Array;       // gravitomagnetic drag field x-component
  frameDragY: Float64Array;       // gravitomagnetic drag field y-component
  metricGtt: Float64Array;        // g_tt metric component
  metricGrr: Float64Array;        // g_rr metric component
  gradX: Float64Array;            // ∂Φ/∂x
  gradY: Float64Array;            // ∂Φ/∂y
  gridSize: number;
  minPotential: number;
  maxPotential: number;
  minExotic: number;
  maxExotic: number;
  solverIterations: number;       // actual iterations used
  converged: boolean;
}

// ─── Geodesic Particle ────────────────────────────────────────────────
export interface GeodesicParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  path: Array<{ x: number; y: number }>;
  isLight: boolean;      // true = null geodesic (light ray)
  energy: number;        // for conservation monitoring
  active: boolean;
}

// ─── Wind Tunnel Types ────────────────────────────────────────────────
export interface WindTunnelConfig {
  carYear: 2024 | 2025 | 2026;  // regulation year
  windSpeed: number;          // km/h (50–350)
  yawAngle: number;           // degrees (-15 to +15)
  attackAngle: number;        // degrees (-5 to +10)
  particleDensity: number;    // 0=low, 1=medium, 2=high
  showStreamlines: boolean;
  showPressureMap: boolean;
  showVortices: boolean;
  showSmoke: boolean;
  drsOpen: boolean;           // DRS flap state
  gridSize: number;           // resolution for CFD grid
  // Car setup parameters
  rideHeight: number;         // mm (30–60) — ground clearance
  frontWingAngle: number;     // degrees (0–15) — front wing attack angle
  rearWingAngle: number;      // degrees (5–35) — rear wing attack angle
  tireWidth: number;          // scale multiplier (0.8–1.2)
}

export interface WindTunnelResult {
  pressureField: Float64Array;  // NxN pressure values
  velocityX: Float64Array;      // NxN velocity x-component
  velocityY: Float64Array;      // NxN velocity y-component
  gridSize: number;
  drag: number;                 // drag force (N)
  lift: number;                 // lift force (N)
  downforce: number;            // downforce (N) — negative lift
  sideForce: number;
  cd: number;                   // drag coefficient
  cl: number;                   // lift coefficient
  maxPressure: number;
  minPressure: number;
  maxVelocity: number;
}

export function defaultWindTunnelConfig(): WindTunnelConfig {
  return {
    carYear: 2025,
    windSpeed: 200,
    yawAngle: 0,
    attackAngle: 0,
    particleDensity: 1,
    showStreamlines: true,
    showPressureMap: true,
    showVortices: true,
    showSmoke: false,
    drsOpen: false,
    gridSize: 200,
    rideHeight: 40,
    frontWingAngle: 8,
    rearWingAngle: 22,
    tireWidth: 1.0,
  };
}

// ─── Worker Messages ──────────────────────────────────────────────────
export type WorkerRequest =
  | { type: 'COMPUTE_FIELD'; config: SimulationConfig }
  | { type: 'INTEGRATE_GEODESICS'; particles: GeodesicParticle[]; fieldData: FieldData; config: SimulationConfig }
  | { type: 'RUN_TESTS' }
  | { type: 'COMPUTE_WIND_TUNNEL'; config: WindTunnelConfig }
  | { type: 'INIT_FLUID_GRID'; width: number; height: number; depth: number; solid: Uint8Array; normals: Float32Array }
  | { type: 'STEP_FLUID'; config: WindTunnelConfig; dt: number };

export type WorkerResponse =
  | { type: 'FIELD_COMPUTED'; data: FieldData }
  | { type: 'GEODESICS_UPDATED'; particles: GeodesicParticle[] }
  | { type: 'TEST_RESULTS'; results: TestResult[] }
  | { type: 'PROGRESS'; iterations: number; residual: number }
  | { type: 'WIND_TUNNEL_COMPUTED'; data: WindTunnelResult }
  | { type: 'FLUID_STEPPED'; velX: Float32Array; velY: Float32Array; velZ: Float32Array; pressure: Float32Array };

export interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

// ─── Default Configuration ────────────────────────────────────────────
export function defaultConfig(): SimulationConfig {
  return {
    mode: SimulationMode.NEWTONIAN,
    gridSize: 256,
    sources: [],
    convergenceTolerance: 1e-6,
    maxIterations: 5000,
    omega: 0,  // 0 = auto-compute optimal
    softeningRadius: 3,
    alcubierreR: 0.15,
    alcubierreSigma: 20,
    alcubierreVs: 0.5,
    casimirPlateGap: 0.05,
    casimirPlateLength: 0.4,
    geodesicDt: 0.002,
    geodesicSteps: 50,
  };
}

export function createSource(overrides: Partial<FieldSource> = {}): FieldSource {
  return {
    id: Math.random().toString(36).slice(2, 9),
    x: 0.5,
    y: 0.5,
    mass: 1.0,
    angularMomentum: 0,
    velocityX: 0,
    velocityY: 0,
    exoticCoupling: 1.0,
    type: 'point',
    ...overrides,
  };
}
