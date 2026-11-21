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

# Reef props

Scanned corals and sponges in `reef/`, placed by `ReefProps` on the reef patches. Each
file is up +Y, base at y = 0, largest dimension 1. Many are dried museum skeletons, so
`REEF_PROP_PATHS` tints them toward the colour of living coral.

| File | Species | Source | Author | License |
|------|---------|--------|--------|---------|
| `reef/brain_rose.glb` | Rose brain coral (*Manicina areolata*) | [Sketchfab](https://sketchfab.com/3d-models/rose-brain-coral-26f4071ad44a41eeb7b179045135522d) | RISD Nature Lab | CC BY 4.0 |
| `reef/brain_platygyra.glb` | Lesser valley brain coral (*Platygyra daedalea*) | [Sketchfab](https://sketchfab.com/3d-models/brain-coral-platygyra-daedalea-0e9aa3ac05034dba8ebd3d0b8f24357a) | jordanmakesmaps | CC BY 4.0 |
| `reef/staghorn.glb` | Staghorn coral (*Acropora cervicornis*) | [Sketchfab](https://sketchfab.com/3d-models/staghorn-coral-8c14ba2dddcb48cb9650e84fb60260e5) | RISD Nature Lab | CC BY 4.0 |
| `reef/elkhorn.glb` | Elkhorn coral (*Acropora palmata*) | [Sketchfab](https://sketchfab.com/3d-models/elkhorn-coral-acropora-palmata-ce0fdf05ab8c4a0e94015cf3798cbc45) | Patric Lengacher | CC BY 4.0 |
| `reef/organpipe.glb` | Red organ pipe coral (*Tubipora musica*) | [Sketchfab](https://sketchfab.com/3d-models/red-organ-pipe-coral-eaaaffad58a14c52b36c3d6550c54167) | RISD Nature Lab | CC BY 4.0 |
| `reef/barrel_sponge.glb` | Giant barrel sponge (*Xestospongia testudinaria*) | [Sketchfab](https://sketchfab.com/3d-models/barrel-sponge-xestospongia-testudinaria-6e42a8bd6a5245a3a3fe6a1248045e4d) | jordanmakesmaps | CC BY 4.0 |
| `reef/tube_sponge.glb` | Yellow tube sponge | [Sketchfab](https://sketchfab.com/3d-models/yellow-tube-sea-sponge-820da7fd539549a0a6274048116eeeb3) | RISD Nature Lab | CC BY 4.0 |
| `reef/tridacna.glb` | Boring clam (*Tridacna crocea*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-boring-clam-tridacna-crocea-af688a0ed6044ab99d0ec20c57fd3b18) | ffish.asia / floraZia.com | CC0 |
| `reef/pocillopora.glb` | Cauliflower coral (*Pocillopora damicornis*) | [Sketchfab](https://sketchfab.com/3d-models/pocillopora-damicornis-caespitosa-662c5b9144334e678b871f1960c03392) | Smithsonian Institution | CC0 |

The CC BY files were modified: decimated, re-oriented, rescaled, and textures downsized.
