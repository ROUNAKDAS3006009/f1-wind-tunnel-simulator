/**
 * F1CarModel — Loads external GLB model and auto-generates 3D Voxel Grid for Fluid Solver
 * 
 * Works with any model geometry, converting it into a boundary field.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useSimulationStore } from '../store/simulation';
import type { CarYear } from './F1CarGeometry';
import { voxelizeMesh } from '../physics/MeshVoxelizer';

interface F1CarModelProps {
  year: CarYear;
  drsOpen?: boolean;
}

// Pre-load the model
useGLTF.preload('/models/f1_car.glb');

export default function F1CarModel({ year, drsOpen = false }: F1CarModelProps) {
  const { scene } = useGLTF('/models/f1_car.glb');
  const groupRef = useRef<THREE.Group>(null);
  const config = useSimulationStore((s) => s.windTunnelConfig);
  const setFluidGridParams = useSimulationStore((s) => s.setFluidGridParams);

  // Scale to fit wind tunnel (F1 car ~5.6m → ~1.85 scene units)
  const modelScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetLength = 1.85;
    const currentLength = Math.max(size.x, size.y, size.z);
    return targetLength / currentLength;
  }, [scene]);

  // Determine model orientation
  const { modelRotationY, modelOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    let rotY = Math.PI; 
    if (size.x > size.z * 1.5) rotY = Math.PI / 2;

    const offset: [number, number, number] = [
      -center.x * modelScale,
      -box.min.y * modelScale,
      -center.z * modelScale,
    ];

    return { modelRotationY: rotY, modelOffset: offset };
  }, [scene, modelScale]);

  // Ride height offset in scene units
  const rideHeightOffset = useMemo(() => {
    return ((config.rideHeight || 40) - 40) * 0.0004;
  }, [config.rideHeight]);

  const yearScale = year === 2026 ? 0.95 : 1.0;

  // Generate 3D Fluid Grid Field Phase
  useEffect(() => {
    if (!scene) return;

    // We clone the scene temporarily to place it exactly where it is in world space
    // to build the correct spatial voxel grid.
    const tempGroup = scene.clone();
    const s = modelScale * yearScale;
    tempGroup.scale.set(s, s, s);
    tempGroup.position.set(modelOffset[0], modelOffset[1] + rideHeightOffset, modelOffset[2]);
    tempGroup.rotation.set(0, modelRotationY, 0);

    // To simulate different wing angles visually and physically,
    // we would ideally rotate the sub-meshes here.
    // For universal models, we strictly voxelize the current transform.
    tempGroup.updateMatrixWorld(true);

    // Define CFD Domain (matches WindTunnelScene visual bounds)
    const sceneMin = new THREE.Vector3(-2.0, 0.0, -4.0);
    const sceneMax = new THREE.Vector3(2.0, 2.0, 5.0);
    
    // CFD Grid Resolution (trading precision for performance)
    // 60 x 30 x 135 = 243,000 voxels (fast enough for real-time JS loop)
    const gridX = 60, gridY = 30, gridZ = 135;

    console.time('MeshVoxelizer');
    const voxelGrid = voxelizeMesh(tempGroup, gridX, gridY, gridZ, sceneMin, sceneMax);
    console.timeEnd('MeshVoxelizer');
    
    console.log(`[F1CarModel] CFD Grid Generated: ${voxelGrid.solid.length} cells.`);

    // Send boundaries to physics worker
    let worker = (window as any).physicsWorker as Worker;
    if (worker) {
      worker.postMessage({
        type: 'INIT_FLUID_GRID',
        width: gridX,
        height: gridY,
        depth: gridZ,
        solid: voxelGrid.solid,
        normals: voxelGrid.normals
      });
    }

    setFluidGridParams({
      width: gridX, height: gridY, depth: gridZ,
      minX: sceneMin.x, maxX: sceneMax.x,
      minY: sceneMin.y, maxY: sceneMax.y,
      minZ: sceneMin.z, maxZ: sceneMax.z,
    });

  }, [scene, modelScale, modelOffset, modelRotationY, yearScale, rideHeightOffset, setFluidGridParams]);

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.isMeshStandardMaterial) {
          mat.roughness = Math.min(mat.roughness, 0.25);
          mat.metalness = Math.max(mat.metalness, 0.15);
          mat.envMapIntensity = 1.5;
          mat.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  const finalScale = modelScale * yearScale;

  return (
    <group ref={groupRef}>
      <primitive
        object={scene}
        scale={[finalScale, finalScale, finalScale]}
        position={[modelOffset[0], modelOffset[1] + rideHeightOffset, modelOffset[2]]}
        rotation={[0, modelRotationY, 0]}
        castShadow
        receiveShadow
      />
    </group>
  );
}
