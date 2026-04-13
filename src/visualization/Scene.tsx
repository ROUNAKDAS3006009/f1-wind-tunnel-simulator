/**
 * Main 3D Scene — Three.js / React Three Fiber
 * Renders all visualization layers on top of the gravitational field.
 */

import { useRef, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '../store/simulation';
import { turboColormap, divergingColormap } from '../utils/colormap';
import { C_SIM } from '../physics/types';

// ─── Curvature Surface Mesh ──────────────────────────────────────────
function CurvatureSurface() {
  const meshRef = useRef<THREE.Mesh>(null);
  const fieldData = useSimulationStore((s) => s.fieldData);
  const show = useSimulationStore((s) => s.visualization.showCurvature);

  const geometry = useMemo(() => {
    if (!fieldData) return null;
    const N = fieldData.gridSize;
    const step = N > 256 ? 4 : N > 128 ? 2 : 1;
    const M = Math.floor(N / step);

    const geo = new THREE.PlaneGeometry(10, 10, M - 1, M - 1);
    const positions = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);

    const range = Math.max(Math.abs(fieldData.minPotential), Math.abs(fieldData.maxPotential), 0.001);
    const heightScale = 3.0 / range;

    for (let ix = 0; ix < M; ix++) {
      for (let iy = 0; iy < M; iy++) {
        const vertIdx = ix * M + iy;
        const srcI = ix * step;
        const srcJ = iy * step;
        const dataIdx = srcI * N + srcJ;
        const phi = fieldData.potential[dataIdx] || 0;
        positions.setZ(vertIdx, phi * heightScale);
        const [r, g, b] = divergingColormap(phi, range);
        colors[vertIdx * 3] = r;
        colors[vertIdx * 3 + 1] = g;
        colors[vertIdx * 3 + 2] = b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    positions.needsUpdate = true;
    return geo;
  }, [fieldData]);

  if (!show || !geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <meshPhongMaterial vertexColors side={THREE.DoubleSide} shininess={30} transparent opacity={0.9} />
    </mesh>
  );
}

// ─── Heatmap Plane ───────────────────────────────────────────────────
function HeatmapPlane() {
  const meshRef = useRef<THREE.Mesh>(null);
  const fieldData = useSimulationStore((s) => s.fieldData);
  const show = useSimulationStore((s) => s.visualization.showHeatmap);

  const texture = useMemo(() => {
    if (!fieldData) return null;
    const N = fieldData.gridSize;
    const data = new Uint8Array(N * N * 4);

    const _range = Math.max(Math.abs(fieldData.minPotential), Math.abs(fieldData.maxPotential), 0.001);

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const idx = i * N + j;
        const phi = fieldData.potential[idx];
        const t = (phi - fieldData.minPotential) / (fieldData.maxPotential - fieldData.minPotential + 1e-10);
        const [r, g, b] = turboColormap(t);
        const pIdx = idx * 4;
        data[pIdx] = Math.floor(r * 255);
        data[pIdx + 1] = Math.floor(g * 255);
        data[pIdx + 2] = Math.floor(b * 255);
        data[pIdx + 3] = 180;
      }
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, [fieldData]);

  if (!show || !texture) return null;
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial map={texture} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Field Lines ─────────────────────────────────────────────────────
function FieldLines() {
  const fieldData = useSimulationStore((s) => s.fieldData);
  const show = useSimulationStore((s) => s.visualization.showFieldLines);

  const lines = useMemo(() => {
    if (!fieldData) return [];
    const N = fieldData.gridSize;
    const lineData: THREE.Vector3[][] = [];
    const step = Math.max(16, Math.floor(N / 16));

    for (let si = step; si < N - step; si += step) {
      for (let sj = step; sj < N - step; sj += step) {
        const points: THREE.Vector3[] = [];
        let ci = si, cj = sj;
        for (let s = 0; s < 40; s++) {
          const idx = Math.round(ci) * N + Math.round(cj);
          if (idx < 0 || idx >= N * N) break;
          if (ci < 1 || ci >= N - 1 || cj < 1 || cj >= N - 1) break;
          const x = (ci / (N - 1) - 0.5) * 10;
          const z = (cj / (N - 1) - 0.5) * 10;
          points.push(new THREE.Vector3(x, 0.1, z));
          const gx = fieldData.gradX[Math.round(ci) * N + Math.round(cj)] || 0;
          const gy = fieldData.gradY[Math.round(ci) * N + Math.round(cj)] || 0;
          const mag = Math.sqrt(gx * gx + gy * gy);
          if (mag < 1e-8) break;
          ci += (gx / mag) * 1.5;
          cj += (gy / mag) * 1.5;
        }
        if (points.length > 2) lineData.push(points);
      }
    }
    return lineData;
  }, [fieldData]);

  if (!show || lines.length === 0) return null;
  return (
    <group>
      {lines.map((pts, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: '#00ffaa', opacity: 0.5, transparent: true });
        const lineObj = new THREE.Line(geo, mat);
        return <primitive key={i} object={lineObj} />;
      })}
    </group>
  );
}

// ─── Geodesic Paths ──────────────────────────────────────────────────
function GeodesicPaths() {
  const particles = useSimulationStore((s) => s.particles);
  const show = useSimulationStore((s) => s.visualization.showGeodesics);
  if (!show || particles.length === 0) return null;
  return (
    <group>
      {particles.map((p) => {
        if (p.path.length < 2) return null;
        const points = p.path.map((pt) => new THREE.Vector3((pt.x - 0.5) * 10, 0.15, (pt.y - 0.5) * 10));
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const color = p.isLight ? '#ffd700' : '#ff4488';
        return (
          <group key={p.id}>
            <primitive object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color }))} />
            <mesh position={points[points.length - 1]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ─── Exotic Energy Overlay ───────────────────────────────────────────
function ExoticEnergyOverlay() {
  const fieldData = useSimulationStore((s) => s.fieldData);
  const show = useSimulationStore((s) => s.visualization.showExoticEnergy);

  const texture = useMemo(() => {
    if (!fieldData || Math.abs(fieldData.minExotic) < 1e-15) return null;
    const N = fieldData.gridSize;
    const data = new Uint8Array(N * N * 4);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const idx = i * N + j;
        const e = fieldData.exoticEnergy[idx];
        const pIdx = idx * 4;
        if (e < 0) {
          const t = Math.min(1, Math.abs(e / fieldData.minExotic));
          data[pIdx] = Math.floor(200 * t + 80 * (1 - t));
          data[pIdx + 1] = Math.floor(30 * t);
          data[pIdx + 2] = Math.floor(230 * t + 60 * (1 - t));
          data[pIdx + 3] = Math.floor(t * 180);
        } else {
          data[pIdx + 3] = 0;
        }
      }
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [fieldData]);

  if (!show || !texture) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Frame Drag Streamlines ──────────────────────────────────────────
function FrameDragStreamlines() {
  const fieldData = useSimulationStore((s) => s.fieldData);
  const show = useSimulationStore((s) => s.visualization.showFrameDrag);

  const streamlines = useMemo(() => {
    if (!fieldData) return [];
    const N = fieldData.gridSize;
    const lines: THREE.Vector3[][] = [];
    const nRings = 5, nPointsPerRing = 12;

    for (let ring = 1; ring <= nRings; ring++) {
      const radius = ring * 0.08;
      for (let p = 0; p < nPointsPerRing; p++) {
        const angle = (p / nPointsPerRing) * Math.PI * 2;
        let cx = 0.5 + radius * Math.cos(angle);
        let cy = 0.5 + radius * Math.sin(angle);
        const points: THREE.Vector3[] = [];
        for (let s = 0; s < 30; s++) {
          const ci = Math.min(N - 1, Math.max(0, Math.round(cx * (N - 1))));
          const cj = Math.min(N - 1, Math.max(0, Math.round(cy * (N - 1))));
          const idx = ci * N + cj;
          points.push(new THREE.Vector3((cx - 0.5) * 10, 0.12, (cy - 0.5) * 10));
          const dx = fieldData.frameDragX[idx] || 0;
          const dy = fieldData.frameDragY[idx] || 0;
          const mag = Math.sqrt(dx * dx + dy * dy);
          if (mag < 1e-10) break;
          cx += (dx / mag) * 0.01;
          cy += (dy / mag) * 0.01;
          if (cx < 0.01 || cx > 0.99 || cy < 0.01 || cy > 0.99) break;
        }
        if (points.length > 3) lines.push(points);
      }
    }
    return lines;
  }, [fieldData]);

  if (!show || streamlines.length === 0) return null;
  return (
    <group>
      {streamlines.map((pts, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: '#ff6622', opacity: 0.7, transparent: true });
        const lineObj = new THREE.Line(geo, mat);
        return <primitive key={i} object={lineObj} />;
      })}
    </group>
  );
}

// ─── Source Markers ──────────────────────────────────────────────────
function SourceMarkers() {
  const sources = useSimulationStore((s) => s.config.sources);
  return (
    <group>
      {sources.map((src) => {
        const x = (src.x - 0.5) * 10;
        const z = (src.y - 0.5) * 10;
        const color = src.mass >= 0 ? '#4488ff' : '#ff4444';
        const scale = Math.min(0.3, Math.abs(src.mass) * 0.05 + 0.1);
        return (
          <group key={src.id} position={[x, 0.3, z]}>
            <mesh>
              <sphereGeometry args={[scale, 16, 16]} />
              <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.9} />
            </mesh>
            {src.angularMomentum !== 0 && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[scale * 1.8, 0.02, 8, 32]} />
                <meshBasicMaterial color="#ff8800" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ─── Grid Floor ──────────────────────────────────────────────────────
function GridFloor() {
  return <gridHelper args={[10, 20, '#1a1a3a', '#1a1a3a']} position={[0, -0.1, 0]} />;
}

// ─── Main Scene Component ────────────────────────────────────────────
export default function Scene() {
  const setCursorReadout = useSimulationStore((s) => s.setCursorReadout);
  const addParticle = useSimulationStore((s) => s.addParticle);
  const fieldData = useSimulationStore((s) => s.fieldData);
  const showGeodesics = useSimulationStore((s) => s.visualization.showGeodesics);

  const handlePointerMove = useCallback(
    (e: any) => {
      if (!fieldData || !e.point) return;
      const N = fieldData.gridSize;
      const nx = e.point.x / 10 + 0.5;
      const nz = e.point.z / 10 + 0.5;
      if (nx < 0 || nx > 1 || nz < 0 || nz > 1) return;
      const i = Math.min(N - 1, Math.max(0, Math.round(nx * (N - 1))));
      const j = Math.min(N - 1, Math.max(0, Math.round(nz * (N - 1))));
      const idx = i * N + j;
      const phi = fieldData.potential[idx];
      const c2 = C_SIM * C_SIM;
      setCursorReadout({
        x: nx, y: nz, potential: phi,
        gtt: fieldData.metricGtt[idx], grr: fieldData.metricGrr[idx],
        timeDilation: Math.sqrt(Math.abs(1 + 2 * phi / c2)),
        exoticEnergy: fieldData.exoticEnergy[idx],
        fieldMagnitude: Math.sqrt((fieldData.gradX[idx] || 0) ** 2 + (fieldData.gradY[idx] || 0) ** 2),
      });
    },
    [fieldData, setCursorReadout]
  );

  const handleClick = useCallback(
    (e: any) => {
      if (!showGeodesics || !e.point) return;
      const nx = e.point.x / 10 + 0.5;
      const nz = e.point.z / 10 + 0.5;
      if (nx < 0.01 || nx > 0.99 || nz < 0.01 || nz > 0.99) return;
      const vx = (Math.random() - 0.5) * 0.3;
      const vy = (Math.random() - 0.5) * 0.3;
      addParticle(nx, nz, vx, vy, false);
    },
    [showGeodesics, addParticle]
  );

  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: '#0a0a1a' }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      <PerspectiveCamera makeDefault position={[0, 8, 8]} fov={50} />
      <OrbitControls enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.1} minDistance={3} maxDistance={25} />

      <ambientLight intensity={0.3} color="#6666aa" />
      <directionalLight position={[5, 10, 5]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} color="#4444ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} visible={false}
        onPointerMove={handlePointerMove} onClick={handleClick}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial />
      </mesh>

      <CurvatureSurface />
      <HeatmapPlane />
      <FieldLines />
      <GeodesicPaths />
      <ExoticEnergyOverlay />
      <FrameDragStreamlines />
      <SourceMarkers />
      <GridFloor />
    </Canvas>
  );
}
