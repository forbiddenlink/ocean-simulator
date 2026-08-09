import * as THREE from 'three';
import { GLTFLoader, mergeBufferGeometries } from 'three-stdlib';

/**
 * Optional GLTF creature-model pipeline.
 *
 * Procedural geometry has a hard ceiling. Drop real modeled creatures into
 * `public/models/` and register them in `CREATURE_MODEL_PATHS` — they replace
 * procedural bodies for shark/dolphin/ray/turtle/whale while still getting
 * countershading / rim / caustic material treatment.
 *
 * IMPORTANT for this project's cinematic look:
 *   Quaternius / poly.pizza "low poly animals" are stylized/cartoon. They improve
 *   silhouette recognition but usually look *worse* next to Beer-Lambert + AgX water.
 *   Prefer mid/high-poly CC0 sculpts with real proportions (or keep procedural).
 *
 * Loading is best-effort and per-file guarded — missing files never break startup.
 */
export class CreatureModelLoader {
  /**
   * Load every registered model. Returns species-key -> baked geometry for successes.
   */
  static async preload(
    entries: Record<string, string>
  ): Promise<Map<string, THREE.BufferGeometry>> {
    const out = new Map<string, THREE.BufferGeometry>();
    const keys = Object.keys(entries);
    if (keys.length === 0) return out;

    const loader = new GLTFLoader();
    await Promise.all(
      keys.map(async (key) => {
        const url = entries[key];
        try {
          const gltf = await loader.loadAsync(url);
          const geo = CreatureModelLoader.bake(gltf.scene, key);
          if (geo) out.set(key, geo);
        } catch (err) {
          console.warn(`[creature-models] failed to load "${key}" from ${url}`, err);
        }
      })
    );
    return out;
  }

  /**
   * Flatten a GLTF scene into one normalized BufferGeometry.
   * Preserves position/normal/uv/color. Auto-orients so the longest horizontal
   * axis faces -X (procedural convention) when the source faces +Z/+X.
   */
  private static bake(root: THREE.Object3D, speciesKey: string): THREE.BufferGeometry | null {
    root.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);

      // Bake vertex colors from the mesh material when the geometry has none
      // (many Quaternius/low-poly assets color via MeshStandardMaterial.color).
      if (!g.getAttribute('color')) {
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const m = Array.isArray(mat) ? mat[0] : mat;
        const c = m?.color;
        const count = g.getAttribute('position').count;
        const colors = new Float32Array(count * 3);
        const r = c?.r ?? 0.7;
        const gC = c?.g ?? 0.75;
        const b = c?.b ?? 0.8;
        for (let i = 0; i < count; i++) {
          colors[i * 3] = r;
          colors[i * 3 + 1] = gC;
          colors[i * 3 + 2] = b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }

      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') {
          g.deleteAttribute(name);
        }
      }
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (!g.getAttribute('uv')) {
        const count = g.getAttribute('position').count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      }
      parts.push(g.index ? g.toNonIndexed() : g);
    });

    if (parts.length === 0) return null;
    let merged = parts.length === 1 ? parts[0] : mergeBufferGeometries(parts, false);
    if (!merged) merged = parts[0];

    // Normalize: center + unit max-dimension
    merged.computeBoundingBox();
    const bb = merged.boundingBox;
    if (bb) {
      const center = new THREE.Vector3();
      bb.getCenter(center);
      merged.translate(-center.x, -center.y, -center.z);
      const size = new THREE.Vector3();
      bb.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      merged.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);

      // Re-measure after scale; if Z is the long axis (common GLTF forward),
      // rotate so nose faces -X like procedural bodies.
      merged.computeBoundingBox();
      const size2 = new THREE.Vector3();
      merged.boundingBox!.getSize(size2);
      if (size2.z >= size2.x * 0.95) {
        merged.rotateY(-Math.PI / 2);
      }
    }

    // Optional per-species axis tweaks if a pack still swims sideways
    const yawFix: Record<string, number> = {
      // e.g. ray: Math.PI,
    };
    if (yawFix[speciesKey]) merged.rotateY(yawFix[speciesKey]);

    merged.computeVertexNormals();
    return merged;
  }
}

/**
 * Species-key -> model path.
 *
 * Leave empty to stay fully procedural (recommended until you have mid/high-poly
 * models that match the cinematic look). When ready:
 *
 *   1. Drop `shark.glb`, `dolphin.glb`, `ray.glb`, `turtle.glb`, `whale.glb`
 *      into `public/models/` (see that folder's README).
 *   2. Uncomment the entries below.
 *
 * Keys must match `MODEL_KEY_BY_TYPE` in BatchedMeshPool.
 */
export const CREATURE_MODEL_PATHS: Record<string, string> = {
  // shark: '/models/shark.glb',
  // dolphin: '/models/dolphin.glb',
  // ray: '/models/ray.glb',
  // turtle: '/models/turtle.glb',
  // whale: '/models/whale.glb',
};
