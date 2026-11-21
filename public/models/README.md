# Creature models

These GLB files replace the procedural bodies of the large creatures. Each species stays
procedural if its file fails to load.

| File | Species | Source | Author | License |
|------|---------|--------|--------|---------|
| `shark.glb` | Scalloped hammerhead | [Sketchfab](https://sketchfab.com/3d-models/cc0-scalloped-hammerhead-shark-b68fdc989ba74bec9495ac907995739e) | ffish.asia | CC0 |
| `ray.glb` | Japanese eagle ray | [Sketchfab](https://sketchfab.com/3d-models/cc0-japanese-eagle-ray-m-tobijei-b2a2da49b65c4bfd8e037ac1b528b2e8) | ffish.asia | CC0 |
| `dolphin.glb` | Bottlenose dolphin | [Sketchfab](https://sketchfab.com/3d-models/bottlenose-dolphin-4bb04fa58d6846938e07bb38507e3f3a) | popcornbag | CC BY 4.0 |
| `turtle.glb` | Flatback sea turtle ("Model 53A") | [Sketchfab](https://sketchfab.com/3d-models/model-53a-flatback-sea-turtle-442372b7f02b4730882d41d959726156) | DigitalLife3D | CC BY 4.0 |
| `whale.glb` | Humpback whale ("Humpback Whale (Idle)") | [Sketchfab](https://sketchfab.com/3d-models/humpback-whale-idle-bd64878acb0844b2be796ee91855c69e) | Connlan_Immure | CC BY 4.0 |

The CC BY files were modified: decimated, re-oriented, rescaled, textures downsized, and
(dolphin) posed from the first animation frame.

## How the files are made

The raw downloads are kept outside the repo. A headless Blender script prepares each one:

1. Drop the colour-calibration card that ffish.asia scans include.
2. Bake skinned meshes in rest pose (the dolphin uses animation frame 0).
3. Join meshes, turn the nose to -X with the back up, centre, and scale to unit length.
4. Weld scan seams, decimate to a triangle budget (8k to 24k), shrink textures to 1024
   or 2048 px, and export GLB with JPEG textures.

## How the app uses them

- `CreatureModelLoader` bakes node transforms into the geometry and keeps the GLTF
  materials. Unlit scan materials become lit `MeshStandardMaterial` so they take the
  underwater light and caustics.
- `CREATURE_MODEL_PATHS` sets each species' world length and swim style.
- The scans have no skeleton. The vertex shader moves them instead: a side-to-side
  wave for sharks, an up-and-down wave for dolphins and whales, flapping wings for rays,
  and flipper strokes for turtles.
- Clones share geometry, materials, and textures, so only `BatchedMeshPool.dispose()`
  frees them.

## Adding a model

Use photogrammetry or sculpted models with real proportions and a license that allows
reuse (CC0 or CC BY). Stylized low-poly packs clash with the water shading. Keep the
nose at -X, add the file to `CREATURE_MODEL_PATHS`, and add a row above with credit.
