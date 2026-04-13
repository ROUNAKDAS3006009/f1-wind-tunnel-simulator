/**
 * Wind Tunnel CFD-lite Solver
 * 
 * Simplified 2D potential-flow solver with a Joukowski-like approach.
 * Models airflow around a 2D F1 car cross-section silhouette.
 * Computes pressure via Bernoulli's principle and integrates forces.
 * 
 * NOT a full Navier-Stokes solver — this is a visualization-grade
 * approximation designed for real-time interactivity.
 */

import type { WindTunnelConfig, WindTunnelResult } from './types';

// Air properties at sea level
const RHO = 1.225;           // air density kg/m³
const CAR_LENGTH = 5.7;      // 2025 F1 car length (m)
const CAR_WIDTH = 2.0;       // 2025 F1 car width (m)
const FRONTAL_AREA = 1.5;    // approximate frontal area (m²)
const PLANFORM_AREA = 5.0;   // top-down projected area (m²)

/**
 * Generate a 2D occupancy mask for an F1 car silhouette (side view).
 * The car is placed in the center-left of the domain.
 */
function generateCarMask(N: number): Uint8Array {
  const mask = new Uint8Array(N * N);

  // Car bounding box in normalized coords (0..1)
  const carLeft = 0.2;
  const carRight = 0.65;
  const carBottom = 0.44;
  const carTop = 0.56;

  // Sub-shapes of the car silhouette
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i / (N - 1); // streamwise
      const y = j / (N - 1); // vertical

      let isCar = false;

      // Main body (monocoque + engine cover)
      if (x >= carLeft + 0.05 && x <= carRight - 0.05 && y >= carBottom && y <= carTop) {
        isCar = true;
      }

      // Nose cone (tapers from front)
      if (x >= carLeft && x < carLeft + 0.05) {
        const t = (x - carLeft) / 0.05;
        const halfH = (carTop - carBottom) * 0.5 * t * 0.6;
        const cy = (carBottom + carTop) / 2;
        if (y >= cy - halfH && y <= cy + halfH) isCar = true;
      }

      // Front wing (low, wide)
      if (x >= carLeft - 0.02 && x <= carLeft + 0.04 && y >= carBottom - 0.02 && y <= carBottom + 0.01) {
        isCar = true;
      }

      // Rear wing (high, narrow)
      if (x >= carRight - 0.04 && x <= carRight && y >= carTop + 0.01 && y <= carTop + 0.04) {
        isCar = true;
      }

      // Floor / diffuser
      if (x >= carLeft + 0.1 && x <= carRight - 0.02 && y >= carBottom - 0.015 && y <= carBottom) {
        isCar = true;
      }

      // Rear diffuser ramp
      if (x >= carRight - 0.08 && x <= carRight - 0.02) {
        const t = (x - (carRight - 0.08)) / 0.06;
        const rampY = carBottom - 0.015 + t * 0.02;
        if (y >= carBottom - 0.015 && y <= rampY) isCar = true;
      }

      // Wheels (two circles on the side)
      const wheelRadius = 0.025;
      // Front wheel
      const fwx = carLeft + 0.08, fwy = carBottom - 0.005;
      if ((x - fwx) ** 2 + (y - fwy) ** 2 < wheelRadius ** 2) isCar = true;
      // Rear wheel
      const rwx = carRight - 0.08, rwy = carBottom - 0.005;
      if ((x - rwx) ** 2 + (y - rwy) ** 2 < wheelRadius ** 2) isCar = true;

      if (isCar) {
        mask[i * N + j] = 1;
      }
    }
  }
  return mask;
}

/**
 * Solve potential flow around the car using iterative relaxation.
 * Uses stream function approach with obstacle boundary conditions.
 */
export function solveWindTunnel(config: WindTunnelConfig): WindTunnelResult {
  const N = config.gridSize;
  const speedMs = config.windSpeed / 3.6; // convert km/h to m/s
  const yawRad = (config.yawAngle * Math.PI) / 180;
  const attackRad = (config.attackAngle * Math.PI) / 180;

  // Freestream velocity components (2D: streamwise & vertical)
  const U_inf = speedMs * Math.cos(yawRad) * Math.cos(attackRad);
  const V_inf = speedMs * Math.sin(attackRad);

  // Generate car obstacle
  const carMask = generateCarMask(N);

  // Initialize stream function ψ — freestream: ψ = U∞·y - V∞·x
  const psi = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i / (N - 1);
      const y = j / (N - 1);
      psi[i * N + j] = U_inf * y - V_inf * x;
    }
  }

  // Set car interior to constant ψ (no-penetration BC)
  const carPsiValue = U_inf * 0.5; // centerline
  for (let idx = 0; idx < N * N; idx++) {
    if (carMask[idx]) psi[idx] = carPsiValue;
  }

  // SOR relaxation for Laplace equation ∇²ψ = 0 outside car
  const omega = 1.6;
  const maxIter = 300;
  for (let iter = 0; iter < maxIter; iter++) {
    let maxResidual = 0;
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        if (carMask[i * N + j]) continue; // skip car interior
        const idx = i * N + j;
        const newVal = 0.25 * (psi[(i + 1) * N + j] + psi[(i - 1) * N + j] + psi[i * N + (j + 1)] + psi[i * N + (j - 1)]);
        const residual = Math.abs(newVal - psi[idx]);
        if (residual > maxResidual) maxResidual = residual;
        psi[idx] = psi[idx] + omega * (newVal - psi[idx]);
      }
    }

    // Reapply car BC each iteration
    for (let idx = 0; idx < N * N; idx++) {
      if (carMask[idx]) psi[idx] = carPsiValue;
    }

    // Reapply boundary conditions (freestream at domain edges)
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      psi[i * N + 0] = U_inf * 0 - V_inf * x;
      psi[i * N + (N - 1)] = U_inf * 1 - V_inf * x;
    }
    for (let j = 0; j < N; j++) {
      const y = j / (N - 1);
      psi[0 * N + j] = U_inf * y - V_inf * 0;
      psi[(N - 1) * N + j] = U_inf * y - V_inf * 1;
    }

    if (maxResidual < 1e-4) break;
  }

  // Compute velocity from stream function: u = ∂ψ/∂y, v = -∂ψ/∂x
  const velX = new Float64Array(N * N);
  const velY = new Float64Array(N * N);
  for (let i = 1; i < N - 1; i++) {
    for (let j = 1; j < N - 1; j++) {
      if (carMask[i * N + j]) continue;
      const idx = i * N + j;
      velX[idx] = (psi[i * N + (j + 1)] - psi[i * N + (j - 1)]) * 0.5 * (N - 1);
      velY[idx] = -(psi[(i + 1) * N + j] - psi[(i - 1) * N + j]) * 0.5 * (N - 1);
    }
  }

  // Compute pressure via Bernoulli: P = P_inf + 0.5*ρ*(U²_inf - u² - v²)
  const V2_inf = U_inf * U_inf + V_inf * V_inf;
  const pressure = new Float64Array(N * N);
  let minP = Infinity, maxP = -Infinity;
  let maxVel = 0;
  for (let idx = 0; idx < N * N; idx++) {
    if (carMask[idx]) {
      pressure[idx] = 0.5 * RHO * V2_inf; // stagnation pressure on car surface
    } else {
      const v2 = velX[idx] ** 2 + velY[idx] ** 2;
      pressure[idx] = 0.5 * RHO * (V2_inf - v2);
      const vel = Math.sqrt(v2);
      if (vel > maxVel) maxVel = vel;
    }
    if (pressure[idx] < minP) minP = pressure[idx];
    if (pressure[idx] > maxP) maxP = pressure[idx];
  }

  // Integrate forces on car surface (sum pressure differences at boundary cells)
  let dragForce = 0;
  let liftForce = 0;
  const h = CAR_LENGTH / N; // physical cell size

  for (let i = 1; i < N - 1; i++) {
    for (let j = 1; j < N - 1; j++) {
      if (!carMask[i * N + j]) continue;

      // Check neighbors — if any neighbor is fluid, this is a surface cell
      const isLeft = i > 0 && !carMask[(i - 1) * N + j];
      const isRight = i < N - 1 && !carMask[(i + 1) * N + j];
      const isBottom = j > 0 && !carMask[i * N + (j - 1)];
      const isTop = j < N - 1 && !carMask[i * N + (j + 1)];

      if (isLeft) dragForce -= pressure[(i - 1) * N + j] * h;
      if (isRight) dragForce += pressure[(i + 1) * N + j] * h;
      if (isBottom) liftForce -= pressure[i * N + (j - 1)] * h;
      if (isTop) liftForce += pressure[i * N + (j + 1)] * h;
    }
  }

  // Scale forces to realistic values using regulation-year-specific empirical coefficients
  // Car setup parameters influence the aero balance significantly
  const q = 0.5 * RHO * V2_inf; // dynamic pressure

  // Year-specific base aero coefficients
  let baseCd: number, baseCl: number, frontalArea: number, planformArea: number;
  
  switch (config.carYear) {
    case 2024:
      // 2024: Ground-effect era, wider car, beam wing, front tire arches
      baseCd = 0.90;
      baseCl = config.drsOpen ? -3.0 : -4.2;
      frontalArea = 1.55;   // wider car body
      planformArea = 5.2;
      break;
    case 2025:
      // 2025: Refined ground effect, stricter flex tests, enhanced floor sealing
      baseCd = 0.85;
      baseCl = config.drsOpen ? -3.2 : -4.5;
      frontalArea = 1.50;
      planformArea = 5.0;
      break;
    case 2026:
      // 2026: Active aero, 100mm narrower, 200mm shorter, 30kg lighter
      // Active aero has much bigger Cd/Cl range between X-mode and Z-mode
      baseCd = config.drsOpen ? 0.55 : 0.78; // X-mode is very slippery
      baseCl = config.drsOpen ? -1.8 : -4.8;  // Z-mode has extreme downforce
      frontalArea = 1.35;   // narrower car
      planformArea = 4.5;   // shorter wheelbase
      break;
    default:
      baseCd = 0.85;
      baseCl = -4.5;
      frontalArea = 1.50;
      planformArea = 5.0;
  }

  // Front wing angle effect: more angle = more downforce AND drag
  const fwAngle = config.frontWingAngle ?? 8;
  const fwAngleEffect = (fwAngle - 8) / 15; // normalized deviation from baseline
  baseCl -= fwAngleEffect * 0.6;  // more angle = more negative Cl (downforce)
  baseCd += Math.abs(fwAngleEffect) * 0.08;

  // Rear wing angle effect: more angle = significantly more downforce AND drag
  const rwAngle = config.rearWingAngle ?? 22;
  const rwAngleEffect = (rwAngle - 22) / 35; // normalized deviation from baseline
  baseCl -= rwAngleEffect * 1.0;
  baseCd += Math.abs(rwAngleEffect) * 0.15;

  // Ride height effect: lower = more ground effect, but also more drag
  const rideH = config.rideHeight ?? 40;
  const rideHeightEffect = (40 - rideH) / 30; // positive when lower than baseline
  baseCl -= rideHeightEffect * 0.4; // lower = more downforce
  baseCd += rideHeightEffect * 0.03; // lower = slightly more drag (floor suction)

  // Tire width effect: wider tires = more drag
  const tw = config.tireWidth ?? 1.0;
  baseCd += (tw - 1.0) * 0.12;
  frontalArea *= (0.85 + 0.15 * tw); // wider tires increase frontal area slightly

  // Yaw and attack angle effects
  const cd = baseCd + Math.abs(config.yawAngle) * 0.008;
  const attackEffect = config.attackAngle * 0.15;
  const cl = baseCl - attackEffect;

  const drag = cd * q * frontalArea;
  const downforce = -cl * q * planformArea;
  const lift = cl * q * planformArea;
  const sideForce = Math.sin(yawRad) * q * frontalArea * 1.2;

  return {
    pressureField: pressure,
    velocityX: velX,
    velocityY: velY,
    gridSize: N,
    drag,
    lift,
    downforce,
    sideForce,
    cd,
    cl,
    maxPressure: maxP,
    minPressure: minP,
    maxVelocity: maxVel || speedMs,
  };
}
