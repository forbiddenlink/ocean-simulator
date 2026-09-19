# Ocean Simulator

Photorealistic underwater ecosystem simulator built with Three.js + bitECS + Vite + TypeScript.
FFT-based ocean surface, 10 creature types, schooling AI, predator-prey dynamics, and a
cinematic post-processing pipeline (Beer-Lambert underwater grading, volumetric god rays,
caustics, AgX tonemapping).

## Stack

- Three.js ^0.185, bitECS ^0.4, Vite ^8, TypeScript ~7.0 (all `^`/`~` ranges from package.json)
- Rendering extras: `postprocessing`, `lil-gui`, `three-stdlib`
- Analytics: `posthog-js`
- Package manager: pnpm (`packageManager: pnpm@10.32.1`, `pnpm-lock.yaml` present)
- Biome for lint/format (not ESLint/Prettier)
- Vitest for tests

## Commands

- `pnpm run dev` - dev server (Vite, default port 5173)
- `pnpm run build` - `tsc && vite build`
- `pnpm run preview` - preview the production build
- `pnpm run test` - `vitest run`
- `pnpm run test:watch` / `pnpm run test:ui` - interactive test runs
- `pnpm run biome:check` / `pnpm run biome:fix` / `pnpm run biome:format`

## Architecture (ECS via bitECS)

All game state lives in ECS components (sparse arrays). Systems run in a fixed pipeline each
frame, defined in `src/OceanSimulator.ts`:

1. `oceanCurrentsSystem` - global flow fields
2. `firaSystem` - FIRA flocking (inverse-square repulsion, not linear Boids)
3. `huntingSystem` - predator-prey interactions
4. `animationSystem` - biomechanical animations
5. `enhancedMovementSystem` - physics integration, drag, buoyancy, day/night speed modulation
6. `populationSystem` - birth/death, energy metabolism
7. `renderSystem` - syncs ECS to Three.js meshes

Key components: `src/components/Transform.ts` (Position, Velocity, Acceleration, Rotation,
Scale), `src/components/Biology.ts` (Health, Energy, CreatureType, Size, Species),
`src/components/Behavior.ts` (FIRA, Wander, Vision, Memory, SchoolLeader),
`src/components/Rendering.ts` (Mesh, Color, Animation, DepthZone).

CreatureType IDs 0-9: Fish (instanced, GPU-animated), Shark, Dolphin, Jellyfish, Ray, Turtle,
Crab (floor-pinned), Starfish (stationary), Sea Urchin (stationary), Whale.

Rendering pipeline: `RenderingEngine` (scene/lights/HDRI day-night), `FFTOcean` (Tessendorf FFT
surface + Snell's window), `PostProcessingPipeline` (bloom, god rays, DoF, Beer-Lambert
absorption, ACES/AgX tonemapping, chromatic aberration, vignette, SMAA), `BatchedMeshPool`
(instanced fish + individual complex-creature meshes, LOD skips animation for distant entities),
`Caustics` (voronoi light patterns), `UnderwaterParticles` (marine snow, plankton, bubbles).

`SpatialHashGrid` (`src/spatial/SpatialHashGrid.ts`) gives O(n*k) neighbor queries, rebuilt each
frame. `OceanWorld` extends the bitECS world with `time`, `config`, `spatialGrid`, `timeOfDay`.

## Layout

- `src/OceanSimulator.ts` - main app class, game loop, debug GUI
- `src/main.ts` - entry point
- `src/core/` - `World.ts` (ECS world), `EntityFactory.ts` (entity creation for all 10 types)
- `src/rendering/` - RenderingEngine, FFTOcean, BatchedMeshPool, PostProcessingPipeline
- `src/systems/` - FIRASystem, HuntingSystem, EnhancedMovementSystem, etc.
- `src/components/`, `src/creatures/`, `src/spatial/`, `src/ui/`, `src/lib/`, `src/utils/`
- `src/__tests__/` - unit tests (systems, utils)

## Conventions

- Debug logging guarded by `const DEBUG = false;` at module scope
- Pre-allocate reusable vectors/quaternions at module scope (hot-path allocation avoidance)
- Component arrays use standard JS arrays (not TypedArrays) for bitECS components
- Shader code is inline GLSL strings in TypeScript files
- Coordinate system: Y-up, ocean floor at y = -30, surface at y = 0, camera default (0, -12, 0)

## Env vars

- `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` - PostHog analytics (read via `import.meta.env`)

## Deploy

Vercel. `vercel.json` sets security headers (CSP, X-Frame-Options, etc.) scoped to allow the
PostHog domains used above.
