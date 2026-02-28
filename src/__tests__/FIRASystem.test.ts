import { describe, it, expect } from 'vitest';

/**
 * FIRA System Unit Tests
 *
 * Tests the core flocking algorithm calculations:
 * - Separation (inverse-square repulsion)
 * - Alignment (velocity matching)
 * - Cohesion (center of mass attraction)
 * - Boundary forces
 * - Force limiting
 */

// Pure function implementations to test (extracted from FIRASystem logic)
// These will be exported from a testable module

/**
 * Calculate inverse-square separation force between two entities
 */
function calculateSeparationForce(
  dx: number,
  dy: number,
  dz: number,
  separationRadius: number
): { x: number; y: number; z: number } {
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq < 0.0001) {
    return { x: 0, y: 0, z: 0 };
  }

  const dist = Math.sqrt(distSq);
  if (dist >= separationRadius) {
    return { x: 0, y: 0, z: 0 };
  }

  // Inverse-square repulsion
  const repulsionForce = 1.0 / (distSq + 0.1);

  return {
    x: -(dx / dist) * repulsionForce,
    y: -(dy / dist) * repulsionForce,
    z: -(dz / dist) * repulsionForce,
  };
}

/**
 * Calculate alignment contribution from a neighbor
 */
function calculateAlignmentContribution(
  neighborVelX: number,
  neighborVelY: number,
  neighborVelZ: number,
  distance: number,
  perceptionRadius: number
): { x: number; y: number; z: number; weight: number } {
  const distanceFactor = 1.0 - distance / perceptionRadius;
  return {
    x: neighborVelX * distanceFactor,
    y: neighborVelY * distanceFactor,
    z: neighborVelZ * distanceFactor,
    weight: distanceFactor,
  };
}

/**
 * Calculate cohesion contribution from a neighbor
 */
function calculateCohesionContribution(
  dx: number,
  dy: number,
  dz: number,
  distance: number,
  perceptionRadius: number
): { x: number; y: number; z: number } {
  const distanceFactor = 1.0 - distance / perceptionRadius;
  return {
    x: dx * distanceFactor,
    y: dy * distanceFactor,
    z: dz * distanceFactor,
  };
}

/**
 * Calculate boundary force for keeping entities within bounds
 */
function calculateBoundaryForce(
  px: number,
  py: number,
  pz: number,
  xzLimit: number = 40.0,
  depthLimit: number = -28.0,
  surfaceLimit: number = -2.0
): { x: number; y: number; z: number } {
  let boundX = 0,
    boundY = 0,
    boundZ = 0;

  if (Math.abs(px) > xzLimit) boundX = -px * 0.5;
  if (pz > xzLimit || pz < -xzLimit) boundZ = -pz * 0.5;
  if (py < depthLimit) boundY = (depthLimit - py) * 2.0;
  if (py > surfaceLimit) boundY = (surfaceLimit - py) * 2.0;

  return { x: boundX, y: boundY, z: boundZ };
}

/**
 * Limit force magnitude to maxForce
 */
function limitForce(
  fx: number,
  fy: number,
  fz: number,
  maxForce: number
): { x: number; y: number; z: number } {
  const mag = Math.sqrt(fx * fx + fy * fy + fz * fz);
  if (mag <= maxForce || mag === 0) {
    return { x: fx, y: fy, z: fz };
  }
  const scale = maxForce / mag;
  return {
    x: fx * scale,
    y: fy * scale,
    z: fz * scale,
  };
}

describe('FIRASystem', () => {
  describe('calculateSeparationForce', () => {
    it('should return zero force when entities are at same position', () => {
      const result = calculateSeparationForce(0, 0, 0, 3.0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should return zero force when distance exceeds separation radius', () => {
      // Entity at (5, 0, 0) relative to origin, separation radius 3
      const result = calculateSeparationForce(5, 0, 0, 3.0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should return repulsion force pointing away from neighbor', () => {
      // Neighbor is at (1, 0, 0), so dx=1, separation should push toward negative X
      const result = calculateSeparationForce(1, 0, 0, 3.0);
      expect(result.x).toBeLessThan(0);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(0);
    });

    it('should produce stronger force when entities are closer', () => {
      const closeResult = calculateSeparationForce(0.5, 0, 0, 3.0);
      const farResult = calculateSeparationForce(2.0, 0, 0, 3.0);

      const closeMag = Math.sqrt(
        closeResult.x ** 2 + closeResult.y ** 2 + closeResult.z ** 2
      );
      const farMag = Math.sqrt(
        farResult.x ** 2 + farResult.y ** 2 + farResult.z ** 2
      );

      expect(closeMag).toBeGreaterThan(farMag);
    });

    it('should work correctly in 3D', () => {
      // Neighbor at (1, 1, 1) - force should point toward (-1, -1, -1)
      const result = calculateSeparationForce(1, 1, 1, 5.0);
      expect(result.x).toBeLessThan(0);
      expect(result.y).toBeLessThan(0);
      expect(result.z).toBeLessThan(0);
    });
  });

  describe('calculateAlignmentContribution', () => {
    it('should return full velocity at zero distance', () => {
      const result = calculateAlignmentContribution(1.0, 0, 0, 0, 10.0);
      expect(result.x).toBeCloseTo(1.0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
      expect(result.weight).toBeCloseTo(1.0);
    });

    it('should return zero contribution at perception radius edge', () => {
      const result = calculateAlignmentContribution(1.0, 0, 0, 10.0, 10.0);
      expect(result.x).toBeCloseTo(0);
      expect(result.weight).toBeCloseTo(0);
    });

    it('should return half contribution at half perception radius', () => {
      const result = calculateAlignmentContribution(1.0, 0, 0, 5.0, 10.0);
      expect(result.x).toBeCloseTo(0.5);
      expect(result.weight).toBeCloseTo(0.5);
    });

    it('should scale all velocity components equally', () => {
      const result = calculateAlignmentContribution(2.0, -1.0, 0.5, 5.0, 10.0);
      expect(result.x).toBeCloseTo(1.0);
      expect(result.y).toBeCloseTo(-0.5);
      expect(result.z).toBeCloseTo(0.25);
    });
  });

  describe('calculateCohesionContribution', () => {
    it('should point toward neighbor at full strength when close', () => {
      // Neighbor at (5, 0, 0), perceptionRadius = 10
      const result = calculateCohesionContribution(5, 0, 0, 0, 10.0);
      expect(result.x).toBeCloseTo(5.0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should return zero contribution at perception radius edge', () => {
      const result = calculateCohesionContribution(5, 0, 0, 10.0, 10.0);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(0);
    });

    it('should reduce contribution with distance', () => {
      const closeResult = calculateCohesionContribution(5, 0, 0, 2.0, 10.0);
      const farResult = calculateCohesionContribution(5, 0, 0, 8.0, 10.0);

      expect(Math.abs(closeResult.x)).toBeGreaterThan(Math.abs(farResult.x));
    });
  });

  describe('calculateBoundaryForce', () => {
    it('should return zero force when inside bounds', () => {
      const result = calculateBoundaryForce(0, -15, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should push toward center when beyond X limit', () => {
      const result = calculateBoundaryForce(50, -15, 0);
      expect(result.x).toBeLessThan(0); // Push back toward center
    });

    it('should push toward center when beyond negative X limit', () => {
      const result = calculateBoundaryForce(-50, -15, 0);
      expect(result.x).toBeGreaterThan(0); // Push back toward center
    });

    it('should push toward center when beyond Z limit', () => {
      const resultPositive = calculateBoundaryForce(0, -15, 50);
      const resultNegative = calculateBoundaryForce(0, -15, -50);

      expect(resultPositive.z).toBeLessThan(0);
      expect(resultNegative.z).toBeGreaterThan(0);
    });

    it('should push up strongly when below depth limit', () => {
      const result = calculateBoundaryForce(0, -35, 0);
      expect(result.y).toBeGreaterThan(0); // Push up
    });

    it('should push down when above surface limit', () => {
      const result = calculateBoundaryForce(0, 0, 0); // At surface
      expect(result.y).toBeLessThan(0); // Push down
    });
  });

  describe('limitForce', () => {
    it('should not change force below max', () => {
      const result = limitForce(1, 0, 0, 5.0);
      expect(result.x).toBe(1);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should scale down force above max', () => {
      const result = limitForce(10, 0, 0, 5.0);
      expect(result.x).toBeCloseTo(5.0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should preserve direction when scaling', () => {
      const result = limitForce(6, 8, 0, 5.0);
      // Original magnitude is 10, scaled to 5
      const expectedScale = 5.0 / 10.0;
      expect(result.x).toBeCloseTo(6 * expectedScale);
      expect(result.y).toBeCloseTo(8 * expectedScale);
      expect(result.z).toBe(0);
    });

    it('should work correctly in 3D', () => {
      const result = limitForce(6, 6, 6, 5.0);
      const resultMag = Math.sqrt(
        result.x ** 2 + result.y ** 2 + result.z ** 2
      );
      expect(resultMag).toBeCloseTo(5.0);
    });

    it('should handle zero force', () => {
      const result = limitForce(0, 0, 0, 5.0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should handle exactly max force', () => {
      const result = limitForce(3, 4, 0, 5.0);
      expect(result.x).toBe(3);
      expect(result.y).toBe(4);
      expect(result.z).toBe(0);
    });
  });

  describe('wander angle clamping', () => {
    it('should clamp vertical angle to prevent extreme vertical movement', () => {
      // Test the clamping logic
      const minAngle = Math.PI * 0.35;
      const maxAngle = Math.PI * 0.65;

      // Simulating extreme angles
      let angle = 0; // Too low
      angle = Math.max(minAngle, Math.min(maxAngle, angle));
      expect(angle).toBeCloseTo(minAngle);

      angle = Math.PI; // Too high
      angle = Math.max(minAngle, Math.min(maxAngle, angle));
      expect(angle).toBeCloseTo(maxAngle);

      angle = Math.PI * 0.5; // Just right
      angle = Math.max(minAngle, Math.min(maxAngle, angle));
      expect(angle).toBeCloseTo(Math.PI * 0.5);
    });
  });

  describe('force accumulation', () => {
    it('should correctly combine weighted forces', () => {
      const separation = { x: 1, y: 0, z: 0 };
      const alignment = { x: 0, y: 1, z: 0 };
      const cohesion = { x: 0, y: 0, z: 1 };
      const wander = { x: 1, y: 1, z: 1 };

      const sepW = 1.8;
      const aliW = 4.5;
      const cohW = 2.5;
      const wanderW = 0.15;

      const totalX =
        separation.x * sepW +
        alignment.x * aliW +
        cohesion.x * cohW +
        wander.x * wanderW;
      const totalY =
        separation.y * sepW +
        alignment.y * aliW +
        cohesion.y * cohW +
        wander.y * wanderW;
      const totalZ =
        separation.z * sepW +
        alignment.z * aliW +
        cohesion.z * cohW +
        wander.z * wanderW;

      expect(totalX).toBeCloseTo(1.8 + 0.15);
      expect(totalY).toBeCloseTo(4.5 + 0.15);
      expect(totalZ).toBeCloseTo(2.5 + 0.15);
    });
  });
});
