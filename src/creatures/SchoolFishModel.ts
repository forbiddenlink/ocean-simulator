import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Share of the instance colour (panic flash, night glow) mixed into the photo texture. */
const TINT = 0.3

/**
 * Carangiform swim for a scan with no skeleton, in model space (nose at x = -0.5, tail at
 * x = +0.5). The wave travels nose to tail and grows toward the tail. It stays small: a big
 * amplitude bends the whole body into a crescent. `animPhase` and `animSpeed` are the same
 * per-instance attributes the procedural school bodies use.
 */
const SWIM_CHUNK = `
{
  float along = clamp(position.x + 0.5, 0.0, 1.0);
  float env = along * along;
  transformed.z += sin(along * 5.2 - animPhase) * env * (0.05 + animSpeed * 0.08);
  transformed.z -= sin(animPhase) * 0.008 * (1.0 - along);
}`

/**
 * The photo texture already holds the fish's real colour, so the instance colour only
 * tints it. It is normalised to its brightest channel first, so a dark species colour
 * shifts the hue without darkening the fish.
 */
const TINT_CHUNK = `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
  vec3 schoolTint = vColor.rgb / max(max(vColor.r, vColor.g), max(vColor.b, 0.05));
  diffuseColor.rgb *= mix(vec3(1.0), schoolTint, ${TINT.toFixed(2)});
#endif`

export interface SchoolFishBody {
  /** All parts merged, one draw group per part. */
  geometry: THREE.BufferGeometry
  /** One material per draw group. */
  materials: THREE.Material[]
}

/**
 * Turns a scanned fish template from `CreatureModelLoader.loadTemplates` into one geometry
 * and one material per part, ready for the InstancedMesh of a school body type. Returns
 * null when the template has no meshes or its parts cannot be merged.
 */
export function schoolFishBody(template: THREE.Group): SchoolFishBody | null {
  const geometries: THREE.BufferGeometry[] = []
  const sources: THREE.Material[] = []
  for (const child of template.children) {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material)) continue
    // Keep only the attributes every part has, so the parts can merge.
    const part = new THREE.BufferGeometry()
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = mesh.geometry.getAttribute(name)
      if (attribute) part.setAttribute(name, attribute)
    }
    if (mesh.geometry.index) part.setIndex(mesh.geometry.index)
    geometries.push(part)
    sources.push(mesh.material)
  }
  if (geometries.length === 0) return null
  const geometry = mergeGeometries(geometries, true)
  if (!geometry) return null
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return { geometry, materials: sources.map(schoolFishMaterial) }
}

function schoolFishMaterial(source: THREE.Material): THREE.MeshStandardMaterial {
  const scan = source as THREE.MeshStandardMaterial
  const material = new THREE.MeshStandardMaterial({
    name: scan.name,
    map: scan.map ?? null,
    color: scan.color ?? 0xffffff,
    roughness: 0.5,
    metalness: 0,
    // Fins are single sheets in the scans.
    side: THREE.DoubleSide,
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float animPhase;
attribute float animSpeed;`
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>${SWIM_CHUNK}`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', TINT_CHUNK)
  }
  return material
}
