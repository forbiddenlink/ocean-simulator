# Ocean Simulator Visual Overhaul

## Goal
Transform the ocean simulator from a technically accurate but visually flat experience into a photorealistic, atmospheric underwater world. Every system gets a pass: creatures, lighting, fog, floor, particles, caustics, and post-processing.

## Phase 1: Creature Materials & Coloring

**Problem:** All creatures use white `MeshStandardMaterial` with emissive `0x111111`. They look like untextured clay models.

**Changes:**
- Replace white base with species-specific colors using `MeshPhysicalMaterial`
- Fish: Silver-blue bodies with darker dorsal, lighter ventral (countershading)
- Sharks: Gray-blue gradient, rougher skin (roughness 0.7-0.8)
- Dolphins: Gray gradient with lighter belly, slight metalness (0.15)
- Jellyfish: Use `transmission: 0.6-0.8` for translucent glass-like appearance
- Rays: Dark top, white bottom, slight iridescence
- Turtles: Green-brown shell with pattern via emissive variation
- Whales: Dark gray-blue, matte (roughness 0.9)
- Add `iridescence: 0.3-0.5` on schooling fish for shimmer effect
- Apply depth-based color tinting in creature update loop

**Files:** `src/rendering/BatchedMeshPool.ts`, new `src/rendering/CreatureMaterials.ts`

## Phase 2: God Rays Replacement

**Problem:** Current 3000-particle system creates vine-like artifacts. Disabled.

**Changes:**
- Replace particle-based approach with screen-space volumetric light shafts
- Use a bright sun disc mesh above the water surface as light source
- Render light source to occlusion texture
- Apply radial blur from sun screen position (6-pass blur)
- Blend additively with scene at low opacity (0.15-0.25)
- Color: warm blue-white `(0.6, 0.8, 1.0)` with slight falloff
- This technique doesn't create vine artifacts since it works in screen space

**Files:** Replace `src/rendering/GodRaysEffect.ts`, update `src/rendering/PostProcessingPipeline.ts`

## Phase 3: Underwater Color Grading

**Problem:** No depth-dependent color shift in post-processing. Scene looks uniformly blue.

**Changes:**
- Create custom post-processing Effect using `postprocessing` library
- Read scene depth buffer to determine per-pixel water depth
- Apply Beer-Lambert absorption per-pixel: R fades fast, G medium, B persists
- Add subtle desaturation with depth (colors become more monochromatic)
- Reduce contrast at distance (scattering effect)
- Slight blue-shift bias on all colors
- Configurable turbidity parameter (clear tropical vs murky coastal)

**Files:** New `src/rendering/UnderwaterColorGrading.ts`, update `PostProcessingPipeline.ts`

## Phase 4: Volumetric Fog Fix

**Problem:** Current implementation washes everything white. Disabled.

**Changes:**
- Replace box-geometry fog volume with depth-based exponential fog
- Use `THREE.FogExp2` with density 0.012-0.018 (tuned to not white-wash)
- Fog color matches wavelength lighting: `0x0a3a5a` (deep blue-green)
- Dynamic fog density based on camera depth (thicker deeper)
- Fog color shifts with depth: greener shallow, bluer deep
- Remove VolumetricFog.ts ray marching approach entirely
- Re-enable in RenderingEngine with proper parameters

**Files:** `src/rendering/WavelengthLighting.ts`, `src/rendering/RenderingEngine.ts`

## Phase 5: Ocean Floor & Environment

**Problem:** Floor is blue-gray and flat. Coral overly saturated. Kelp sparse and dark.

**Ocean Floor Changes:**
- Warm sandy colors: base `0xa09070` (warm sand), dark `0x887060` (wet sand)
- Increase rock count from 50 to 120, add larger focal rocks (scale 3-5)
- Add scattered shells and pebbles (small sphere/capsule geometry)
- Increase floor subdivisions for finer detail
- Add sand mound variations (height 0.5-2.0 at random positions)

**Coral Changes:**
- Desaturate colors ~20% to account for underwater absorption
- Increase emissive to 0.2-0.3 for subtle glow
- Add more coral count (+30%) for denser reef areas
- Cluster corals in groups rather than random scatter

**Kelp Changes:**
- Increase count from 40 to 70 plants
- Restore heights to 6-12 units
- Brighten colors: add vivid green tones `0x6d9a4a`, `0x7daa5a`
- Increase fronds per plant from 3-6 to 5-10
- Reduce opacity from 0.9 to 0.75 for translucency

**Files:** `src/rendering/RealisticOceanFloor.ts`, `src/rendering/CoralFormations.ts`, `src/rendering/KelpForest.ts`

## Phase 6: Particle Enhancement

**Problem:** 350 particles sparse for the volume. Bubbles only 12. Bioluminescence pulses too fast.

**Underwater Particles:**
- Increase count from 350 to 600
- Reduce marine snow blue tint (more neutral white/gray)
- Reduce max point size from 12 to 8
- Reduce alpha from 0.55 to 0.35 (more transparent, layered look)
- Add subtle drift animation (particles move with current)

**Bubbles:**
- Increase from 12 to 25
- Change color from white to pale blue `0xccddff`
- Reduce opacity from 0.6 to 0.35
- Add size variation wobble during rise

**Bioluminescence:**
- Increase count from 1000 to 1400
- Slow pulse from 2.0 to 1.2 rad/s (more natural)
- Increase particle sizes from 0.1-0.5 to 0.15-0.8
- Extend distance fade from 30-60 to 40-80 units
- Reduce color intensity from 1.5 to 1.2 (less oversaturated)
- Add slow positional drift so particles float through space

**Files:** `src/rendering/UnderwaterParticles.ts`, `src/rendering/Bioluminescence.ts`

## Phase 7: Caustics & Lighting

**Problem:** Caustics slightly too intense. Lighting could be richer.

**Caustics:**
- Reduce intensity from 0.8 to 0.55
- Increase scale from 20 to 28 (finer patterns)
- Slow depth falloff: exp(-depth * 0.05) instead of 0.08
- Add blue-green tint: `vec3(0.7, 0.95, 1.0)`
- Increase chromatic aberration from 0.02 to 0.035
- Sync caustic animation speed with FFT wave frequency

**Lighting:**
- Increase ambient from 0.35 to 0.45 (less harsh contrast)
- Add subtle fill light from camera direction (0.15 intensity)
- Make sun light color warmer near surface: `0x99ccdd` → `0xaaddee`
- Ensure caustic direction follows sun direction uniform

**Files:** `src/rendering/Caustics.ts`, `src/shaders/caustics.frag`, `src/rendering/RenderingEngine.ts`

## Phase 8: Post-Processing Polish

**Problem:** Bloom threshold too high. Vignette subtle. Missing underwater lens effects.

**Changes:**
- Reduce bloom luminanceThreshold from 0.7 to 0.5 (more objects glow softly)
- Increase bloom luminanceSmoothing to 0.7
- Increase vignette darkness from 0.5 to 0.65
- Add chromatic aberration effect (offset 0.003) for underwater lens
- Add subtle depth of field (far blur only, focus at 20-30 units)

**Files:** `src/rendering/PostProcessingPipeline.ts`

## Implementation Notes

- Each phase should be tested visually before moving to next
- Keep disabled features (old god rays, old volumetric fog) in git history but remove from code
- All color values are pre-absorption - the color grading post-process will shift them
- Performance budget: maintain 60fps on mid-range GPU at 1080p
