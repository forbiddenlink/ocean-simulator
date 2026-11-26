import { describe, expect, it } from 'vitest'
import { touchSwimAxis } from '../rendering/CameraController'

describe('two-finger swim axis', () => {
  it('ignores small drift around the start point', () => {
    expect(touchSwimAxis(5, -5)).toEqual({ forward: 0, strafe: 0 })
  })

  it('swims forward when the fingers move up the screen', () => {
    expect(touchSwimAxis(0, -40).forward).toBeCloseTo(0.5)
  })

  it('swims back and strafes right', () => {
    const axis = touchSwimAxis(80, 80)
    expect(axis.forward).toBe(-1)
    expect(axis.strafe).toBe(1)
  })

  it('caps speed at full throttle', () => {
    expect(touchSwimAxis(-500, -500)).toEqual({ forward: 1, strafe: -1 })
  })
})
