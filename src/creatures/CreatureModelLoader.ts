import * as THREE from 'three';
import { GLTFLoader, mergeBufferGeometries } from 'three-stdlib';

/**
 * Optional GLTF creature-model pipeline.
 *
 * Procedural geometry has a hard "stylized" ceiling. This lets real modeled creatures
 * (e.g. CC0 low-poly packs like Quaternius "Ultimate Sea" or Poly Pizza) be dropped into
 * `public/models/` and used in place of the procedural bodies — while still flowing through
 * the same countershading / rim / caustic material treatment as everything else.
 *
 * It is INERT by default: with no paths registered (see `CREATURE_MODEL_PATHS`), nothing
 * loads and every creature stays procedural — identical to not having this file. Loading is
 * best-effort and per-file guarded, so a missing or broken model can never break the app;
 * that creature just falls back to procedural.
 *
 * To activate: drop `<species>.glb` files into `public/models/` and fill in
 * `CREATURE_MODEL_PATHS` below. Models are expected to face -X (the procedural convention);
 * each is auto-centered and scaled to a unit bounding box, then re-scaled per creature by
 * the existing `Scale` component.
 */
export class CreatureModelLoader {
  /**
   * Load every registered model. Returns a map of species-key -> baked geometry for the
   * ones that loaded; failures are logged and omitted (caller falls back to procedural).
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
          const geo = CreatureModelLoader.bake(gltf.scene);
          if (geo) out.set(key, geo);
        } catch (err) {
          console.warn(`[creature-models] failed to load "${key}" from ${url}`, err);
        }
      })
    );
    return out;
  }

  /**
   * Flatten a loaded GLTF scene into one merged, normalized BufferGeometry carrying only
   * position/normal/uv (so it can be instanced/merged and take the shared shader patches).
   */
  private static bake(root: THREE.Object3D): THREE.BufferGeometry | null {
    root.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);

      // Keep a uniform attribute set so parts merge cleanly.
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      }
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (!g.getAttribute('uv')) {
        const count = g.getAttribute('position').count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      }
      // Non-indexed so every part is compatible for the merge.
      parts.push(g.index ? g.toNonIndexed() : g);
    });

    if (parts.length === 0) return null;
    let merged = parts.length === 1 ? parts[0] : mergeBufferGeometries(parts, false);
    if (!merged) merged = parts[0];

    // Normalize: center at origin and scale so the max dimension is 1 unit. The existing
    // Scale component then sizes each creature as before.
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
    }
    merged.computeVertexNormals();
    return merged;
  }
}

/**
 * Species-key -> model path. EMPTY by default (fully procedural). To use modeled creatures,
 * add CC0 `.glb` files under `public/models/` and map them here, e.g.:
 *
 *   export const CREATURE_MODEL_PATHS = {
 *     shark: '/models/shark.glb',
 *     dolphin: '/models/dolphin.glb',
 *     turtle: '/models/turtle.glb',
 *     whale: '/models/whale.glb',
 *     ray: '/models/ray.glb',
 *   };
 *
 * Keys must match `MODEL_KEY_BY_TYPE` in BatchedMeshPool (shark/dolphin/ray/turtle/whale).
 */
export const CREATURE_MODEL_PATHS: Record<string, string> = {};
