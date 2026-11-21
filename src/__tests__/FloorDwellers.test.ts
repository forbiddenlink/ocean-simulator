import { describe, expect, it } from 'vitest'
import { Position } from '../components/Transform'
import * as EntityFactory from '../core/EntityFactory'
import { createOceanWorld } from '../core/World'
import { sampleSandHeight } from '../rendering/RealisticOceanFloor'
import { enhancedMovementSystem } from '../systems/EnhancedMovementSystem'

const FLOOR_DATUM = -30

// The pinnacle at (-31, -16) lifts the seabed about ten metres above the datum, so a
// creature pinned to a fixed depth there ends up inside the rock.
const PINNACLE = { x: -31, z: -16 }

describe('floor dwellers', () => {
  const spawners = {
    crab: EntityFactory.createCrab,
    starfish: EntityFactory.createStarfish,
    urchin: EntityFactory.createSeaUrchin,
  }

  for (const [name, spawn] of Object.entries(spawners)) {
    it(`rests a ${name} on the seabed where the terrain rises`, () => {
      const world = createOceanWorld()
      world.time.delta = 1 / 60
      const eid = spawn(world, PINNACLE.x, 0, PINNACLE.z)
      const ground = () => FLOOR_DATUM + sampleSandHeight(Position.x[eid], Position.z[eid])

      expect(ground()).toBeGreaterThan(FLOOR_DATUM + 5)
      expect(Math.abs(Position.y[eid] - ground())).toBeLessThan(1)

      for (let i = 0; i < 30; i++) enhancedMovementSystem(world)
      expect(Math.abs(Position.y[eid] - ground())).toBeLessThan(1)
    })
  }
})
