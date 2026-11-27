# Sunken Atlantis: implementation prompt

Status: spec only. Do not start rendering code until the owner has reviewed `artstyle.md` (see `plan.md`, slice 0).

This is the prompt you hand to an implementation session. It is written to you, the implementer.

## What you are building

A new mode of the existing Ocean Simulator: a drowned marble-and-bronze city on a reef shelf that you swim through. You are not writing a new engine. You are adding a mode to the Three.js app in this repo, built on its existing water medium, caustics, light shafts, fish schooling and post chain. The player finds 5 relics. Every run is reproducible from a seed in the URL.

The method comes from the public "flyable procedural Atlantis" project (a 10 KB prompt plus a 24 KB art bible, built in one session). Copy its method: a spec-first workflow, a fixed seed, fixed review shots, a scripted fly-through used as a benchmark, a separate visual critic that sees only the art bible and the renders, and an explicit cut order when over budget. Do not copy its text, its city design or its WebGPU-only, no-engine constraints. This repo uses Three.js and WebGL2, and you stay on that.

Read `artstyle.md` fully before writing code. It is the only authority on how the scene looks. Read `plan.md` to see which slice you are on. Build one slice per PR.

## Ranked priorities

When two goals conflict, the higher one wins.

1. The drowned city reads as a real, beautiful place from the review shots. Look beats feature count.
2. Frame pacing on the target devices (budgets below). A missed frame is worse than a missing detail.
3. Works on phones. Quality tiers, a lite fallback path, touch controls.
4. The relic goal and the share URL work and never break the first three.
5. Small additional bundle size and no new runtime dependencies.

## Stack and constraints

- Use what the repo already uses: Three.js ^0.185 `WebGLRenderer` (WebGL2), TypeScript, Vite, pnpm, Biome, Vitest, the `postprocessing` package, bitECS for creatures. Shaders are inline GLSL strings in TypeScript, matching the repo convention. Do not add a new engine, and do not add runtime dependencies without asking.
- Everything is procedural. No new texture, model or image files in `public/`. The existing optional `.glb` creature pipeline stays inert for this mode (fish come from the procedural generators).
- All geometry comes from a small set of parametric generators (listed in `artstyle.md` section 6), instanced or merged into chunks. One draw call per (chunk, material), not per object.
- Zero per-frame allocations. No `new`, no array literals, no object literals, no closures created, no `.map`/`.filter`/spread inside any function that runs per frame. Preallocate vectors, matrices, typed arrays and scratch objects at module scope or in constructors (the repo already asks for this in `CLAUDE.md`). Write a Vitest guard that runs the mode's update loop for 600 frames and asserts the JS heap delta stays under a small bound (use `performance.memory` where present, otherwise a counter of constructor calls through a spy on `THREE.Vector3`, `THREE.Matrix4`, `THREE.Quaternion`).
- Determinism: add one seeded PRNG module (mulberry32 is fine) and route every random decision in this mode through it. Do not call `Math.random()` in mode code. The repo has no seeded PRNG today.
- Debug logging stays behind a module-level `const DEBUG = false;` as in the rest of the repo.
- The existing default experience must not change. The mode is opt-in (URL parameter, see Share URLs). Existing tests keep passing.
- No file in this mode may be longer than about 500 lines. Split by system.

## Target devices and frame budgets

Frame budgets use the repo's own method. `src/rendering/DynamicResolution.ts` explains why GPU timer queries lie on tiled GPUs (Apple, many phones), so measure with animation-frame deltas and use timer queries only where they are trustworthy.

| Device class | Example | Render size | Target | Hard limit |
|---|---|---|---|---|
| Desktop, discrete or Apple M-series | RTX 3060 class, M2 | up to 2560x1440, DPR capped at 1.5 | 60 fps, p50 frame under 12 ms | p99 under 16.7 ms, no frame over 25 ms in the fly-through |
| Mid-range phone | 3 to 4 year old Android flagship-lite or iPhone 12 class | 0.6 to 0.75 of CSS size, DPR capped at 2 | 45 to 60 fps in tier 1, 30 fps floor | p99 under 33 ms, no frame over 50 ms |
| Low-end or unsupported | old phone, software GL | 0.5 of CSS size | 30 fps | the lite path must still start and be playable |

Scene budgets (visible after culling, in the worst review shot):

| Tier | Draw calls | Triangles | Fish | Texture/RT memory |
|---|---|---|---|---|
| 3 Ultra | 220 | 1.8 M | 900 | 160 MB |
| 2 High | 160 | 1.2 M | 600 | 120 MB |
| 1 Mobile | 90 | 350 k | 220 | 64 MB |
| 0 Lite | 50 | 150 k | 80 | 32 MB |

Add a Vitest budget test in the style of `src/__tests__/DrawCallBudget.test.ts` that builds the world at the fixed seed and asserts draw calls, meshes and materials per tier, with margin so it catches regressions in kind.

## Quality tiers and fallback

Four tiers, chosen once at startup and adjustable at runtime, in this order of what you cut first when over budget (cut the earliest first, never cut the last group):

1. Extra fish, small drifting particles, coral detail instances far away.
2. Bloom, then depth of field, then the shaft raymarch step count.
3. Detail of overgrowth (kelp and coral density), caustic octaves, render scale (via the existing `DynamicResolution`).
4. Never cut: the water medium (colour absorption with distance), the light shafts at least as cards, marble and bronze material response, the Spire, the relic goal.

Tier detection: read `renderer.capabilities`, `navigator.hardwareConcurrency`, `navigator.deviceMemory` (where available), `matchMedia('(pointer: coarse)')`, the renderer string from `WEBGL_debug_renderer_info` (only to detect software renderers such as SwiftShader or llvmpipe), then run a 90-frame warm-up and drop one tier if the p95 frame delta misses the target. `?tier=0|1|2|3` overrides detection. Respect `prefers-reduced-motion` by freezing camera sway and slowing fish.

The "WebGL fallback" in this repo means the lite path, not a second renderer. Three r163 and later dropped WebGL1, so the floor is WebGL2. Tier 0 must work when float or half-float render targets, MSAA or the `postprocessing` chain are unavailable or too slow:

- Tier 0 renders straight to the canvas with no `EffectComposer`. Water colour, depth fog and the caustic term are computed inside each material (the repo's seabed shader already does this per-material; reuse `CAUSTIC_GLSL` and `WATER` from `src/rendering/WaterMedium.ts`).
- Light shafts in tier 0 and tier 1 are additive cards with a baked gradient, animated by a time uniform. Tier 2 and 3 raymarch via the existing `WaterMediumEffect`.
- If WebGL2 itself fails, show the repo's existing init-error message path (see `src/main.ts`) with a plain explanation, not a blank canvas.
- A WebGPU path is out of scope. Do not write one. See open question 1 in `plan.md`.

## Reused systems

Reuse these. Extend them through parameters or small additive changes; do not fork them.

| Need | Existing file |
|---|---|
| Water absorption, in-scatter, shafts, caustic GLSL, `SURFACE_Y` | `src/rendering/WaterMedium.ts` (`WATER`, `CAUSTIC_GLSL`, `WaterMediumEffect`, `UnderwaterBloomEffect`) |
| Renderer, lights, pixel ratio cap, dynamic resolution, quality hooks | `src/rendering/RenderingEngine.ts`, `src/rendering/DynamicResolution.ts` |
| Post chain (tone map, bloom, SMAA, vignette) and DoF toggle | `src/rendering/PostProcessingPipeline.ts` |
| Surface seen from below, Snell's window | `src/rendering/FFTOcean.ts`, `src/rendering/OceanCascade.ts` |
| Sun direction, environment lighting | `src/rendering/HDRIEnvironment.ts` |
| Camera, scripted spline flight, swim clamp | `src/rendering/CameraController.ts` (`playCinematic`, `clampToSwimVolume`) |
| Seabed height function pattern and datum | `src/rendering/RealisticOceanFloor.ts` (`seabedY`, `FLOOR_DATUM`) |
| Kelp, seagrass, coral, anemones, reef props | `src/rendering/KelpForest.ts`, `AnimatedSeagrass.ts`, `CoralFormations.ts`, `SeaAnemones.ts`, `ReefProps.ts` |
| Tube geometry (kelp stems, pipes, rails) | `src/rendering/TaperedTube.ts` |
| Merging static meshes, deduping materials | `src/rendering/SceneOptimizer.ts` (`mergeStaticSubtree`, `dedupeMaterials`, `optimizeDecor`) |
| Instanced fish with GPU animation | `src/rendering/BatchedMeshPool.ts`, `src/creatures/SchoolFishModel.ts`, `ProceduralFishGeometry.ts` |
| Schooling and spatial queries | `src/systems/FIRASystem.ts`, `src/spatial/SpatialHashGrid.ts` |
| Marine snow, plankton, bubbles | `src/rendering/UnderwaterParticles.ts` |
| Glow for lamps and relics | `src/rendering/Bioluminescence.ts` |
| HUD container, stats panel | `src/ui/UIManager.ts` |
| Draw-call budget test pattern | `src/__tests__/DrawCallBudget.test.ts` |

Known gaps you must fill yourself: a seeded PRNG, a world larger than the current swim volume (`clampToSwimVolume` is hard-wired to a 60 m half-width and `seabedY`), touch controls, pointer-lock mouse look (the camera today uses mouse-drag), URL parameter parsing, and a heightfield for the reef shelf. Make `clampToSwimVolume` take bounds and a floor function as arguments so the default mode behaves exactly as before.

## Controls

Desktop:

| Input | Action |
|---|---|
| W A S D | swim forward, left, back, right |
| Mouse (pointer lock after a click) | look |
| E / Q | rise / dive (matches the repo README) |
| Shift | sprint |
| R | sonar ping (shows relic bearing) |
| 1 to 6 | jump to the six review shots |
| H | hide or show the HUD (matches the repo) |
| Esc | release pointer |
| F, B | dev build only (`?dev=1`): play the scripted fly-through, run it as a benchmark |

Mobile: a left-thumb virtual stick for move, a right-half drag for look, two hold buttons for rise and dive, a ping button, a one-tap quality toggle. No tilt control. Buttons are at least 48 px. Handle `touchstart` with passive listeners and no per-event allocation.

Movement: swim speed 8 m/s, sprint 24 m/s, velocity eased with a 0.35 s time constant so it feels like water, no collision with architecture beyond a soft push-out sphere of 1.2 m radius against the world's distance-field proxies (cheap analytic proxies, not mesh collision). Camera never leaves the swim volume below.

Field of view 70 degrees vertical on desktop, 75 on phones in portrait. Near plane 0.2 m, far plane 400 m.

## World conventions

These are in the repo's units: metres, +Y up, sea level at y = 0 (`SURFACE_Y`). Existing default mode uses a floor datum of -30 and a 60 m swim box; this mode has its own world.

- Axes: +X east, +Z south, -Z north. The reef wall is to the north, the open drop-off is to the south.
- Shelf plateau (city floor): y = -34. Hero tower tip: y = -7. Highest ruin: y = -12 except the Spire. Reef wall rises from y = -34 at z = -170 to y = -6 at z = -240. The shelf edge is at z = +200 and falls to y = -120 by z = +260.
- City centre at the origin. The Astrolabe Spire (see `artstyle.md`) stands at (0, 0) with base y = -34.
- Swim volume: x in [-260, 260], z in [-230, 290], y from the local floor plus 1.0 m up to y = -1.5 (just under the surface). Soft-push at the edges, no hard wall; at the drop-off the water darkens and a gentle current pushes you back.
- Fixed sun direction (towards the sun): (-0.35, 0.86, -0.36), about 59 degrees elevation from the north-west. Shafts therefore lean towards the south-east. The sun never moves in this mode.
- Fixed seed for review and benchmark: `1177`. This value is provisional. Slice 3 freezes the final value (see Relics) and writes it to `src/atlantis/constants.ts` and `review-shots.json`.
- Layout (fixed, not seeded, so review shots stay valid): Spire Court at the origin (radius 45); the Processional Way colonnade runs south from (0, 45) to the Threshold Gate at (0, 190); the Cistern Basilica sits north at (0, -115); the Bathhouse Terraces west at (-120, -10); Foundry Row east at (130, 20); the Harbour Mole south-west at (-150, 170); the reef wall and its caves to the north and north-east. Seeded decisions only change decay, overgrowth, fish routes and which relics are active.

## Relics and the goal

There are 9 fixed relic sockets. Each run activates 5.

| Id | Position (x, y, z) | Place |
|---|---|---|
| S1 | (0, -30, -4) | Spire plinth |
| S2 | (0, -26, -122) | Basilica apse altar |
| S3 | (-118, -30, -8) | lowest Bathhouse pool |
| S4 | (128, -31, 22) | Foundry bell-forge |
| S5 | (-30, -30, 118) | fallen column nest on the Processional Way |
| S6 | (34, -29, 180) | Threshold Gate keystone |
| S7 | (-150, -31, 165) | wreck on the Harbour Mole |
| S8 | (95, -24, -70) | reef wall cave |
| S9 | (-70, -27, -90) | overgrown kelp cistern |

Selection: shuffle the 9 ids with the seeded PRNG, then take them greedily, skipping any socket within 60 m of one already taken, until 5 are taken. Fall back to the unfiltered shuffle order if fewer than 5 pass. The intended result for the review seed is S2, S3, S4, S6, S8 (a spread across north, west, east, south and the reef). In slice 3, search seeds upward from 1000 until the algorithm yields exactly that set, freeze that seed, and add a Vitest that asserts it.

Relic look: a palm-sized bronze-and-marble disc, each with a different engraved motif (tide, bell, key, shell, star), with a small warm light (about 2800 K) so it is the only warm point in the cold water. Collect by swimming within 2.5 m. Pickup plays a soft chime made with the Web Audio API (no audio files), a ring of motes, and the counter updates.

Help without hand-holding: pressing R pings. A bearing arrow and a distance read-out to the nearest uncollected relic show for 4 seconds, cooldown 8 seconds. The relic's own light is visible through fog from 60 m on high tiers and 35 m on mobile.

Win: collecting the fifth relic makes the Spire's three rings slowly align, a single shaft lights the Spire Court, and an end card shows time taken, the seed and a Copy link button.

Progress is not saved between sessions in the first version.

## Share URLs

`/?mode=atlantis&seed=1177&tier=auto`

| Parameter | Meaning | Default |
|---|---|---|
| `mode` | `atlantis` enters the mode; absent means the normal simulator | absent |
| `seed` | integer 0 to 4,294,967,295; anything else is rejected and replaced by the default | 1177 |
| `tier` | `auto`, `0`, `1`, `2`, `3` | `auto` |
| `shot` | 1 to 6, start at a review shot | none |
| `dev` | `1` enables F and B and the frame-time overlay | off |

Parse with `URLSearchParams` once at startup. Treat all values as untrusted: validate with a strict integer parse and clamp, never put them into `innerHTML`. The Copy link button builds the URL from validated state. Do not send the seed or the URL to the analytics layer.

## Review shots

The six shots live in `review-shots.json` (positions and look-at points are in repo units). Keys 1 to 6 jump to them. Each is rendered at the fixed seed with the camera frozen and sway off. For each, keep a reference PNG outside git for the visual critic. Do not tune the shots after slice 3 unless a shot is outright broken; the shots must stay comparable across slices.

## Scripted fly-through (60 s)

One smooth Catmull-Rom spline through the keyframes below, via `CameraController.playCinematic`. Peak speed 30 m/s, yaw rate at most 40 degrees per second, no roll. Look-at points are given where the camera does not look along the path.

| Time (s) | Position | What it shows |
|---|---|---|
| 0 | (60, -8, 260) | descent from the drop-off, the whole city below |
| 8 | (30, -18, 215) | over the Threshold Gate |
| 18 | (6, -27, 110) | down the Processional Way between columns |
| 28 | (20, -16, 48) | spiral up to the Spire rings, look at (0, -14, 0) |
| 36 | (-20, -14, 10) | through the rings, look at (0, -12, 0) |
| 44 | (-110, -22, 20) | over the Bathhouse Terraces |
| 52 | (-40, -27, -70) | into the Cistern Basilica, look at (0, -24, -118) |
| 60 | (0, -20, -40) | pull out to a wide Spire framing, look at (0, -16, 0) |

Benchmark mode (B) plays the path twice, logs frame deltas, and prints average, p50, p95, p99 and max, plus draw calls and triangles per second of path. Run it per tier and record results in the PR description.

## Verification

- `pnpm run biome:check`, `pnpm run build` (runs `tsc`), `pnpm run test` must pass.
- Visual critic: a separate session that sees only `artstyle.md` and your renders (never your code or reasoning) judges the six shots plus fly-through frame pairs and 100 percent crops of marble, bronze, kelp and water highlights, using the rubric at the end of `artstyle.md`. Run it after slice 3 (look-dev), after slice 6 (population and overgrowth) and at the end. Iterate until nothing above Minor remains. If a defect survives 3 real fix attempts, record it as a known limitation with what you tried.
- Performance: run the benchmark on a desktop and on a real mid-range phone (or the closest emulation, flagged as emulation). Never claim a phone number from desktop emulation.
- Before trusting any render or timing, confirm the browser is on a hardware GPU, not SwiftShader or llvmpipe.

## Workflow rules

- Harness first: camera, controls, shots, fly-through, stats overlay. Then the look on one hero object (the Spire). Then populate. A few things that look real beat many props.
- One slice per PR, each with its acceptance test from `plan.md`.
- Use Edit and Write tools for files; keep commands under 2 minutes; cap the frame rate during development; do not leave the dev server running.
- Do not change the default simulator's look or controls as a side effect.

## Done when

All slices in `plan.md` are merged, the critic reports nothing above Minor on the six shots, the benchmark meets the budgets on desktop and on a mid-range phone, and a fixed-seed URL reproduces the same city, the same 5 relics and the same review shots every time.
