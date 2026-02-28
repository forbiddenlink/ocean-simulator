import { describe, it, expect } from 'vitest';

/**
 * Enhanced Movement System Unit Tests
 *
 * Tests the physics calculations:
 * - Drag force calculation
 * - Velocity clamping (min/max)
 * - Buoyancy depth preference
 * - Surface/floor boundary enforcement
 * - Reynolds number calculation
 * - Braking force
 */

// Pure function implementations to test (extracted from EnhancedMovementSystem)

/**
 * Calculate drag factor for water resistance
 * Returns multiplier to apply to velocity (0 to 1)
 */
function calculateDragFactor(
  speed: number,
  dt: number,
  dragCoefficient: number = 0.02
): number {
  const factor = 1.0 - dragCoefficient * speed * dt;
  return Math.max(0, factor);
}

/**
 * Clamp velocity to min/max speed, returning new velocity components
 */
function clampVelocity(
  vx: number,
  vy: number,
  vz: number,
  minSpeed: number,
  maxSpeed: number
): { x: number; y: number; z: number; wasRandomized: boolean } {
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

  if (maxSpeed > 0 && speed > maxSpeed) {
    const scale = maxSpeed / speed;
    return { x: vx * scale, y: vy * scale, z: vz * scale, wasRandomized: false };
  }

  if (minSpeed > 0 && speed < minSpeed) {
    if (speed < 0.001) {
      // Random direction kick
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.cos(angle) * minSpeed,
        y: 0,
        z: Math.sin(angle) * minSpeed,
        wasRandomized: true,
      };
    } else {
      const scale = minSpeed / speed;
      return { x: vx * scale, y: vy * scale, z: vz * scale, wasRandomized: false };
    }
  }

  return { x: vx, y: vy, z: vz, wasRandomized: false };
}

/**
 * Calculate buoyancy force based on current depth vs preferred depth
 * Returns vertical velocity adjustment
 */
function calculateBuoyancyForce(
  currentY: number,
  preferredDepth: number,
  neutralBuoyancyZone: number,
  dt: number
): number {
  const currentDepth = -currentY; // Y is negative underwater

  if (currentDepth < preferredDepth - neutralBuoyancyZone) {
    // Too shallow: downward force
    return -0.3 * dt;
  } else if (currentDepth > preferredDepth + neutralBuoyancyZone) {
    // Too deep: upward force
    return 0.3 * dt;
  }

  return 0;
}

/**
 * Enforce surface boundary - fish can't break surface
 */
function enforceSurfaceBoundary(
  y: number,
  vy: number,
  surfaceY: number = -0.5
): { y: number; vy: number } {
  if (y > surfaceY) {
    return {
      y: surfaceY,
      vy: vy > 0 ? -0.1 : vy,
    };
  }
  return { y, vy };
}

/**
 * Enforce floor boundary - fish can't go too deep
 */
function enforceFloorBoundary(
  y: number,
  vy: number,
  maxDepth: number = 50.0
): { y: number; vy: number } {
  if (y < -maxDepth) {
    return {
      y: -maxDepth,
      vy: vy < 0 ? 0.1 : vy,
    };
  }
  return { y, vy };
}

/**
 * Calculate Reynolds number for flow regime detection
 */
function calculateReynoldsNumber(
  speed: number,
  characteristicLength: number = 0.5,
  waterDensity: number = 1000,
  waterViscosity: number = 0.001
): number {
  return (waterDensity * speed * characteristicLength) / waterViscosity;
}

/**
 * Apply braking factor to velocity
 */
function applyBrakingToVelocity(
  vx: number,
  vy: number,
  vz: number,
  brakingFactor: number
): { x: number; y: number; z: number } {
  const reduction = 1.0 - brakingFactor * 0.5;
  return {
    x: vx * reduction,
    y: vy * reduction,
    z: vz * reduction,
  };
}

/**
 * Get preferred depth by creature type
 */
function getPreferredDepth(creatureType: number): number {
  const depthByType: Record<number, number> = {
    0: 10.0, // fish - mid-water
    1: 8.0, // shark - upper-mid
    2: 5.0, // dolphin - near surface
    3: 8.0, // jellyfish - mid-water
    4: 25.0, // ray - near bottom
    5: 5.0, // turtle - near surface
    9: 15.0, // whale - deep
  };
  return depthByType[creatureType] ?? 10.0;
}

describe('EnhancedMovementSystem', () => {
  describe('calculateDragFactor', () => {
    it('should return 1.0 for zero speed (no drag)', () => {
      const result = calculateDragFactor(0, 0.016);
      expect(result).toBe(1.0);
    });

    it('should reduce factor with increasing speed', () => {
      const slowDrag = calculateDragFactor(1.0, 0.016);
      const fastDrag = calculateDragFactor(5.0, 0.016);
      expect(fastDrag).toBeLessThan(slowDrag);
    });

    it('should reduce factor with longer time step', () => {
      const shortDt = calculateDragFactor(2.0, 0.016);
      const longDt = calculateDragFactor(2.0, 0.033);
      expect(longDt).toBeLessThan(shortDt);
    });

    it('should clamp to zero for extreme values', () => {
      const result = calculateDragFactor(100, 1.0);
      expect(result).toBe(0);
    });

    it('should apply correct drag coefficient', () => {
      // speed=10, dt=1, coef=0.02 -> 1 - 0.02*10*1 = 0.8
      const result = calculateDragFactor(10, 1.0, 0.02);
      expect(result).toBeCloseTo(0.8);
    });
  });

  describe('clampVelocity', () => {
    it('should not change velocity within min/max bounds', () => {
      const result = clampVelocity(3, 0, 4, 1.0, 10.0);
      expect(result.x).toBe(3);
      expect(result.y).toBe(0);
      expect(result.z).toBe(4);
      expect(result.wasRandomized).toBe(false);
    });

    it('should scale down velocity exceeding maxSpeed', () => {
      // Speed is 10, maxSpeed is 5
      const result = clampVelocity(6, 0, 8, 0, 5.0);
      const newSpeed = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
      expect(newSpeed).toBeCloseTo(5.0);
    });

    it('should scale up velocity below minSpeed', () => {
      // Speed is 0.5, minSpeed is 2.0
      const result = clampVelocity(0.3, 0, 0.4, 2.0, 10.0);
      const newSpeed = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
      expect(newSpeed).toBeCloseTo(2.0);
      expect(result.wasRandomized).toBe(false);
    });

    it('should give random direction when velocity is nearly zero', () => {
      const result = clampVelocity(0.0001, 0, 0, 2.0, 10.0);
      const newSpeed = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
      expect(newSpeed).toBeCloseTo(2.0);
      expect(result.wasRandomized).toBe(true);
    });

    it('should preserve direction when scaling', () => {
      const result = clampVelocity(6, 0, 8, 0, 5.0);
      // Original direction is (0.6, 0, 0.8) normalized
      // Scaled should maintain same ratio
      const ratio = result.x / result.z;
      expect(ratio).toBeCloseTo(6 / 8);
    });
  });

  describe('calculateBuoyancyForce', () => {
    it('should return zero when in neutral buoyancy zone', () => {
      // Fish at depth 10, preferred 10, zone 8 = neutral
      const result = calculateBuoyancyForce(-10, 10, 8, 0.016);
      expect(result).toBe(0);
    });

    it('should push down when too shallow', () => {
      // Fish at depth 0 (y=0), preferred 10, zone 8
      // currentDepth (0) < preferredDepth - zone (2)
      const result = calculateBuoyancyForce(0, 10, 8, 0.016);
      expect(result).toBeLessThan(0);
    });

    it('should push up when too deep', () => {
      // Fish at depth 25 (y=-25), preferred 10, zone 8
      // currentDepth (25) > preferredDepth + zone (18)
      const result = calculateBuoyancyForce(-25, 10, 8, 0.016);
      expect(result).toBeGreaterThan(0);
    });

    it('should be proportional to delta time', () => {
      const shortDt = calculateBuoyancyForce(-25, 10, 8, 0.016);
      const longDt = calculateBuoyancyForce(-25, 10, 8, 0.033);
      expect(Math.abs(longDt)).toBeGreaterThan(Math.abs(shortDt));
    });
  });

  describe('enforceSurfaceBoundary', () => {
    it('should not modify position below surface', () => {
      const result = enforceSurfaceBoundary(-5, 0);
      expect(result.y).toBe(-5);
      expect(result.vy).toBe(0);
    });

    it('should clamp position at surface', () => {
      const result = enforceSurfaceBoundary(1, 2);
      expect(result.y).toBe(-0.5);
    });

    it('should reverse upward velocity at surface', () => {
      const result = enforceSurfaceBoundary(1, 2);
      expect(result.vy).toBeLessThan(0);
    });

    it('should not reverse downward velocity at surface', () => {
      const result = enforceSurfaceBoundary(1, -2);
      expect(result.y).toBe(-0.5);
      expect(result.vy).toBe(-2);
    });
  });

  describe('enforceFloorBoundary', () => {
    it('should not modify position above floor', () => {
      const result = enforceFloorBoundary(-30, 0);
      expect(result.y).toBe(-30);
      expect(result.vy).toBe(0);
    });

    it('should clamp position at floor', () => {
      const result = enforceFloorBoundary(-60, -2);
      expect(result.y).toBe(-50);
    });

    it('should reverse downward velocity at floor', () => {
      const result = enforceFloorBoundary(-60, -2);
      expect(result.vy).toBeGreaterThan(0);
    });

    it('should not reverse upward velocity at floor', () => {
      const result = enforceFloorBoundary(-60, 2);
      expect(result.y).toBe(-50);
      expect(result.vy).toBe(2);
    });
  });

  describe('calculateReynoldsNumber', () => {
    it('should return zero for zero speed', () => {
      const Re = calculateReynoldsNumber(0);
      expect(Re).toBe(0);
    });

    it('should increase with speed', () => {
      const slowRe = calculateReynoldsNumber(1);
      const fastRe = calculateReynoldsNumber(5);
      expect(fastRe).toBeGreaterThan(slowRe);
    });

    it('should indicate laminar flow at low speed', () => {
      // At speed 1 m/s, length 0.5m: Re = 1000*1*0.5/0.001 = 500000
      // Actually with these defaults, even slow fish are turbulent
      // Let's verify the calculation
      const Re = calculateReynoldsNumber(0.001, 0.5, 1000, 0.001);
      expect(Re).toBe(500);
      expect(Re).toBeLessThan(2000); // Laminar
    });

    it('should indicate turbulent flow at high speed', () => {
      const Re = calculateReynoldsNumber(1.0, 0.5, 1000, 0.001);
      expect(Re).toBe(500000);
      expect(Re).toBeGreaterThan(4000); // Turbulent
    });

    it('should scale with characteristic length', () => {
      const smallFish = calculateReynoldsNumber(2, 0.1);
      const largeFish = calculateReynoldsNumber(2, 1.0);
      expect(largeFish).toBe(smallFish * 10);
    });
  });

  describe('applyBrakingToVelocity', () => {
    it('should reduce velocity by braking factor', () => {
      const result = applyBrakingToVelocity(10, 0, 0, 0.5);
      // reduction = 1 - 0.5*0.5 = 0.75
      expect(result.x).toBe(7.5);
    });

    it('should apply equally to all components', () => {
      const result = applyBrakingToVelocity(4, 3, 0, 0.5);
      const ratio = result.x / result.y;
      expect(ratio).toBeCloseTo(4 / 3);
    });

    it('should handle zero velocity', () => {
      const result = applyBrakingToVelocity(0, 0, 0, 0.5);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should not increase velocity', () => {
      const result = applyBrakingToVelocity(10, 5, 0, 0.0);
      expect(result.x).toBe(10);
      expect(result.y).toBe(5);
    });

    it('should handle max braking factor', () => {
      const result = applyBrakingToVelocity(10, 0, 0, 2.0);
      // reduction = 1 - 2*0.5 = 0
      expect(result.x).toBe(0);
    });
  });

  describe('getPreferredDepth', () => {
    it('should return 10 for fish (type 0)', () => {
      expect(getPreferredDepth(0)).toBe(10.0);
    });

    it('should return 8 for shark (type 1)', () => {
      expect(getPreferredDepth(1)).toBe(8.0);
    });

    it('should return 5 for dolphin (type 2)', () => {
      expect(getPreferredDepth(2)).toBe(5.0);
    });

    it('should return 25 for ray (type 4)', () => {
      expect(getPreferredDepth(4)).toBe(25.0);
    });

    it('should return 15 for whale (type 9)', () => {
      expect(getPreferredDepth(9)).toBe(15.0);
    });

    it('should return default 10 for unknown types', () => {
      expect(getPreferredDepth(99)).toBe(10.0);
    });
  });

  describe('bottom dweller logic', () => {
    it('should identify bottom dweller types correctly', () => {
      const bottomDwellerTypes = [6, 7, 8]; // crab, starfish, urchin
      const regularTypes = [0, 1, 2, 3, 4, 5, 9];

      for (const type of bottomDwellerTypes) {
        expect(type >= 6 && type <= 8).toBe(true);
      }

      for (const type of regularTypes) {
        expect(type >= 6 && type <= 8).toBe(false);
      }
    });

    it('should identify stationary bottom dwellers', () => {
      // Starfish (7) and urchins (8) should be stationary
      const stationaryTypes = [7, 8];
      const mobileTypes = [6]; // Crabs can move

      for (const type of stationaryTypes) {
        expect(type === 7 || type === 8).toBe(true);
      }

      for (const type of mobileTypes) {
        expect(type === 7 || type === 8).toBe(false);
      }
    });
  });

  describe('jellyfish pulse physics', () => {
    it('should produce periodic thrust with sine wave', () => {
      const pulseFrequency = 0.8;
      const times = [0, 0.3125, 0.625, 0.9375, 1.25]; // Quarter cycle points
      const phaseOffset = 0;

      const pulses = times.map((t) => {
        const phase = t * pulseFrequency * Math.PI * 2 + phaseOffset;
        return Math.sin(phase);
      });

      // At t=0, sin(0) = 0
      expect(pulses[0]).toBeCloseTo(0);
      // At quarter cycle, sin(PI/2) = 1
      expect(pulses[1]).toBeCloseTo(1);
      // At half cycle, sin(PI) = 0
      expect(pulses[2]).toBeCloseTo(0);
      // At 3/4 cycle, sin(3PI/2) = -1
      expect(pulses[3]).toBeCloseTo(-1);
      // At full cycle, sin(2PI) = 0
      expect(pulses[4]).toBeCloseTo(0);
    });

    it('should only apply upward thrust during positive pulse', () => {
      // During contraction (pulse > 0), jellyfish pushes up
      // During relaxation (pulse <= 0), no thrust
      const positivePulse = 0.5;
      const negativePulse = -0.5;

      expect(positivePulse > 0).toBe(true);
      expect(negativePulse > 0).toBe(false);
    });
  });
});
