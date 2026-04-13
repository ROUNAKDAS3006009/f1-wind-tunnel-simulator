/**
 * Geodesic Integrator — RK4 path tracing through curved space
 */
import type { GeodesicParticle, FieldData, SimulationConfig } from './types';

function interpolateField(field: Float64Array, N: number, x: number, y: number): number {
  const fx = x * (N - 1), fy = y * (N - 1);
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  const i1 = Math.min(i0 + 1, N - 1), j1 = Math.min(j0 + 1, N - 1);
  const tx = fx - i0, ty = fy - j0;
  return (1-tx)*(1-ty)*field[i0*N+j0] + tx*(1-ty)*field[i1*N+j0] + (1-tx)*ty*field[i0*N+j1] + tx*ty*field[i1*N+j1];
}

function getAcceleration(fieldData: FieldData, x: number, y: number): { ax: number; ay: number } {
  const N = fieldData.gridSize;
  const cx = Math.max(0.001, Math.min(0.999, x)), cy = Math.max(0.001, Math.min(0.999, y));
  return { ax: -interpolateField(fieldData.gradX, N, cx, cy), ay: -interpolateField(fieldData.gradY, N, cx, cy) };
}

function inBounds(x: number, y: number): boolean {
  return x > 0.005 && x < 0.995 && y > 0.005 && y < 0.995;
}

export function integrateGeodesic(particle: GeodesicParticle, fieldData: FieldData, config: SimulationConfig): GeodesicParticle {
  if (!particle.active) return particle;
  const dt = config.geodesicDt, steps = config.geodesicSteps;
  let { x, y, vx, vy } = particle;
  const newPath = [...particle.path];

  for (let step = 0; step < steps; step++) {
    if (!inBounds(x, y)) return { ...particle, x, y, vx, vy, path: newPath, active: false };
    if (particle.isLight) {
      const speed = Math.sqrt(vx*vx+vy*vy);
      if (speed > 1e-10) { const ls = 0.5; vx = (vx/speed)*ls; vy = (vy/speed)*ls; }
    }
    const k1 = getAcceleration(fieldData, x, y);
    const x2 = x+0.5*dt*vx, y2 = y+0.5*dt*vy, vx2 = vx+0.5*dt*k1.ax, vy2 = vy+0.5*dt*k1.ay;
    const k2 = getAcceleration(fieldData, x2, y2);
    const x3 = x+0.5*dt*vx2, y3 = y+0.5*dt*vy2, vx3 = vx+0.5*dt*k2.ax, vy3 = vy+0.5*dt*k2.ay;
    const k3 = getAcceleration(fieldData, x3, y3);
    const vx4 = vx+dt*k3.ax, vy4 = vy+dt*k3.ay;
    const k4 = getAcceleration(fieldData, x+dt*vx3, y+dt*vy3);
    x += (dt/6.0)*(vx+2*vx2+2*vx3+vx4);
    y += (dt/6.0)*(vy+2*vy2+2*vy3+vy4);
    vx += (dt/6.0)*(k1.ax+2*k2.ax+2*k3.ax+k4.ax);
    vy += (dt/6.0)*(k1.ay+2*k2.ay+2*k3.ay+k4.ay);
    newPath.push({ x, y });
    if (newPath.length > 2000) newPath.splice(0, newPath.length - 2000);
  }
  const phi = interpolateField(fieldData.potential, fieldData.gridSize, Math.max(0.001,Math.min(0.999,x)), Math.max(0.001,Math.min(0.999,y)));
  return { ...particle, x, y, vx, vy, path: newPath, energy: 0.5*(vx*vx+vy*vy)+phi, active: inBounds(x,y) };
}

export function integrateAllGeodesics(particles: GeodesicParticle[], fieldData: FieldData, config: SimulationConfig): GeodesicParticle[] {
  return particles.map(p => integrateGeodesic(p, fieldData, config));
}

export function createParticle(x: number, y: number, vx: number, vy: number, isLight = false): GeodesicParticle {
  return { id: Math.random().toString(36).slice(2,9), x, y, vx, vy, path: [{x,y}], isLight, energy: 0, active: true };
}
