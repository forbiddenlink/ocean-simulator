import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { KelpForest } from '../rendering/KelpForest'
import { SeaAnemones } from '../rendering/SeaAnemones'

/** Runs a material's onBeforeCompile on stub shader text and returns the fragment shader. */
function compiledFragment(material: THREE.Material): string {
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\nvec3 totalEmissiveRadiance = emissive;',
  }
  material.onBeforeCompile(shader as never, undefined as never)
  return shader.fragmentShader
}

describe('floor life at night', () => {
  // Kelp and anemones carry an emissive term that stands in for daylight through and
  // around them. Left constant, they stay lit at midnight in an otherwise dark sea.

  it('dims the kelp glow with the daylight', () => {
    const scene = new THREE.Scene()
    const kelp = new KelpForest(scene, -30, 10)
    const blades = scene.getObjectByName('kelpBlades') as THREE.Mesh
    const fragment = compiledFragment(blades.material as THREE.Material)
    expect(fragment).toMatch(/totalEmissiveRadiance \*= [^;]*uKelpDaylight/)
    kelp.setDaylight(0.25)
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: '', fragmentShader: '' }
    ;(blades.material as THREE.Material).onBeforeCompile(shader as never, undefined as never)
    expect(shader.uniforms.uKelpDaylight.value).toBeCloseTo(0.25)
  })

  it('dims the anemone glow with the daylight and restores it at noon', () => {
    const scene = new THREE.Scene()
    const anemones = new SeaAnemones(scene, -30, 10)
    const materials: THREE.MeshPhysicalMaterial[] = []
    anemones.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined
      if (m?.isMeshPhysicalMaterial) materials.push(m)
    })
    expect(materials.length).toBeGreaterThan(0)
    const noon = materials.map((m) => m.emissiveIntensity)
    anemones.setDaylight(0)
    materials.forEach((m, i) => expect(m.emissiveIntensity).toBeLessThan(noon[i] * 0.2))
    anemones.setDaylight(1)
    materials.forEach((m, i) => expect(m.emissiveIntensity).toBeCloseTo(noon[i]))
  })
})
