/**
 * F1CarGeometry — High-fidelity procedural 2025 F1 car
 * 
 * Uses smooth CatmullRom spline profiles, proper airfoil sections,
 * and high-poly geometry for a recognizable F1 car silhouette.
 * 
 * Scale: ~1:3 in scene units. Car nose at +Z, rear at -Z.
 */

import * as THREE from 'three';

export type CarYear = 2024 | 2025 | 2026;

export interface CarSurfaceZone {
  name: string;
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
  deflectY: number;
  deflectX: number;
  slowdown: number;
  turbulence: number;
  isWing: boolean;
  isUnderbody: boolean;
}

// ─── Materials ───────────────────────────────────────────────────────

function createCarMaterials() {
  return {
    bodyMain: new THREE.MeshPhysicalMaterial({
      color: '#1a1a20', roughness: 0.15, metalness: 0.25,
      clearcoat: 1.0, clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
    }),
    bodyAccent: new THREE.MeshPhysicalMaterial({
      color: '#252530', roughness: 0.2, metalness: 0.2,
      clearcoat: 0.9, clearcoatRoughness: 0.08,
    }),
    silverLivery: new THREE.MeshPhysicalMaterial({
      color: '#9aa0b0', roughness: 0.1, metalness: 0.7,
      clearcoat: 1.0, clearcoatRoughness: 0.03,
      envMapIntensity: 2.0,
    }),
    wingRed: new THREE.MeshPhysicalMaterial({
      color: '#cc1100', roughness: 0.2, metalness: 0.15,
      clearcoat: 0.85, clearcoatRoughness: 0.08,
    }),
    wingWhite: new THREE.MeshPhysicalMaterial({
      color: '#e8e8e8', roughness: 0.15, metalness: 0.1,
      clearcoat: 0.8,
    }),
    tire: new THREE.MeshStandardMaterial({
      color: '#0e0e0e', roughness: 0.88, metalness: 0.0,
    }),
    wheelMetal: new THREE.MeshStandardMaterial({
      color: '#4a4a55', roughness: 0.12, metalness: 0.9,
    }),
    wheelCover: new THREE.MeshPhysicalMaterial({
      color: '#1e1e22', roughness: 0.2, metalness: 0.15,
      clearcoat: 0.7,
    }),
    halo: new THREE.MeshStandardMaterial({
      color: '#888899', roughness: 0.08, metalness: 0.95,
    }),
    suspension: new THREE.MeshStandardMaterial({
      color: '#3a3a3a', roughness: 0.3, metalness: 0.6,
    }),
    rearLight: new THREE.MeshStandardMaterial({
      color: '#ff0000', emissive: '#ff2200', emissiveIntensity: 1.2,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#6688aa', roughness: 0, metalness: 0.05,
      transparent: true, opacity: 0.2, transmission: 0.85,
    }),
    floor: new THREE.MeshPhysicalMaterial({
      color: '#181818', roughness: 0.4, metalness: 0.1,
    }),
  };
}

// ─── Smooth body profile from spline ─────────────────────────────────

function createBodyMeshFromSpline(
  topProfile: THREE.Vector2[],   // z,y pairs for top edge
  bottomProfile: THREE.Vector2[], // z,y pairs for bottom edge
  widthProfile: THREE.Vector2[],  // z,halfWidth pairs
  segments: number = 40,
): THREE.BufferGeometry {
  const topCurve = new THREE.CatmullRomCurve3(
    topProfile.map(p => new THREE.Vector3(0, p.y, p.x)), false, 'catmullrom', 0.3
  );
  const bottomCurve = new THREE.CatmullRomCurve3(
    bottomProfile.map(p => new THREE.Vector3(0, p.y, p.x)), false, 'catmullrom', 0.3
  );
  const widthCurve = new THREE.CatmullRomCurve3(
    widthProfile.map(p => new THREE.Vector3(p.y, 0, p.x)), false, 'catmullrom', 0.3
  );

  const perimeterPoints = 16; // Points around each cross-section
  const verts: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const top = topCurve.getPoint(t);
    const bot = bottomCurve.getPoint(t);
    const wid = widthCurve.getPoint(t);
    const hw = Math.abs(wid.x); // half-width at this station
    const yTop = top.y;
    const yBot = bot.y;
    const yMid = (yTop + yBot) / 2;
    const halfH = (yTop - yBot) / 2;

    // Generate elliptical cross-section
    for (let j = 0; j <= perimeterPoints; j++) {
      const a = (j / perimeterPoints) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);

      // Elliptical with flat bottom bias
      let x = hw * cos;
      let y = yMid + halfH * sin;
      // Flatten the bottom to simulate flat floor
      if (sin < -0.3) {
        y = yBot + (y - yBot) * 0.3;
      }

      verts.push(x, y, top.z);
      // Approximate normal
      normals.push(cos, sin * 0.8, 0);
    }
  }

  // Create faces
  const ringSize = perimeterPoints + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < perimeterPoints; j++) {
      const a = i * ringSize + j;
      const b = a + 1;
      const c = (i + 1) * ringSize + j;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─── Main geometry builder ───────────────────────────────────────────

export interface CarGeometryResult {
  meshes: {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    position: [number, number, number];
    rotation: [number, number, number];
    name: string;
  }[];
  zones: CarSurfaceZone[];
}

export function buildCarGeometry(year: CarYear, drsOpen: boolean = false): CarGeometryResult {
  const mat = createCarMaterials();
  const meshes: CarGeometryResult['meshes'] = [];
  const zones: CarSurfaceZone[] = [];

  // Scale factor
  const S = 0.33;
  const isCompact = year === 2026;
  const wScale = isCompact ? 0.95 : 1.0;
  const lScale = isCompact ? 0.94 : 1.0;

  // ━━━━━ 1. MAIN BODY — smooth spline-based monocoque ━━━━━━━━━━━━━━━
  const bodyTop: THREE.Vector2[] = [
    new THREE.Vector2(2.6 * S * lScale, 0.16 * S),   // nose tip (low)
    new THREE.Vector2(2.3 * S * lScale, 0.22 * S),   // nose slope up
    new THREE.Vector2(1.8 * S * lScale, 0.28 * S),   // nose peak
    new THREE.Vector2(1.2 * S * lScale, 0.32 * S),   // front bulkhead
    new THREE.Vector2(0.5 * S * lScale, 0.38 * S),   // cockpit front
    new THREE.Vector2(0.2 * S * lScale, 0.42 * S),   // cockpit highest
    new THREE.Vector2(-0.1 * S * lScale, 0.40 * S),  // behind driver
    new THREE.Vector2(-0.5 * S * lScale, 0.42 * S),  // air intake
    new THREE.Vector2(-0.9 * S * lScale, 0.38 * S),  // engine cover
    new THREE.Vector2(-1.3 * S * lScale, 0.30 * S),  // engine taper
    new THREE.Vector2(-1.7 * S * lScale, 0.22 * S),  // rear end
  ];

  const bodyBottom: THREE.Vector2[] = [
    new THREE.Vector2(2.6 * S * lScale, 0.06 * S),
    new THREE.Vector2(2.3 * S * lScale, 0.055 * S),
    new THREE.Vector2(1.8 * S * lScale, 0.05 * S),
    new THREE.Vector2(1.2 * S * lScale, 0.05 * S),
    new THREE.Vector2(0.5 * S * lScale, 0.05 * S),
    new THREE.Vector2(0.2 * S * lScale, 0.05 * S),
    new THREE.Vector2(-0.1 * S * lScale, 0.05 * S),
    new THREE.Vector2(-0.5 * S * lScale, 0.05 * S),
    new THREE.Vector2(-0.9 * S * lScale, 0.05 * S),
    new THREE.Vector2(-1.3 * S * lScale, 0.06 * S),
    new THREE.Vector2(-1.7 * S * lScale, 0.08 * S),
  ];

  const bodyWidth: THREE.Vector2[] = [
    new THREE.Vector2(2.6 * S * lScale, 0.06 * S * wScale),   // nose very narrow
    new THREE.Vector2(2.3 * S * lScale, 0.10 * S * wScale),
    new THREE.Vector2(1.8 * S * lScale, 0.15 * S * wScale),
    new THREE.Vector2(1.2 * S * lScale, 0.18 * S * wScale),
    new THREE.Vector2(0.5 * S * lScale, 0.20 * S * wScale),   // widest at cockpit
    new THREE.Vector2(0.2 * S * lScale, 0.20 * S * wScale),
    new THREE.Vector2(-0.1 * S * lScale, 0.19 * S * wScale),
    new THREE.Vector2(-0.5 * S * lScale, 0.16 * S * wScale),
    new THREE.Vector2(-0.9 * S * lScale, 0.14 * S * wScale),  // taper toward rear
    new THREE.Vector2(-1.3 * S * lScale, 0.10 * S * wScale),
    new THREE.Vector2(-1.7 * S * lScale, 0.07 * S * wScale),  // rear narrow
  ];

  const bodyGeo = createBodyMeshFromSpline(bodyTop, bodyBottom, bodyWidth, 48);
  meshes.push({ geometry: bodyGeo, material: mat.bodyMain, position: [0, 0, 0], rotation: [0, 0, 0], name: 'body' });

  zones.push({
    name: 'monocoque',
    minX: -0.20 * S * wScale, maxX: 0.20 * S * wScale,
    minY: 0.05 * S, maxY: 0.42 * S,
    minZ: -1.7 * S * lScale, maxZ: 2.6 * S * lScale,
    deflectY: 0.35, deflectX: 0.7, slowdown: 0.4, turbulence: 0.04,
    isWing: false, isUnderbody: false,
  });

  // ━━━━━ 2. SIDEPODS — smooth tapered intakes ━━━━━━━━━━━━━━━━━━━━━━
  for (const side of [-1, 1]) {
    const spW = 0.22 * S * wScale;
    const spH = 0.18 * S;
    const spLen = 1.2 * S * lScale;
    const spX = side * (0.22 * S * wScale);
    const spStartZ = 0.6 * S * lScale;

    // Sidepod body — rounded box with bevels
    const spGeo = new THREE.BoxGeometry(spW, spH, spLen, 4, 4, 8);
    // Round the edges by modifying vertices
    const spPos = spGeo.attributes.position;
    for (let i = 0; i < spPos.count; i++) {
      const x = spPos.getX(i);
      const y = spPos.getY(i);
      const z = spPos.getZ(i);
      // Taper toward rear
      const taper = 1 - Math.max(0, (-z / (spLen / 2))) * 0.4;
      spPos.setX(i, x * taper);
      spPos.setY(i, y * taper);
      // Round top edge
      if (y > spH * 0.4) {
        const roundFactor = 1 - (y - spH * 0.4) / (spH * 0.6);
        spPos.setX(i, x * (0.7 + 0.3 * roundFactor));
      }
    }
    spGeo.computeVertexNormals();

    meshes.push({
      geometry: spGeo, material: mat.bodyAccent,
      position: [spX + side * spW * 0.45, 0.14 * S, spStartZ - spLen * 0.35],
      rotation: [0, 0, 0], name: `sidepod-${side > 0 ? 'R' : 'L'}`,
    });

    // Sidepod inlet opening
    const inletGeo = new THREE.BoxGeometry(spW * 0.7, spH * 0.5, 0.015);
    meshes.push({
      geometry: inletGeo, material: mat.bodyMain,
      position: [spX + side * spW * 0.45, 0.22 * S, spStartZ + 0.01],
      rotation: [0.1, 0, 0], name: `inlet-${side > 0 ? 'R' : 'L'}`,
    });

    zones.push({
      name: `sidepod-${side > 0 ? 'R' : 'L'}`,
      minX: spX, maxX: spX + side * spW,
      minY: 0.05 * S, maxY: 0.26 * S,
      minZ: spStartZ - spLen, maxZ: spStartZ,
      deflectY: 0.2, deflectX: 0.9 * side, slowdown: 0.45, turbulence: 0.1,
      isWing: false, isUnderbody: false,
    });
  }

  // ━━━━━ 3. FLOOR — flat underbody with edges ━━━━━━━━━━━━━━━━━━━━━━
  const floorW = 0.58 * S * wScale;
  const floorLen = 2.8 * S * lScale;
  const floorGeo = new THREE.BoxGeometry(floorW, 0.008, floorLen);
  meshes.push({ geometry: floorGeo, material: mat.floor, position: [0, 0.04 * S, -0.1 * S], rotation: [0, 0, 0], name: 'floor' });

  // Floor edge vanes
  for (const side of [-1, 1]) {
    const edgeGeo = new THREE.BoxGeometry(0.012, 0.02, floorLen * 0.8);
    meshes.push({
      geometry: edgeGeo, material: mat.bodyAccent,
      position: [side * floorW * 0.52, 0.05 * S, 0],
      rotation: [0, 0, 0], name: `floor-edge-${side > 0 ? 'R' : 'L'}`,
    });
  }

  zones.push({
    name: 'floor', minX: -floorW / 2, maxX: floorW / 2,
    minY: 0.01, maxY: 0.05 * S, minZ: -0.1 * S - floorLen / 2, maxZ: -0.1 * S + floorLen / 2,
    deflectY: -0.15, deflectX: 0.0, slowdown: 0.7, turbulence: 0.02,
    isWing: false, isUnderbody: true,
  });

  // ━━━━━ 4. FRONT WING — multi-element with endplates ━━━━━━━━━━━━━
  const fwZ = 2.65 * S * lScale;
  const fwW = 0.95 * S * wScale;
  const fwChord = 0.09 * S;

  // Main plane
  const fwMainGeo = new THREE.BoxGeometry(fwW * 2, 0.004, fwChord, 1, 1, 1);
  // Curve the main plane slightly
  const fwMainPos = fwMainGeo.attributes.position;
  for (let i = 0; i < fwMainPos.count; i++) {
    const x = fwMainPos.getX(i);
    const camber = -0.008 * Math.sin((x / fwW + 0.5) * Math.PI);
    fwMainPos.setY(i, fwMainPos.getY(i) + camber);
  }
  fwMainGeo.computeVertexNormals();
  meshes.push({ geometry: fwMainGeo, material: mat.wingRed, position: [0, 0.035 * S, fwZ], rotation: [0.06, 0, 0], name: 'fw-main' });

  // Second element
  const fwFlap1 = new THREE.BoxGeometry(fwW * 1.9, 0.003, fwChord * 0.65);
  meshes.push({ geometry: fwFlap1, material: mat.bodyMain, position: [0, 0.045 * S, fwZ - fwChord * 0.6], rotation: [0.14, 0, 0], name: 'fw-flap1' });

  // Third element
  const fwFlap2 = new THREE.BoxGeometry(fwW * 1.75, 0.003, fwChord * 0.45);
  meshes.push({ geometry: fwFlap2, material: mat.bodyMain, position: [0, 0.055 * S, fwZ - fwChord * 1.0], rotation: [0.22, 0, 0], name: 'fw-flap2' });

  // Endplates
  for (const side of [-1, 1]) {
    const epGeo = new THREE.BoxGeometry(0.004, 0.04, fwChord * 2.2);
    meshes.push({ geometry: epGeo, material: mat.wingWhite, position: [side * fwW, 0.04 * S, fwZ - fwChord * 0.3], rotation: [0, 0, 0], name: `fw-ep-${side > 0 ? 'R' : 'L'}` });
  }

  // Nose connection to front wing
  const noseConnGeo = new THREE.BoxGeometry(0.025, 0.025, fwChord * 0.6);
  meshes.push({ geometry: noseConnGeo, material: mat.bodyMain, position: [0, 0.045 * S, fwZ - 0.01], rotation: [0, 0, 0], name: 'fw-nose-conn' });

  zones.push({
    name: 'front-wing', minX: -fwW, maxX: fwW,
    minY: 0.02, maxY: 0.07 * S,
    minZ: fwZ - fwChord * 1.5, maxZ: fwZ + fwChord * 0.5,
    deflectY: -0.6, deflectX: 0.3, slowdown: 0.35, turbulence: 0.15,
    isWing: true, isUnderbody: false,
  });

  // ━━━━━ 5. REAR WING — main plane + DRS flap ━━━━━━━━━━━━━━━━━━━━
  const rwZ = -1.55 * S * lScale;
  const rwW = 0.48 * S * wScale;
  const rwChord = 0.06 * S;
  const rwY = 0.50 * S;

  // Main plane
  const rwMainGeo = new THREE.BoxGeometry(rwW * 2, 0.004, rwChord);
  meshes.push({ geometry: rwMainGeo, material: mat.wingRed, position: [0, rwY, rwZ], rotation: [0, 0, 0], name: 'rw-main' });

  // DRS flap
  const drsAngle = drsOpen ? -0.4 : 0;
  const rwFlapGeo = new THREE.BoxGeometry(rwW * 1.92, 0.003, rwChord * 0.65);
  meshes.push({
    geometry: rwFlapGeo, material: mat.bodyMain,
    position: [0, rwY + 0.012, rwZ - rwChord * 0.5],
    rotation: [drsAngle, 0, 0], name: 'rw-flap',
  });

  // Endplates
  for (const side of [-1, 1]) {
    const rwEpGeo = new THREE.BoxGeometry(0.004, 0.055, rwChord * 2.5);
    meshes.push({
      geometry: rwEpGeo, material: mat.wingWhite,
      position: [side * rwW, rwY - 0.01, rwZ - rwChord * 0.2],
      rotation: [0, 0, 0], name: `rw-ep-${side > 0 ? 'R' : 'L'}`,
    });
  }

  // Swan-neck support pillars
  for (const side of [-1, 1]) {
    const pillarGeo = new THREE.CylinderGeometry(0.004, 0.004, rwY * 0.38, 8);
    meshes.push({
      geometry: pillarGeo, material: mat.bodyMain,
      position: [side * rwW * 0.3, rwY * 0.78, rwZ + rwChord * 0.2],
      rotation: [0.1, 0, 0], name: `rw-pillar-${side > 0 ? 'R' : 'L'}`,
    });
  }

  // Beam wing (2024/2025 only)
  if (year !== 2026) {
    const bwGeo = new THREE.BoxGeometry(rwW * 1.7, 0.003, rwChord * 0.6);
    meshes.push({
      geometry: bwGeo, material: mat.bodyMain,
      position: [0, rwY * 0.55, rwZ], rotation: [0.04, 0, 0], name: 'beam-wing',
    });
  }

  zones.push({
    name: 'rear-wing', minX: -rwW, maxX: rwW,
    minY: rwY - 0.04, maxY: rwY + 0.04,
    minZ: rwZ - rwChord * 1.5, maxZ: rwZ + rwChord,
    deflectY: 0.8, deflectX: 0.2, slowdown: 0.3, turbulence: 0.2,
    isWing: true, isUnderbody: false,
  });

  // ━━━━━ 6. DIFFUSER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const diffW = floorW * 0.88;
  const diffLen = 0.35 * S * lScale;
  const diffGeo = new THREE.BoxGeometry(diffW, 0.06 * S, diffLen, 1, 1, 1);
  // Angle upward toward rear
  const diffPos = diffGeo.attributes.position;
  for (let i = 0; i < diffPos.count; i++) {
    const z = diffPos.getZ(i);
    if (z < 0) diffPos.setY(i, diffPos.getY(i) + 0.02);
  }
  diffGeo.computeVertexNormals();
  meshes.push({
    geometry: diffGeo, material: mat.bodyMain,
    position: [0, 0.06 * S, -1.65 * S * lScale],
    rotation: [-0.18, 0, 0], name: 'diffuser',
  });

  // Diffuser strakes
  for (const off of [-0.25, -0.08, 0.08, 0.25]) {
    const strakeGeo = new THREE.BoxGeometry(0.002, 0.05, diffLen * 0.92);
    meshes.push({
      geometry: strakeGeo, material: mat.bodyAccent,
      position: [off * diffW, 0.07 * S, -1.65 * S * lScale],
      rotation: [-0.18, 0, 0], name: `strake-${off}`,
    });
  }

  zones.push({
    name: 'diffuser', minX: -diffW / 2, maxX: diffW / 2,
    minY: 0.02, maxY: 0.1 * S,
    minZ: -1.85 * S * lScale, maxZ: -1.5 * S * lScale,
    deflectY: 0.5, deflectX: 0.3, slowdown: 0.6, turbulence: 0.25,
    isWing: false, isUnderbody: false,
  });

  // ━━━━━ 7. HALO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const haloRadius = 0.07 * S;
  const haloGeo = new THREE.TorusGeometry(haloRadius, 0.006, 8, 32, Math.PI);
  meshes.push({ geometry: haloGeo, material: mat.halo, position: [0, 0.38 * S, 0.35 * S * lScale], rotation: [0, 0, 0], name: 'halo-ring' });

  // Halo central pillar
  const haloPillarGeo = new THREE.CylinderGeometry(0.005, 0.005, haloRadius * 2.5, 6);
  haloPillarGeo.rotateX(Math.PI / 2);
  meshes.push({ geometry: haloPillarGeo, material: mat.halo, position: [0, 0.36 * S, 0.48 * S * lScale], rotation: [-0.12, 0, 0], name: 'halo-pillar' });

  // Cockpit opening
  const cockpitGeo = new THREE.BoxGeometry(0.10 * S, 0.003, 0.12 * S);
  meshes.push({ geometry: cockpitGeo, material: mat.glass, position: [0, 0.39 * S, 0.33 * S * lScale], rotation: [0, 0, 0], name: 'cockpit' });

  // ━━━━━ 8. AIR INTAKE (roll hoop) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const intakeGeo = new THREE.BoxGeometry(0.06 * S * wScale, 0.06 * S, 0.08 * S, 2, 2, 2);
  // Round it
  const intPos = intakeGeo.attributes.position;
  for (let i = 0; i < intPos.count; i++) {
    const x = intPos.getX(i);
    const y = intPos.getY(i);
    const dist = Math.sqrt(x * x + y * y);
    if (dist > 0) {
      const factor = 0.85 + 0.15 * Math.cos(Math.atan2(y, x) * 2);
      intPos.setX(i, x * factor);
      intPos.setY(i, y * factor);
    }
  }
  intakeGeo.computeVertexNormals();
  meshes.push({ geometry: intakeGeo, material: mat.bodyAccent, position: [0, 0.42 * S, -0.05 * S * lScale], rotation: [0, 0, 0], name: 'air-intake' });

  // ━━━━━ 9. WHEELS — recognizable tires with covers ━━━━━━━━━━━━━━━
  const tireDiam = 0.72 * S * (isCompact ? 0.94 : 1.0);
  const frontAxleZ = 1.5 * S * lScale;
  const rearAxleZ = -0.85 * S * lScale;
  const trackHW = 0.95 * S * wScale;
  const fTireW = 0.10 * S * (isCompact ? 0.92 : 1.0);
  const rTireW = 0.13 * S * (isCompact ? 0.92 : 1.0);

  const wheels = [
    { x: trackHW * 0.75, z: frontAxleZ, tw: fTireW, label: 'FR', isRear: false },
    { x: -trackHW * 0.75, z: frontAxleZ, tw: fTireW, label: 'FL', isRear: false },
    { x: trackHW * 0.78, z: rearAxleZ, tw: rTireW, label: 'RR', isRear: true },
    { x: -trackHW * 0.78, z: rearAxleZ, tw: rTireW, label: 'RL', isRear: true },
  ];

  for (const w of wheels) {
    const tr = tireDiam / 2;

    // Tire — torus for realistic rounded profile
    const tireGeo = new THREE.TorusGeometry(tr * 0.75, tr * 0.28, 12, 32);
    tireGeo.rotateY(Math.PI / 2);
    meshes.push({ geometry: tireGeo, material: mat.tire, position: [w.x, tr, w.z], rotation: [0, 0, 0], name: `tire-${w.label}` });

    // Wheel cover — disc
    const coverGeo = new THREE.CylinderGeometry(tr * 0.72, tr * 0.72, w.tw * 0.6, 24);
    coverGeo.rotateZ(Math.PI / 2);
    meshes.push({ geometry: coverGeo, material: mat.wheelCover, position: [w.x, tr, w.z], rotation: [0, 0, 0], name: `cover-${w.label}` });

    // Hub center
    const hubGeo = new THREE.CylinderGeometry(tr * 0.15, tr * 0.15, w.tw * 0.7, 8);
    hubGeo.rotateZ(Math.PI / 2);
    meshes.push({ geometry: hubGeo, material: mat.wheelMetal, position: [w.x, tr, w.z], rotation: [0, 0, 0], name: `hub-${w.label}` });

    zones.push({
      name: `wheel-${w.label}`,
      minX: w.x - w.tw * 0.8, maxX: w.x + w.tw * 0.8,
      minY: 0, maxY: tireDiam,
      minZ: w.z - tr, maxZ: w.z + tr,
      deflectY: 0.2, deflectX: (w.x > 0 ? 1 : -1) * 0.7,
      slowdown: 0.4, turbulence: w.isRear ? 0.35 : 0.3,
      isWing: false, isUnderbody: false,
    });

    // Suspension arms — visible wishbones
    const suspLen = Math.abs(w.x) * 0.55;
    const suspGeo = new THREE.CylinderGeometry(0.003, 0.003, suspLen, 4);
    suspGeo.rotateZ(Math.PI / 2);
    // Upper wishbone
    meshes.push({
      geometry: suspGeo.clone(), material: mat.suspension,
      position: [w.x * 0.6, tr * 1.1, w.z + tr * 0.2],
      rotation: [0, 0.15 * (w.isRear ? -1 : 1), 0],
      name: `susp-upper-${w.label}`,
    });
    // Lower wishbone
    meshes.push({
      geometry: suspGeo.clone(), material: mat.suspension,
      position: [w.x * 0.6, tr * 0.5, w.z - tr * 0.15],
      rotation: [0, -0.08 * (w.isRear ? -1 : 1), 0],
      name: `susp-lower-${w.label}`,
    });

    // Tire arches (2024/2025 only, front wheels)
    if (year !== 2026 && !w.isRear) {
      const archGeo = new THREE.TorusGeometry(tr * 0.95, 0.004, 4, 16, Math.PI);
      meshes.push({
        geometry: archGeo, material: mat.bodyMain,
        position: [w.x, tr, w.z],
        rotation: [Math.PI / 2, 0, 0], name: `arch-${w.label}`,
      });
    }
  }

  // ━━━━━ 10. REAR LIGHT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const rlGeo = new THREE.BoxGeometry(0.12, 0.006, 0.004);
  meshes.push({ geometry: rlGeo, material: mat.rearLight, position: [0, 0.20 * S, -1.78 * S * lScale], rotation: [0, 0, 0], name: 'rear-light' });

  // ━━━━━ 11. T-CAMERA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const tcGeo = new THREE.BoxGeometry(0.012, 0.014, 0.016);
  meshes.push({ geometry: tcGeo, material: mat.bodyMain, position: [0, 0.44 * S, -0.02 * S], rotation: [0, 0, 0], name: 't-camera' });

  // ━━━━━ 12. BARGEBOARDS / TURNING VANES ━━━━━━━━━━━━━━━━━━━━━━━━━
  for (const side of [-1, 1]) {
    const bgGeo = new THREE.BoxGeometry(0.002, 0.03, 0.1 * S);
    meshes.push({
      geometry: bgGeo, material: mat.bodyAccent,
      position: [side * 0.16 * S * wScale, 0.12 * S, 0.65 * S * lScale],
      rotation: [0, side * 0.06, 0], name: `bargeboard-${side > 0 ? 'R' : 'L'}`,
    });
  }

  return { meshes, zones };
}

export function getYearInfo(year: CarYear): { name: string; regs: string; changes: string[] } {
  switch (year) {
    case 2024: return {
      name: '2024 F1 Car', regs: 'Ground Effect Era — FIA 2022-2024 Regulations',
      changes: ['Ground-effect aerodynamics', 'Beam wing present', 'Front tire arches', '798 kg minimum weight', 'DRS rear wing', 'Undercut sidepods'],
    };
    case 2025: return {
      name: '2025 F1 Car', regs: 'Refined Ground Effect — FIA 2025 Regulations',
      changes: ['Stricter wing flex tests', 'No mini-DRS allowed', '800 kg minimum weight', 'Reduced DRS slot gap', 'Downwash sidepods', 'Enhanced floor sealing'],
    };
    case 2026: return {
      name: '2026 F1 Car', regs: 'Active Aero Era — FIA 2026 Regulations',
      changes: ['Active front & rear wings (X/Z mode)', 'No DRS — replaced by active aero', '100mm narrower car', '200mm shorter wheelbase', 'No beam wing', 'No tire arches', '768 kg (30kg lighter)', 'Narrower tires', 'Compact sidepods', '50:50 ICE/electric split'],
    };
  }
}
