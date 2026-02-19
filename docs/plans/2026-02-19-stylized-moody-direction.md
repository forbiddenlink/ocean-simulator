# Ocean Simulator — Stylized Moody / Cinematic Direction (2026-02-19)

## Goal
Pivot the experience from “photoreal ocean” to a **stylized art piece** that feels **moody, deep, inky, cinematic**—optimized for an impressive interactive demo + short screen-recorded clips.

This direction prioritizes:
- strong silhouette/readability
- art-directed color + fog
- intentional post-processing
- stable performance over raw realism

## Demo moment (target)
- Start in near-dark open water → a slow reveal as a volumetric light shaft cuts through particulates → a school of fish passes through the beam → subtle caustics flicker on a rocky form below.
- One keybind toggles between “Clean” and “Cinematic” grade to show the transformation.

## Art direction pillars
1) **Inky depth**
- Heavy depth absorption (blue/green falloff)
- Darker midtones; highlights reserved for rays/caustics

2) **Particulate mood**
- Visible suspended particles/dust motes
- Slight bloom on highlights for underwater haze

3) **Readable fauna**
- Slightly exaggerated rim lighting
- Emphasize schooling motion as a graphic element

## Implementation plan (incremental)
### Phase 1 — Controls + baseline look (fast)
- Add a "Look Preset" switch: `Clean | Cinematic-Inky`
- Expose 8–12 key parameters in lil-gui:
  - fog density / color
  - absorption coefficients
  - bloom strength/threshold
  - vignette
  - chromatic aberration (very subtle)
  - film grain/noise (subtle)

### Phase 2 — Particles + rays
- Improve particle system to read in the beam (size variation + depth fade)
- Tune god rays/volumetric to be the hero effect (avoid blowing out)

### Phase 3 — Caustics + sea floor readability
- Art-direct caustics intensity to “flicker” occasionally
- Ensure sea floor silhouettes read (contrast banding + light pools)

## Non-goals (for this stylized pass)
- Perfect physical accuracy
- Perfect real-time volumetrics
- Fully realistic creature anatomy

## Acceptance criteria
- Inky preset looks cinematic on a normal laptop display.
- Inky preset produces a 10–20s screen recording that looks portfolio-worthy.
- Toggle demo is obvious and satisfying.
