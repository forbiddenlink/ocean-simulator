import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { taperedTube } from '../rendering/TaperedTube'

/** Distance of every vertex in ring `i` from the spine point at that ring. */
function ringRadii(
  geo: THREE.BufferGeometry,
  curve: THREE.Curve<THREE.Vector3>,
  rings: number,
  radial: number,
  i: number
): number[] {
  const pos = geo.getAttribute('position')
  const centre = curve.getPointAt(i / rings)
  const out: number[] = []
  for (let j = 0; j <= radial; j++) {
    const k = i * (radial + 1) + j
    out.push(new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).distanceTo(centre))
  }
  return out
}

describe('taperedTube', () => {
  const spine = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0.5, 0),
    new THREE.Vector3(2, 0, 0.3),
    new THREE.Vector3(3, 0, 0),
  ]
  const curve = new THREE.CatmullRomCurve3(spine)

  it('scales each ring to the radius the taper gives at that point', () => {
    const geo = taperedTube(spine, (t) => 0.1 + 0.4 * t, { segments: 20, radial: 8 })
    for (const i of [0, 5, 10, 20]) {
      const expected = 0.1 + 0.4 * (i / 20)
      for (const r of ringRadii(geo, curve, 20, 8, i)) expect(r).toBeCloseTo(expected, 4)
    }
  })

  it('applies an optional cross-section squash, so bodies can be flattened sideways', () => {
    const straight = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(2, 0, 0),
    ]
    const geo = taperedTube(straight, () => 1, {
      segments: 10,
      radial: 16,
      squash: 0.5,
      squashAxis: new THREE.Vector3(0, 0, 1),
    })
    const radii = ringRadii(geo, new THREE.CatmullRomCurve3(straight), 10, 16, 5)
    const pos = geo.getAttribute('position')
    let maxZ = 0
    for (let k = 0; k < pos.count; k++) maxZ = Math.max(maxZ, Math.abs(pos.getZ(k)))
    expect(maxZ).toBeCloseTo(0.5, 2)
    expect(Math.max(...radii)).toBeCloseTo(1, 2)
    expect(Math.min(...radii)).toBeCloseTo(0.5, 2)
  })

  it('writes a per-vertex colour when given a colour function', () => {
    const red = new THREE.Color(1, 0, 0)
    const blue = new THREE.Color(0, 0, 1)
    const geo = taperedTube(spine, () => 0.2, {
      segments: 10,
      radial: 6,
      color: (t) => (t < 0.5 ? red : blue),
    })
    const col = geo.getAttribute('color')
    expect(col.count).toBe(geo.getAttribute('position').count)
    expect(col.getX(0)).toBe(1)
    expect(col.getZ(col.count - 1)).toBe(1)
  })
})
