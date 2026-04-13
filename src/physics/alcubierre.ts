/**
 * Alcubierre Warp Metric — Shape Function and Energy Density
 * Reference: Alcubierre, M., Class. Quantum Grav. 11, L73–L77 (1994)
 */
import { Grid2D } from './grid';
import { type SimulationConfig, C_SIM } from './types';

export function shapeFunction(rs: number, R: number, sigma: number): number {
  const tanhSigmaR = Math.tanh(sigma * R);
  if (Math.abs(tanhSigmaR) < 1e-15) return 0;
  return (Math.tanh(sigma * (rs + R)) - Math.tanh(sigma * (rs - R))) / (2.0 * tanhSigmaR);
}

export function shapeFunctionDerivative(rs: number, R: number, sigma: number): number {
  const tanhSigmaR = Math.tanh(sigma * R);
  if (Math.abs(tanhSigmaR) < 1e-15) return 0;
  const sechPlus = 1.0 / Math.cosh(sigma * (rs + R));
  const sechMinus = 1.0 / Math.cosh(sigma * (rs - R));
  return sigma * (sechPlus * sechPlus - sechMinus * sechMinus) / (2.0 * tanhSigmaR);
}

export function computeAlcubierreField(config: SimulationConfig): {
  potential: Grid2D; exoticEnergy: Grid2D; expansion: Grid2D;
} {
  const N = config.gridSize;
  const R = config.alcubierreR;
  const sigma = config.alcubierreSigma;
  const vs = config.alcubierreVs;
  const potential = new Grid2D(N);
  const exoticEnergy = new Grid2D(N);
  const expansion = new Grid2D(N);
  let cx = 0.5, cy = 0.5;
  if (config.sources.length > 0) { cx = config.sources[0].x; cy = config.sources[0].y; }
  const dx = 1.0 / (N - 1);

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i * dx, y = j * dx;
      const xs = x - cx, ys = y - cy;
      const rs = Math.sqrt(xs * xs + ys * ys);
      if (rs < 1e-10) {
        potential.set(i, j, -vs * vs * 0.5);
        continue;
      }
      const f = shapeFunction(rs, R, sigma);
      const dfdr = shapeFunctionDerivative(rs, R, sigma);
      const theta = vs * dfdr * (xs / rs);
      const phiEff = -vs * vs * f * f * 0.5;
      const yOverR = ys / rs;
      const exoticE = -(vs * vs) / (32.0 * Math.PI) * (dfdr * dfdr) * (yOverR * yOverR) * (C_SIM * C_SIM * C_SIM * C_SIM);
      potential.set(i, j, phiEff);
      expansion.set(i, j, theta);
      exoticEnergy.set(i, j, exoticE);
    }
  }
  return { potential, exoticEnergy, expansion };
}

export function computeTotalExoticEnergy(exoticEnergy: Grid2D): number {
  const dx = exoticEnergy.dx;
  let total = 0;
  for (let i = 0; i < exoticEnergy.N; i++)
    for (let j = 0; j < exoticEnergy.N; j++) {
      const e = exoticEnergy.get(i, j);
      if (e < 0) total += Math.abs(e) * dx * dx;
    }
  return total;
}
