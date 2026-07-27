# Ocean Ecosystem Simulator

A **cinematic** real-time underwater ecosystem built with Three.js and bitECS — a moody deep-water world of hundreds of living marine creatures, volumetric god rays, and emergent schooling behaviour, running in the browser.

![Ocean Ecosystem Simulator — Cinematic Deep](public/og-image.png)

> **Hero flythrough:** an 18-second in-engine cinematic dive lives at [`public/hero.mp4`](public/hero.mp4) — surface → through the light shafts and a passing school → over the reef.

## Cinematic Deep — a rendering case study

The engine was technically strong but the art direction read flat — a bright "swimming
pool," not an ocean. A ground-up **Cinematic Deep** pass rebuilt the look toward an
Abzù-style stylized-gorgeous target. The techniques, roughly in order of impact:

**Atmosphere & depth**
- **Per-channel Beer-Lambert depth grading** — red is absorbed fastest, cyan persists, so
  distance dissolves into deep-water murk. The single biggest "ocean not pool" cue.
  (`PostProcessingPipeline` underwater grading + `WavelengthLighting` fog.)
- **Image-based lighting** — fixed a real bug where the environment map was an empty (black)
  cube, flattening every PBR material; replaced with a PMREM underwater gradient so creatures
  pick up plausible ambient reflection. (`HDRIEnvironment`.)
- **Depth of field** — a gentle world-focus DoF keeps mid-field crisp while the far murk
  softens to bokeh, the depth separation that reads as *cinematic*. (`PostProcessingPipeline`,
  quality-gated.)
- **Sun in-scattering** — a warm glow blooms around the sun's projected screen position,
  growing with distance-scatter: light diffusing through the water column.

**Light**
- **Volumetric god-ray shafts** — additive columns descending from the surface with a
  warm-near-surface / cool-deep within-beam gradient and animated shimmer. (`VolumetricLightShafts`.)
- **Organic caustics** — domain-warped voronoi light pooling on the seabed (killed a tiled-grid
  artifact) plus animated caustic dapples on the upward-facing surfaces of every creature, so
  the whole ecosystem shares one light. (`Caustics`, `BatchedMeshPool`.)

**Creatures**
- Shared **countershading** (dark dorsal → pale belly via the world normal) + **fresnel rim**
  so bodies read as lit animals, not grey capsules; fixed a flat-shading bug on a quarter of
  the fish and tapered their bodies into a real caudal peduncle; rebuilt the ray as a proper
  manta wing; extruded flat cardboard fins into 3D. (`SimpleFishGeometry`,
  `SpecializedCreatureGeometry`, `BatchedMeshPool`.)

**Post & art direction**
- **AgX tonemapping** (preserves teal better than ACES), film grain, chromatic aberration,
  bloom-on-highlights, vignette.
- **Three art-directed look presets** — a single button cycles **Cinematic Deep → Bioluminescent
  (a midnight dive where jellies, an anglerfish lure and plankton become the only light) →
  Clean Tropical**. Each preset drives every light, fog, exposure, post parameter and freezes
  time-of-day for reproducibility. (`OceanSimulator.applyLookPreset`.)
- **Presentation** — an auto intro flythrough (cancel-on-input, `prefers-reduced-motion` aware)
  and a loading/title card.

### Engineering notes
- **Optional GLTF creature pipeline** — drop CC0 `.glb` packs into `public/models/` to replace
  procedural bodies with real models (same material + AI). Inert by default. (`CreatureModelLoader`.)
- **Draw-call optimization** — ambient creatures are merged by material at spawn, cutting the
  layer from ~2,200 tiny meshes to ~380 with identical geometry. (`ExtraOceanLife.optimizeDrawCalls`.)
- **Cleanup** — removed ~1,600 lines of dead code and unused dependencies (an ~8 MB physics
  engine that was never imported, plus a dead file-based shader pipeline).

## Features

### Marine Life
- **Living ecosystem**: fish schools, sharks, dolphins, jellyfish, manta rays, sea turtles, whales
- **Bottom dwellers**: crabs, starfish, sea urchins
- **Ambient variety**: octopus, squid, cuttlefish, nautilus, seahorses, moray eels, sea snakes,
  lobsters, hermit crabs, nudibranchs, pufferfish, giant clams, sea cucumbers, comb jellies, and
  a bioluminescent anglerfish
- **Environment**: kelp forests, coral formations, sea anemones

### Rendering
- **FFT Ocean Surface**: Realistic wave simulation with foam and spray
- **Underwater Lighting**: Beer-Lambert light absorption, caustics, god rays
- **Post-Processing**: Bloom, chromatic aberration, color grading, vignette
- **Instanced Rendering**: GPU-optimized for hundreds of fish

### Simulation
- **FIRA Steering**: Fish Intelligent Responsive Algorithm for realistic movement
- **Hunting System**: Predator-prey dynamics with sustainable population balance
- **Schooling Behavior**: Based on Reynolds' boids algorithm
- **Ocean Currents**: Dynamic water flow affecting creature movement

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

## Controls

| Action | Control |
|--------|---------|
| Move | WASD |
| Ascend / dive | Q / E |
| Look | Mouse (drag) |
| Hide interface | H |
| Pause · speed · look mode · replay intro | Buttons in the HUD |

The **Look** button cycles the three art-directed presets (Cinematic Deep · Bioluminescent ·
Clean Tropical). Any movement or click cancels the intro flythrough and hands you control.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Rendering | Three.js |
| ECS | bitECS |
| Post-Processing | postprocessing |
| Build | Vite + TypeScript |

## Project Structure

```
src/
  components/     # ECS components (Transform, Biology, Behavior)
  core/           # World setup, entity factory
  creatures/      # Procedural geometry (fish, sharks, whales, etc.)
  rendering/      # Visual systems (ocean, lighting, particles)
  systems/        # ECS systems (movement, hunting, population)
  shaders/        # GLSL shaders
```

## License

MIT
