import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { UnderwaterBloomEffect, WaterMediumEffect } from '../rendering/WaterMedium'

describe('underwater bloom', () => {
  const water = new WaterMediumEffect()
  const bloom = new UnderwaterBloomEffect(water, { luminanceThreshold: 0.55, mipmapBlur: true })
  const material = bloom.luminanceMaterial

  it('extracts highlights from the scene as the water shows it', () => {
    // Bloom reads its pass input, the scene before the water. Without this, a bright
    // surface the water hides still leaves a halo.
    expect(material.fragmentShader).toMatch(/texel\.rgb=waterBloomSource\(texel\.rgb,vUv\);/)
    expect(material.fragmentShader).toMatch(/waterSurfaceLight\(/)
  })

  it('follows the water settings without copying them each frame', () => {
    water.setDensity(2)
    water.setExposure(0.8)
    expect(material.uniforms.uDensity.value).toBe(2)
    expect(material.uniforms.uExposure.value).toBe(0.8)
    expect(material.uniforms.uCameraPos).toBe(water.uniforms.get('uCameraPos'))
  })

  it('reads the depth texture the effect pass hands to every effect', () => {
    const depth = new THREE.DepthTexture(4, 4)
    bloom.setDepthTexture(depth, THREE.RGBADepthPacking)
    expect(material.uniforms.depthBuffer.value).toBe(depth)
    expect(material.defines.DEPTH_PACKING).toBe(String(THREE.RGBADepthPacking))
  })
})
