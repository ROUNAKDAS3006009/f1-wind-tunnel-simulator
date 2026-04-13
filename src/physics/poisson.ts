/**
 * Poisson Equation Solver — Successive Over-Relaxation (SOR)
 * Solves: ∇²Φ = 4πGρ  (Newtonian gravitational potential)
 * Reference: Will, C.M., "Theory and Experiment in Gravitational Physics" (2018)
 */

import { Grid2D, buildSourceDensity } from './grid';
import { type SimulationConfig, G_SIM, C_SIM } from './types';

export interface SolverResult {
  potential: Grid2D;
  iterations: number;
  converged: boolean;
  finalResidual: number;
}

function optimalOmega(N: number): number {
  return 2.0 / (1.0 + Math.sin(Math.PI / N));
}

export function solvePoissonSOR(config: SimulationConfig): SolverResult {
  const N = config.gridSize;
  const omega = config.omega > 0 ? config.omega : optimalOmega(N);
  const dx = 1.0 / (N - 1);
  const dx2 = dx * dx;
  const fourPiG = 4.0 * Math.PI * G_SIM;
  const rho = buildSourceDensity(N, config.sources, config.softeningRadius);
  const phi = new Grid2D(N);
  let converged = false;
  let iterations = 0;
  let residual = 0;

  for (let iter = 0; iter < config.maxIterations; iter++) {
    residual = 0;
    for (let color = 0; color < 2; color++) {
      for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
          if ((i + j) % 2 !== color) continue;
          const neighbors = phi.get(i + 1, j) + phi.get(i - 1, j) + phi.get(i, j + 1) + phi.get(i, j - 1);
          const rhs = fourPiG * rho.get(i, j);
          const phiNew = (neighbors - dx2 * rhs) / 4.0;
          const phiOld = phi.get(i, j);
          const updated = phiOld + omega * (phiNew - phiOld);
          phi.set(i, j, updated);
          const diff = Math.abs(updated - phiOld);
          if (diff > residual) residual = diff;
        }
      }
    }
    iterations = iter + 1;
    if (residual < config.convergenceTolerance) { converged = true; break; }
  }

  phi.applyBoundaryConditions();
  return { potential: phi, iterations, converged, finalResidual: residual };
}

export function applyPPNCorrection(phi: Grid2D): Grid2D {
  const result = phi.clone();
  const c2 = C_SIM * C_SIM;
  for (let k = 0; k < result.data.length; k++) {
    const phiN = result.data[k];
    result.data[k] = phiN + (phiN * phiN) / c2;
  }
  return result;
}

export function computeMetricCoefficients(phi: Grid2D): { gtt: Float64Array; grr: Float64Array } {
  const c2 = C_SIM * C_SIM;
  const N = phi.N;
  const gtt = new Float64Array(N * N);
  const grr = new Float64Array(N * N);
  for (let k = 0; k < phi.data.length; k++) {
    const twoPhi_c2 = 2.0 * phi.data[k] / c2;
    gtt[k] = -(1.0 + twoPhi_c2);
    grr[k] = 1.0 - twoPhi_c2;
  }
  return { gtt, grr };
}
