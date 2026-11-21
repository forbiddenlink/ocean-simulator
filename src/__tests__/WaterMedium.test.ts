import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SKY_DEPTH, WaterMediumEffect } from '../rendering/WaterMedium'

/** Depth-buffer value (0..1) the GPU writes for a point straight ahead at `distance`. */
function bufferDepth(camera: THREE.PerspectiveCamera, distance: number): number {
  const ndc = new THREE.Vector3(0, 0, -distance).applyMatrix4(camera.projectionMatrix)
  // The depth texture is 32-bit float.
  return Math.fround(ndc.z * 0.5 + 0.5)
}

describe('WaterMedium open-water test', () => {
  // Same frustum as the scene camera in RenderingEngine.
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000)
  camera.updateProjectionMatrix()

  it('treats geometry inside the far plane as geometry, not open water', () => {
    // Open water adds the pixel's colour unfogged, so far geometry classed as open water
    // shows through without fog.
    for (const distance of [500, 900, 950, 990]) {
      expect(bufferDepth(camera, distance)).toBeLessThan(SKY_DEPTH)
    }
  })

  it('treats the far plane and the cleared background as open water', () => {
    expect(bufferDepth(camera, 1000)).toBeGreaterThanOrEqual(SKY_DEPTH)
    expect(1.0).toBeGreaterThanOrEqual(SKY_DEPTH)
  })
})

describe('WaterMedium single scattering', () => {
  const shader = new WaterMediumEffect().getFragmentShader()

  it('keeps the sign of the attenuation coefficient', () => {
    // Looking up, the light grows along the ray faster than the water absorbs it in the red
    // channel, so the coefficient is negative. Clamping it to a tiny positive value changes
    // the integral; only a near-zero coefficient takes the limiting value.
    expect(shader).not.toMatch(/max\(sigma - kd \* rd\.y, vec3\(1e-4\)\)/)
    expect(shader).toMatch(/abs\(a\)/)
  })

  it('integrates only the part of the ray that is under water', () => {
    // With a negative coefficient the integrand grows along the ray, so a ray that leaves
    // through the surface must stop there.
    expect(shader).toMatch(/camDepth \/ /)
  })
})
