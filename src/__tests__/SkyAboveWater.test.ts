import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { HDRIEnvironment } from '../rendering/HDRIEnvironment'

function skyMesh(scene: THREE.Scene): THREE.Mesh {
  const mesh = scene.children.find(
    (o) => (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.Material).side === THREE.BackSide
  )
  if (!mesh) throw new Error('no sky mesh in scene')
  return mesh as THREE.Mesh
}

describe('sky above the surface', () => {
  // The camera can rise to 2 m above the sea. The sky stays hidden under water, where
  // the water medium is the backdrop, but above the surface it must show, or the upper
  // half of the frame is black.

  it('hides the sky under water and shows it above the surface', () => {
    const scene = new THREE.Scene()
    const env = new HDRIEnvironment(scene)
    env.followCamera(new THREE.Vector3(0, -5, 0))
    expect(skyMesh(scene).visible).toBe(false)
    env.followCamera(new THREE.Vector3(3, 1.5, -4))
    expect(skyMesh(scene).visible).toBe(true)
  })

  it('keeps the sky centred on the camera so its horizon never shifts', () => {
    const scene = new THREE.Scene()
    const env = new HDRIEnvironment(scene)
    env.followCamera(new THREE.Vector3(40, 1, -60))
    expect(skyMesh(scene).position.toArray()).toEqual([40, 1, -60])
  })
})
