/**
 * Data Export Utilities — CSV, JSON, and PNG export
 */
import type { FieldData, SimulationConfig, GeodesicParticle } from '../physics/types';

export function exportFieldCSV(fieldData: FieldData): string {
  const N = fieldData.gridSize, dx = 1.0 / (N - 1);
  const lines = ['x,y,potential,exotic_energy,g_tt,g_rr'];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const idx = i * N + j;
      lines.push([(i*dx).toFixed(6),(j*dx).toFixed(6),fieldData.potential[idx].toFixed(8),
        fieldData.exoticEnergy[idx].toFixed(8),fieldData.metricGtt[idx].toFixed(8),fieldData.metricGrr[idx].toFixed(8)].join(','));
    }
  return lines.join('\n');
}

export function exportGeodesicsCSV(particles: GeodesicParticle[]): string {
  const lines = ['particle_id,is_light,step,x,y'];
  for (const p of particles)
    for (let i = 0; i < p.path.length; i++)
      lines.push([p.id, p.isLight ? 1 : 0, i, p.path[i].x.toFixed(6), p.path[i].y.toFixed(6)].join(','));
  return lines.join('\n');
}

export function exportSimulationJSON(config: SimulationConfig, fieldData: FieldData, particles: GeodesicParticle[]): string {
  return JSON.stringify({
    meta: { application: 'Antigravity Field Simulation Platform', version: '1.0.0', timestamp: new Date().toISOString(),
      gridSize: fieldData.gridSize, solverIterations: fieldData.solverIterations, converged: fieldData.converged },
    config,
    fieldRange: { potential: { min: fieldData.minPotential, max: fieldData.maxPotential }, exotic: { min: fieldData.minExotic, max: fieldData.maxExotic } },
    particles: particles.map(p => ({ id: p.id, isLight: p.isLight, position: { x: p.x, y: p.y }, velocity: { vx: p.vx, vy: p.vy },
      energy: p.energy, pathLength: p.path.length, active: p.active })),
  }, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function exportCanvasPNG(canvas: HTMLCanvasElement, filename = 'simulation.png') {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
