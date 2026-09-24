import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { dedupeMaterials, mergeStaticSubtree, optimizeDecor } from '../rendering/SceneOptimizer';
import { KelpForest } from '../rendering/KelpForest';
import { SeaAnemones } from '../rendering/SeaAnemones';
import { CoralFormations } from '../rendering/CoralFormations';

/**
 * Regression gate for the defect that made the simulator unusable: the décor builders
 * produced one mesh and one material per detail element, and several of those materials
 * enabled `transmission`, which makes three.js render an extra pass of the whole scene
 * per transmissive object. Measured before the fix: 7,294 meshes, 4,440 materials, 2,290
 * transmissive meshes, 595 shader programs, ~6.6 seconds per frame.
 *
 * These budgets are deliberately set well above the current numbers so the test catches a
 * regression in kind, not ordinary content changes.
 */

function countMeshes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) count++;
  });
  return count;
}

function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) materials.push(...mesh.material);
    else materials.push(mesh.material);
  });
  return materials;
}

describe('décor draw-call budget', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    CoralFormations.lastReefPatches = [];
  });

  it('draws the whole kelp forest in a handful of meshes', () => {
    const forest = new KelpForest(scene, -30, 75);
    expect(countMeshes(scene)).toBeLessThanOrEqual(3);
    forest.dispose();
  });

  it('gives every kelp blade its sway parameters as vertex attributes', () => {
    new KelpForest(scene, -30, 20);
    const blades = scene.getObjectByName('kelpBlades') as THREE.Mesh;
    expect(blades).toBeDefined();
    expect(blades.geometry.getAttribute('aKelpSway')).toBeDefined();

    // A per-plant cache key compiles a separate shader program per plant. That is exactly
    // what produced 595 programs and a ~100 second startup stall.
    const material = blades.material as THREE.Material;
    expect(material.customProgramCacheKey?.()).toBe('kelp-gpu-sway');
  });

  it('draws the whole anemone colony in two meshes', () => {
    const anemones = new SeaAnemones(scene, -30, 55);
    expect(countMeshes(scene)).toBeLessThanOrEqual(2);
    anemones.dispose();
  });

  it('keeps transmission off the décor materials', () => {
    new KelpForest(scene, -30, 20);
    new SeaAnemones(scene, -30, 20);
    CoralFormations.createCoralReef(scene, -30, 20);

    for (const material of collectMaterials(scene)) {
      const transmission = (material as THREE.MeshPhysicalMaterial).transmission;
      expect(transmission ?? 0).toBe(0);
    }
  });
});

describe('SceneOptimizer', () => {
  it('collapses materials that render identically', () => {
    const group = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      group.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.5 })
        )
      );
    }
    expect(new Set(collectMaterials(group).map((m) => m.uuid)).size).toBe(10);

    dedupeMaterials(group);
    expect(new Set(collectMaterials(group).map((m) => m.uuid)).size).toBe(1);
  });

  it('keeps materials that differ apart', () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0xff0000 })));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x00ff00 })));

    dedupeMaterials(group);
    expect(new Set(collectMaterials(group).map((m) => m.uuid)).size).toBe(2);
  });

  it('merges a static subtree into one mesh per material and keeps world positions', () => {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x336699 });
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      mesh.position.set(i * 2, 0, 0);
      group.add(mesh);
    }

    const result = mergeStaticSubtree(group);
    expect(result.before).toBe(12);
    expect(result.after).toBe(1);

    const merged = group.children[0] as THREE.Mesh;
    merged.geometry.computeBoundingBox();
    const box = merged.geometry.boundingBox!;
    // Boxes span x = -0.5 .. 22.5 once the per-mesh translations are baked in.
    expect(box.min.x).toBeCloseTo(-0.5, 5);
    expect(box.max.x).toBeCloseTo(22.5, 5);
  });

  it('leaves children the caller marked as skipped alone', () => {
    const scene = new THREE.Scene();
    const articulated = new THREE.Group();
    const keep = new THREE.Group();
    keep.userData.kind = 'angler';
    keep.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    keep.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));

    const mergeable = new THREE.Group();
    mergeable.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    mergeable.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));

    articulated.add(keep, mergeable);
    scene.add(articulated);

    optimizeDecor(scene, [], [{ root: articulated, skip: (child) => child.userData.kind === 'angler' }]);

    expect(countMeshes(keep)).toBe(2);
    expect(countMeshes(mergeable)).toBe(1);
  });
});
