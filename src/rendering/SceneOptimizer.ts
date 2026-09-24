import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Draw-call reduction for the procedural décor.
 *
 * The scene builders create one THREE.Mesh *and* one Material per coral polyp, per
 * starfish arm, per anemone tentacle. That produced 7,000+ meshes and 4,400+ materials,
 * which is a CPU-bound submission cost of several hundred milliseconds per frame before
 * a single pixel is shaded. Nothing here changes how the scene looks: materials with
 * identical parameters are collapsed onto one instance, and static sub-trees are merged
 * into one mesh per material with their world transform baked into the vertices.
 */

/** Attributes kept when merging. Anything else is dropped so geometries stay mergeable. */
const MERGE_ATTRIBUTES = ['position', 'normal', 'uv'] as const;

type AnyMaterial = THREE.Material & Record<string, unknown>;

/**
 * Parameters that actually change how a material renders. Two materials sharing all of
 * these are visually identical and can be the same object.
 */
const MATERIAL_KEYS = [
  'color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'opacity',
  'transparent', 'side', 'flatShading', 'depthWrite', 'depthTest', 'wireframe',
  'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'iridescence',
  'blending', 'alphaTest', 'vertexColors', 'toneMapped', 'fog',
] as const;

function materialKey(material: THREE.Material): string | null {
  // A material with a custom program, a texture, or its own uniforms is not safely
  // shareable — leave those alone.
  const m = material as AnyMaterial;
  // three.js defines a no-op onBeforeCompile on the prototype, so only an OWN property is
  // a real per-material shader hook.
  const own = Object.prototype.hasOwnProperty;
  if (own.call(material, 'onBeforeCompile')) return null;
  if (own.call(material, 'customProgramCacheKey')) return null;
  if (m.map || m.normalMap || m.alphaMap || m.emissiveMap || m.roughnessMap) return null;
  if ((m as unknown as THREE.ShaderMaterial).uniforms) return null;

  const parts: string[] = [material.type];
  for (const key of MATERIAL_KEYS) {
    const value = m[key];
    if (value === undefined) continue;
    if (value instanceof THREE.Color) parts.push(`${key}=${value.getHexString()}`);
    else parts.push(`${key}=${String(value)}`);
  }
  return parts.join('|');
}

/**
 * Collapse visually identical materials onto shared instances.
 * Returns how many distinct material objects were eliminated.
 */
export function dedupeMaterials(root: THREE.Object3D): number {
  const canonical = new Map<string, THREE.Material>();
  const seen = new Set<string>();
  let removed = 0;

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const replaced = materials.map((material) => {
      if (!material) return material;
      const key = materialKey(material);
      if (key === null) return material;

      const existing = canonical.get(key);
      if (!existing) {
        canonical.set(key, material);
        seen.add(material.uuid);
        return material;
      }
      if (existing !== material) {
        if (!seen.has(material.uuid)) {
          seen.add(material.uuid);
          removed++;
        }
        material.dispose();
      }
      return existing;
    });

    mesh.material = Array.isArray(mesh.material) ? (replaced as THREE.Material[]) : replaced[0]!;
  });

  return removed;
}

/** Strip to the shared attribute set so geometries from different builders can merge. */
function normalizeGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry | null {
  if (!source.attributes.position) return null;

  const geometry = new THREE.BufferGeometry();
  for (const name of MERGE_ATTRIBUTES) {
    const attribute = source.attributes[name];
    if (attribute) geometry.setAttribute(name, attribute.clone());
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (!geometry.attributes.uv) {
    // mergeGeometries requires a matching attribute set, so synthesize flat UVs.
    const count = geometry.attributes.position.count;
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (source.index) geometry.setIndex(source.index.clone());
  return geometry;
}

interface MergeBucket {
  material: THREE.Material;
  geometries: THREE.BufferGeometry[];
  castShadow: boolean;
  receiveShadow: boolean;
  renderOrder: number;
}

/**
 * Merge every mesh under `root` into one mesh per material, with each mesh's transform
 * relative to `root` baked into its vertices. Only call this on sub-trees whose meshes
 * are never moved or animated individually afterwards.
 *
 * Returns the mesh count before and after.
 */
export function mergeStaticSubtree(root: THREE.Object3D): { before: number; after: number } {
  root.updateWorldMatrix(true, true);

  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, MergeBucket>();
  const originals: THREE.Mesh[] = [];
  const relative = new THREE.Matrix4();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.material) return;
    if ((mesh as unknown as THREE.InstancedMesh).isInstancedMesh) return;

    const geometry = normalizeGeometry(mesh.geometry);
    if (!geometry) return;

    relative.copy(inverseRoot).multiply(mesh.matrixWorld);
    geometry.applyMatrix4(relative);

    const key = mesh.material.uuid;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: mesh.material,
        geometries: [],
        castShadow: false,
        receiveShadow: false,
        renderOrder: mesh.renderOrder,
      };
      buckets.set(key, bucket);
    }
    bucket.geometries.push(geometry);
    bucket.castShadow ||= mesh.castShadow;
    bucket.receiveShadow ||= mesh.receiveShadow;
    originals.push(mesh);
  });

  const before = originals.length;
  if (before === 0) return { before: 0, after: 0 };

  for (const mesh of originals) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }

  let after = 0;
  for (const bucket of buckets.values()) {
    const merged =
      bucket.geometries.length === 1
        ? bucket.geometries[0]
        : mergeGeometries(bucket.geometries, false);
    if (!merged) continue;
    if (bucket.geometries.length > 1) {
      for (const geometry of bucket.geometries) geometry.dispose();
    }
    merged.computeBoundingSphere();

    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    mesh.renderOrder = bucket.renderOrder;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    after++;
  }

  return { before, after };
}

/**
 * Merge each direct child's own sub-tree in place. Use this when the children still need
 * to move (a bobbing crab) but their internal parts never move relative to each other.
 */
export function mergeChildSubtrees(
  group: THREE.Object3D,
  skip?: (child: THREE.Object3D) => boolean
): { before: number; after: number } {
  let before = 0;
  let after = 0;
  for (const child of [...group.children]) {
    if (skip?.(child)) continue;
    const result = mergeStaticSubtree(child);
    before += result.before;
    after += result.after;
  }
  return { before, after };
}

export interface OptimizeReport {
  meshesBefore: number;
  meshesAfter: number;
  materialsRemoved: number;
}

function countMeshes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) count++;
  });
  return count;
}

/**
 * Run the full décor optimization pass. `staticRoots` are merged whole; `articulatedRoots`
 * keep their direct children separate and merge only inside each one.
 */
export interface ArticulatedRoot {
  root: THREE.Object3D | undefined;
  /** Children that keep moving their own parts and so must not be merged. */
  skip?: (child: THREE.Object3D) => boolean;
}

export function optimizeDecor(
  scene: THREE.Scene,
  staticRoots: Array<THREE.Object3D | undefined>,
  articulatedRoots: ArticulatedRoot[],
  dedupeOnly: Array<THREE.Object3D | undefined> = []
): OptimizeReport {
  const meshesBefore = countMeshes(scene);
  let materialsRemoved = 0;

  const dedupeTargets = [
    ...staticRoots,
    ...articulatedRoots.map((entry) => entry.root),
    ...dedupeOnly,
  ];
  for (const root of dedupeTargets) {
    if (root) materialsRemoved += dedupeMaterials(root);
  }
  for (const root of staticRoots) {
    if (root) mergeStaticSubtree(root);
  }
  for (const entry of articulatedRoots) {
    if (entry.root) mergeChildSubtrees(entry.root, entry.skip);
  }

  return { meshesBefore, meshesAfter: countMeshes(scene), materialsRemoved };
}
