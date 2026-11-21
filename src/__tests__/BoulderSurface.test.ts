import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { RealisticOceanFloor } from '../rendering/RealisticOceanFloor'

/** Runs the material's shader hook on the stock physical shader, as the renderer would. */
function compiledShader(material: THREE.Material): { vertexShader: string; fragmentShader: string } {
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  } as unknown as THREE.WebGLProgramParametersWithUniforms
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
  return shader
}

describe('boulder surface', () => {
  const group = RealisticOceanFloor.createDetailedFloor(new THREE.Scene(), -30)
  const rocks = group.getObjectByName('rocksInstanced') as THREE.InstancedMesh
  const shader = compiledShader(rocks.material as THREE.Material)

  it('passes the object-space position and world normal to the fragment shader', () => {
    expect(shader.vertexShader).toContain('vRockPos = position;')
    expect(shader.vertexShader).toMatch(/vRockWorldNormal = /)
  })

  it('breaks up the flat colour with stone detail and algae on top faces', () => {
    expect(shader.fragmentShader).toMatch(/diffuseColor\.rgb \*= [^;]*rockDetail/)
    expect(shader.fragmentShader).toMatch(/vRockWorldNormal\.y/)
  })

  it('bumps the shading normal with the stone detail', () => {
    expect(shader.fragmentShader).toMatch(/normal = normalize\([^;]*rockGrad/)
  })
})
