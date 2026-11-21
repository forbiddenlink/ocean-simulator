import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { RealisticOceanFloor, sampleSandHeight } from '../rendering/RealisticOceanFloor'

function sandFloor(): THREE.Mesh {
  const group = RealisticOceanFloor.createDetailedFloor(new THREE.Scene(), -30)
  return group.getObjectByName('sandFloor') as THREE.Mesh
}

describe('sand ripples', () => {
  const floor = sandFloor()

  it('keeps the mesh on the shared seabed height', () => {
    // The vertices are 1.47 m apart, too far to carry ripples under a metre long: baked
    // into the mesh they aliased into stripes. Ripples live in the shader instead, so
    // the mesh matches the height every placed object is set on.
    const positions = floor.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i += 997) {
      const x = positions.getX(i)
      const z = positions.getZ(i)
      expect(positions.getY(i)).toBeCloseTo(sampleSandHeight(x, z), 5)
    }
  })

  describe('shader', () => {
    const shader = (floor.material as THREE.ShaderMaterial).fragmentShader

    it('shades the ripples through the normal, not only the colour', () => {
      expect(shader).toMatch(/n = normalize\([^;]*rippleGrad/)
    })

    it('fades the ripples out where they get smaller than a pixel', () => {
      expect(shader).toMatch(/fwidth\(ripplePhase\)/)
    })
  })
})
