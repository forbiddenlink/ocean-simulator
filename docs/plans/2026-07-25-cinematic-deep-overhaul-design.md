# Ocean Simulator — "Cinematic Deep" Portfolio Overhaul

**Date:** 2026-07-25 · **Branch:** `feat/cinematic-deep-overhaul`
**Written against:** commit `9335d22` (main)
**Direction (locked by owner):** **Cinematic Deep** — moody blue-green depth, god-ray shafts,
high contrast, silhouetted schools crossing the light, caustics flickering below. Palette teal → deep navy.
Mood: awe, scale, drama. NOT bright "tropical-clear," NOT photoreal-documentary.

## Goal

Turn a technically strong but visually flat ("swimming-pool teal") Three.js underwater sim into a
portfolio centerpiece that wows in a single frame and a short video. Engine is good; the gap is
**art direction + presentation**. Audience: mixed (recruiters/peers/social) → weight immediate
visual impact + shareability.

## Diagnosis (live + code-verified)

Root causes of the flat look (all confirmed against code):
- God rays **explicitly stubbed off** (`PostProcessingPipeline.ts:225`). #1 hero effect disabled.
- Default look preset = `tropical-clear`, not `inky-cinematic`; cinematic preset exists but is off and
  doesn't touch the washing hemisphere/fill/point lights.
- Hemisphere light @1.4 flattens contrast (outside preset control). No exposure control. CA @0.0008
  imperceptible. No film grain / DOF / LUT grade.
- envMap null → no surface reflections. Floor brightness hard-capped at 0.7; procedurally repetitive.
- Live creature path (`BatchedMeshPool`) has **no rim light**; advanced fish shaders with
  rim/iridescence/SSS already written but disconnected (`EnhancedFishMaterial`, `FishMaterial`,
  `MeshSystem` = dead code).
- Surface "confetti" band of tiny fish reads as noise, not schools.

Keep (good bones): 880 live entities, kelp foreground, dense ecosystem, FFT ocean, instancing, 92 tests.

## Technique north-stars (from research)

- Per-channel **Beer-Lambert** absorption `color *= exp(-coeff*depth)`, coeff ≈ `(0.45,0.10,0.03)`,
  blend toward deep tint (~`#0a2e38`), + exp² depth fog from depth buffer. Desaturate + drop contrast
  with depth. (Biggest single "underwater" win.)
- **God rays:** raymarched shadow-map sampling (à la `three-good-godrays`), not occlusion-sprite; shimmer
  correlated with caustics. Hero effect.
- **Caustics:** dual-scroll voronoi textures (have a system) → tune contrast/pools; optional projected refraction for foreground.
- **Surface from below:** Snell's window + TIR band + blooming sun disc; envMap reflections.
- **Creatures:** countershading everywhere + fresnel rim tinted to ambient + jelly transmission + per-instance color variation + iridescence on schools.
- **Post:** AgX tonemapping (preserves teal better than ACES), stronger CA, subtle film grain, light DOF (fg creature vs hazy bg), final teal LUT/CDL. Bloom only on highlights.
- **Composition:** low slightly-upward camera, 35-50mm FOV, creature silhouetted against shafts.

## Phased plan

- **P0 Foundation** — reliable capture harness (`window.__sim` + `canvas.toDataURL`); repo hygiene
  (87 stray root PNGs → `docs/screenshots/` or purge); build a strong **"Cinematic Deep"** preset as default.
- **P1 Atmosphere/Depth** — Beer-Lambert + exp² depth fog tuned deep; tame hemisphere light; add exposure; depth desaturation/contrast falloff. *(first visible before/after checkpoint)*
- **P2 Hero light** — rebuild god rays (raymarched), correlate caustic shimmer, tune caustic contrast/pools.
- **P3 Creatures** — wire rim light + iridescence + countershading to live path & species meshes; jelly transmission; per-instance variation.
- **P4 Surface + floor** — envMap reflections, Snell's window + sun disc + TIR, kill floor repetition + focal detail, raise brightness cap, light pools.
- **P5 Post polish** — AgX, CA, film grain, DOF, teal LUT; bloom on highlights only.
- **P6 Composition + story** — cinematic intro auto-fly reveal; camera modes (orbit/dolly/follow); reduce surface confetti; guided tour / creature spotlight; Clean⇄Cinematic toggle demo.
- **P7 Wrapper** — intentional HUD identity (not generic glass), loading/title card, README case study with before/after + technique breakdown; align copy (drop "photorealistic" overclaim); `prefers-reduced-motion`.
- **P8 Video + OG** — scripted flythrough → MP4/GIF loop; regenerate `og-image.png` from a hero frame; `llms.txt`, favicon polish.
- **P9 Gate** — Lighthouse perf + a11y (MCP), fps, tests green, `tsc && vite build` passes; fold audit findings.

## Definition of done

- A single screenshot reads unmistakably as a dramatic deep-ocean scene, not a pool.
- A 10-20s hero video that's portfolio/social worthy.
- 60fps target on mid GPU at 1080p (Medium preset); tests + build green.
- README case study explains the techniques (technical-audience credibility).

## Non-goals

- Pixel-accurate photorealism. Perfect real-time volumetrics. Backend/SaaS machinery
  (no auth/payments/multitenancy — irrelevant audit tracks skipped).

## Validation rhythm

Design work validates by **showing**: capture before/after at each phase checkpoint (P1, P2, P3, P5, P6)
and surface to owner rather than asking abstractly.
