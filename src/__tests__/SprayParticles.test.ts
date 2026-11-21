import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SprayParticles } from '../rendering/SprayParticles'

describe('SprayParticles', () => {
  it('retires a drop once it falls back into the sea', () => {
    // Spray is mist above the surface. A drop that kept falling used to glow as a bright
    // dot several metres under water.
    const scene = new THREE.Scene()
    const spray = new SprayParticles(scene, 200)
    spray.spawnAt(new THREE.Vector3(0, 0, 0), 200)
    const points = scene.children[0] as THREE.Points
    const position = points.geometry.getAttribute('position')
    const size = points.geometry.getAttribute('size')

    let lowestLive = Infinity
    for (let frame = 0; frame < 180; frame++) {
      spray.update(1 / 60)
      for (let i = 0; i < position.count; i++) {
        if (size.getX(i) > 0) lowestLive = Math.min(lowestLive, position.getY(i))
      }
    }
    expect(lowestLive).toBeGreaterThanOrEqual(-0.5)
  })
})
