import { describe, expect, it } from 'vitest'
import { DynamicResolution } from '../rendering/DynamicResolution'

const opts = { targetMs: 1000 / 60, warmupFrames: 10, windowFrames: 60, probeWindows: 3 }
const ON_TIME = 16.7
const LATE = 33.3

/** Feeds `frames` frame deltas, every `lateEvery`th one late (0 = none late). */
function feed(res: DynamicResolution, frames: number, lateEvery = 0): void {
  for (let i = 0; i < frames; i++) res.addFrameDelta(lateEvery && i % lateEvery === 0 ? LATE : ON_TIME)
}

/** A GPU that misses the refresh whenever the scale is above `limit`. */
function feedGpuLimit(res: DynamicResolution, frames: number, limit: number): void {
  for (let i = 0; i < frames; i++) res.addFrameDelta(res.scale > limit && i % 8 === 0 ? LATE : ON_TIME)
}

describe('DynamicResolution', () => {
  it('ignores the warmup frames, where shader compiles and uploads spike', () => {
    const res = new DynamicResolution(opts)
    for (let i = 0; i < opts.warmupFrames; i++) res.addFrameDelta(LATE)
    expect(res.scale).toBe(1)
  })

  it('lowers the scale when one frame in eight misses the refresh', () => {
    // Measured on an M4 Pro at 1512x900 with the old fixed pixel budget.
    const res = new DynamicResolution(opts)
    feed(res, opts.warmupFrames)
    feed(res, opts.windowFrames, 8)
    expect(res.scale).toBeLessThan(1)
  })

  it('tolerates a single late frame, such as a garbage-collection pause', () => {
    const res = new DynamicResolution(opts)
    feed(res, opts.warmupFrames)
    feed(res, opts.windowFrames, opts.windowFrames)
    expect(res.scale).toBe(1)
  })

  it('ignores one-off hitches, such as a shader compile while models load', () => {
    // A fill-rate miss holds the frame for one extra refresh (33 ms). Compiles and
    // uploads stall for 50 ms or more, and a lower resolution does not shorten them.
    const res = new DynamicResolution(opts)
    feed(res, opts.warmupFrames)
    for (let i = 0; i < opts.windowFrames * 10; i++) res.addFrameDelta(i % 12 === 0 ? 70 : ON_TIME)
    expect(res.scale).toBe(1)
  })

  it('still lowers the scale when most frames take several refreshes', () => {
    const res = new DynamicResolution(opts)
    feed(res, opts.warmupFrames)
    for (let i = 0; i < opts.windowFrames; i++) res.addFrameDelta(50)
    expect(res.scale).toBeLessThan(1)
  })

  it('treats long gaps as a paused tab, not as slow frames', () => {
    const res = new DynamicResolution(opts)
    for (let i = 0; i < 1000; i++) res.addFrameDelta(i % 2 ? 500 : ON_TIME)
    expect(res.scale).toBe(1)
  })

  it('settles just under the scale where frames start to miss', () => {
    const res = new DynamicResolution(opts)
    feed(res, opts.warmupFrames)
    feedGpuLimit(res, 5000, 0.75)
    expect(res.scale).toBeLessThanOrEqual(0.75)
    expect(res.scale).toBeGreaterThan(0.6)
  })

  it('stops probing upward once a probe has failed', () => {
    // Every probe above the limit costs a window of late frames and a render-target
    // reallocation, so after one failure the controller stays put.
    const res = new DynamicResolution(opts)
    feed(res, opts.warmupFrames)
    feedGpuLimit(res, 3000, 0.75)
    const settled = res.scale
    let changes = 0
    for (let i = 0; i < 5000; i++) {
      const before = res.scale
      res.addFrameDelta(res.scale > 0.75 && i % 8 === 0 ? LATE : ON_TIME)
      if (res.scale !== before) changes++
    }
    expect(changes).toBe(0)
    expect(res.scale).toBe(settled)
  })

  it('keeps a margin under a scale that missed the refresh later on', () => {
    // The flythrough moves between light and heavy views, so a probe can pass its
    // first window and still miss a few seconds later.
    const res = new DynamicResolution(opts)
    feed(res, opts.warmupFrames)
    feed(res, opts.windowFrames, 8)
    feed(res, opts.windowFrames * opts.probeWindows)
    const probed = res.scale
    feed(res, opts.windowFrames * 2)
    feed(res, opts.windowFrames, 8)
    expect(res.scale).toBeLessThan(probed)
    feed(res, 20000)
    expect(res.scale).toBeLessThanOrEqual(probed * 0.95 + 1e-9)
  })

  it('climbs back after a reset when the load is gone', () => {
    const res = new DynamicResolution(opts)
    feed(res, opts.warmupFrames)
    feed(res, opts.windowFrames * 4, 4)
    const low = res.scale
    expect(low).toBeLessThan(1)
    res.reset()
    expect(res.scale).toBe(low)
    feed(res, 10000)
    expect(res.scale).toBe(1)
  })

  it('never goes above 1', () => {
    const res = new DynamicResolution(opts)
    feed(res, 10000)
    expect(res.scale).toBe(1)
  })

  it('never goes below the minimum', () => {
    const res = new DynamicResolution({ ...opts, minScale: 0.5 })
    for (let i = 0; i < 10000; i++) res.addFrameDelta(LATE)
    expect(res.scale).toBe(0.5)
  })
})
