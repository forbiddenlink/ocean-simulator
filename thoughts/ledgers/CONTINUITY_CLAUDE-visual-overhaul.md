# Visual Overhaul Continuity Ledger

## Goal
Transform the ocean simulator from visually flat to photorealistic underwater world. All 8 phases of visual improvements.

## State
- Done:
  - [x] Phase 1: Creature materials & species coloring (BatchedMeshPool.ts)
  - [x] Phase 2: God rays replacement - re-enabled with conservative params (PostProcessingPipeline.ts)
  - [x] Phase 3: Underwater color grading post-process (PostProcessingPipeline.ts)
  - [x] Phase 4: Fix volumetric fog - FogExp2 (WavelengthLighting.ts)
  - [x] Phase 5: Ocean floor & environment enrichment (RealisticOceanFloor.ts, CoralFormations.ts, KelpForest.ts)
  - [x] Phase 6: Particle system enhancement (UnderwaterParticles.ts, Bioluminescence.ts)
  - [x] Phase 7: Caustics & lighting refinement (Caustics.ts, caustics.frag, RenderingEngine.ts)
  - [x] Phase 8: Post-processing polish (PostProcessingPipeline.ts)
  - [x] Phase 9: Creature movement & behavior bugfixes
  - [x] Phase 10: Movement pipeline root-cause fixes (velocity clamping, force routing, bottom dwellers, buoyancy, whale spawns, jellyfish)
  - [x] Phase 11: Major visual fixes - camera, rotation slerp, swimming animation
  - [x] Phase 13: Visual debugging & color fixes - sky mesh hidden, fish colors visible, lighting tuned
- Now: Visual testing complete. Scene looks like proper underwater environment.
- Next: Continue enhancing visual quality, add more features as requested

## Key Decisions
- Replaced VolumetricFog ray marching with simple FogExp2 (it works, ray marching caused white wash)
- Re-enabled GodRaysEffect with very conservative params instead of building screen-space replacement
- Created custom UnderwaterColorGradingEffect extending postprocessing Effect class
- Used MeshPhysicalMaterial with iridescence for fish, transmission for jellyfish

## Phase 9 Creature Movement Fixes
- **Root cause**: Sharks, dolphins, rays, turtles, whales had maxForce 60-250x too low (0.02-0.1 vs fish at 5.0). Creatures couldn't overcome drag.
- **Root cause**: Same creatures were MISSING Wander and Vision components, so FIRA query excluded them entirely. They got zero steering forces.
- **FIRASystem min speed dead zone**: When speed < 0.0001, minSpeed enforcement was skipped. Now gives random velocity kick.
- **Bottom dwellers**: Buoyancy was pulling crabs/starfish/urchins off the floor. Now pinned to ocean floor with buoyancy exemption.
- **Jellyfish movement**: Added periodic bell-contraction thrust pulses since they have no FIRA system.

## Phase 10 Movement Pipeline Root-Cause Fixes
- **RC1 (CRITICAL)**: Moved velocity clamping from FIRASystem to EnhancedMovementSystem (after drag, before position update). FIRA was clamping velocity that drag immediately invalidated.
- **RC2 (HIGH)**: Routed OceanCurrentsSystem and HuntingSystem forces through Acceleration instead of direct Velocity writes. Removed `* deltaTime` from force writes (EnhancedMovementSystem handles integration).
- **RC3 (HIGH)**: Fully pinned bottom dwellers. Starfish/urchins: zero all velocity + continue. Crabs: zero Y, heavy X/Z drag, allow slow movement. Ocean currents now skip types 6-8.
- **RC4 (MEDIUM)**: Per-creature depth preferences for buoyancy (rays=25, dolphins/turtles=5, whales=15, etc.). Widened neutral zone from 5.0 to 8.0.
- **RC5 (MEDIUM)**: Fixed whale spawn positions from x=60/-70 to x=40/-40 (within ±50 spatial grid bounds).
- **RC6 (LOW)**: Strengthened jellyfish pulse (vertical 0.4→1.2, horizontal 0.1→0.3), reduced current multiplier 2.5→1.5.

## Phase 11 Major Visual Fixes
- **Camera position**: Moved from (0,-12,50) to (0,-12,0), lookAt to (0,-12,-10). Camera now surrounded by fish in all directions.
- **Velocity history 10→4**: Reduced ice-skating lag from 170ms to 67ms. Fish respond faster to direction changes.
- **Instanced fish quaternion slerp**: Added `lastQuaternion` to InstanceData, slerp at 0.15 per frame. Smooth rotation instead of jerky snapping.
- **Wander vertical smoothing**: Added `verticalAngle` to Wander component with accumulated angle instead of white noise phi. Eliminates vertical jitter.
- **GPU swimming animation**: Injected vertex shader via `onBeforeCompile` with per-instance `animPhase` and `animSpeed` attributes. S-curve body undulation from head to tail with speed-dependent amplitude and frequency.

## Phase 14 Hunting Balance Fix
- **Fish dying too fast**: 15 sharks killing ~130 fish/minute, population collapsed 586→73
- **Reduced predator damage**: 15→5 damage/sec (fish survive 20 sec in combat vs 6.7)
- **Reduced attack range**: 1.2→0.8 (predators must get very close)
- **Enhanced prey escape**: flee speed 2.0→2.2x, fear radius 15→18
- **Less persistent hunting**: target forget time 8→5 sec, vision check 0.5→1.0 sec
- **Result**: Population stable at 588 after 5 seconds

## Phase 13 Visual Debugging & Color Fixes
- **Sky mesh causing bright background**: HDRIEnvironment sky sphere was rendering bright sky, but we're underwater. Set `mesh.visible = false` to hide it.
- **Fish appearing as black/dark silhouettes**: Instance colors weren't visible because emissive was dominating. Fixed material:
  - Emissive changed from 0x224466 to 0x446688 at 0.35 intensity (blue-cyan matching underwater)
  - Metalness reduced from 0.3 to 0.1 for more diffuse color
  - Roughness increased to 0.65 for better light diffusion
- **Scene lighting too blue**: Made ambient light more neutral (0x5588aa at 1.0 intensity) and hemisphere sky color warmer (0x88aacc at 0.8)
- **Tone mapping too bright**: Reduced whitePoint 6.0→4.0, middleGrey 0.8→0.6 to prevent over-bright areas
- **Result**: Fish now show colorful instance colors (cyan, green, yellow, pink, blue), underwater atmosphere is dark and atmospheric

## Phase 12 Ecosystem Balance Fixes (fish were dying in seconds)
- **Energy drain 0.5→0.05/sec**: Fish now survive ~2000 seconds instead of 200 seconds from starvation.
- **Starvation damage 2.0→0.5/sec**: 4x slower health loss when energy low.
- **Health regen 0.5→1.0/sec**: Faster recovery when well-fed.
- **Well-fed threshold 100→50**: Easier to trigger health regeneration.
- **Predator damage 50→15/sec**: Fish survive ~7 seconds in combat vs 2 seconds before.
- **Predator energy cost 5.0→0.5/sec**: Predators survive longer without food.
- **Prey flee speed 1.8→2.0x**: Prey can escape more often.
- **Fear radius 12→15**: Prey detect predators earlier.
- **Attack range 1.5→1.2**: Harder for predators to catch prey.

## Files Modified (28 total)
1. `src/rendering/BatchedMeshPool.ts` - Species-specific MeshPhysicalMaterial, quaternion slerp, velocity history 4, GPU swimming shader
2. `src/rendering/PostProcessingPipeline.ts` - God rays, color grading, chromatic aberration, bloom/vignette tuning
3. `src/rendering/WavelengthLighting.ts` - FogExp2 with depth-dynamic density/color
4. `src/rendering/RenderingEngine.ts` - Lighting tuning, camera fill light, color grading update call, camera centered at (0,-12,0)
5. `src/rendering/Caustics.ts` - Intensity, scale, chromatic aberration params
6. `src/shaders/caustics.frag` - Depth falloff, color tint, contrast
7. `src/rendering/RealisticOceanFloor.ts` - Warm sandy colors, more rocks, brighter lighting
8. `src/rendering/CoralFormations.ts` - Desaturated colors, increased emissive
9. `src/rendering/KelpForest.ts` - More plants, taller, greener, translucent
10. `src/rendering/UnderwaterParticles.ts` - More particles, neutral colors, less opaque
11. `src/rendering/Bioluminescence.ts` - More particles, slower pulse, larger, less intense
12. `docs/plans/2026-02-05-visual-overhaul-design.md` - Design document
13. `src/core/EntityFactory.ts` - Fixed maxForce values, added missing Wander+Vision components, Wander.verticalAngle init
14. `src/systems/FIRASystem.ts` - Fixed min speed dead zone, random velocity kick, wander vertical smoothing
15. `src/systems/EnhancedMovementSystem.ts` - Bottom dweller floor pinning, jellyfish thrust pulses
16. `src/systems/FIRASystem.ts` - Removed velocity clamping (moved to EnhancedMovementSystem)
17. `src/systems/EnhancedMovementSystem.ts` - Velocity clamping after drag, per-creature buoyancy, full bottom-dweller pinning, stronger jellyfish pulse
18. `src/systems/OceanCurrentsSystem.ts` - Route through Acceleration, skip bottom dwellers, reduce jellyfish multiplier
19. `src/systems/HuntingSystem.ts` - Route pursuit/flee through Acceleration
20. `src/OceanSimulator.ts` - Fix whale spawn positions within grid bounds, cameraZ param, debug strings
21. `src/components/Behavior.ts` - Added verticalAngle to Wander component
22. `src/systems/PopulationSystem.ts` - Reduced energy drain and starvation damage
23. `src/systems/HuntingSystem.ts` - Rebalanced predator damage and prey escape
24. `src/rendering/HDRIEnvironment.ts` - Hidden sky mesh for underwater (Phase 13)

## Working Set
- Branch: main (untracked changes)
- Build: `npx vite build` passes
- Dev: `npx vite` on port 3000
- TypeScript: `npx tsc --noEmit` clean

## Open Questions
- CONFIRMED: God rays with conservative params look good - light patterns visible at surface
- CONFIRMED: FogExp2 density 0.015 works well - proper underwater atmosphere
- CONFIRMED: Bioluminescence particles visible throughout scene
- CONFIRMED: Fish instance colors now visible (cyan, green, yellow, pink, blue, etc.)
