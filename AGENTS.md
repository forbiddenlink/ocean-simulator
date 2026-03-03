# Ocean Simulator — Agent Guide

## Overview
Photorealistic underwater ecosystem simulator built with **Three.js**, **bitECS**, **Vite**, and **TypeScript**. Features FFT-based ocean, 10 creature types, schooling AI, predator-prey dynamics, and a full post-processing pipeline.

## Quick Commands
- `pnpm run dev` — Dev server (localhost:5173)
- `pnpm run build` — `tsc && vite build`
- `pnpm run test` — `vitest run` (92 tests)

## Architecture

### ECS (bitECS)
All game state lives in ECS components (sparse arrays). Systems run in a pipeline each frame.

**Pipeline order** (defined in `src/OceanSimulator.ts`):
1. `oceanCurrentsSystem` — Global flow fields
2. `firaSystem` — FIRA flocking (inverse-square repulsion, not linear Boids)
3. `huntingSystem` — Predator-prey interactions
4. `animationSystem` — Biomechanical animations
5. `enhancedMovementSystem` — Physics integration, drag, buoyancy, day/night speed modulation
6. `populationSystem` — Birth/death, energy metabolism
7. `renderSystem` — Syncs ECS → Three.js meshes

### Key Components
- **Transform:** `Position`, `Velocity`, `Acceleration`, `Rotation`, `Scale` (`src/components/Transform.ts`)
- **Biology:** `Health`, `Energy`, `CreatureType`, `Size`, `Species` (`src/components/Biology.ts`)
- **Behavior:** `FIRA`, `Wander`, `Vision`, `Memory`, `SchoolLeader` (`src/components/Behavior.ts`)
- **Rendering:** `Mesh`, `Color`, `Animation`, `DepthZone` (`src/components/Rendering.ts`)

### CreatureType IDs
| ID | Type | Rendering | Notes |
|----|------|-----------|-------|
| 0 | Fish | InstancedMesh (4 body types × 500 max) | GPU-animated swimming |
| 1 | Shark | Individual mesh | Predator |
| 2 | Dolphin | Individual mesh | |
| 3 | Jellyfish | Individual mesh | Translucent, bioluminescent |
| 4 | Ray | Individual mesh | |
| 5 | Turtle | Individual mesh | |
| 6 | Crab | Individual mesh | Bottom dweller (floor-pinned) |
| 7 | Starfish | Individual mesh | Stationary |
| 8 | Sea Urchin | Individual mesh | Stationary |
| 9 | Whale | Individual mesh | |

### Rendering Pipeline
- `RenderingEngine` — Scene setup, lights, ocean surface, particles, HDRI day/night cycle
- `FFTOcean` — Tessendorf FFT ocean surface with PBR shader, Snell's window (below-surface view)
- `PostProcessingPipeline` — Bloom, god rays (depth-aware), DoF, Beer-Lambert absorption, ACES tone mapping, chromatic aberration, vignette, SMAA
- `BatchedMeshPool` — Instanced fish rendering + individual mesh management for complex creatures; LOD skips animation for distant entities
- `Caustics` — Voronoi-based caustic patterns projected on ocean floor
- `UnderwaterParticles` — Marine snow, plankton, dust, and creature bubble trails

### Spatial Grid
`SpatialHashGrid` (`src/spatial/SpatialHashGrid.ts`) provides O(n·k) neighbor queries. Rebuilt each frame in the game loop.

### World State
`OceanWorld` extends bitECS world with:
- `time` — `{ delta, elapsed, then }` (seconds)
- `config` — Entity limits, target FPS
- `spatialGrid` — Spatial hash for neighbor lookups
- `timeOfDay` — 0..1 (0 = midnight, 0.5 = noon), synced from HDRIEnvironment

## Conventions
- **Package manager:** pnpm
- **Debug logging:** Guarded by `const DEBUG = false;` at module scope
- **Hot-path allocations:** Pre-allocate reusable vectors/quaternions at module scope
- **Component arrays:** Use standard JS arrays (not TypedArrays) for bitECS components
- **Shader code:** Inline GLSL strings in TypeScript files
- **Coordinate system:** Y-up, ocean floor at y = -30, surface at y = 0, camera default at (0, -12, 0)

## Key Files
- `src/OceanSimulator.ts` — Main app class, game loop, debug GUI
- `src/core/World.ts` — ECS world definition
- `src/core/EntityFactory.ts` — Entity creation functions for all 10 creature types
- `src/rendering/RenderingEngine.ts` — Scene, lights, visual effects orchestration
- `src/rendering/FFTOcean.ts` — Ocean surface simulation and shader
- `src/rendering/BatchedMeshPool.ts` — Creature mesh management and rendering
- `src/rendering/PostProcessingPipeline.ts` — Post-processing effects chain
- `src/systems/FIRASystem.ts` — Flocking AI with school leader following
- `src/systems/HuntingSystem.ts` — Predator-prey with bait ball split behavior
- `src/systems/EnhancedMovementSystem.ts` — Physics, day/night behavior
- `src/ui/UIManager.ts` — HTML overlay UI for controls and stats
