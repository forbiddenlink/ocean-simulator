import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FFTOcean } from '../rendering/FFTOcean'

function oceanMaterial(ocean: FFTOcean): THREE.ShaderMaterial {
  return ocean.mesh.material as THREE.ShaderMaterial
}

describe('FFTOcean daylight', () => {
  // Small grid: the test only reads uniforms and shader text.
  const ocean = new FFTOcean(16, 100)

  it('starts in full daylight', () => {
    expect(oceanMaterial(ocean).uniforms.daylight.value).toBe(1)
  })

  it('takes the sun strength and clamps it to 0..1', () => {
    ocean.setDaylight(0.4)
    expect(oceanMaterial(ocean).uniforms.daylight.value).toBeCloseTo(0.4)
    ocean.setDaylight(-1)
    expect(oceanMaterial(ocean).uniforms.daylight.value).toBe(0)
    ocean.setDaylight(3)
    expect(oceanMaterial(ocean).uniforms.daylight.value).toBe(1)
  })

  it('dims the underside seen from below with the daylight', () => {
    // The underside is lit only by the sky through the surface, so at night it must go
    // dark with the water below the horizon, or a bright band ends in a hard line.
    const shader = oceanMaterial(ocean).fragmentShader
    const underside = shader.slice(shader.indexOf('if (!gl_FrontFacing)'))
    expect(underside).toMatch(/belowColor \*= [^;]*daylight/)
  })
})
