import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { litMaterial } from '../creatures/CreatureModelLoader'

describe('litMaterial', () => {
  it('turns an unlit scan material into a lit one with the same texture and colour', () => {
    const map = new THREE.Texture()
    const lit = litMaterial(new THREE.MeshBasicMaterial({ map, color: 0x336699 })) as THREE.MeshStandardMaterial
    expect(lit.isMeshStandardMaterial).toBe(true)
    expect(lit.map).toBe(map)
    expect(lit.color.getHex()).toBe(0x336699)
  })

  it('keeps vertex colours, which some scans use on top of their texture', () => {
    // brain_platygyra.glb and barrel_sponge.glb carry COLOR_0 attributes, which tint the
    // texture; dropping them renders the reef brighter than the scan.
    const lit = litMaterial(new THREE.MeshBasicMaterial({ vertexColors: true })) as THREE.MeshStandardMaterial
    expect(lit.vertexColors).toBe(true)
  })

  it('returns materials that are already lit unchanged', () => {
    const standard = new THREE.MeshStandardMaterial()
    expect(litMaterial(standard)).toBe(standard)
  })
})
