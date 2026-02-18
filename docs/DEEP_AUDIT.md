# Ocean Simulator — Deep Audit (2026-02-18)

## Goals (as stated)
- Look **realistic** and **visually impressive** — “exactly like the ocean” vibe
- Fix bugs:
  - fish don’t swim/look right
  - some things not showing properly on the page

## What I inspected
- Core loop + pipeline: `src/OceanSimulator.ts`
- Behavior/movement: `src/systems/FIRASystem.ts`, `src/systems/EnhancedMovementSystem.ts`
- Animation: `src/systems/BiomechanicalAnimationSystem.ts`
- Rendering: `src/rendering/RenderingEngine.ts`, `src/rendering/BatchedMeshPool.ts`
- Entity creation: `src/core/EntityFactory.ts`

## Key architecture observations
- You’re using **bitECS** with a pipeline of systems.
- Fish rendering is **instanced** (4 body types) with a GPU vertex deformation shader in `BatchedMeshPool.createFishMaterial()`.
- Complex creatures (sharks/dolphins/etc.) are **individual meshes** and get CPU-side biomechanical deformation via `applyBiomechanicalAnimationToMesh`.

This split is good: you can keep 500+ fish without murdering performance.

---

## Findings & Fixes (done)

### 1) Fish orientation bug (major “looks wrong” culprit)
**Symptom:** fish appear rotated incorrectly / swim sideways / don’t face travel direction.

**Cause:** your model forward axis is **-X** (head at -X, tail at +X), but the yaw calculation used `atan2(vx, vz)` (swapped axes), producing a 90°/wrong heading.

**Fix applied:** updated yaw to:
- `yaw = atan2(vz, vx) + PI`

Files:
- `src/rendering/BatchedMeshPool.ts`

Commit:
- `Fix fish orientation: correct yaw for -X forward model`

### 2) Fish swim animation too subtle at low speeds
**Symptom:** fish can look “frozen” or barely animated when cruising.

**Cause:** GPU swim amplitude scales directly with `speed / maxSpeed`, and a lot of fish cruise slow (plus drag), so normalized speed can be tiny.

**Fix applied:** added a baseline so the fish always read as swimming:
- `normalizedSpeed = 0.25 + raw * 0.75` (clamped)
- slightly adjusted phase rate

Files:
- `src/rendering/BatchedMeshPool.ts`

Commit:
- `Make fish GPU swim animation readable at low speeds`

---

## Likely remaining issues (next fixes)

### A) “Some stuff isn’t showing up properly”
Most common causes in this codebase:
1. **Over-aggressive fog / post-processing depth adjustments** masking meshes
2. **Transparent materials** + render order + depthWrite/depthTest weirdness (jellyfish)
3. **Frustum culling** on large instanced meshes if bounding spheres aren’t updated
4. Entities spawning outside the camera volume (less likely — camera is centered at y=-12 and spawn ranges look reasonable)

**Next diagnostic steps:**
- add an in-app debug overlay for:
  - visible counts by type
  - camera position
  - fish instanced mesh bounding box/sphere
  - toggles: post-processing on/off, fog on/off, FFT ocean on/off

### B) Instanced fish lighting/material realism
The instanced fish material is a `MeshPhysicalMaterial` with shader injection — good, but it’s still fairly “plastic.”

**Next upgrade options (pick one):**
1) Keep MeshPhysicalMaterial but add:
   - depth tinting (absorption)
   - subtle normal perturbation / sheen
2) Switch instanced fish to a custom ShaderMaterial that matches your underwater spectral model (bigger change, best result)

### C) Fish locomotion realism beyond just tail wiggle
Right now instanced fish animation is a single procedural wave. We can improve:
- burst vs glide visuals (match the BiomechanicalAnimationState)
- turn banking visuals (use roll + lateral bend)
- per-species style (tuna = tighter tail beat; disc fish = more pectoral flapping)

---

## What I’m doing next (continuous improvement plan)
1) Add a **Debug Mode panel** (in lil-gui or your UIManager) with “visual toggles” + metrics.
2) Fix any visibility/culling issues (instancing bounding volumes + fog/postprocessing interactions).
3) Upgrade the fish GPU animation to:
   - react to turn rate (stronger tail deflection on turns)
   - species/body-type parameterization
4) Do a lighting pass to push it toward “real ocean”:
   - distance haze
   - depth absorption that feels correct
   - caustics intensity tuning

## How to run
```bash
cd /Volumes/LizsDisk/ocean-simulator
npm run dev -- --host --port 5179
```

---

## Questions for you (so I match your taste precisely)
1) What’s your reference for “exactly like the ocean”? (1–3 links or a vibe: tropical shallow / deep open ocean / kelp forest / reef)
2) Do you want “cinematic” (slightly stylized, high contrast) or “documentary” (true-to-life)?
3) Are we optimizing for a **recorded demo video** (looks insane on screen) or **interactive** (smooth FPS + exploration)?
