import * as THREE from 'three'

export interface TaperedTubeOptions {
  /** Rings along the spine. */
  segments?: number
  /** Vertices around each ring. */
  radial?: number
  /**
   * Cross-section scale along `squashAxis`, 1 = round. Below 1 flattens the body along
   * that axis, like the sideways-flattened body of a moray. Ignored without an axis.
   */
  squash?: number
  /** Model-space direction to squash along. A fixed axis, because tube frames twist. */
  squashAxis?: THREE.Vector3
  /** Per-ring colour, written as a vertex colour attribute (bands, belly shading). */
  color?: (t: number) => THREE.Color
}

/**
 * One continuous body along a smooth spine whose thickness follows `radiusAt(t)`, t in
 * [0, 1] from the first spine point to the last. Replaces chains of overlapping spheres,
 * which read as beads, with a single smooth skin.
 *
 * Built on TubeGeometry, then each ring is rescaled about its spine point. Normals stay
 * radial to the ring, which ignores the slope of the taper; that is invisible on the
 * gentle tapers this is used for.
 */
export function taperedTube(
  points: THREE.Vector3[],
  radiusAt: (t: number) => number,
  options: TaperedTubeOptions = {}
): THREE.BufferGeometry {
  const segments = options.segments ?? 48
  const radial = options.radial ?? 12
  const squash = options.squashAxis ? (options.squash ?? 1) : 1
  const axis = (options.squashAxis ?? new THREE.Vector3(0, 0, 1)).clone().normalize()
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  const tube = new THREE.TubeGeometry(curve, segments, 1, radial, false)

  const pos = tube.getAttribute('position') as THREE.BufferAttribute
  const nrm = tube.getAttribute('normal') as THREE.BufferAttribute
  const colors = options.color ? new Float32Array(pos.count * 3) : null
  const centre = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const side = new THREE.Vector3()

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    curve.getPointAt(t, centre)
    const r = radiusAt(t)
    const c = options.color?.(t)
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j
      // Unit-radius offset from the spine, split into the part along the squash axis and the rest.
      offset.fromBufferAttribute(pos, k).sub(centre)
      side.copy(axis).multiplyScalar(offset.dot(axis))
      offset.sub(side)
      // Ellipse normal: gradient of the squashed section, proportional to squash * rest + side.
      normal.copy(offset).multiplyScalar(squash).add(side).normalize()
      offset.addScaledVector(side, squash).multiplyScalar(r)
      pos.setXYZ(k, centre.x + offset.x, centre.y + offset.y, centre.z + offset.z)
      nrm.setXYZ(k, normal.x, normal.y, normal.z)
      if (colors && c) colors.set([c.r, c.g, c.b], k * 3)
    }
  }
  if (colors) tube.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  pos.needsUpdate = true
  nrm.needsUpdate = true
  tube.computeBoundingSphere()
  return tube
}
