# Sunken Atlantis: delivery plan

Each slice is one PR. Do them in order unless a note says they can overlap. Every slice ships with its acceptance test and leaves the default simulator unchanged.

Model column: "Top" means a top-tier model session, because the slice is about taste, hard performance trade-offs or cross-cutting design. "Sonnet" means a Sonnet session can do it from this spec.

Standing checks for every slice: `pnpm run biome:check`, `pnpm run build`, `pnpm run test`, the zero-allocation guard, and the draw-call budget test once slice 2 adds it.

| # | Slice | Model | Size |
|---|---|---|---|
| 0 | Art bible review (owner) | owner | no code |
| 1 | Mode scaffold, URL, seeded PRNG, tier detection | Sonnet | small |
| 2 | Harness: world bounds, camera, controls, touch, shots, fly-through, stats | Sonnet | medium |
| 3 | Look-dev on the Spire and the shelf | Top | medium |
| 4 | Architecture kit and decay operators | Top | large |
| 5 | City layout and districts | Sonnet | large |
| 6 | Overgrowth rules: kelp, coral, sand | Sonnet, with a Top review of the placement rules | medium |
| 7 | Life: fish schools, motes, lamps | Sonnet | medium |
| 8 | Relics, ping, goal, end card, share link | Sonnet | medium |
| 9 | Tiers, lite fallback, phone performance | Top | large |
| 10 | Polish, critic loop, README | Top | medium |

## Slice 0: art bible review (owner, no code)

You read `artstyle.md`, edit anything you dislike, add 6 to 8 reference images under `docs/sunken-atlantis/refs/`, and confirm or change the layout and the hero structure.

Acceptance: you reply "approved" on the PR, or push edits. No rendering code is merged before this.

## Slice 1: mode scaffold

Add `src/atlantis/` with `constants.ts` (world numbers from `prompt.md`), `prng.ts` (mulberry32), `params.ts` (URL parsing with strict validation), `tier.ts` (detection plus override), and a mode entry that `src/main.ts` calls only when `?mode=atlantis`. Show a loading card and an empty sea.

Acceptance:
- Vitest: `params` rejects `seed=abc`, `seed=-1`, `seed=1e99`, `tier=9`, and `<script>` strings, and accepts `seed=1177`.
- Vitest: the PRNG gives the same first 1,000 values for the same seed.
- Opening `/` without parameters is pixel-identical to before (existing tests pass; manual check of the default scene).
- `?mode=atlantis&tier=0` and `&tier=3` both start without errors.

## Slice 2: harness

World bounds and a shelf floor function for the mode, `clampToSwimVolume` generalised to take bounds and a floor function (default arguments keep the old behaviour), pointer-lock look, WASD, E and Q, Shift, touch stick and buttons, keys 1 to 6, `shot` parameter, the 60 s fly-through from `review-shots.json` via `playCinematic`, the `?dev=1` stats overlay, the benchmark (B), the zero-allocation guard and the draw-call budget test with placeholder geometry (a flat shelf and 6 coloured pillars at the shot positions).

Acceptance:
- Vitest: zero-allocation guard passes for 600 frames of the update loop.
- Vitest: camera clamp keeps 10,000 random positions inside the volume and at least 1.0 m above the floor.
- Manual: keys 1 to 6 land on the six shots; the fly-through runs 60 s with peak speed at most 30 m/s and yaw at most 40 degrees per second (logged by the benchmark).
- Manual on a phone: stick and look work, buttons are at least 48 px, no page scroll or zoom while playing.

## Slice 3: look-dev (top-tier session)

Make one thing look right before building the city. Water preset for Atlantis (clear lagoon extinction values), fixed sun, shafts, caustics on the shelf, the Astrolabe Spire with marble, bronze and verdigris materials, the rings animation, lamps, sand and contact darkening, tone mapping and bloom settings. Freeze the review seed so relics S2, S3, S4, S6, S8 are active, and add the test.

Acceptance:
- Shots 1 and 3 rendered at the fixed seed, plus 100 percent crops of marble, bronze and a caustic area.
- Visual critic pass with the rubric: no Blocker, no Major on shots 1 and 3, Minor at most 3 each.
- Vitest: with seed search upward from 1000, the relic algorithm yields S2, S3, S4, S6, S8 and the frozen seed is asserted.
- Benchmark number for the Spire scene on tier 3 and tier 1 recorded in the PR.

## Slice 4: architecture kit (top-tier session)

The generators from `artstyle.md` section 6 (revolved profiles, extruded and tapered polygons, arch modules, stairs, swept rings, damage operators), producing chunked, merged or instanced geometry. Generators are pure functions of (params, seed) with unit tests. A kit gallery page under `?mode=atlantis&dev=1&gallery=1` shows each generator at three decay values.

Acceptance:
- Vitest: each generator is deterministic (same inputs, identical vertex hash), has no NaN, and stays under a per-generator triangle cap.
- Vitest: damage operators never leave a piece below the floor or detached more than 0.5 m from its support.
- Gallery screenshot shows bevelled edges (no sharp box corners) at 3 decay values.
- Critic pass on the gallery for marble versus bronze material read.

## Slice 5: city layout

Place districts from section 5 of the art bible at the fixed coordinates, chunk the world into a grid (suggested 32 m cells) with frustum culling and distance culling to 160 m (desktop) and 100 m (phone), and LOD per chunk with cross-fade hidden by the water medium. Seeded decay and toppling rhythm along the Processional Way.

Acceptance:
- Vitest: at the fixed seed the world has the same object counts per district on every run (snapshot test).
- Vitest: the draw-call budget stays within tier limits for all six shots.
- Shot 1 silhouette test passes the critic (yes/no test 2).
- Fly-through shows no popping in frame pairs.

## Slice 6: overgrowth

Placement rules from section 10: sand drifts, kelp holdfasts on sheltered faces, coral crusts on upward faces and edges, using the surface normal and decay, reusing `KelpForest`, `AnimatedSeagrass`, `CoralFormations` and `TaperedTube` where they fit. Kelp sway on a time uniform.

Acceptance:
- Vitest: for a sample column set, no kelp holdfast sits on a downward face, and coral density on upward faces exceeds that on sun-facing vertical faces.
- Shots 2 and 5 pass the critic on yes/no tests 5, 7 and 8.
- Triangle and draw-call budgets still hold.
- Top-tier review of the placement rules before merge, because they decide the look.

## Slice 7: life

Fish schools via the existing instanced fish and FIRA steering, with city-aware avoidance (analytic proxies, no mesh queries); small reef fish in coral; one large ray or turtle on a slow path; marine snow and motes; bronze lamp glow via the existing glow system.

Acceptance:
- Vitest: school members stay within 12 m of the school centre and never enter a wall proxy over 2,000 simulated steps.
- Fish counts per tier match the budget table.
- Critic yes/no test 9 passes.
- Zero-allocation guard still passes.

## Slice 8: relics and share link

Relic sockets and the seeded selection, relic meshes and light, pickup logic, HUD counter, R ping with bearing arrow and cooldown, chime with Web Audio, win state with the Spire alignment and end card, Copy link button.

Acceptance:
- Vitest: selection is deterministic, returns 5 unique ids, respects the 60 m spacing rule, and matches the frozen set at the review seed.
- Vitest: pickup triggers only within 2.5 m and only once.
- Manual: collecting all 5 at the review seed shows the end card; the copied URL, opened in a fresh tab, reproduces the same relics.
- Share link validation test from slice 1 still passes.

## Slice 9: tiers, lite fallback, phones (top-tier session)

Implement tier 0 to 3 as specified in `prompt.md`: material-embedded water, shaft cards, no composer in tier 0, render-scale control through `DynamicResolution`, runtime tier step-down, reduced-motion handling, and the init-failure message. Profile on real hardware.

Acceptance:
- Benchmark table in the PR for desktop tier 3 and 2, and a mid-range phone tier 1 and tier 0. Budgets from `prompt.md` met, or the gap stated.
- Vitest: tier 0 builds without `EffectComposer` and without render targets (mocked capabilities).
- Manual: forcing a software renderer (or `?tier=0`) still runs the full relic loop.
- No visible tier-to-tier change in layout, only in detail and effects (critic compares shot 1 across tiers).

## Slice 10: polish and critic loop (top-tier session)

Retune the six shots, final critic rounds, a README section for the mode, the share link on the main UI, a hero GIF or still for the repo. Record known limitations.

Acceptance:
- Critic reports nothing above Minor on all six shots and the temporal pairs.
- All standing checks pass; benchmark numbers in the README.
- The fixed-seed URL reproduces the same city and relics on two different machines.

## Open design questions for the owner

1. WebGL only or WebGPU too? This plan stays on the repo's WebGL2 renderer, which covers phones today. A WebGPU path would only add value for the top tier and costs a second renderer. Recommended: no, revisit after slice 9.
2. Is the city name Halcyra and the hero, the Astrolabe Spire, right? Both are easy to change now and hard to change after slice 4.
3. Do you want the clear-lagoon water for this mode (about 110 m visibility), or the repo's darker default (about 60 m) for a moodier, smaller-feeling city?
4. Is the goal "find 5 of 9 hidden relics, with a ping" the right amount of game, or should relics always be in the same 5 places so the share link is only about the look?
5. Should audio (a soft chime on pickup, optional low ambient hum) ship, given there are no audio files and everything would be synthesised?
