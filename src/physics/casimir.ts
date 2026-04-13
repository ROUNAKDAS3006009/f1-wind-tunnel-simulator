/**
 * Casimir Effect — Quantum Vacuum Energy Proxy
 * Reference: Casimir, H.B.G., Proc. Kon. Ned. Akad. Wetensch. 51, 793 (1948)
 */
import { Grid2D } from './grid';
import { type SimulationConfig } from './types';

export function casimirEnergyDensity(separation: number): number {
  if (separation <= 0) return 0;
  const pi2 = Math.PI * Math.PI;
  const d4 = separation * separation * separation * separation;
  return -pi2 / (720.0 * d4);
}

export function computeCasimirField(config: SimulationConfig): {
  potential: Grid2D; exoticEnergy: Grid2D;
} {
  const N = config.gridSize, dx = 1.0 / (N - 1);
  const gap = config.casimirPlateGap, plateLength = config.casimirPlateLength;
  const potential = new Grid2D(N), exoticEnergy = new Grid2D(N);
  let cx = 0.5, cy = 0.5;
  if (config.sources.length > 0) { cx = config.sources[0].x; cy = config.sources[0].y; }
  const plate1X = cx - gap / 2, plate2X = cx + gap / 2;
  const plateTop = cy - plateLength / 2, plateBottom = cy + plateLength / 2;

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i * dx, y = j * dx;
      const betweenPlates = x > plate1X && x < plate2X && y > plateTop && y < plateBottom;
      if (betweenPlates) {
        const d1 = x - plate1X;
        const energy = casimirEnergyDensity(gap) * (config.sources[0]?.exoticCoupling || 1.0);
        const positionFactor = Math.sin(Math.PI * d1 / gap);
        exoticEnergy.set(i, j, energy * positionFactor);
        potential.set(i, j, energy * positionFactor * 0.01);
      }
      const onPlate1 = Math.abs(x - plate1X) < dx && y > plateTop && y < plateBottom;
      const onPlate2 = Math.abs(x - plate2X) < dx && y > plateTop && y < plateBottom;
      if (onPlate1 || onPlate2) potential.set(i, j, 0.5);
    }
  }
  return { potential, exoticEnergy };
}
