# Creature models (optional GLTF pipeline)

The simulator renders every creature from **procedural geometry** by default. This folder is
the drop-in point for real modeled creatures, which beat procedural bodies for realism.

## Activating

1. Get CC0 low-poly sea-life models as `.glb`. Good sources:
   - **Quaternius — "Ultimate Sea"** (public domain): https://quaternius.com
   - **Poly Pizza** (filter to CC0): https://poly.pizza
2. Drop the files here, named per species, e.g. `shark.glb`, `dolphin.glb`, `ray.glb`,
   `turtle.glb`, `whale.glb`.
3. Register them in `src/creatures/CreatureModelLoader.ts` → `CREATURE_MODEL_PATHS`:
   ```ts
   export const CREATURE_MODEL_PATHS: Record<string, string> = {
     shark: '/models/shark.glb',
     dolphin: '/models/dolphin.glb',
     ray: '/models/ray.glb',
     turtle: '/models/turtle.glb',
     whale: '/models/whale.glb',
   };
   ```

That's it. Registered species use the model; anything unregistered (and the instanced fish)
stays procedural. Loaded models flow through the same countershading / rim-light / caustic
material treatment as the rest of the scene, and are driven by the existing movement AI.

## Conventions

- Models should face **-X** (nose toward -X), matching the procedural bodies, so the
  velocity-based orientation points them the right way.
- Each model is auto-centered and scaled to a unit bounding box; the per-creature `Scale`
  component then sizes it — so absolute model scale does not matter.
- Loading is best-effort and per-file guarded: a missing or broken `.glb` is logged and that
  creature simply falls back to procedural. It can never break the app or block startup.

## Species keys

`shark` · `dolphin` · `ray` · `turtle` · `whale` (see `MODEL_KEY_BY_TYPE` in
`src/rendering/BatchedMeshPool.ts`). Fish, jellyfish, and floor critters remain procedural.
