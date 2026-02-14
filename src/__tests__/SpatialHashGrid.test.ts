import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialHashGrid, createDefaultSpatialGrid } from '../spatial/SpatialHashGrid';

describe('SpatialHashGrid', () => {
  let grid: SpatialHashGrid;

  beforeEach(() => {
    grid = createDefaultSpatialGrid(); // Uses default config with 10 unit cells
  });

  describe('rebuild', () => {
    it('should correctly index entities by position', () => {
      const entities = [1, 2, 3];
      const posX = [0, 15, 25];
      const posY = [0, 0, 0];
      const posZ = [0, 0, 0];

      grid.rebuild(entities, posX, posY, posZ);

      const stats = grid.getStats();
      expect(stats.totalEntities).toBe(3);
    });

    it('should handle empty entity list', () => {
      grid.rebuild([], [], [], []);

      const stats = grid.getStats();
      expect(stats.totalEntities).toBe(0);
    });
  });

  describe('getNeighbors', () => {
    it('should find nearby entities within radius', () => {
      const entities = [1, 2, 3, 4];
      const posX: number[] = [];
      const posY: number[] = [];
      const posZ: number[] = [];

      // Set positions by entity ID index
      posX[1] = 0; posY[1] = -10; posZ[1] = 0;
      posX[2] = 5; posY[2] = -10; posZ[2] = 0;
      posX[3] = 40; posY[3] = -10; posZ[3] = 0;
      posX[4] = -40; posY[4] = -10; posZ[4] = 0;

      grid.rebuild(entities, posX, posY, posZ);

      // Query around origin with radius 15
      const neighbors = grid.getNeighbors(0, -10, 0, 15);

      // Should find entities 1 and 2 (at 0 and 5), not 3 or 4
      expect(neighbors).toContain(1);
      expect(neighbors).toContain(2);
      expect(neighbors).not.toContain(3);
      expect(neighbors).not.toContain(4);
    });

    it('should return empty array when no entities nearby', () => {
      const entities = [1, 2];
      const posX: number[] = [];
      const posY: number[] = [];
      const posZ: number[] = [];

      posX[1] = 40; posY[1] = -10; posZ[1] = 40;
      posX[2] = -40; posY[2] = -10; posZ[2] = -40;

      grid.rebuild(entities, posX, posY, posZ);

      const neighbors = grid.getNeighbors(0, -10, 0, 10);
      expect(neighbors).toHaveLength(0);
    });

    it('should handle 3D positions correctly', () => {
      const entities = [1, 2, 3];
      const posX: number[] = [];
      const posY: number[] = [];
      const posZ: number[] = [];

      posX[1] = 0; posY[1] = -10; posZ[1] = 0;
      posX[2] = 0; posY[2] = -5; posZ[2] = 0;
      posX[3] = 0; posY[3] = -25; posZ[3] = 0;

      grid.rebuild(entities, posX, posY, posZ);

      const neighbors = grid.getNeighbors(0, -10, 0, 10);

      expect(neighbors).toContain(1);
      expect(neighbors).toContain(2);
      expect(neighbors).not.toContain(3);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const entities = [1, 2, 3, 4, 5];
      const posX: number[] = [];
      const posY: number[] = [];
      const posZ: number[] = [];

      // Put some in same cell, some in different
      posX[1] = 0; posY[1] = -10; posZ[1] = 0;
      posX[2] = 1; posY[2] = -10; posZ[2] = 0;
      posX[3] = 2; posY[3] = -10; posZ[3] = 0;
      posX[4] = 30; posY[4] = -10; posZ[4] = 0;
      posX[5] = 31; posY[5] = -10; posZ[5] = 0;

      grid.rebuild(entities, posX, posY, posZ);

      const stats = grid.getStats();
      expect(stats.totalEntities).toBe(5);
      expect(stats.totalCells).toBeGreaterThan(0);
    });
  });

  describe('insert and remove', () => {
    it('should insert entities correctly', () => {
      grid.insert(1, 0, -10, 0);
      grid.insert(2, 5, -10, 0);

      const stats = grid.getStats();
      expect(stats.totalEntities).toBe(2);
    });

    it('should remove entities correctly', () => {
      grid.insert(1, 0, -10, 0);
      grid.insert(2, 5, -10, 0);

      grid.remove(1);

      const stats = grid.getStats();
      expect(stats.totalEntities).toBe(1);
    });
  });
});
