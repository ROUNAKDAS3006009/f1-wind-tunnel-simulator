/**
 * Simulation State Store — Zustand
 */
import { create } from 'zustand';
import {
  SimulationMode, type SimulationConfig, type FieldData, type FieldSource,
  type GeodesicParticle, type WindTunnelConfig, type WindTunnelResult,
  defaultConfig, createSource, defaultWindTunnelConfig,
} from '../physics/types';
import { createParticle } from '../physics/geodesic';
import { PRESETS, applyPreset, type Preset } from '../presets/scenarios';

export interface VisualizationState {
  showCurvature: boolean; showHeatmap: boolean; showFieldLines: boolean;
  showGeodesics: boolean; showExoticEnergy: boolean; showFrameDrag: boolean;
  showMetricOverlay: boolean;
}

export interface CursorReadout {
  x: number; y: number; potential: number; gtt: number; grr: number;
  timeDilation: number; exoticEnergy: number; fieldMagnitude: number;
}

interface SimulationStore {
  // App mode: simulator vs wind tunnel
  appMode: 'simulator' | 'windtunnel';
  setAppMode: (mode: 'simulator' | 'windtunnel') => void;

  config: SimulationConfig;
  setConfig: (config: Partial<SimulationConfig>) => void;
  setMode: (mode: SimulationMode) => void;
  addSource: (source?: Partial<FieldSource>) => void;
  removeSource: (id: string) => void;
  updateSource: (id: string, updates: Partial<FieldSource>) => void;
  fieldData: FieldData | null;
  setFieldData: (data: FieldData) => void;
  isComputing: boolean;
  setIsComputing: (v: boolean) => void;
  particles: GeodesicParticle[];
  addParticle: (x: number, y: number, vx: number, vy: number, isLight?: boolean) => void;
  setParticles: (ps: GeodesicParticle[]) => void;
  clearParticles: () => void;
  visualization: VisualizationState;
  toggleVisualization: (key: keyof VisualizationState) => void;
  setVisualization: (state: Partial<VisualizationState>) => void;
  activePreset: string | null;
  loadPreset: (presetId: string) => void;
  cursorReadout: CursorReadout | null;
  setCursorReadout: (readout: CursorReadout | null) => void;
  analysisMode: boolean;
  setAnalysisMode: (v: boolean) => void;
  resetSimulation: () => void;

  // Wind tunnel state
  windTunnelConfig: WindTunnelConfig;
  setWindTunnelConfig: (updates: Partial<WindTunnelConfig>) => void;
  windTunnelResult: WindTunnelResult | null;
  setWindTunnelResult: (data: WindTunnelResult) => void;

  // Real-time CFD 3D Fluid State
  fluidGridReady: boolean;
  fluidGridParams: { width: number, height: number, depth: number, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number } | null;
  setFluidGridParams: (params: SimulationStore['fluidGridParams']) => void;
  fluidVelX: Float32Array | null;
  fluidVelY: Float32Array | null;
  fluidVelZ: Float32Array | null;
  fluidPressure: Float32Array | null;
  setFluidVelocity: (velX: Float32Array, velY: Float32Array, velZ: Float32Array, pressure: Float32Array) => void;
  setFluidState: (velX: Float32Array, velY: Float32Array, velZ: Float32Array, pressure: Float32Array) => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  appMode: 'simulator',
  setAppMode: (mode) => set({ appMode: mode }),

  config: {
    ...defaultConfig(),
    sources: PRESETS[0].sources,
    mode: PRESETS[0].config.mode ?? SimulationMode.NEWTONIAN,
    ...(PRESETS[0].config),
  },

  setConfig: (updates) => set((s) => ({ config: { ...s.config, ...updates } })),
  setMode: (mode) => set((s) => ({ config: { ...s.config, mode } })),

  addSource: (partial) => set((s) => {
    if (s.config.sources.length >= 8) return s;
    return { config: { ...s.config, sources: [...s.config.sources, createSource(partial)] } };
  }),
  removeSource: (id) => set((s) => ({ config: { ...s.config, sources: s.config.sources.filter((src) => src.id !== id) } })),
  updateSource: (id, updates) => set((s) => ({
    config: { ...s.config, sources: s.config.sources.map((src) => src.id === id ? { ...src, ...updates } : src) },
  })),

  fieldData: null,
  setFieldData: (data) => set({ fieldData: data }),
  isComputing: false,
  setIsComputing: (v) => set({ isComputing: v }),

  particles: [],
  addParticle: (x, y, vx, vy, isLight = false) => set((s) => ({ particles: [...s.particles, createParticle(x, y, vx, vy, isLight)] })),
  setParticles: (ps) => set({ particles: ps }),
  clearParticles: () => set({ particles: [] }),

  visualization: {
    showCurvature: true, showHeatmap: true, showFieldLines: true,
    showGeodesics: false, showExoticEnergy: false, showFrameDrag: false, showMetricOverlay: false,
  },
  toggleVisualization: (key) => set((s) => ({ visualization: { ...s.visualization, [key]: !s.visualization[key] } })),
  setVisualization: (state) => set((s) => ({ visualization: { ...s.visualization, ...state } })),

  activePreset: PRESETS[0].id,
  loadPreset: (presetId) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    set({ activePreset: presetId, config: applyPreset(preset), visualization: { ...preset.visualizationDefaults }, particles: [], fieldData: null });
  },

  cursorReadout: null,
  setCursorReadout: (readout) => set({ cursorReadout: readout }),

  analysisMode: false,
  setAnalysisMode: (v) => set((s) => ({
    analysisMode: v,
    config: { ...s.config, gridSize: v ? 512 : 256, maxIterations: v ? 10000 : 3000, convergenceTolerance: v ? 1e-7 : 1e-5 },
  })),

  resetSimulation: () => set({ config: defaultConfig(), fieldData: null, particles: [], cursorReadout: null, activePreset: null }),

  // Wind tunnel
  windTunnelConfig: defaultWindTunnelConfig(),
  setWindTunnelConfig: (updates) => set((s) => ({
    windTunnelConfig: { ...s.windTunnelConfig, ...updates },
  })),
  windTunnelResult: null,
  setWindTunnelResult: (data) => set({ windTunnelResult: data, isComputing: false }),

  // Real-time CFD
  fluidGridReady: false,
  fluidGridParams: null,
  setFluidGridParams: (params) => set({ fluidGridParams: params, fluidGridReady: true }),
  fluidVelX: null,
  fluidVelY: null,
  fluidVelZ: null,
  fluidPressure: null,
  setFluidVelocity: (velX, velY, velZ, pressure) => set({ fluidVelX: velX, fluidVelY: velY, fluidVelZ: velZ, fluidPressure: pressure }),
  setFluidState: (velX, velY, velZ, pressure) => set({ fluidVelX: velX, fluidVelY: velY, fluidVelZ: velZ, fluidPressure: pressure }),
}));
