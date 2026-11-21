import { type Effect, EffectAttribute, type Pass } from 'postprocessing'
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

// The real composer needs a WebGL context. This one only records the passes in order.
vi.mock('postprocessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('postprocessing')>()
  class RecordingComposer {
    readonly passes: Pass[] = []
    addPass(pass: Pass): void {
      this.passes.push(pass)
    }
  }
  return { ...actual, EffectComposer: RecordingComposer }
})

const { PostProcessingPipeline } = await import('../rendering/PostProcessingPipeline')

function effectsOf(pass: Pass): Effect[] {
  // `effects` is private on EffectPass; the test reads it to check the pass layout.
  return (pass as unknown as { effects?: Effect[] }).effects ?? []
}

describe('PostProcessingPipeline', () => {
  it('runs no neighbour-sampling effect before the water medium in the same pass', () => {
    // EffectPass runs convolution effects first. With SMAA merged into the water pass, an
    // edge pixel whose depth is open water got colour blended in from the lit sand or
    // surface beside it, and the water pass added it unfogged: a dashed bright line along
    // every far edge.
    const pipeline = new PostProcessingPipeline(
      {} as THREE.WebGLRenderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera()
    )
    const passes = (pipeline as unknown as { composer: { passes: Pass[] } }).composer.passes
    const waterPass = passes.find((p) => effectsOf(p).includes(pipeline.water))
    expect(waterPass).toBeDefined()
    const convolution = effectsOf(waterPass!).filter(
      (e) => (e.getAttributes() & EffectAttribute.CONVOLUTION) !== 0
    )
    expect(convolution.map((e) => e.name)).toEqual([])
  })

  it('still antialiases, after the water medium', () => {
    const pipeline = new PostProcessingPipeline(
      {} as THREE.WebGLRenderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera()
    )
    const passes = (pipeline as unknown as { composer: { passes: Pass[] } }).composer.passes
    const waterIndex = passes.findIndex((p) => effectsOf(p).includes(pipeline.water))
    const smaaIndex = passes.findIndex((p) => effectsOf(p).some((e) => e.name === 'SMAAEffect'))
    expect(smaaIndex).toBeGreaterThan(waterIndex)
  })
})
