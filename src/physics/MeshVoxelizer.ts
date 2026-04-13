import * as THREE from 'three';

export interface VoxelGrid {
  width: number;
  height: number;
  depth: number;
  bounds: {
    min: THREE.Vector3;
    max: THREE.Vector3;
  };
  // 1D array of size width*height*depth. 0 = air, 1 = solid
  solid: Uint8Array;
  // 1D array of size width*height*depth*3. Stores surface normal for solid voxels
  normals: Float32Array;
}

/**
 * Voxelizes a THREE.Object3D into a 3D grid using Raycasting.
 * 
 * Works by casting rays downwards (Y-axis) through a grid of X,Z columns
 * and finding all entry/exit intersections to mark solid voxels.
 */
export function voxelizeMesh(
  object: THREE.Object3D,
  gridWidth: number,
  gridHeight: number,
  gridDepth: number,
  sceneMin: THREE.Vector3,
  sceneMax: THREE.Vector3
): VoxelGrid {
  const solid = new Uint8Array(gridWidth * gridHeight * gridDepth);
  const normals = new Float32Array(gridWidth * gridHeight * gridDepth * 3);

  // We must ensure the object has up-to-date world matrices
  object.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster();
  const dirDown = new THREE.Vector3(0, -1, 0);

  const sizeX = sceneMax.x - sceneMin.x;
  const sizeY = sceneMax.y - sceneMin.y;
  const sizeZ = sceneMax.z - sceneMin.z;

  const dx = sizeX / gridWidth;
  const dy = sizeY / gridHeight;
  const dz = sizeZ / gridDepth;

  // For raycasting to work reliably, we only want to intersect Mesh objects
  const meshes: THREE.Mesh[] = [];
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshes.push(child as THREE.Mesh);
    }
  });

  if (meshes.length === 0) {
    console.warn("MeshVoxelizer: No meshes found to voxelize.");
    return { width: gridWidth, height: gridHeight, depth: gridDepth, bounds: { min: sceneMin, max: sceneMax }, solid, normals };
  }

  const startY = sceneMax.y + dy; // Start slightly above the bounding box

  for (let ix = 0; ix < gridWidth; ix++) {
    for (let iz = 0; iz < gridDepth; iz++) {
      const worldX = sceneMin.x + (ix + 0.5) * dx;
      const worldZ = sceneMin.z + (iz + 0.5) * dz;

      const origin = new THREE.Vector3(worldX, startY, worldZ);
      raycaster.set(origin, dirDown);

      // Intersect against all meshes in the object
      const hits = raycaster.intersectObjects(meshes, false);

      // Sort hits by distance (closest first, i.e., highest Y to lowest Y)
      // THREE.Raycaster already sorts them, but we ensure it here.
      hits.sort((a, b) => a.distance - b.distance);

      // Process entry/exit pairs
      // A well-formed closed mesh will have an even number of hits.
      // If a ray hits an entering face, it's inside until it hits an exiting face.
      
      let isInside = false;
      let currentNormal = new THREE.Vector3(0, 1, 0); // default pointing up

      const yPositions = hits.map(h => h.point.y);
      const hitNormals = hits.map(h => h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize() : new THREE.Vector3(0, 1, 0));

      let hitIndex = 0;

      for (let iy = gridHeight - 1; iy >= 0; iy--) {
        const worldY = sceneMin.y + (iy + 0.5) * dy;

        // Check if we passed the next intersection point
        while (hitIndex < yPositions.length && worldY < yPositions[hitIndex]) {
          isInside = !isInside; // toggle state
          currentNormal = hitNormals[hitIndex];
          hitIndex++;
        }

        if (isInside) {
          const index = ix + iy * gridWidth + iz * gridWidth * gridHeight;
          solid[index] = 1;
          normals[index * 3] = currentNormal.x;
          normals[index * 3 + 1] = currentNormal.y;
          normals[index * 3 + 2] = currentNormal.z;
        }
      }
    }
  }

  return {
    width: gridWidth,
    height: gridHeight,
    depth: gridDepth,
    bounds: { min: sceneMin, max: sceneMax },
    solid,
    normals
  };
}
