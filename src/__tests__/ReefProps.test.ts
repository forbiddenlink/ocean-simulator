import * as THREE from 'three'
import { GLTFExporter } from 'three-stdlib'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { CoralFormations } from '../rendering/CoralFormations'
import { type ReefPropEntry, ReefProps } from '../rendering/ReefProps'

// three's FileLoader reports progress with ProgressEvent, which Node lacks.
if (!('ProgressEvent' in globalThis)) {
  ;(globalThis as Record<string, unknown>).ProgressEvent = class extends Event {
    constructor(type: string) {
      super(type)
    }
  }
}

/** A unit box as a GLB data URL, so the real loader path runs without a server. */
async function boxGlbUrl(): Promise<string> {
  const scene = new THREE.Scene()
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xff8844 })
  )
  box.position.y = 0.5
  scene.add(box)
  const glb = await new Promise<ArrayBuffer>((resolve, reject) =>
    new GLTFExporter().parse(scene, (out) => resolve(out as ArrayBuffer), reject, { binary: true })
  )
  let binary = ''
  for (const byte of new Uint8Array(glb)) binary += String.fromCharCode(byte)
  return `data:model/gltf-binary;base64,${btoa(binary)}`
}

describe('ReefProps', () => {
  let url = ''
  beforeAll(async () => {
    url = await boxGlbUrl()
    CoralFormations.lastReefPatches = [
      { x: 10, z: 0, radius: 5 },
      { x: -20, z: 15, radius: 8 },
    ]
  })

  const entry = (over: Partial<ReefPropEntry> = {}): ReefPropEntry => ({
    url,
    size: [1, 2],
    count: 4,
    placement: 'reef',
    tilt: 0.2,
    sink: 0.1,
    ...over,
  })

  it('instances each prop on every reef patch with lit materials', async () => {
    const scene = new THREE.Scene()
    const props = await ReefProps.load(scene, -30, { box: entry() })
    expect(scene.children).toContain(props.group)
    const mesh = props.group.children[0] as THREE.InstancedMesh
    expect(mesh.isInstancedMesh).toBe(true)
    expect(mesh.count).toBe(8) // 4 per patch, 2 patches
    expect((mesh.material as THREE.Material).type).toBe('MeshStandardMaterial')

    // Every instance sits within its patch radius.
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      p.setFromMatrixPosition(m)
      const near = CoralFormations.lastReefPatches.some(
        (patch) => Math.hypot(p.x - patch.x, p.z - patch.z) <= patch.radius + 1e-6
      )
      expect(near).toBe(true)
    }
    props.dispose()
    expect(scene.children).not.toContain(props.group)
  })

  it('tints bleached museum scans toward living colour', async () => {
    const props = await ReefProps.load(new THREE.Scene(), -30, {
      box: entry({ tint: 0x88cc66 }),
    })
    const mat = (props.group.children[0] as THREE.InstancedMesh)
      .material as THREE.MeshStandardMaterial
    const expected = new THREE.Color(0xff8844).multiply(new THREE.Color(0x88cc66))
    expect(mat.color.getHex()).toBe(expected.getHex())
  })

  it('grows the same reef from the same seed', async () => {
    const a = await ReefProps.load(new THREE.Scene(), -30, { box: entry() }, 7)
    const b = await ReefProps.load(new THREE.Scene(), -30, { box: entry() }, 7)
    const ma = (a.group.children[0] as THREE.InstancedMesh).instanceMatrix.array
    const mb = (b.group.children[0] as THREE.InstancedMesh).instanceMatrix.array
    expect(Array.from(ma)).toEqual(Array.from(mb))
  })

  it('skips a file that fails to load and keeps the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const props = await ReefProps.load(new THREE.Scene(), -30, {
      missing: entry({ url: 'data:model/gltf-binary;base64,AAAA' }),
      box: entry({ placement: 'scatter', count: 5 }),
    })
    expect(props.group.children.map((c) => c.name)).toEqual(['reefProp_box'])
    expect((props.group.children[0] as THREE.InstancedMesh).count).toBe(5)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
