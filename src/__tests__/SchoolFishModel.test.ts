import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { schoolFishBody } from '../creatures/SchoolFishModel'
import { BatchedMeshPool } from '../rendering/BatchedMeshPool'
import type { RenderingEngine } from '../rendering/RenderingEngine'

/** A two-part stand-in for a loaded scan template, each part with its own textured material. */
function fakeTemplate(): THREE.Group {
  const template = new THREE.Group()
  for (let i = 0; i < 2; i++) {
    const geometry = new THREE.BoxGeometry(0.5, 0.3, 0.2)
    geometry.translate(i === 0 ? -0.25 : 0.25, 0, 0)
    const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() })
    template.add(new THREE.Mesh(geometry, material))
  }
  return template
}

describe('schoolFishBody', () => {
  it('merges the parts into one geometry with a draw group and a material per part', () => {
    const body = schoolFishBody(fakeTemplate())
    expect(body).not.toBeNull()
    expect(body!.geometry.groups).toHaveLength(2)
    expect(body!.materials).toHaveLength(2)
  })

  it('keeps the scan texture and takes the instance colour as a tint, not vertex colours', () => {
    const template = fakeTemplate()
    const texture = ((template.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial)
      .map
    const material = schoolFishBody(template)!.materials[0] as THREE.MeshStandardMaterial
    expect(material.map).toBe(texture)
    expect(material.vertexColors).toBe(false)
    expect(material.side).toBe(THREE.DoubleSide)
  })

  it('returns null for a template with no meshes', () => {
    expect(schoolFishBody(new THREE.Group())).toBeNull()
  })
})

describe('BatchedMeshPool.setSchoolFishModels', () => {
  function poolWithScene(): { pool: BatchedMeshPool; mesh: (name: string) => THREE.InstancedMesh } {
    const engine = { scene: new THREE.Scene() } as unknown as RenderingEngine
    const pool = new BatchedMeshPool(engine)
    return { pool, mesh: (name) => engine.scene.getObjectByName(name) as THREE.InstancedMesh }
  }

  it('swaps the named body type to the scan and keeps the per-instance swim attributes', () => {
    const { pool, mesh } = poolWithScene()
    const slender = mesh('fish_slender')
    const phase = slender.geometry.getAttribute('animPhase')
    const procedural = slender.geometry

    pool.setSchoolFishModels(new Map([['slender', fakeTemplate()]]))

    expect(slender.geometry).not.toBe(procedural)
    expect(slender.geometry.getAttribute('animPhase')).toBe(phase)
    expect(slender.geometry.getAttribute('animSpeed')).toBeDefined()
    expect(Array.isArray(slender.material)).toBe(true)
  })

  it('leaves body types without a scan procedural', () => {
    const { pool, mesh } = poolWithScene()
    const disc = mesh('fish_disc').geometry
    pool.setSchoolFishModels(new Map([['slender', fakeTemplate()]]))
    expect(mesh('fish_disc').geometry).toBe(disc)
    expect(Array.isArray(mesh('fish_disc').material)).toBe(false)
  })
})
