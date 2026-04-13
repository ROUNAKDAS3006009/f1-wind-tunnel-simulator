/**
 * F1Car2025 — Procedural 2025-regulation Formula 1 car
 * Built entirely from Three.js geometry primitives.
 * 
 * Key 2025 features: simplified front wing, wider floor,
 * redesigned sidepods, active aero DRS, wheel covers, halo.
 */

import { useRef, useMemo } from 'react';
import * as THREE from 'three';

interface F1Car2025Props {
  drsOpen?: boolean;
  showPressureColors?: boolean;
}

// Carbon fiber dark color palette
const CARBON = '#1a1a1a';
const CARBON_ACCENT = '#2a2a2a';
const RED_ACCENT = '#e10600';
const WHITE_ACCENT = '#f0f0f0';
const TIRE_BLACK = '#111111';
const METALLIC = '#4a4a5a';

function createExtrudedShape(points: [number, number][], depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.lineTo(points[0][0], points[0][1]);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

export default function F1Car2025({ drsOpen = false }: F1Car2025Props) {
  const groupRef = useRef<THREE.Group>(null);

  const carMaterials = useMemo(() => ({
    carbon: new THREE.MeshPhysicalMaterial({
      color: CARBON, roughness: 0.3, metalness: 0.1,
      clearcoat: 1.0, clearcoatRoughness: 0.1,
    }),
    carbonAccent: new THREE.MeshPhysicalMaterial({
      color: CARBON_ACCENT, roughness: 0.4, metalness: 0.05,
    }),
    red: new THREE.MeshPhysicalMaterial({
      color: RED_ACCENT, roughness: 0.3, metalness: 0.2,
      clearcoat: 0.8, clearcoatRoughness: 0.1,
    }),
    white: new THREE.MeshPhysicalMaterial({
      color: WHITE_ACCENT, roughness: 0.2, metalness: 0.1,
    }),
    tire: new THREE.MeshStandardMaterial({
      color: TIRE_BLACK, roughness: 0.9, metalness: 0,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: METALLIC, roughness: 0.2, metalness: 0.8,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#88aacc', roughness: 0, metalness: 0.1,
      transparent: true, opacity: 0.3, transmission: 0.8,
    }),
  }), []);

  const drsAngle = drsOpen ? -0.4 : 0;

  return (
    <group ref={groupRef} scale={[1, 1, 1]} position={[0, 0.05, 0]}>
      {/* ── Monocoque / Main Body ── */}
      <mesh position={[0, 0.22, 0]} material={carMaterials.carbon}>
        <boxGeometry args={[0.7, 0.22, 2.8]} />
      </mesh>

      {/* ── Engine Cover (tapered rear) ── */}
      <mesh position={[0, 0.28, -0.6]} material={carMaterials.red}>
        <boxGeometry args={[0.55, 0.15, 1.4]} />
      </mesh>

      {/* ── Nose Cone ── */}
      <mesh position={[0, 0.18, 1.8]} rotation={[0.15, 0, 0]} material={carMaterials.carbon}>
        <boxGeometry args={[0.35, 0.12, 0.8]} />
      </mesh>
      <mesh position={[0, 0.15, 2.3]} rotation={[0.2, 0, 0]} material={carMaterials.carbon}>
        <boxGeometry args={[0.2, 0.08, 0.6]} />
      </mesh>

      {/* ── Halo ── */}
      <mesh position={[0, 0.42, 0.45]} material={carMaterials.metal}>
        <torusGeometry args={[0.2, 0.025, 8, 16, Math.PI]} />
      </mesh>
      <mesh position={[0, 0.38, 0.65]} rotation={[-0.3, 0, 0]} material={carMaterials.metal}>
        <boxGeometry args={[0.04, 0.04, 0.5]} />
      </mesh>

      {/* ── Cockpit Opening ── */}
      <mesh position={[0, 0.35, 0.45]} material={carMaterials.glass}>
        <boxGeometry args={[0.4, 0.05, 0.5]} />
      </mesh>

      {/* ── Sidepods (2025 style - undercut) ── */}
      {[-1, 1].map((side) => (
        <group key={`sidepod-${side}`}>
          <mesh position={[side * 0.55, 0.2, -0.1]} material={carMaterials.carbon}>
            <boxGeometry args={[0.4, 0.18, 1.6]} />
          </mesh>
          {/* Sidepod inlet */}
          <mesh position={[side * 0.6, 0.32, 0.5]} material={carMaterials.carbonAccent}>
            <boxGeometry args={[0.25, 0.1, 0.3]} />
          </mesh>
        </group>
      ))}

      {/* ── Floor / Underbody ── */}
      <mesh position={[0, 0.06, 0]} material={carMaterials.carbonAccent}>
        <boxGeometry args={[1.0, 0.04, 3.0]} />
      </mesh>
      {/* Floor edge wings */}
      {[-1, 1].map((side) => (
        <mesh key={`floor-edge-${side}`} position={[side * 0.55, 0.06, 0.2]} material={carMaterials.carbonAccent}>
          <boxGeometry args={[0.15, 0.03, 2.0]} />
        </mesh>
      ))}

      {/* ── Diffuser ── */}
      <mesh position={[0, 0.1, -1.5]} rotation={[-0.25, 0, 0]} material={carMaterials.carbon}>
        <boxGeometry args={[0.95, 0.03, 0.6]} />
      </mesh>
      {/* Diffuser fins */}
      {[-0.3, -0.1, 0.1, 0.3].map((offset) => (
        <mesh key={`dfin-${offset}`} position={[offset, 0.1, -1.5]} rotation={[-0.25, 0, 0]} material={carMaterials.carbonAccent}>
          <boxGeometry args={[0.015, 0.12, 0.55]} />
        </mesh>
      ))}

      {/* ── Front Wing ── */}
      <group position={[0, 0.06, 2.5]}>
        {/* Main plane */}
        <mesh material={carMaterials.red}>
          <boxGeometry args={[1.8, 0.015, 0.25]} />
        </mesh>
        {/* Flap elements */}
        <mesh position={[0, 0.025, -0.08]} rotation={[0.12, 0, 0]} material={carMaterials.carbon}>
          <boxGeometry args={[1.75, 0.012, 0.18]} />
        </mesh>
        <mesh position={[0, 0.045, -0.14]} rotation={[0.2, 0, 0]} material={carMaterials.carbon}>
          <boxGeometry args={[1.6, 0.01, 0.14]} />
        </mesh>
        {/* End plates */}
        {[-1, 1].map((side) => (
          <mesh key={`fw-ep-${side}`} position={[side * 0.9, 0.03, -0.05]} material={carMaterials.white}>
            <boxGeometry args={[0.02, 0.08, 0.35]} />
          </mesh>
        ))}
        {/* Nose support */}
        <mesh position={[0, 0.05, 0]} material={carMaterials.carbon}>
          <boxGeometry args={[0.15, 0.06, 0.12]} />
        </mesh>
      </group>

      {/* ── Rear Wing ── */}
      <group position={[0, 0.52, -1.35]}>
        {/* Main plane */}
        <mesh material={carMaterials.red}>
          <boxGeometry args={[0.85, 0.015, 0.2]} />
        </mesh>
        {/* DRS Flap */}
        <mesh position={[0, 0.03, -0.06]} rotation={[drsAngle, 0, 0]} material={carMaterials.carbon}>
          <boxGeometry args={[0.82, 0.012, 0.15]} />
        </mesh>
        {/* End plates */}
        {[-1, 1].map((side) => (
          <mesh key={`rw-ep-${side}`} position={[side * 0.43, -0.02, 0]} material={carMaterials.white}>
            <boxGeometry args={[0.02, 0.14, 0.3]} />
          </mesh>
        ))}
        {/* Support pillars */}
        {[-1, 1].map((side) => (
          <mesh key={`rw-pillar-${side}`} position={[side * 0.15, -0.15, 0.05]} material={carMaterials.carbon}>
            <boxGeometry args={[0.03, 0.25, 0.04]} />
          </mesh>
        ))}
      </group>

      {/* ── Wheels with Covers ── */}
      {[
        { x: 0.7, z: 1.6, label: 'fl' },
        { x: -0.7, z: 1.6, label: 'fr' },
        { x: 0.72, z: -0.9, label: 'rl' },
        { x: -0.72, z: -0.9, label: 'rr' },
      ].map((wheel) => (
        <group key={wheel.label} position={[wheel.x, 0.16, wheel.z]}>
          {/* Tire */}
          <mesh rotation={[0, 0, Math.PI / 2]} material={carMaterials.tire}>
            <cylinderGeometry args={[0.17, 0.17, 0.2, 24]} />
          </mesh>
          {/* Wheel cover */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[wheel.x > 0 ? 0.005 : -0.005, 0, 0]} material={carMaterials.carbon}>
            <cylinderGeometry args={[0.14, 0.14, 0.21, 24]} />
          </mesh>
          {/* Hub */}
          <mesh rotation={[0, 0, Math.PI / 2]} material={carMaterials.metal}>
            <cylinderGeometry args={[0.04, 0.04, 0.22, 12]} />
          </mesh>
        </group>
      ))}

      {/* ── Rear Light ── */}
      <mesh position={[0, 0.22, -1.65]}>
        <boxGeometry args={[0.5, 0.04, 0.02]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>

      {/* ── T-Camera ── */}
      <mesh position={[0, 0.42, 0.1]} material={carMaterials.carbon}>
        <boxGeometry args={[0.06, 0.05, 0.08]} />
      </mesh>

      {/* ── Air intake (above engine) ── */}
      <mesh position={[0, 0.38, -0.1]} material={carMaterials.carbonAccent}>
        <boxGeometry args={[0.2, 0.12, 0.3]} />
      </mesh>

      {/* ── Bargeboard area ── */}
      {[-1, 1].map((side) => (
        <mesh key={`barge-${side}`} position={[side * 0.42, 0.15, 0.7]} material={carMaterials.carbonAccent}>
          <boxGeometry args={[0.02, 0.12, 0.4]} />
        </mesh>
      ))}
    </group>
  );
}
