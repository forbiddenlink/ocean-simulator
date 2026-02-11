/**
 * 3D Spatial Hash Grid for efficient neighbor queries
 *
 * Reduces neighbor search from O(n²) to O(n·k) where k ≈ 27 cells
 * Grid cells are 10x10x10 units by default
 */

export interface SpatialGridConfig {
  cellSize: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

/**
 * Spatial hash grid for fast 3D proximity queries
 */
export class SpatialHashGrid {
  private invCellSize: number;
  private grid: Map<string, Set<number>>; // key: "x,y,z" -> Set<entityId>
  private entityCells: Map<number, string>; // entityId -> current cell key

  // Grid dimensions
  private minX: number;
  private maxX: number;
  private minY: number;
  private maxY: number;
  private minZ: number;
  private maxZ: number;

  // Reusable neighbor buffer to avoid allocations
  private neighborBuffer: number[] = [];

  constructor(config: SpatialGridConfig) {
    this.invCellSize = 1.0 / config.cellSize;
    this.grid = new Map();
    this.entityCells = new Map();

    this.minX = config.bounds.minX;
    this.maxX = config.bounds.maxX;
    this.minY = config.bounds.minY;
    this.maxY = config.bounds.maxY;
    this.minZ = config.bounds.minZ;
    this.maxZ = config.bounds.maxZ;
  }

  /**
   * Hash position to grid cell coordinates
   */
  private hashPosition(x: number, y: number, z: number): { cx: number; cy: number; cz: number } {
    return {
      cx: Math.floor(x * this.invCellSize),
      cy: Math.floor(y * this.invCellSize),
      cz: Math.floor(z * this.invCellSize),
    };
  }

  /**
   * Convert cell coordinates to key string
   */
  private cellKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  /**
   * Clear all entities from the grid (call at start of frame)
   */
  clear(): void {
    this.grid.clear();
    this.entityCells.clear();
  }

  /**
   * Insert entity at position into grid
   */
  insert(entityId: number, x: number, y: number, z: number): void {
    // Clamp to grid bounds
    const clampedX = Math.max(this.minX, Math.min(this.maxX, x));
    const clampedY = Math.max(this.minY, Math.min(this.maxY, y));
    const clampedZ = Math.max(this.minZ, Math.min(this.maxZ, z));

    const { cx, cy, cz } = this.hashPosition(clampedX, clampedY, clampedZ);
    const key = this.cellKey(cx, cy, cz);

    // Get or create cell
    let cell = this.grid.get(key);
    if (!cell) {
      cell = new Set();
      this.grid.set(key, cell);
    }

    // Add entity to cell
    cell.add(entityId);
    this.entityCells.set(entityId, key);
  }

  /**
   * Remove entity from grid
   */
  remove(entityId: number): void {
    const cellKey = this.entityCells.get(entityId);
    if (cellKey) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        cell.delete(entityId);
        if (cell.size === 0) {
          this.grid.delete(cellKey);
        }
      }
      this.entityCells.delete(entityId);
    }
  }

  /**
   * Get all neighbors within radius of position
   * Returns reusable array (do not store reference!)
   */
  getNeighbors(
    x: number,
    y: number,
    z: number,
    radius: number,
    excludeEntity?: number
  ): number[] {
    this.neighborBuffer.length = 0;

    // Determine which cells to check based on radius
    const radiusInCells = Math.ceil(radius * this.invCellSize);
    const { cx, cy, cz } = this.hashPosition(x, y, z);

    // Check all cells within radius
    for (let dx = -radiusInCells; dx <= radiusInCells; dx++) {
      for (let dy = -radiusInCells; dy <= radiusInCells; dy++) {
        for (let dz = -radiusInCells; dz <= radiusInCells; dz++) {
          const key = this.cellKey(cx + dx, cy + dy, cz + dz);
          const cell = this.grid.get(key);

          if (cell) {
            // Check each entity in cell
            for (const entityId of cell) {
              if (excludeEntity !== undefined && entityId === excludeEntity) {
                continue;
              }

              // NOTE: Actual distance check happens in calling code
              // using Position components. Here we just return candidates.
              this.neighborBuffer.push(entityId);
            }
          }
        }
      }
    }

    return this.neighborBuffer;
  }

  /**
   * Get all neighbors within radius of an entity (excludes self)
   * Uses entity's current grid position
   */
  getNeighborsForEntity(
    entityId: number,
    x: number,
    y: number,
    z: number,
    radius: number
  ): number[] {
    return this.getNeighbors(x, y, z, radius, entityId);
  }

  /**
   * Get entities in a specific cell (for debugging)
   */
  getCellContents(cx: number, cy: number, cz: number): number[] {
    const key = this.cellKey(cx, cy, cz);
    const cell = this.grid.get(key);
    return cell ? Array.from(cell) : [];
  }

  /**
   * Get statistics about grid usage (for debugging/profiling)
   */
  getStats(): {
    totalCells: number;
    totalEntities: number;
    avgEntitiesPerCell: number;
    maxEntitiesInCell: number;
  } {
    let totalEntities = 0;
    let maxEntities = 0;

    for (const cell of this.grid.values()) {
      const size = cell.size;
      totalEntities += size;
      maxEntities = Math.max(maxEntities, size);
    }

    return {
      totalCells: this.grid.size,
      totalEntities,
      avgEntitiesPerCell: this.grid.size > 0 ? totalEntities / this.grid.size : 0,
      maxEntitiesInCell: maxEntities,
    };
  }

  /**
   * Rebuild grid from scratch with all entities
   * Call this each frame before queries
   */
  rebuild(
    entities: number[],
    posX: number[],
    posY: number[],
    posZ: number[]
  ): void {
    this.clear();

    for (const eid of entities) {
      this.insert(eid, posX[eid], posY[eid], posZ[eid]);
    }
  }
}

/**
 * Create default spatial grid for ocean simulator
 * Bounds: ±50 units XZ, -30 to 0 units Y (ocean depth)
 */
export function createDefaultSpatialGrid(): SpatialHashGrid {
  return new SpatialHashGrid({
    cellSize: 10.0, // 10 unit cells (optimal for perception radius ~15-20)
    bounds: {
      minX: -50,
      maxX: 50,
      minY: -30,
      maxY: 0,
      minZ: -50,
      maxZ: 50,
    },
  });
}
