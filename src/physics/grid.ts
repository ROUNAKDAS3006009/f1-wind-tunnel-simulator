/**
 * Grid Management — 2D computational grid with boundary conditions
 * 
 * Implements a square NxN grid with Dirichlet boundary conditions
 * (asymptotic falloff approximation: Φ → 0 at boundaries).
 * Coordinate mapping between grid indices and physical space [0, 1].
 */

export class Grid2D {
  readonly N: number;
  readonly dx: number;
  data: Float64Array;

  constructor(N: number, initialValue = 0) {
    this.N = N;
    this.dx = 1.0 / (N - 1);
    this.data = new Float64Array(N * N);
    if (initialValue !== 0) {
      this.data.fill(initialValue);
    }
  }

  get(i: number, j: number): number {
    return this.data[i * this.N + j];
  }

  set(i: number, j: number, value: number): void {
    this.data[i * this.N + j] = value;
  }

  add(i: number, j: number, value: number): void {
    this.data[i * this.N + j] += value;
  }

  toPhysical(idx: number): number {
    return idx * this.dx;
  }

  toIndex(coord: number): number {
    return Math.round(coord / this.dx);
  }

  distance(i1: number, j1: number, i2: number, j2: number): number {
    const dx = (i1 - i2) * this.dx;
    const dy = (j1 - j2) * this.dx;
    return Math.sqrt(dx * dx + dy * dy);
  }

  clear(): void {
    this.data.fill(0);
  }

  clone(): Grid2D {
    const g = new Grid2D(this.N);
    g.data.set(this.data);
    return g;
  }

  getRange(): { min: number; max: number } {
    let min = Infinity, max = -Infinity;
    for (let k = 0; k < this.data.length; k++) {
      if (this.data[k] < min) min = this.data[k];
      if (this.data[k] > max) max = this.data[k];
    }
    return { min, max };
  }

  applyBoundaryConditions(): void {
    const N = this.N;
    for (let i = 0; i < N; i++) {
      this.set(0, i, 0);
      this.set(N - 1, i, 0);
      this.set(i, 0, 0);
      this.set(i, N - 1, 0);
    }
  }

  computeGradient(): { gradX: Float64Array; gradY: Float64Array } {
    const N = this.N;
    const gradX = new Float64Array(N * N);
    const gradY = new Float64Array(N * N);
    const inv2dx = 1.0 / (2.0 * this.dx);

    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        gradX[i * N + j] = (this.get(i + 1, j) - this.get(i - 1, j)) * inv2dx;
        gradY[i * N + j] = (this.get(i, j + 1) - this.get(i, j - 1)) * inv2dx;
      }
    }
    return { gradX, gradY };
  }

  laplacian(i: number, j: number): number {
    if (i <= 0 || i >= this.N - 1 || j <= 0 || j >= this.N - 1) return 0;
    const invDx2 = 1.0 / (this.dx * this.dx);
    return (
      this.get(i + 1, j) + this.get(i - 1, j) +
      this.get(i, j + 1) + this.get(i, j - 1) -
      4 * this.get(i, j)
    ) * invDx2;
  }
}

export function buildSourceDensity(
  N: number,
  sources: Array<{ x: number; y: number; mass: number; type: string }>,
  softeningRadius: number
): Grid2D {
  const rho = new Grid2D(N);
  const dx = 1.0 / (N - 1);
  const sigma = softeningRadius * dx;
  const sigma2 = sigma * sigma;
  const norm = 1.0 / (2.0 * Math.PI * sigma2);

  for (const src of sources) {
    const ci = Math.round(src.x * (N - 1));
    const cj = Math.round(src.y * (N - 1));
    const range = Math.ceil(4 * softeningRadius);
    
    for (let di = -range; di <= range; di++) {
      for (let dj = -range; dj <= range; dj++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || i >= N || j < 0 || j >= N) continue;
        const r2 = (di * dx) * (di * dx) + (dj * dx) * (dj * dx);
        const density = src.mass * norm * Math.exp(-r2 / (2 * sigma2));
        rho.add(i, j, density);
      }
    }
  }

  return rho;
}
