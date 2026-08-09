# Creature models (optional GLTF pipeline)

Procedural creatures are the default and currently match the cinematic underwater look
better than most free low-poly packs. This folder is the drop-in point when you have
**mid/high-poly** models you want to swap in for hero species.

## When to use models

| Source | Verdict for this project |
|--------|--------------------------|
| Quaternius / poly.pizza “Animated Fish” | Stylized cartoon — usually clashes with AgX + Beer-Lambert water |
| Photogrammetry / sculpted CC0 (real proportions) | Good — use these |
| Keep procedural | Best default until you have the above |

## Activating

1. Drop `.glb` files here named per species:
   - `shark.glb` · `dolphin.glb` · `ray.glb` · `turtle.glb` · `whale.glb`
2. In `src/creatures/CreatureModelLoader.ts`, uncomment the matching entries in
   `CREATURE_MODEL_PATHS`.
3. Restart the dev server. Console will warn on any failed load; that species
   stays procedural.

## Conventions

- Models should ideally face **-X** (nose toward −X). The loader auto-rotates
  common +Z-forward packs when Z is the long axis.
- Each model is centered and scaled to a unit box; the ECS `Scale` component
  sizes individuals.
- Vertex colors and material base colors are preserved into the bake so
  patterned models keep their paint under the shared underwater shader patches.

## Good sources (CC0 / check license per file)

- [Poly Pizza](https://poly.pizza) — filter CC0; prefer higher triangle counts
- [Sketchfab](https://sketchfab.com) — filter Downloadable + CC0
- [Quaternius](https://quaternius.com) — great for stylized games, weak fit here

## Species keys

`shark` · `dolphin` · `ray` · `turtle` · `whale`  
(Fish schools, jellyfish, and floor critters stay procedural.)
