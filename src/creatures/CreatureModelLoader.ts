import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

/**
 * How a model's vertex shader moves it, since the scanned models carry no skeleton.
 *   lateral  - fish and sharks: a side-to-side wave that grows toward the tail.
 *   vertical - dolphins and whales: the same wave, up and down (flukes are horizontal).
 *   wing     - rays: the wing tips flap, the body barely moves.
 *   paddle   - turtles: the flippers sweep, the shell stays still.
 */
export type SwimStyle = 'lateral' | 'vertical' | 'wing' | 'paddle';

export interface CreatureModelEntry {
  url: string;
  /** World length of the animal nose to tail, before the ECS Scale component. */
  length: number;
  swim: SwimStyle;
}

export interface CreatureModel {
  /**
   * Meshes in model space: nose at x = -0.5, tail at x = +0.5, back toward +Y.
   * Geometry and materials are shared by every clone, so callers must not dispose them.
   */
  template: THREE.Group;
  length: number;
  swim: SwimStyle;
}

/**
 * Photogrammetry scans ship as unlit (KHR_materials_unlit) because the photo already holds
 * the studio lighting. Under water they must take the scene's light, depth colour and
 * caustics like everything else, so unlit materials become lit ones that keep the same
 * texture. Other materials are returned unchanged.
 */
export function litMaterial(material: THREE.Material): THREE.Material {
  const basic = material as THREE.MeshBasicMaterial;
  if (!basic.isMeshBasicMaterial) return material;
  const lit = new THREE.MeshStandardMaterial({
    name: basic.name,
    map: basic.map,
    color: basic.color,
    vertexColors: basic.vertexColors,
    side: basic.side,
    transparent: basic.transparent,
    opacity: basic.opacity,
    alphaTest: basic.alphaTest,
    roughness: 0.6,
    metalness: 0,
  });
  basic.dispose();
  return lit;
}

/**
 * Loads the scanned creature models in `public/models/`.
 *
 * The models are prepared offline in Blender (decimated, nose turned to -X, textures
 * shrunk), so this loader only bakes node transforms into the geometry and normalizes
 * every model to unit length along X. The GLTF materials, including their photo
 * textures, are kept as they are.
 *
 * Loading is per-file guarded: a missing or broken file leaves that species procedural.
 */
export class CreatureModelLoader {
  static async preload(
    entries: Record<string, CreatureModelEntry>
  ): Promise<Map<string, CreatureModel>> {
    const urls: Record<string, string> = {};
    for (const [key, entry] of Object.entries(entries)) urls[key] = entry.url;
    const templates = await CreatureModelLoader.loadTemplates(urls);
    const out = new Map<string, CreatureModel>();
    for (const [key, template] of templates) {
      const entry = entries[key];
      out.set(key, { template, length: entry.length, swim: entry.swim });
    }
    return out;
  }

  /**
   * Load each file as a template: meshes in model space, nose at x = -0.5, unit length
   * along X. A missing or broken file is skipped with a warning.
   */
  static async loadTemplates(urls: Record<string, string>): Promise<Map<string, THREE.Group>> {
    const out = new Map<string, THREE.Group>();
    const loader = new GLTFLoader();
    await Promise.all(
      Object.entries(urls).map(async ([key, url]) => {
        try {
          const gltf = await loader.loadAsync(url);
          const template = CreatureModelLoader.normalize(gltf.scene);
          if (template) out.set(key, template);
        } catch (err) {
          console.warn(`[creature-models] failed to load "${key}" from ${url}`, err);
        }
      })
    );
    return out;
  }

  /** Flatten the scene into identity-transform meshes, centered, unit length along X. */
  private static normalize(root: THREE.Object3D): THREE.Group | null {
    root.updateMatrixWorld(true);
    const parts: THREE.Mesh[] = [];
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      const material = Array.isArray(mesh.material)
        ? mesh.material.map(litMaterial)
        : litMaterial(mesh.material);
      parts.push(new THREE.Mesh(geometry, material));
    });
    if (parts.length === 0) return null;

    const box = new THREE.Box3();
    for (const part of parts) {
      part.geometry.computeBoundingBox();
      box.union(part.geometry.boundingBox!);
    }
    const center = box.getCenter(new THREE.Vector3());
    const length = box.max.x - box.min.x || 1;

    const template = new THREE.Group();
    for (const part of parts) {
      part.geometry.translate(-center.x, -center.y, -center.z);
      part.geometry.scale(1 / length, 1 / length, 1 / length);
      part.geometry.computeBoundingSphere();
      part.castShadow = true;
      part.receiveShadow = true;
      template.add(part);
    }
    template.userData.sharedModel = true;
    return template;
  }
}

/**
 * Species key -> model. Keys must match `MODEL_KEY_BY_TYPE` in BatchedMeshPool.
 * Lengths match the procedural bodies they replace. The ray's length includes its
 * whip tail, so 2.2 gives the same 1.8 wingspan as the procedural ray.
 */
export const CREATURE_MODEL_PATHS: Record<string, CreatureModelEntry> = {
  shark: { url: '/models/shark.glb', length: 2.0, swim: 'lateral' },
  dolphin: { url: '/models/dolphin.glb', length: 1.5, swim: 'vertical' },
  ray: { url: '/models/ray.glb', length: 2.2, swim: 'wing' },
  turtle: { url: '/models/turtle.glb', length: 1.15, swim: 'paddle' },
  whale: { url: '/models/whale.glb', length: 5.0, swim: 'vertical' },
};

/**
 * Scanned reef fish for the instanced school body types, keyed by body type name in
 * BatchedMeshPool. Each file replaces that type's procedural body; a missing one leaves it
 * procedural. Same model-space convention as above.
 */
export const SCHOOL_FISH_MODEL_PATHS: Record<string, string> = {
  standard: '/models/fish/parrotfish.glb',
  slender: '/models/fish/wrasse.glb',
  disc: '/models/fish/angelfish.glb',
  chunky: '/models/fish/grouper.glb',
};
