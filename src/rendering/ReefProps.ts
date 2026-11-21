import * as THREE from 'three'
import { GLTFLoader } from 'three-stdlib'
import { litMaterial } from '../creatures/CreatureModelLoader'
import { CoralFormations } from './CoralFormations'
import { sampleSandHeight } from './RealisticOceanFloor'

/** Where a prop grows: on the reef patches, or scattered over the whole seabed. */
export type PropPlacement = 'reef' | 'scatter'

export interface ReefPropEntry {
  url: string
  /** Largest dimension in metres, sampled uniformly between the two values. */
  size: [number, number]
  /** Instances per reef patch ('reef') or over the whole seabed ('scatter'). */
  count: number
  placement: PropPlacement
  /** Maximum tilt away from vertical, radians. Branching corals stand up; rubble lies anyhow. */
  tilt: number
  /** How far below the sand the base sits, as a fraction of size, so props look rooted. */
  sink: number
  /**
   * Multiplies the scan's colour. Museum scans are bleached skeletons, so a tint brings
   * them back toward the colour of living coral.
   */
  tint?: number
}

/**
 * Scanned reef props (corals, sponges, rocks) from `public/models/reef/`.
 *
 * The files are prepared offline in Blender: up is +Y, the base sits at y = 0, and the
 * largest dimension is 1. Each file becomes one InstancedMesh per material, so a prop
 * costs the same few draw calls whether it appears ten times or a hundred.
 *
 * Loading is per-file guarded: a missing or broken file is skipped and the procedural
 * reef stays as it is.
 */
export class ReefProps {
  readonly group = new THREE.Group()

  private constructor() {
    this.group.name = 'reefProps'
  }

  static async load(
    scene: THREE.Scene,
    floorDepth: number,
    entries: Record<string, ReefPropEntry> = REEF_PROP_PATHS,
    seed = 1
  ): Promise<ReefProps> {
    const props = new ReefProps()
    const loader = new GLTFLoader()
    const random = mulberry32(seed)
    const loaded = await Promise.all(
      Object.entries(entries).map(async ([key, entry]) => {
        try {
          const gltf = await loader.loadAsync(entry.url)
          const parts = ReefProps.bake(gltf.scene)
          if (entry.tint !== undefined) {
            const tint = new THREE.Color(entry.tint)
            for (const part of parts)
              (part.material as THREE.MeshStandardMaterial).color?.multiply(tint)
          }
          return { key, entry, parts }
        } catch (err) {
          console.warn(`[reef-props] failed to load "${key}" from ${entry.url}`, err)
          return null
        }
      })
    )
    // Place in a fixed order so the same seed always grows the same reef.
    for (const item of loaded) {
      if (!item || item.parts.length === 0) continue
      const matrices = ReefProps.placements(item.entry, floorDepth, random)
      for (const part of item.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length)
        mesh.name = `reefProp_${item.key}`
        for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i])
        mesh.instanceMatrix.needsUpdate = true
        mesh.computeBoundingSphere()
        mesh.castShadow = true
        mesh.receiveShadow = true
        props.group.add(mesh)
      }
    }
    scene.add(props.group)
    return props
  }

  /** Flatten a GLTF scene into world-space geometry with lit materials. */
  private static bake(
    root: THREE.Object3D
  ): Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> {
    root.updateMatrixWorld(true)
    const parts: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = []
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry || Array.isArray(mesh.material)) return
      const geometry = mesh.geometry.clone()
      geometry.applyMatrix4(mesh.matrixWorld)
      parts.push({ geometry, material: litMaterial(mesh.material) })
    })
    return parts
  }

  private static placements(
    entry: ReefPropEntry,
    floorDepth: number,
    random: () => number
  ): THREE.Matrix4[] {
    const out: THREE.Matrix4[] = []
    const patches = CoralFormations.lastReefPatches
    const spots: Array<[number, number]> = []
    if (entry.placement === 'reef' && patches.length > 0) {
      for (const patch of patches) {
        for (let i = 0; i < entry.count; i++) {
          // Denser toward the patch centre, like a real reef mound.
          const angle = random() * Math.PI * 2
          const dist = random() ** 0.7 * patch.radius
          spots.push([patch.x + Math.cos(angle) * dist, patch.z + Math.sin(angle) * dist])
        }
      }
    } else {
      for (let i = 0; i < entry.count; i++)
        spots.push([(random() - 0.5) * 150, (random() - 0.5) * 150])
    }

    const up = new THREE.Vector3(0, 1, 0)
    const axis = new THREE.Vector3()
    const tilt = new THREE.Quaternion()
    const spin = new THREE.Quaternion()
    for (const [x, z] of spots) {
      const size = entry.size[0] + random() * (entry.size[1] - entry.size[0])
      const y = floorDepth + sampleSandHeight(x, z) - entry.sink * size
      spin.setFromAxisAngle(up, random() * Math.PI * 2)
      const a = random() * Math.PI * 2
      axis.set(Math.cos(a), 0, Math.sin(a))
      tilt.setFromAxisAngle(axis, random() * entry.tilt)
      out.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z),
          tilt.clone().multiply(spin),
          new THREE.Vector3(size, size, size)
        )
      )
    }
    return out
  }

  dispose(): void {
    const materials = new Set<THREE.Material>()
    for (const child of this.group.children) {
      const mesh = child as THREE.InstancedMesh
      mesh.geometry.dispose()
      materials.add(mesh.material as THREE.Material)
      mesh.dispose()
    }
    for (const m of materials) {
      ;(m as THREE.MeshStandardMaterial).map?.dispose()
      m.dispose()
    }
    this.group.removeFromParent()
    this.group.clear()
  }
}

/** Small deterministic PRNG so the reef layout is stable between reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Prop key -> file and placement. Files that are missing are skipped. */
export const REEF_PROP_PATHS: Record<string, ReefPropEntry> = {
  // Counts are per reef patch. Museum skeletons are tinted toward living colour;
  // underwater scans (platygyra, elkhorn, barrel sponge) keep their own.
  brainRose: {
    url: '/models/reef/brain_rose.glb',
    size: [0.9, 1.8],
    count: 4,
    placement: 'reef',
    tilt: 0.25,
    sink: 0.15,
    tint: 0xb8a070,
  },
  // Scanned with a slab of seabed around it; the sink buries the slab.
  brainPlatygyra: {
    url: '/models/reef/brain_platygyra.glb',
    size: [1.4, 2.4],
    count: 3,
    placement: 'reef',
    tilt: 0.08,
    sink: 0.12,
  },
  staghorn: {
    url: '/models/reef/staghorn.glb',
    size: [0.8, 1.6],
    count: 8,
    placement: 'reef',
    tilt: 0.3,
    sink: 0.08,
    tint: 0xc89a60,
  },
  elkhorn: {
    url: '/models/reef/elkhorn.glb',
    size: [2.0, 3.5],
    count: 3,
    placement: 'reef',
    tilt: 0.12,
    sink: 0.15,
  },
  // Organ pipe coral's skeleton is red in life too, so it keeps its colour.
  organPipe: {
    url: '/models/reef/organpipe.glb',
    size: [0.5, 1.0],
    count: 4,
    placement: 'reef',
    tilt: 0.3,
    sink: 0.1,
  },
  barrelSponge: {
    url: '/models/reef/barrel_sponge.glb',
    size: [1.6, 2.6],
    count: 2,
    placement: 'reef',
    tilt: 0.06,
    sink: 0.1,
  },
  tubeSponge: {
    url: '/models/reef/tube_sponge.glb',
    size: [0.6, 1.2],
    count: 5,
    placement: 'reef',
    tilt: 0.2,
    sink: 0.05,
    tint: 0xffd070,
  },
  // Boring clam (Tridacna crocea), about 15 cm in life; it bores into reef rock, hence the deep sink.
  tridacna: {
    url: '/models/reef/tridacna.glb',
    size: [0.25, 0.45],
    count: 2,
    placement: 'reef',
    tilt: 0.2,
    sink: 0.25,
  },
  pocillopora: {
    url: '/models/reef/pocillopora.glb',
    size: [0.4, 0.9],
    count: 8,
    placement: 'reef',
    tilt: 0.3,
    sink: 0.1,
    tint: 0xd09080,
  },
}
