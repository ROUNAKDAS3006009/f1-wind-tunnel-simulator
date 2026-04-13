
// Air properties
const RHO = 1.225;

export interface FluidState3D {
  width: number;
  height: number;
  depth: number;
  solid: Uint8Array;
  normals: Float32Array; // 3 floats per voxel
  
  // Velocity field (Vx, Vy, Vz)
  velX: Float32Array;
  velY: Float32Array;
  velZ: Float32Array;
  
  // Pressure field
  pressure: Float32Array;
  
  // Initialization tracking
  initialized: boolean;
  lastWindSpeed: number;
  lastYaw: number;
  lastAttack: number;
}

export function initFluidState(width: number, height: number, depth: number, solid: Uint8Array, normals: Float32Array): FluidState3D {
  const size = width * height * depth;
  return {
    width, height, depth,
    solid, normals,
    velX: new Float32Array(size),
    velY: new Float32Array(size),
    velZ: new Float32Array(size),
    pressure: new Float32Array(size),
    initialized: false,
    lastWindSpeed: 0,
    lastYaw: 0,
    lastAttack: 0,
  };
}

/**
 * Initialize the entire velocity field to freestream conditions.
 * This gives immediate convergence instead of waiting for edges to propagate inward.
 */
function initializeToFreestream(state: FluidState3D, U_inf: number, V_inf: number, W_inf: number) {
  const { width, height, depth, solid, velX, velY, velZ, pressure } = state;
  const V2_inf = U_inf * U_inf + V_inf * V_inf + W_inf * W_inf;
  
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = x + y * width + z * width * height;
        if (solid[idx] === 1) {
          velX[idx] = 0;
          velY[idx] = 0;
          velZ[idx] = 0;
          pressure[idx] = 0.5 * RHO * V2_inf;
        } else {
          velX[idx] = U_inf;
          velY[idx] = V_inf;
          velZ[idx] = W_inf;
          pressure[idx] = 0;
        }
      }
    }
  }
}

/**
 * Real-time simplified 3D fluid advection and boundary deflection.
 * Optimized for Web Worker execution.
 * 
 * On first call (or when wind parameters change significantly), the entire
 * field is initialized to freestream so flow is visible immediately.
 */
export function solveFluidStep(
  state: FluidState3D, 
  windSpeedMs: number, 
  dt: number,
  yawAngleStr: number = 0,
  attackAngleStr: number = 0
) {
  const { width, height, depth, solid, normals, velX, velY, velZ, pressure } = state;
  const size = width * height * depth;

  const yawRad = (yawAngleStr * Math.PI) / 180;
  const attackRad = (attackAngleStr * Math.PI) / 180;

  // Freestream velocity components (wind flows from +Z to -Z in Three.js coordinates)
  const U_inf = -windSpeedMs * Math.sin(yawRad) * Math.cos(attackRad);
  const V_inf = -windSpeedMs * Math.sin(attackRad);
  const W_inf = -windSpeedMs * Math.cos(yawRad) * Math.cos(attackRad);
  
  const V2_inf = U_inf * U_inf + V_inf * V_inf + W_inf * W_inf;

  // Initialize to freestream on first call or when wind parameters change significantly
  const speedChanged = Math.abs(windSpeedMs - state.lastWindSpeed) > 2;
  const yawChanged = Math.abs(yawAngleStr - state.lastYaw) > 1;
  const attackChanged = Math.abs(attackAngleStr - state.lastAttack) > 1;
  
  if (!state.initialized || speedChanged || yawChanged || attackChanged) {
    initializeToFreestream(state, U_inf, V_inf, W_inf);
    state.initialized = true;
    state.lastWindSpeed = windSpeedMs;
    state.lastYaw = yawAngleStr;
    state.lastAttack = attackAngleStr;
    // After initialization, run a few extra passes for immediate boundary interaction
    for (let pass = 0; pass < 3; pass++) {
      solveFluidPassInner(state, U_inf, V_inf, W_inf, V2_inf);
    }
    return;
  }

  solveFluidPassInner(state, U_inf, V_inf, W_inf, V2_inf);
}

function solveFluidPassInner(
  state: FluidState3D,
  U_inf: number, V_inf: number, W_inf: number,
  V2_inf: number
) {
  const { width, height, depth, solid, normals, velX, velY, velZ, pressure } = state;
  const size = width * height * depth;

  // Temporary arrays for new velocity
  const newVx = new Float32Array(size);
  const newVy = new Float32Array(size);
  const newVz = new Float32Array(size);

  const getIdx = (x: number, y: number, z: number) => x + y * width + z * width * height;

  // Single-pass advection and boundary enforcement
  for (let z = depth - 1; z >= 0; z--) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = getIdx(x, y, z);

        if (solid[idx] === 1) {
          newVx[idx] = 0;
          newVy[idx] = 0;
          newVz[idx] = 0;
          pressure[idx] = 0.5 * RHO * V2_inf; // Stagnation pressure
          continue;
        }

        // Pull velocity from "upwind" cell
        let srcX = x - Math.sign(U_inf);
        let srcY = y - Math.sign(V_inf);
        let srcZ = z - Math.sign(W_inf);

        // Clamp to edges
        if (srcX < 0 || srcX >= width) srcX = x;
        if (srcY < 0 || srcY >= height) srcY = y;
        if (srcZ < 0 || srcZ >= depth) srcZ = z;

        const srcIdx = getIdx(srcX, srcY, srcZ);
        
        let vx = velX[srcIdx];
        let vy = velY[srcIdx];
        let vz = velZ[srcIdx];

        // Domain boundaries maintain freestream velocity
        if (x <= 1 || x >= width - 2 || y >= height - 2 || z >= depth - 2) {
           vx = U_inf;
           vy = V_inf;
           vz = W_inf;
        }

        // Ground boundary layer (y=0): no-slip condition
        if (y === 0) {
          vx *= 0.3;
          vy = Math.max(0, vy); // Don't allow flow through the floor
          vz *= 0.3;
        }

        // Boundary reflection: check ALL 6 neighbors for solids, accumulate deflections
        let totalNx = 0, totalNy = 0, totalNz = 0;
        let hitCount = 0;

        const checkSolid = (sx: number, sy: number, sz: number) => {
          if (sx >= 0 && sx < width && sy >= 0 && sy < height && sz >= 0 && sz < depth) {
            const sIdx = getIdx(sx, sy, sz);
            if (solid[sIdx] === 1) {
              totalNx += normals[sIdx * 3];
              totalNy += normals[sIdx * 3 + 1];
              totalNz += normals[sIdx * 3 + 2];
              hitCount++;
            }
          }
        };

        checkSolid(x - 1, y, z);
        checkSolid(x + 1, y, z);
        checkSolid(x, y - 1, z);
        checkSolid(x, y + 1, z);
        checkSolid(x, y, z - 1);
        checkSolid(x, y, z + 1);

        if (hitCount > 0) {
          // Average surface normal from all adjacent solid voxels
          const invCount = 1.0 / hitCount;
          const nx = totalNx * invCount;
          const ny = totalNy * invCount;
          const nz = totalNz * invCount;
          const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);

          if (nLen > 0.01) {
            const nnx = nx / nLen, nny = ny / nLen, nnz = nz / nLen;
            // Tangential deflection: V = V - (V dot N) * N
            const dot = vx * nnx + vy * nny + vz * nnz;
            if (dot < 0) { // Only deflect if moving TOWARD the surface
              vx -= nnx * dot * 1.5;
              vy -= nny * dot * 1.5;
              vz -= nnz * dot * 1.5;
            }
          }

          // Boundary layer friction — scale by proximity (more neighbors = closer)
          const friction = 0.75 + 0.1 / hitCount;
          vx *= friction;
          vy *= friction;
          vz *= friction;
        }

        // Turbulence decay (viscosity) — blend toward freestream
        vx = vx * 0.97 + U_inf * 0.03;
        vy = vy * 0.97 + V_inf * 0.03;
        vz = vz * 0.97 + W_inf * 0.03;

        newVx[idx] = vx;
        newVy[idx] = vy;
        newVz[idx] = vz;

        // Bernoulli Pressure
        const vSq = vx * vx + vy * vy + vz * vz;
        pressure[idx] = 0.5 * RHO * (V2_inf - vSq);
      }
    }
  }

  // Update state arrays
  for (let i = 0; i < size; i++) {
    velX[i] = newVx[i];
    velY[i] = newVy[i];
    velZ[i] = newVz[i];
  }
}
