import { createWorld } from 'bitecs';
import { SpatialHashGrid, createDefaultSpatialGrid } from '../spatial/SpatialHashGrid';

/**
 * Extended world interface with custom properties
 */
export interface OceanWorld extends ReturnType<typeof createWorld> {
  time: {
    delta: number;
    elapsed: number;
    then: number;
  };
  config: {
    maxEntities: number;
    targetFPS: number;
    fixedTimestep: number;
  };
  spatialGrid: SpatialHashGrid;
}

/**
 * Creates and initializes the ECS world
 */
export function createOceanWorld(): OceanWorld {
  const world = createWorld() as OceanWorld;

  // Time tracking
  world.time = {
    delta: 0,
    elapsed: 0,
    then: performance.now(),
  };

  // Configuration
  world.config = {
    maxEntities: 100000,  // Support up to 100k entities (WebGPU target)
    targetFPS: 60,
    fixedTimestep: 1 / 60,
  };

  // Spatial partitioning for efficient neighbor queries
  // Reduces O(n²) neighbor search to O(n·k) where k ≈ 27 cells
  world.spatialGrid = createDefaultSpatialGrid();

  return world;
}

/**
 * Updates world time
 */
export function updateWorldTime(world: OceanWorld): void {
  const now = performance.now();
  world.time.delta = (now - world.time.then) / 1000; // Convert to seconds
  world.time.elapsed += world.time.delta;
  world.time.then = now;
}
