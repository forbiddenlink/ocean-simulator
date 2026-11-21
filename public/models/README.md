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

# Critters

Scanned bodies for the small ambient animals in `critters/`, swapped in by
`ExtraOceanLife.applyModels`. Each scan is fitted to the procedural body it replaces
(same longest side and centre; floor dwellers keep their underside on the sand), so
position, size, and idle motion stay the same. A kind whose file fails to load stays
procedural. `CRITTER_MODELS` maps kinds to files. Cowfish have no procedural body and
appear only when their scan loads.

| File | Replaces | Species | Source | Author | License |
|------|----------|---------|--------|--------|---------|
| `critters/octopus.glb` | octopus | Common octopus (*Octopus vulgaris*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-common-octopus-octopus-vulgaris-db7cab212b95485d8257deaf951e3706) | ffish.asia / floraZia.com | CC0 |
| `critters/cuttlefish.glb` | cuttlefish | Golden cuttlefish (*Sepia esculenta*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-golden-cuttlefish-sepia-esculenta-0ddc83f783cd4f82ad06e71b07ef7e94) | ffish.asia / floraZia.com | CC0 |
| `critters/hermitcrab.glb` | hermitcrab | Blue-striped hermit crab | [Sketchfab](https://sketchfab.com/3d-models/cc0-blue-stripped-hermit-crab-5ebe7794183346e998afb97b68021158) | ffish.asia / floraZia.com | CC0 |
| `critters/balloonfish.glb` | pufferfish | Porcupinefish (*Diodon hystrix*) | [Sketchfab](https://sketchfab.com/3d-models/diodon-hystrix-6fc8b7bf018845ab84e56ea6ea0c0e94) | Smithsonian Institution | CC0 |
| `critters/cowfish.glb` | (new) | Longhorn cowfish (*Lactoria cornuta*) | [Sketchfab](https://sketchfab.com/3d-models/longhorn-cowfish-abe1ac6f043840b1936012b83b4a19a1) | RISD Nature Lab | CC BY 4.0 |
| `critters/seahorse.glb` | seahorse | Seahorse | [Sketchfab](https://sketchfab.com/3d-models/seahorse-0f47172461f64588af96f8380d38db4f) | RISD Nature Lab | CC BY 4.0 |
| `critters/moray.glb` | eel | Brutal moray (*Gymnothorax kidako*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-brutal-moray-gymnothorax-kidako-f7b2e7e06e454392bf7d7ab739658d57) | ffish.asia / floraZia.com | CC0 |
| `critters/lobster.glb` | lobster | Japanese spiny lobster (*Panulirus japonicus*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-japanese-spiny-lobster-p-japonicus-56a178ef439c413199551554e430b7c3) | ffish.asia / floraZia.com | CC0 |
| `critters/squid.glb` | squid | Bigfin reef squid (*Sepioteuthis lessoniana*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-bigfin-reef-squid-s-lessoniana-8457fc5fb9bc4db8a00fdec43a3f4456) | ffish.asia / floraZia.com | CC0 |
| `critters/nautilus.glb` | nautilus | Chambered nautilus (*Nautilus pompilius*), shell | [Sketchfab](https://sketchfab.com/3d-models/cephalopod-nautilus-pompilius-pri-70573-ff2344351c384ee4be2adb73c22250e7) | Digital Atlas of Ancient Life | CC0 |
| `critters/nudibranch.glb` | nudibranch | *Felimida britoi* | [Sketchfab](https://sketchfab.com/3d-models/felimida-britoi-c5b4b517ef5643d5915289e49aeb4daa) | Israel Fernández | CC BY 4.0 |
| `critters/seacucumber.glb` | seacucumber | Japanese common sea cucumber | [Sketchfab](https://sketchfab.com/3d-models/cc0-japanese-common-sea-cucumber-c8fcb7b084df432c9d5765eee264ee02) | ffish.asia / floraZia.com | CC0 |
| `reef/tridacna.glb` | giantclam | Boring clam (*Tridacna crocea*), reused from the reef props | see Reef props | ffish.asia / floraZia.com | CC0 |

The CC BY files were modified: decimated, re-oriented, rescaled, and textures downsized.
The nautilus scan is an empty museum shell, tipped so its opening leads as it swims. The
angler, sea snake, and comb jelly stay procedural.

# School fish

Scanned reef fish in `fish/` replace the four procedural body types of the instanced
schools (`SCHOOL_FISH_MODEL_PATHS`, swapped in by `BatchedMeshPool.setSchoolFishModels`).
Each scan keeps its photo texture; the per-fish colour (panic flash, night glow) only tints
it. A vertex-shader wave drives the swim from the same per-instance phase and speed as the
procedural bodies. Prepared like the creature models, at about 3.5k to 4.5k triangles and
512 px textures, since a school draws hundreds of each.

| File | Body type | Species | Source | Author | License |
|------|-----------|---------|--------|--------|---------|
| `fish/parrotfish.glb` | standard | Knobsnout parrotfish (*Scarus ovifrons*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-knobsnout-parrotfish-s-ovifrons-dac672386dd741af8485fcab811b9db4) | ffish.asia / floraZia.com | CC0 |
| `fish/wrasse.glb` | slender | Snooty wrasse (*Bodianus oxycephalus*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-snooty-wrasse-bodianus-oxycephalus-a1fa2be4f363454baadf35fafa403e6b) | ffish.asia / floraZia.com | CC0 |
| `fish/angelfish.glb` | disc | Blue-striped angelfish | [Sketchfab](https://sketchfab.com/3d-models/cc0-blue-striped-angelfish-a5c0bb6877184e698c1992e5ce1a69d0) | ffish.asia / floraZia.com | CC0 |
| `fish/grouper.glb` | chunky | Neptune grouper (*Cephalopholis igarashiensis*) | [Sketchfab](https://sketchfab.com/3d-models/cc0-neptune-grouper-c-igarashiensis-777d773273f343c6b11e647474fb1c0e) | ffish.asia / floraZia.com | CC0 |
