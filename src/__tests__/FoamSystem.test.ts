import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FoamSystem } from '../rendering/FoamSystem'

/** World-space width of the foam sheet along X. */
function foamWidth(scene: THREE.Scene): number {
  const mesh = scene.children.find((o) => (o as THREE.Mesh).isMesh) as THREE.Mesh
  mesh.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).x
}

describe('FoamSystem', () => {
  it('covers the ocean it is bound to, not more', () => {
    // Foam past the ocean edge has no surface behind it. Seen from below, those pixels
    // count as open water and skip the water fog.
    const scene = new THREE.Scene()
    const foam = new FoamSystem(scene, 1500)
    foam.setWaterHeightMap(null, 1000)
    expect(foamWidth(scene)).toBeCloseTo(1000, 3)
  })

  it('keeps its size when no ocean size is given', () => {
    const scene = new THREE.Scene()
    const foam = new FoamSystem(scene, 1000)
    foam.setWaterHeightMap(null)
    expect(foamWidth(scene)).toBeCloseTo(1000, 3)
  })
})
