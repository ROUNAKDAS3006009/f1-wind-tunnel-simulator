/**
 * WindTunnelScene — Professional CFD-style wind tunnel visualization
 * 
 * Now uses Real-Time Eulerian Fluid Dynamics (SDF Grid) from the physics worker
 * instead of hardcoded F1 aerodynamic zones. Supports arbitrary 3D geometry!
 */

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '../store/simulation';
import F1CarModel from './F1CarModel';
import type { CarYear } from './F1CarGeometry';

// ─── Velocity Interpolation with Freestream Fallback ─────────────────

function getFreestreamVelocity(): { vx: number, vy: number, vz: number } {
  const config = useSimulationStore.getState().windTunnelConfig;
  const speedMs = config.windSpeed / 3.6;
  const yawRad = (config.yawAngle * Math.PI) / 180;
  const attackRad = (config.attackAngle * Math.PI) / 180;
  return {
    vx: -speedMs * Math.sin(yawRad) * Math.cos(attackRad),
    vy: -speedMs * Math.sin(attackRad),
    vz: -speedMs * Math.cos(yawRad) * Math.cos(attackRad),
  };
}

function sampleVelocity(
  x: number, y: number, z: number,
  params: Exclude<ReturnType<typeof useSimulationStore>['fluidGridParams'], null>,
  velX: Float32Array, velY: Float32Array, velZ: Float32Array
): { vx: number, vy: number, vz: number } {
  // Map world coordinates to grid coordinates [0..dim]
  const gx = ((x - params.minX) / (params.maxX - params.minX)) * params.width;
  const gy = ((y - params.minY) / (params.maxY - params.minY)) * params.height;
  const gz = ((z - params.minZ) / (params.maxZ - params.minZ)) * params.depth;

  // If outside domain, return freestream velocity so particles can enter the domain
  if (gx < 0 || gx >= params.width - 1 || gy < 0 || gy >= params.height - 1 || gz < 0 || gz >= params.depth - 1) {
    return getFreestreamVelocity();
  }

  const getIdx = (i: number, j: number, k: number) => i + j * params.width + k * params.width * params.height;

  // Clamped nearest-neighbor for maximum speed in JS tight loop
  const rx = Math.min(params.width - 1, Math.max(0, Math.round(gx)));
  const ry = Math.min(params.height - 1, Math.max(0, Math.round(gy)));
  const rz = Math.min(params.depth - 1, Math.max(0, Math.round(gz)));
  const idx = getIdx(rx, ry, rz);
  
  const vx = velX[idx] || 0;
  const vy = velY[idx] || 0;
  const vz = velZ[idx] || 0;
  
  // If velocity is exactly zero at this cell (solid interior), return a small value
  // to prevent particles from getting permanently stuck
  if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001 && Math.abs(vz) < 0.001) {
    const fs = getFreestreamVelocity();
    return { vx: fs.vx * 0.1, vy: fs.vy * 0.1 + 0.5, vz: fs.vz * 0.1 };
  }
  
  return { vx, vy, vz };
}

// ─── Velocity to color mapping (blue→cyan→green→yellow→red) ─────────

function velocityToColor(vel: number, maxVel: number): THREE.Color {
  const t = Math.min(1, Math.max(0, vel / maxVel));
  if (t < 0.2) return new THREE.Color().setHSL(0.65, 0.9, 0.4 + t * 1.5);
  else if (t < 0.4) return new THREE.Color().setHSL(0.55 - (t - 0.2) * 1.5, 0.95, 0.5);
  else if (t < 0.6) return new THREE.Color().setHSL(0.35 - (t - 0.4) * 1.0, 0.95, 0.5);
  else if (t < 0.8) return new THREE.Color().setHSL(0.15 - (t - 0.6) * 0.5, 1.0, 0.5);
  else return new THREE.Color().setHSL(0.05 - (t - 0.8) * 0.25, 1.0, 0.45);
}

// ─── Continuous Tube Streamlines (Tracing velocity field) ────────────

function TubeStreamlines() {
  const windTunnelConfig = useSimulationStore((s) => s.windTunnelConfig);
  const params = useSimulationStore((s) => s.fluidGridParams);
  const velX = useSimulationStore((s) => s.fluidVelX);
  const velY = useSimulationStore((s) => s.fluidVelY);
  const velZ = useSimulationStore((s) => s.fluidVelZ);

  const streamlineData = useMemo(() => {
    if (!params || !velX || !velY || !velZ) return [];
    
    // Decrease rendering frequency if user wants high FPS with static models
    // In universal live CFD, calculating 200 lines x 150 steps per frame is heavy.
    // We compute only when buffers update.
    
    const baseSpeedMs = windTunnelConfig.windSpeed / 3.6; // convert km/h to m/s
    const dt = 0.02; // integration time step

    const lineCount = windTunnelConfig.particleDensity === 0 ? 50
      : windTunnelConfig.particleDensity === 1 ? 120 : 200;

    const lines: { points: THREE.Vector3[]; colors: THREE.Color[] }[] = [];
    let globalMaxVel = 0;
    const rawLines: { points: THREE.Vector3[]; velocities: number[] }[] = [];

    const gridRows = Math.ceil(Math.sqrt(lineCount * 0.5));
    const gridCols = Math.ceil(lineCount * 0.5 / gridRows);
    const gridTotal = gridRows * gridCols;

    for (let i = 0; i < lineCount; i++) {
      let px: number, py: number;

      // Seed points at the back of the wind tunnel (where wind comes from)
      if (i < gridTotal) {
        // Uniform grid over the cross-section
        const row = Math.floor(i / gridCols);
        const col = i % gridCols;
        px = (col / Math.max(1, gridCols - 1) - 0.5) * 3.0;
        py = (row / Math.max(1, gridRows - 1)) * 1.4 + 0.015;
        px += (Math.random() - 0.5) * 0.1;
        py += (Math.random() - 0.5) * 0.06;
      } else {
        // Random focus near the center where the car usually is
        px = (Math.random() - 0.5) * 1.5;
        py = Math.random() * 0.5 + 0.012;
      }
      
      let pz = params.maxZ - 0.2; // Start near the +Z edge (flow is -Z)

      const points: THREE.Vector3[] = [];
      const velocities: number[] = [];

      // Integrate path through the velocity field
      for (let s = 0; s < 150; s++) {
        const { vx, vy, vz } = sampleVelocity(px, py, pz, params, velX, velY, velZ);
        
        // If velocity is effectively zero, we hit a solid or stagnation point
        const mag = Math.sqrt(vx*vx + vy*vy + vz*vz);
        if (mag < 0.01) break; 
        
        px += vx * dt;
        py += vy * dt;
        pz += vz * dt;

        // Domain boundaries
        if (py < params.minY) py = params.minY;
        if (py > params.maxY) break;
        if (px < params.minX || px > params.maxX) break;
        if (pz < params.minZ || pz > params.maxZ) break;

        points.push(new THREE.Vector3(px, py, pz));
        velocities.push(mag);
        if (mag > globalMaxVel) globalMaxVel = mag;
      }

      if (points.length > 5) rawLines.push({ points, velocities });
    }

    // Colorize based on relative velocity max
    const maxColorVel = globalMaxVel * 0.85 || baseSpeedMs;
    for (const sl of rawLines) {
      const colors = sl.velocities.map(v => velocityToColor(v, maxColorVel));
      lines.push({ points: sl.points, colors });
    }

    return lines;
  }, [params, velX, velY, velZ, windTunnelConfig.particleDensity, windTunnelConfig.windSpeed]);

  if (!windTunnelConfig.showStreamlines || streamlineData.length === 0) return null;

  return (
    <group>
      {streamlineData.map((line, idx) => (
        <Line
          key={idx}
          points={line.points}
          vertexColors={line.colors.map(c => [c.r, c.g, c.b] as [number, number, number])}
          lineWidth={2.0}
          transparent
          opacity={0.8}
        />
      ))}
    </group>
  );
}

// ─── Pressure Heatmap (Real-Time CFD Floor Slice) ────────────────────

function PressureHeatmap() {
  const windTunnelConfig = useSimulationStore((s) => s.windTunnelConfig);
  const params = useSimulationStore((s) => s.fluidGridParams);
  
  // Ref to texture so we don't recreate the object constantly
  const texRef = useRef<THREE.DataTexture | null>(null);

  useEffect(() => {
    if (!params) return;
    const data = new Uint8Array(params.width * params.depth * 4);
    const tex = new THREE.DataTexture(data, params.width, params.depth, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    texRef.current = tex;
  }, [params]);

  useFrame(() => {
    if (!windTunnelConfig.showPressureMap || !params || !texRef.current) return;
    const pressureArray = useSimulationStore.getState().fluidVelX ? useSimulationStore.getState().fluidVelX : null; // Quick check. Real pressure is another state!
    const pressure = useSimulationStore.getState().fluidPressure;
    if (!pressure) return;

    // The floor is y=0 in grid space. We sample there.
    const { width, depth, height } = params;
    
    // Find global min/max for normalization this frame
    let minP = Infinity, maxP = -Infinity;
    // For performance, we only scan the floor layer (y=0) to find min/max
    const yLayerOffset = 0; 
    
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        const idx = x + yLayerOffset * width + z * width * height;
        const p = pressure[idx];
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
      }
    }
    
    const pRange = (maxP - minP) || 1;
    if (!texRef.current.image.data) return;
    const texData = texRef.current.image.data;

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        const gridIdx = x + yLayerOffset * width + z * width * height;
        const p = pressure[gridIdx];
        
        // Normalize 0 to 1
        const t = (p - minP) / pRange;
        
        // Use the velocityToColor function, inverted (high pressure = slow = blue, low pressure = fast = red)
        const c = velocityToColor(1.0 - t, 1.0);
        
        const texIdx = (x + z * width) * 4;
        texData[texIdx] = Math.floor(c.r * 255);
        texData[texIdx + 1] = Math.floor(c.g * 255);
        texData[texIdx + 2] = Math.floor(c.b * 255);
        texData[texIdx + 3] = 120; // Alpha
      }
    }
    
    texRef.current.needsUpdate = true;
  });

  if (!windTunnelConfig.showPressureMap || !params) return null;
  
  // The plane dimensions should match the CFD domain parameters
  const domainWidth = params.maxX - params.minX;
  const domainLength = params.maxZ - params.minZ;
  
  // PlaneGeometry by default puts 0,0 at center.
  // The domain spans from minX to maxX, minZ to maxZ.
  const centerX = (params.minX + params.maxX) / 2;
  const centerZ = (params.minZ + params.maxZ) / 2;

  return (
    <mesh position={[centerX, 0.005, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[domainWidth, domainLength]} />
      <meshBasicMaterial 
        map={texRef.current || undefined} 
        transparent 
        opacity={0.35} 
        blending={THREE.NormalBlending} 
        side={THREE.DoubleSide} 
      />
    </mesh>
  );
}

// ─── Moving Flow Particles (Dynamic Smoke Effect) ────────────────────

function SmokeParticles() {
  const windTunnelConfig = useSimulationStore((s) => s.windTunnelConfig);
  const params = useSimulationStore((s) => s.fluidGridParams);
  
  // Use refs in the animation loop to avoid re-renders
  const velXBuffer = useRef<Float32Array | null>(null);
  const velYBuffer = useRef<Float32Array | null>(null);
  const velZBuffer = useRef<Float32Array | null>(null);
  
  useEffect(() => {
    velXBuffer.current = useSimulationStore.getState().fluidVelX;
    velYBuffer.current = useSimulationStore.getState().fluidVelY;
    velZBuffer.current = useSimulationStore.getState().fluidVelZ;
    // Subscribe to changes without triggering React renders
    return useSimulationStore.subscribe((state) => {
      velXBuffer.current = state.fluidVelX;
      velYBuffer.current = state.fluidVelY;
      velZBuffer.current = state.fluidVelZ;
    });
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  const count = 3000;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        // Randomly scatter initially
      pos[i * 3] = (Math.random() - 0.5) * 3;
      pos[i * 3 + 1] = Math.random() * 1.5 + 0.01;
      pos[i * 3 + 2] = Math.random() * 10 - 3;
      col[i * 3] = 0.5; col[i * 3 + 1] = 0.6; col[i * 3 + 2] = 0.8;
    }
    return [pos, col];
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !params) return;
    const vxBuf = velXBuffer.current;
    const vyBuf = velYBuffer.current;
    const vzBuf = velZBuffer.current;
    if (!vxBuf || !vyBuf || !vzBuf) return;

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = pointsRef.current.geometry.attributes.color as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;
    
    // dt varies with frame rate, but cap it so particles don't jump through walls
    const dt = Math.min(delta, 0.05);
    const baseSpeed = windTunnelConfig.windSpeed / 3.6;

    for (let i = 0; i < count; i++) {
      let px = posArr[i * 3], py = posArr[i * 3 + 1], pz = posArr[i * 3 + 2];

      const { vx, vy, vz } = sampleVelocity(px, py, pz, params, vxBuf, vyBuf, vzBuf);
      
      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;

      // Reset particle if it leaves the tunnel or gets stuck on a surface (velocity near 0)
      const vMag = Math.sqrt(vx*vx + vy*vy + vz*vz);
      if (pz < params.minZ || py > params.maxY || px < params.minX || px > params.maxX || vMag < 0.05) {
        pz = params.maxZ - 0.1; 
        px = (Math.random() - 0.5) * 3.0; 
        py = Math.random() * 1.5 + 0.02; 
      }
      
      if (py < params.minY) py = params.minY;

      posArr[i * 3] = px; posArr[i * 3 + 1] = py; posArr[i * 3 + 2] = pz;

      // Color based on velocity
      const t = Math.min(1, vMag / (baseSpeed * 1.3));
      const col3 = velocityToColor(t, 1);
      colArr[i * 3] = col3.r; colArr[i * 3 + 1] = col3.g; colArr[i * 3 + 2] = col3.b;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  if (!windTunnelConfig.showSmoke && !windTunnelConfig.showStreamlines) return null;
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial 
        size={windTunnelConfig.showSmoke ? 0.06 : 0.015} 
        vertexColors 
        transparent 
        opacity={windTunnelConfig.showSmoke ? 0.15 : 0.5} 
        sizeAttenuation 
        depthWrite={false} 
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─── Tunnel Enclosure ────────────────────────────────────────────────

function TunnelEnclosure() {
  return (
    <group>
      {/* Dark polished floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Subtle grid */}
      <gridHelper args={[14, 28, '#141428', '#0e0e20']} position={[0, 0.001, 0]} />
      {/* Glass walls */}
      {[-1, 1].map((side) => (
        <mesh key={`wall-${side}`} position={[0, 1.4, side * 2.8]}>
          <planeGeometry args={[14, 2.8]} />
          <meshPhysicalMaterial color="#111122" transparent opacity={0.04} roughness={0} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 6]} />
        <meshStandardMaterial color="#0f0f1a" roughness={0.25} metalness={0.5} />
      </mesh>
    </group>
  );
}

function SimulationLoop() {
  const windTunnelConfig = useSimulationStore((s) => s.windTunnelConfig);

  // Simulation loop trigger — send fluid physics steps to worker continuously
  useFrame((state, delta) => {
    const worker = (window as any).physicsWorker as Worker;
    if (worker) {
      worker.postMessage({
        type: 'STEP_FLUID',
        config: windTunnelConfig,
        dt: Math.min(delta, 0.033) // Max 30ms simulation step
      });
    }
  });

  return null;
}

// ─── Vortex Trails (Visualize Rotational Flow Structures) ────────────

function VortexTrails() {
  const windTunnelConfig = useSimulationStore((s) => s.windTunnelConfig);
  const params = useSimulationStore((s) => s.fluidGridParams);
  const velX = useSimulationStore((s) => s.fluidVelX);
  const velY = useSimulationStore((s) => s.fluidVelY);
  const velZ = useSimulationStore((s) => s.fluidVelZ);

  const vortexData = useMemo(() => {
    if (!params || !velX || !velY || !velZ || !windTunnelConfig.showVortices) return [];

    const lines: { points: THREE.Vector3[]; colors: THREE.Color[] }[] = [];
    const dt = 0.015;
    const baseSpeedMs = windTunnelConfig.windSpeed / 3.6;

    // Seed vortex tracers behind the car at key vortex-generating locations:
    // Wing tips, rear diffuser edges, wheel wake areas
    const seedPoints = [
      // Front wing tip vortices
      { x: -0.95, y: 0.05, z: 0.8 },
      { x: 0.95, y: 0.05, z: 0.8 },
      // Rear wing tip vortices
      { x: -0.5, y: 0.5, z: -0.5 },
      { x: 0.5, y: 0.5, z: -0.5 },
      // Diffuser edge vortices
      { x: -0.3, y: 0.08, z: -0.7 },
      { x: 0.3, y: 0.08, z: -0.7 },
      // Wheel wake vortices
      { x: -0.7, y: 0.15, z: 0.3 },
      { x: 0.7, y: 0.15, z: 0.3 },
      { x: -0.7, y: 0.15, z: -0.5 },
      { x: 0.7, y: 0.15, z: -0.5 },
    ];

    for (const seed of seedPoints) {
      let px = seed.x, py = seed.y, pz = seed.z;
      const points: THREE.Vector3[] = [];
      const velocities: number[] = [];
      let maxVel = 0;

      for (let s = 0; s < 100; s++) {
        const { vx, vy, vz } = sampleVelocity(px, py, pz, params, velX, velY, velZ);
        const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (mag < 0.05) break;

        // Add a small helical perturbation to make vortices visually spiral
        const angle = s * 0.3;
        const helixR = 0.02 * Math.min(1, s / 20);
        
        px += vx * dt + Math.cos(angle) * helixR * dt;
        py += vy * dt + Math.sin(angle) * helixR * dt;
        pz += vz * dt;

        if (py < params.minY) py = params.minY;
        if (py > params.maxY || px < params.minX || px > params.maxX || pz < params.minZ || pz > params.maxZ) break;

        points.push(new THREE.Vector3(px, py, pz));
        velocities.push(mag);
        if (mag > maxVel) maxVel = mag;
      }

      if (points.length > 5) {
        const maxColorVel = maxVel * 0.85 || baseSpeedMs;
        const colors = velocities.map(v => {
          // Vortices get a purple/magenta color scheme
          const t = Math.min(1, v / maxColorVel);
          return new THREE.Color().setHSL(0.8 - t * 0.15, 0.9, 0.35 + t * 0.25);
        });
        lines.push({ points, colors });
      }
    }

    return lines;
  }, [params, velX, velY, velZ, windTunnelConfig.showVortices, windTunnelConfig.windSpeed]);

  if (!windTunnelConfig.showVortices || vortexData.length === 0) return null;

  return (
    <group>
      {vortexData.map((line, idx) => (
        <Line
          key={`vortex-${idx}`}
          points={line.points}
          vertexColors={line.colors.map(c => [c.r, c.g, c.b] as [number, number, number])}
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}
    </group>
  );
}

// ─── Wind Direction Indicator ────────────────────────────────────────

function WindDirectionIndicator() {
  const windTunnelConfig = useSimulationStore((s) => s.windTunnelConfig);
  
  const yawRad = (windTunnelConfig.yawAngle * Math.PI) / 180;
  const arrowDir = new THREE.Vector3(
    -Math.sin(yawRad),
    0,
    -Math.cos(yawRad)
  ).normalize();

  return (
    <group position={[0, 1.8, 4.5]}>
      {/* Arrow shaft */}
      <mesh position={[arrowDir.x * 0.3, 0, arrowDir.z * 0.3]}
        rotation={[0, -yawRad, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.6, 8]} />
        <meshStandardMaterial color="#44aaff" emissive="#2266aa" emissiveIntensity={0.5} />
      </mesh>
      {/* Arrow head */}
      <mesh position={[arrowDir.x * 0.6, 0, arrowDir.z * 0.6]}
        rotation={[Math.PI / 2, 0, yawRad]}>
        <coneGeometry args={[0.04, 0.1, 8]} />
        <meshStandardMaterial color="#44aaff" emissive="#2266aa" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// ─── Main Scene ──────────────────────────────────────────────────────

export default function WindTunnelScene() {
  const windTunnelConfig = useSimulationStore((s) => s.windTunnelConfig);

  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: '#020208' }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <PerspectiveCamera makeDefault position={[1.8, 1.0, 2.2]} fov={45} />
      <OrbitControls
        enableDamping dampingFactor={0.07}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={0.8} maxDistance={12}
        target={[0, 0.15, 0]}
      />

      <SimulationLoop />

      <ambientLight intensity={0.08} color="#223344" />
      <directionalLight position={[3, 6, 4]} intensity={0.4} color="#ffffff" />
      <directionalLight position={[-2, 4, -2]} intensity={0.15} color="#4488cc" />
      <spotLight position={[0, 4, 1]} intensity={0.5} angle={0.4} penumbra={0.5} color="#ddeeff" />
      <spotLight position={[0, 3, -2]} intensity={0.3} angle={0.3} penumbra={0.7} color="#bbccee" />
      <spotLight position={[-2, 1.5, 0]} intensity={0.2} angle={0.5} penumbra={0.8} color="#4466aa" />
      <spotLight position={[2, 1.5, 0]} intensity={0.2} angle={0.5} penumbra={0.8} color="#4466aa" />

      <fog attach="fog" args={['#020208', 10, 20]} />

      <TunnelEnclosure />
      
      {/* Instead of passing down Zones, the Model auto-voxelizes and sends grid to Worker */}
      <F1CarModel
        year={windTunnelConfig.carYear as CarYear}
        drsOpen={windTunnelConfig.drsOpen}
      />
      
      {/* Streamlines and smoke purely advect via the generated 3D grid vectors */}
      <TubeStreamlines />
      <SmokeParticles />
      <PressureHeatmap />
      <VortexTrails />
      <WindDirectionIndicator />

    </Canvas>
  );
}
