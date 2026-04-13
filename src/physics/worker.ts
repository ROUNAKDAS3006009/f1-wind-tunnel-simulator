/**
 * Physics Web Worker — Background computation thread
 */
import { solvePoissonSOR, applyPPNCorrection, computeMetricCoefficients } from './poisson';
import { computeAlcubierreField, shapeFunction } from './alcubierre';
import { computeFrameDragField } from './framedrag';
import { computeCasimirField } from './casimir';
import { solveWindTunnel } from './windtunnel';
import { initFluidState, solveFluidStep, type FluidState3D } from './fluid_solver';
import { integrateAllGeodesics } from './geodesic';
import { Grid2D } from './grid';
import {
  SimulationMode, type SimulationConfig, type FieldData,
  type WorkerRequest, type WorkerResponse, type TestResult, G_SIM,
} from './types';

let fluidState: FluidState3D | null = null;

function computeField(config: SimulationConfig): FieldData {
  const N = config.gridSize;
  let potential: Grid2D;
  let exoticEnergy = new Grid2D(N);
  let frameDragXGrid = new Grid2D(N);
  let frameDragYGrid = new Grid2D(N);
  let solverIterations = 0;
  let converged = true;

  switch (config.mode) {
    case SimulationMode.NEWTONIAN: {
      const result = solvePoissonSOR(config);
      potential = result.potential; solverIterations = result.iterations; converged = result.converged; break;
    }
    case SimulationMode.PPN: {
      const result = solvePoissonSOR(config);
      potential = applyPPNCorrection(result.potential); solverIterations = result.iterations; converged = result.converged; break;
    }
    case SimulationMode.ALCUBIERRE: {
      const result = computeAlcubierreField(config);
      potential = result.potential; exoticEnergy = result.exoticEnergy; break;
    }
    case SimulationMode.FRAME_DRAG: {
      const result = computeFrameDragField(config);
      potential = result.potential; frameDragXGrid = result.dragX; frameDragYGrid = result.dragY; break;
    }
    case SimulationMode.CASIMIR: {
      const result = computeCasimirField(config);
      potential = result.potential; exoticEnergy = result.exoticEnergy; break;
    }
    default: potential = new Grid2D(N);
  }

  const { gradX, gradY } = potential.computeGradient();
  const { gtt, grr } = computeMetricCoefficients(potential);
  const potRange = potential.getRange();
  const exoticRange = exoticEnergy.getRange();

  return {
    potential: potential.data, exoticEnergy: exoticEnergy.data,
    frameDragX: frameDragXGrid.data, frameDragY: frameDragYGrid.data,
    metricGtt: gtt, metricGrr: grr, gradX, gradY,
    gridSize: N, minPotential: potRange.min, maxPotential: potRange.max,
    minExotic: exoticRange.min, maxExotic: exoticRange.max, solverIterations, converged,
  };
}

function runTests(): TestResult[] {
  const results: TestResult[] = [];
  // Test 1: Point mass
  {
    const config: SimulationConfig = {
      mode: SimulationMode.NEWTONIAN, gridSize: 128,
      sources: [{ id:'t1', x:0.5, y:0.5, mass:1.0, angularMomentum:0, velocityX:0, velocityY:0, exoticCoupling:1, type:'point' }],
      convergenceTolerance: 1e-7, maxIterations: 10000, omega: 0, softeningRadius: 2,
      alcubierreR: 0.15, alcubierreSigma: 20, alcubierreVs: 0.5,
      casimirPlateGap: 0.05, casimirPlateLength: 0.4, geodesicDt: 0.002, geodesicSteps: 50,
    };
    const result = solvePoissonSOR(config);
    const N = config.gridSize;
    const testR = 0.2;
    const testI = Math.round((0.5 + testR) * (N - 1));
    const testJ = Math.round(0.5 * (N - 1));
    const numericalPhi = result.potential.get(testI, testJ);
    const analyticalPhi = -G_SIM * 1.0 / testR;
    const relError = Math.abs((numericalPhi - analyticalPhi) / analyticalPhi);
    results.push({ name: 'Point mass Φ = -GM/r', passed: relError < 0.15,
      expected: `Φ(r=0.2) ≈ ${analyticalPhi.toFixed(4)}`,
      actual: `Φ(r=0.2) = ${numericalPhi.toFixed(4)}, error = ${(relError*100).toFixed(1)}%` });
  }
  // Test 2: Alcubierre shape function
  {
    const fCenter = shapeFunction(0, 0.15, 20);
    const fFar = shapeFunction(1.0, 0.15, 20);
    results.push({ name: 'Alcubierre f(0) ≈ 1, f(∞) ≈ 0',
      passed: Math.abs(fCenter-1.0) < 0.01 && Math.abs(fFar) < 0.01,
      expected: 'f(0) = 1.0, f(far) = 0.0',
      actual: `f(0) = ${fCenter.toFixed(6)}, f(far) = ${fFar.toFixed(6)}` });
  }
  // Test 3: Two-body saddle
  {
    const config: SimulationConfig = {
      mode: SimulationMode.NEWTONIAN, gridSize: 128,
      sources: [
        { id:'t3a', x:0.3, y:0.5, mass:1.0, angularMomentum:0, velocityX:0, velocityY:0, exoticCoupling:1, type:'point' },
        { id:'t3b', x:0.7, y:0.5, mass:1.0, angularMomentum:0, velocityX:0, velocityY:0, exoticCoupling:1, type:'point' },
      ],
      convergenceTolerance: 1e-7, maxIterations: 10000, omega: 0, softeningRadius: 2,
      alcubierreR: 0.15, alcubierreSigma: 20, alcubierreVs: 0.5,
      casimirPlateGap: 0.05, casimirPlateLength: 0.4, geodesicDt: 0.002, geodesicSteps: 50,
    };
    const result = solvePoissonSOR(config);
    const N = config.gridSize;
    const midI = Math.round(0.5*(N-1)), midJ = Math.round(0.5*(N-1));
    const phiMid = result.potential.get(midI, midJ);
    const phiLeft = result.potential.get(midI-5, midJ);
    const phiRight = result.potential.get(midI+5, midJ);
    results.push({ name: 'Two-body saddle point at midpoint',
      passed: phiMid > phiLeft && phiMid > phiRight,
      expected: 'Φ(mid) > Φ(left) and Φ(mid) > Φ(right)',
      actual: `Φ(mid)=${phiMid.toFixed(4)}, Φ(left)=${phiLeft.toFixed(4)}, Φ(right)=${phiRight.toFixed(4)}` });
  }
  return results;
}

self.onmessage = function (e: MessageEvent<WorkerRequest>) {
  const msg = e.data;
  switch (msg.type) {
    case 'COMPUTE_FIELD': {
      const data = computeField(msg.config);
      const response: WorkerResponse = { type: 'FIELD_COMPUTED', data };
      self.postMessage(response);
      break;
    }
    case 'INTEGRATE_GEODESICS': {
      const particles = integrateAllGeodesics(msg.particles, msg.fieldData, msg.config);
      const response: WorkerResponse = { type: 'GEODESICS_UPDATED', particles };
      self.postMessage(response);
      break;
    }
    case 'RUN_TESTS': {
      const results = runTests();
      const response: WorkerResponse = { type: 'TEST_RESULTS', results };
      self.postMessage(response);
      break;
    }
    case 'COMPUTE_WIND_TUNNEL': {
      const data = solveWindTunnel(msg.config);
      const response: WorkerResponse = { type: 'WIND_TUNNEL_COMPUTED', data };
      self.postMessage(response);
      break;
    }
    case 'INIT_FLUID_GRID': {
      fluidState = initFluidState(msg.width, msg.height, msg.depth, msg.solid, msg.normals);
      break;
    }
    case 'STEP_FLUID': {
      if (fluidState) {
        // Convert wind tunnel config to meters per second
        const windSpeedMs = msg.config.windSpeed / 3.6;
        solveFluidStep(fluidState, windSpeedMs, msg.dt, msg.config.yawAngle, msg.config.attackAngle);
        
        // We only send the raw arrays back for rendering, but DON'T transfer ownership 
        // to avoid constant reallocation inside the worker since it's step-by-step.
        // For max performance, we create copies, or slice.
        const response: WorkerResponse = { 
          type: 'FLUID_STEPPED', 
          velX: fluidState.velX.slice(), 
          velY: fluidState.velY.slice(), 
          velZ: fluidState.velZ.slice(), 
          pressure: fluidState.pressure.slice() 
        };
        (self as unknown as Worker).postMessage(response, {
          transfer: [
            response.velX.buffer, 
            response.velY.buffer, 
            response.velZ.buffer, 
            response.pressure.buffer
          ]
        });
      }
      break;
    }
  }
};
