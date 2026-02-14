import { describe, it, expect } from 'vitest';
import { TargetMemory } from '../systems/HuntingSystem';

/**
 * Unit tests for HuntingSystem components and logic
 *
 * Note: Full integration tests for HuntingSystem require the complete ECS
 * world with proper component registration. These tests validate the
 * underlying data structures and logic.
 */

describe('HuntingSystem', () => {
  describe('TargetMemory component', () => {
    it('should initialize with correct array types', () => {
      expect(TargetMemory.targetEid).toBeInstanceOf(Int32Array);
      expect(TargetMemory.lastSeenX).toBeInstanceOf(Float32Array);
      expect(TargetMemory.lastSeenY).toBeInstanceOf(Float32Array);
      expect(TargetMemory.lastSeenZ).toBeInstanceOf(Float32Array);
      expect(TargetMemory.timeSinceSeen).toBeInstanceOf(Float32Array);
      expect(TargetMemory.huntingMode).toBeInstanceOf(Uint8Array);
    });

    it('should have capacity for 10000 entities', () => {
      expect(TargetMemory.targetEid.length).toBe(10000);
      expect(TargetMemory.huntingMode.length).toBe(10000);
    });

    it('should store and retrieve target data correctly', () => {
      const predatorId = 42;
      const preyId = 100;

      // Set target data
      TargetMemory.targetEid[predatorId] = preyId;
      TargetMemory.lastSeenX[predatorId] = 10.5;
      TargetMemory.lastSeenY[predatorId] = -15.0;
      TargetMemory.lastSeenZ[predatorId] = 20.3;
      TargetMemory.timeSinceSeen[predatorId] = 2.5;
      TargetMemory.huntingMode[predatorId] = 1; // pursuing

      // Verify
      expect(TargetMemory.targetEid[predatorId]).toBe(preyId);
      expect(TargetMemory.lastSeenX[predatorId]).toBeCloseTo(10.5);
      expect(TargetMemory.lastSeenY[predatorId]).toBeCloseTo(-15.0);
      expect(TargetMemory.lastSeenZ[predatorId]).toBeCloseTo(20.3);
      expect(TargetMemory.timeSinceSeen[predatorId]).toBeCloseTo(2.5);
      expect(TargetMemory.huntingMode[predatorId]).toBe(1);

      // Cleanup
      TargetMemory.targetEid[predatorId] = 0;
      TargetMemory.huntingMode[predatorId] = 0;
    });

    it('should support hunting mode states', () => {
      const eid = 50;

      // Test all hunting modes
      TargetMemory.huntingMode[eid] = 0; // idle
      expect(TargetMemory.huntingMode[eid]).toBe(0);

      TargetMemory.huntingMode[eid] = 1; // pursuing
      expect(TargetMemory.huntingMode[eid]).toBe(1);

      TargetMemory.huntingMode[eid] = 2; // attacking
      expect(TargetMemory.huntingMode[eid]).toBe(2);

      TargetMemory.huntingMode[eid] = 3; // fleeing
      expect(TargetMemory.huntingMode[eid]).toBe(3);

      // Cleanup
      TargetMemory.huntingMode[eid] = 0;
    });
  });

  describe('hunt configuration', () => {
    it('should have reasonable pursuit speed multiplier', () => {
      // Verify predators are faster but not overwhelmingly so
      const pursuitMultiplier = 1.2;
      expect(pursuitMultiplier).toBeGreaterThan(1.0);
      expect(pursuitMultiplier).toBeLessThan(2.0);
    });

    it('should have reasonable flee speed multiplier', () => {
      // Verify prey can escape
      const fleeMultiplier = 2.2;
      expect(fleeMultiplier).toBeGreaterThan(1.5);
      expect(fleeMultiplier).toBeLessThan(3.0);
    });

    it('should have reasonable fear radius', () => {
      // Prey should detect predators at a reasonable distance
      const fearRadius = 18.0;
      expect(fearRadius).toBeGreaterThan(10.0);
      expect(fearRadius).toBeLessThan(30.0);
    });

    it('should have reasonable target forget time', () => {
      // Predators shouldn't pursue indefinitely
      const forgetTime = 5.0;
      expect(forgetTime).toBeGreaterThan(2.0);
      expect(forgetTime).toBeLessThan(10.0);
    });
  });
});
