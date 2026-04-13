/**
 * Gravitomagnetic Frame Dragging — GEM Formalism
 * Reference: Mashhoon, B., gr-qc/0311030 (2003)
 */
import { Grid2D } from './grid';
import { type SimulationConfig, G_SIM, C_SIM } from './types';

export function computeFrameDragField(config: SimulationConfig): {
  dragX: Grid2D; dragY: Grid2D; potential: Grid2D;
} {
  const N = config.gridSize;
  const dx = 1.0 / (N - 1);
  const c2 = C_SIM * C_SIM;
  const dragX = new Grid2D(N), dragY = new Grid2D(N), potential = new Grid2D(N);
  const eps = config.softeningRadius * dx, eps2 = eps * eps;

  for (const src of config.sources) {
    if (Math.abs(src.angularMomentum) < 1e-15) continue;
    const J = src.angularMomentum, M = src.mass, cx = src.x, cy = src.y;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = i * dx - cx, y = j * dx - cy;
        const r2 = x * x + y * y + eps2, r = Math.sqrt(r2), r3 = r2 * r;
        potential.add(i, j, -G_SIM * M / r);
        const omegaFD = (2.0 * G_SIM * J) / (c2 * r3);
        dragX.add(i, j, -omegaFD * y);
        dragY.add(i, j, omegaFD * x);
      }
    }
  }
  return { dragX, dragY, potential };
}

export function solveGravitomagnetic(config: SimulationConfig): Grid2D {
  const N = config.gridSize, dx = 1.0 / (N - 1), dx2 = dx * dx;
  const c2 = C_SIM * C_SIM, coeff = 16.0 * Math.PI * G_SIM / c2;
  const sigma = config.softeningRadius * dx, sigma2 = sigma * sigma;
  const norm = 1.0 / (2.0 * Math.PI * sigma2);
  const sourceGrid = new Grid2D(N);

  for (const src of config.sources) {
    if (Math.abs(src.angularMomentum) < 1e-15) continue;
    const ci = Math.round(src.x * (N - 1)), cj = Math.round(src.y * (N - 1));
    const range = Math.ceil(4 * config.softeningRadius);
    for (let di = -range; di <= range; di++)
      for (let dj = -range; dj <= range; dj++) {
        const ii = ci + di, jj = cj + dj;
        if (ii < 0 || ii >= N || jj < 0 || jj >= N) continue;
        const r2 = (di * dx) * (di * dx) + (dj * dx) * (dj * dx);
        sourceGrid.add(ii, jj, src.angularMomentum * norm * Math.exp(-r2 / (2 * sigma2)));
      }
  }

  const Ag = new Grid2D(N);
  const omega = 2.0 / (1.0 + Math.sin(Math.PI / N));
  for (let iter = 0; iter < config.maxIterations; iter++) {
    let maxRes = 0;
    for (let i = 1; i < N - 1; i++)
      for (let j = 1; j < N - 1; j++) {
        const nb = Ag.get(i+1,j)+Ag.get(i-1,j)+Ag.get(i,j+1)+Ag.get(i,j-1);
        const nv = (nb + dx2 * coeff * sourceGrid.get(i,j)) / 4.0;
        const ov = Ag.get(i,j), up = ov + omega * (nv - ov);
        Ag.set(i,j,up);
        maxRes = Math.max(maxRes, Math.abs(up-ov));
      }
    if (maxRes < config.convergenceTolerance) break;
  }
  return Ag;
}
