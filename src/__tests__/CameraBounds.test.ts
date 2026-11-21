import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { clampToSwimVolume } from '../rendering/CameraController'
import { seabedY } from '../rendering/RealisticOceanFloor'

describe('camera swim volume', () => {
  it('keeps the camera above the seabed where the terrain rises', () => {
    // Pinnacle at (-31, -16): the rock top sits about ten metres above the -30 m datum.
    const pos = new THREE.Vector3(-31, -27, -16)
    clampToSwimVolume(pos)
    expect(pos.y).toBeGreaterThan(seabedY(-31, -16) + 1)
  })

  it('keeps the camera above the basin wall at the edge of the area', () => {
    const pos = new THREE.Vector3(60, -27, 60)
    clampToSwimVolume(pos)
    expect(pos.y).toBeGreaterThan(seabedY(60, 60) + 1)
  })

  it('leaves the camera free over open sand', () => {
    const pos = new THREE.Vector3(0, -20, 0)
    clampToSwimVolume(pos)
    expect(pos.toArray()).toEqual([0, -20, 0])
  })

  it('stops the camera just above the surface', () => {
    const pos = new THREE.Vector3(0, 10, 0)
    clampToSwimVolume(pos)
    expect(pos.y).toBe(2)
  })
})
