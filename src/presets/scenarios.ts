/**
 * Preset Scenarios — Pre-configured simulation setups
 */
import { SimulationMode, type SimulationConfig, type FieldSource, createSource, defaultConfig } from '../physics/types';

export interface Preset {
  id: string; name: string; description: string; theoreticalBasis: string;
  config: Partial<SimulationConfig>; sources: FieldSource[];
  visualizationDefaults: {
    showCurvature: boolean; showHeatmap: boolean; showFieldLines: boolean; showGeodesics: boolean;
    showExoticEnergy: boolean; showFrameDrag: boolean; showMetricOverlay: boolean;
  };
}

export const PRESETS: Preset[] = [
  {
    id: 'hovering-platform', name: 'Hovering Platform',
    description: 'A negative mass source hovering above a positive mass, demonstrating gravitational field cancellation and levitation zone.',
    theoreticalBasis: 'Bondi (1957) — Negative mass in GR produces repulsive gravity. The saddle point between positive and negative masses creates a stable equilibrium.',
    config: { mode: SimulationMode.NEWTONIAN, gridSize: 256, softeningRadius: 4, maxIterations: 3000, convergenceTolerance: 1e-5 },
    sources: [
      createSource({ id: 'ground-mass', x: 0.5, y: 0.7, mass: 3.0, type: 'point' }),
      createSource({ id: 'hover-mass', x: 0.5, y: 0.35, mass: -1.5, type: 'point' }),
    ],
    visualizationDefaults: { showCurvature: true, showHeatmap: true, showFieldLines: true, showGeodesics: false, showExoticEnergy: false, showFrameDrag: false, showMetricOverlay: false },
  },
  {
    id: 'warp-bubble', name: 'Alcubierre Warp Bubble',
    description: 'A spacetime warp bubble that contracts space ahead and expands it behind, with exotic energy shell visualization.',
    theoreticalBasis: 'Alcubierre (1994) — Warp drive metric: ds² = -(1-v²f²)dt² + 2vf·dx·dt + dx² + dy². Requires negative energy density (exotic matter) to sustain the geometry.',
    config: { mode: SimulationMode.ALCUBIERRE, gridSize: 256, alcubierreR: 0.12, alcubierreSigma: 25, alcubierreVs: 0.6 },
    sources: [createSource({ id: 'bubble-center', x: 0.5, y: 0.5, mass: 0, type: 'point' })],
    visualizationDefaults: { showCurvature: true, showHeatmap: true, showFieldLines: false, showGeodesics: false, showExoticEnergy: true, showFrameDrag: false, showMetricOverlay: true },
  },
  {
    id: 'rotating-mass', name: 'Rotating Black Hole Analog',
    description: 'A massive spinning source demonstrating frame dragging — spacetime itself is twisted by the rotation.',
    theoreticalBasis: 'Kerr metric (1963) / Lense-Thirring effect (1918): A rotating mass drags inertial frames. Gravitomagnetic field Ω ≈ 2GJ/(c²r³).',
    config: { mode: SimulationMode.FRAME_DRAG, gridSize: 256, softeningRadius: 5 },
    sources: [createSource({ id: 'spinning-mass', x: 0.5, y: 0.5, mass: 5.0, angularMomentum: 8.0, type: 'point' })],
    visualizationDefaults: { showCurvature: true, showHeatmap: true, showFieldLines: false, showGeodesics: false, showExoticEnergy: false, showFrameDrag: true, showMetricOverlay: false },
  },
  {
    id: 'casimir-cavity', name: 'Casimir Cavity',
    description: 'Quantum vacuum energy between parallel conducting plates — one of the few known sources of negative energy density in physics.',
    theoreticalBasis: 'Casimir (1948): Vacuum fluctuations between conducting plates produce a negative energy density u = -π²ℏc/(720d⁴), creating an attractive force.',
    config: { mode: SimulationMode.CASIMIR, gridSize: 256, casimirPlateGap: 0.08, casimirPlateLength: 0.5 },
    sources: [createSource({ id: 'cavity-center', x: 0.5, y: 0.5, mass: 1.0, exoticCoupling: 2.0, type: 'plate' })],
    visualizationDefaults: { showCurvature: false, showHeatmap: true, showFieldLines: false, showGeodesics: false, showExoticEnergy: true, showFrameDrag: false, showMetricOverlay: false },
  },
  {
    id: 'gravitational-lens', name: 'Gravitational Lens',
    description: 'A massive object bending light paths — demonstrating gravitational lensing with geodesic ray tracing.',
    theoreticalBasis: 'Einstein (1915): Light follows null geodesics in curved spacetime. Deflection angle α ≈ 4GM/(c²b). First confirmed by Eddington in 1919.',
    config: { mode: SimulationMode.PPN, gridSize: 256, softeningRadius: 3, maxIterations: 3000, convergenceTolerance: 1e-5 },
    sources: [createSource({ id: 'lens-mass', x: 0.5, y: 0.5, mass: 5.0, type: 'point' })],
    visualizationDefaults: { showCurvature: true, showHeatmap: true, showFieldLines: false, showGeodesics: true, showExoticEnergy: false, showFrameDrag: false, showMetricOverlay: true },
  },
  {
    id: 'multi-body', name: 'Multi-Body Field',
    description: 'Multiple gravitational sources with complex field superposition — saddle points, tidal regions, and field interference.',
    theoreticalBasis: 'Superposition principle in linearized gravity: total potential is the sum of individual source potentials.',
    config: { mode: SimulationMode.PPN, gridSize: 256, softeningRadius: 3, maxIterations: 3000, convergenceTolerance: 1e-5 },
    sources: [
      createSource({ id: 'body-1', x: 0.3, y: 0.3, mass: 3.0, type: 'point' }),
      createSource({ id: 'body-2', x: 0.7, y: 0.3, mass: 2.0, type: 'point' }),
      createSource({ id: 'body-3', x: 0.5, y: 0.7, mass: 4.0, type: 'point' }),
      createSource({ id: 'body-4', x: 0.35, y: 0.55, mass: -1.0, type: 'point' }),
    ],
    visualizationDefaults: { showCurvature: true, showHeatmap: true, showFieldLines: true, showGeodesics: false, showExoticEnergy: false, showFrameDrag: false, showMetricOverlay: false },
  },
];

export function getPresetById(id: string): Preset | undefined { return PRESETS.find(p => p.id === id); }

export function applyPreset(preset: Preset): SimulationConfig {
  return { ...defaultConfig(), ...preset.config, sources: preset.sources };
}
