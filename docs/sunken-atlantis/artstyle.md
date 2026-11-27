# HALCYRA: ART BIBLE

Status: draft for the owner's taste review. No rendering code starts until this is approved or edited.

Halcyra is the working name of the drowned city. Change it if you like; nothing in the code depends on it.

## 1. Vision

You swim into a city that sank slowly and was never looted. It is marble and bronze, built on a reef shelf by people who loved geometry. Sunlight still reaches it in tall, soft shafts. Kelp and coral have grown over the arcades and the arches, and fish use the streets as roads. Nothing here is menacing. It is quiet, old and a little sad, and it is beautiful.

Three feelings, in order: awe at the scale as you come over the drop-off, calm as you drift down the long colonnade, curiosity as a small warm light shows you where something is hidden.

The look is stylised realism: believable materials and light, a controlled palette, and strong silhouettes. It is not a flat cartoon and it is not a gritty simulation. The test is "would a good underwater photographer stop for this?"

Do not copy any existing Atlantis from film, games or the viral reference project. The layout, the hero structure and the palette in this document are original.

## 2. Rendering target

Realism comes first from how light moves through water, second from material response, third from detail.

- Water is a medium, not a fog colour. Red dies first, then green, so distance turns everything blue-green. Use the repo's per-channel extinction model in `src/rendering/WaterMedium.ts` with a clearer preset than the default (target horizontal visibility about 110 m in green, 45 m in red; the default sea is about 60 m).
- The sun is fixed, about 59 degrees up from the north-west. The light that reaches the city is the sun through the surface: soft shafts, caustic filaments on upward-facing stone, and a bright Snell's window overhead.
- Grounding: every object meets the floor with contact darkening, sand drift, or growth. An object that floats on the ground with no contact shadow is the number-one cause of a fake look.
- Edges: every architectural edge is bevelled so it catches a highlight. No razor-sharp box corners.
- Tone: a filmic curve at a fixed exposure, gentle bloom on the shafts and the Snell's window only, a light vignette. No film grain, no heavy chromatic aberration, no sparkle stars.
- Motion: slow. Everything that moves does so on a time uniform in the shader (kelp sway, caustics, fish), never by per-object CPU updates.

## 3. Reference approach

There are no concept images yet. Before slice 3, you (the owner) pick 6 to 8 reference photos or paintings and drop them in `docs/sunken-atlantis/refs/` with a one-line note on what to take from each. Suggested subjects:

- Shipwreck and ruin photography in 10 to 25 m depth with strong shafts.
- Kelp forest photography looking up through the canopy.
- Roman and Hellenistic marble: weathered columns, honed versus polished zones.
- Verdigris bronze: Corinthian bronze, ship's rams, old astrolabes and orreries.
- Coral growing over man-made objects.

Match: the colour grading, the density of light shafts, the proportion of overgrowth to bare stone. Exceed: the sense of scale and the clarity of silhouettes at distance.

## 4. Scope and exclusions

In scope: the city, its shelf, the reef wall, kelp, coral, fish schools, drifting particles, five relics, one hero structure.

Out of scope, and the critic should flag them if they appear:

- No people, no skeletons, no bodies, no statues of recognisable people (statues, if any, are faceless and eroded).
- No crystals, no glowing energy crystals, no sci-fi light cores. The hero is made of stone and bronze.
- No treasure chests, no gold coin piles, no sharks hunting you, no jump scares.
- No text or glyph readable as real words. Inscriptions are abstract line patterns.
- No sunken modern objects (no cars, planes, plastic).
- No rainbow-saturated "tropical" colour. The palette stays cool, with warm light as the single accent.

## 5. World layout

Units are metres. +Y up, +Z south, -Z north, +X east, sea level y = 0. The shelf floor is y = -34. See `prompt.md` for the full set of conventions.

The city is a long amphitheatre that opens south onto a drop-off. Everything faces the Spire.

| Place | Centre (x, z) | Size and character |
|---|---|---|
| Spire Court | (0, 0) | circular court radius 45, three concentric low steps, the Astrolabe Spire in the middle |
| Processional Way | (0, 45) to (0, 190) | 145 m colonnade, 14 m between rows of columns, 2 rows of 24 columns, many toppled or shortened |
| Threshold Gate | (0, 190) | broad bronze-and-marble sea gate on the shelf edge; beyond it the floor falls away into dark blue |
| Cistern Basilica | (0, -115) | long barrel-vaulted hall, 60 m by 30 m, roof partly collapsed so a single wide shaft falls inside |
| Bathhouse Terraces | (-120, -10) | five stepped terraces of pools and arched vaults, heavily overgrown with kelp |
| Foundry Row | (130, 20) | a curved street of arcades and three open bell-forges, bronze-streaked, more coral than kelp |
| Harbour Mole | (-150, 170) | a curved breakwater wall with a wreck of a hull, moss-green |
| Reef Wall | z from -170 to -240 | a natural rock and coral cliff that closes the north; caves lead off it |

Silhouette rule: from the south approach at 150 m you must read, left to right, the mole, the colonnade axis, the Spire, the forge row, and the reef wall behind. If the city reads as a scatter of boxes, the layout has failed.

Density: the central axis is the most detailed and brightest. Detail and light fall off towards the edges, with the edges dissolving into blue.

## 6. Hero elements and the generator kit

Every building is made from a small set of parametric generators, so the whole city is procedural and stays small. Each generator takes a seed, a size, and a decay value from 0 (new) to 1 (ruin).

Generators:

1. Revolved profile: columns (fluted shafts, entasis, bases, capitals), domes, drums, urns.
2. Extruded and tapered polygon: towers, plinths, walls with batters.
3. Arch module: single arch, arcade run, barrel vault, groin vault.
4. Stair and terrace: stepped plinths, pool basins, amphitheatre seating.
5. Swept arc and ring: ring roads, aqueduct-like spans, the Spire rings.
6. Heightfield: the shelf, reef wall, caves, sand drifts.
7. Damage operators: cut, tilt, topple, shorten, and bury a piece. Applied by the decay value and the seed.

### The hero: the Astrolabe Spire

A tower of pale marble, 27 m tall (y = -34 to -7), whose upper third carries three nested bronze rings, each a flat band with engraved line scales on its outer face. The rings are set at different tilts like an armillary sphere, centred at about y = -14, with radii 11 m, 8 m and 5.5 m. Each ring is thick enough to read as metal: 0.8 m wide, 0.5 m deep, with bevelled edges.

- The rings turn very slowly (one revolution in about 10 minutes, each at a different speed and axis) on a time uniform. When the player finishes the relic goal the rings align to a single plane and a shaft lands on the court.
- The tower below is a stack of five tiers: a wide stepped base, a fluted drum, a ring of arched niches, a narrower fluted shaft and a bronze cap. The cap is a small hemispherical dome with a thin bronze spike.
- Sunlight passes through the rings and throws slow, moving bars of light across the court floor. This is the signature image of the mode.
- Bronze lamps hang on short arms at the second tier. They carry a faint warm glow (about 2800 K). They are the only warm points besides relics and give the Spire a gentle halo.
- Growth: kelp holdfasts on the base and tiers one and two only, a few coral crusts on the drum. The rings stay mostly clean, with verdigris in the engravings.

The Spire must read from 150 m as a clear silhouette: a slim tower with three tilted bands. Check this first.

### Supporting hero places

- The Processional Way: the long perspective of columns is the calm shot. Columns lean and fall in a rhythm, not randomly: about one in four toppled, one in three shortened, the rest standing with capitals draped in kelp.
- The Cistern Basilica: a dark hall with one wide shaft of light. It is the contrast shot.
- The Threshold Gate: two huge bronze-faced piers and a lintel with a keystone. The keystone holds a relic socket.

### Detail layers

1. Primary: the forms above.
2. Secondary: cornices, bases, door reveals, balustrades, niches, bronze studs and rails, drains.
3. Tertiary (shader): marble veins, pitting, honed versus polished zones, waterline-style staining, verdigris runs, barnacle crust. These fade with distance to avoid shimmering.

## 7. Materials

| Material | Look | Notes |
|---|---|---|
| Marble, standing | pale warm white, faint grey-green veins, honed in most places, a few polished panels | veins from triplanar noise; fine detail fades beyond 30 m |
| Marble, in shadow | cool grey-blue | colour comes from the water medium, not a painted grey |
| Bronze | dark gold-brown where clean, verdigris teal-green in recesses and engravings | lower roughness on raised edges, higher in recesses |
| Limestone and reef rock | warm beige to grey, rough | for the mole and the reef wall |
| Sand | pale cream with ripples, a little darker in hollows | drifts bank up against walls and half-bury steps |
| Kelp | olive to amber green, translucent when backlit | thin ribbons on long stems, sway on a time uniform |
| Coral | muted rose, ochre, lavender, a few cream; no neon | grows as crusts and branching clumps on upward-facing and sheltered faces |
| Glass | none. There is no glass in this city | |

Roughness rule: no surface is perfectly smooth. Specular shows as soft sheen on marble and bright thin lines on bevelled bronze.

## 8. Water

- The surface is seen from below: a bright, rippling, silvery ceiling with a Snell's window. Reuse `FFTOcean` for the surface. Do not rebuild it.
- Water colour: shallow near the surface is a clear turquoise; with depth and distance it moves through teal to a deep blue-indigo. Far geometry (over 110 m) is gone into blue.
- Caustics: bright network filaments on upward-facing surfaces, strongest on the court and the colonnade floor, absent in shadow and in the Basilica except under the roof hole. Reuse `CAUSTIC_GLSL`. Caustics must fade with depth below the surface and must not tile visibly.
- Particles: sparse marine snow and plankton motes lit by the shafts. Small, soft, never bright dots in shadow.
- The drop-off: south of the shelf edge the water goes darker and bluer very quickly. There is no visible bottom.
- The surface also acts as a ceiling for the swim volume; at y = -1.5 the image brightens, bubbles trail, and you cannot break through.

## 9. Light, sky, atmosphere and colour

Sun: fixed, direction towards the sun (-0.35, 0.86, -0.36). There is no visible sky; the sun appears only as the bright part of the Snell's window and as shafts.

Light shafts: wide, soft-edged, slightly blue-white, in a few clear groups, not a fan of identical beams. They must be broken by the geometry (colonnade, Spire rings, roof holes) and by kelp. Typical shaft width 4 to 12 m, with a visible gradient from bright at the surface to faint at the floor.

Warm accents: bronze lamps and relics are the only warm light (about 2800 K). They never light more than 8 m around them. The contrast of a small warm point in a large cool space is the intended mood.

### Palette

Colours are targets for what the player sees after absorption and grading, not raw material values.

| Role | Hex | Where |
|---|---|---|
| Surface glow | #BFEFF2 | Snell's window, top of shafts |
| Shallow water | #4FB6C4 | upper water column |
| Mid water | #1F7F96 | most distance fog in daylight areas |
| Deep water | #0B3550 | far distance, shadows in the open |
| Abyss | #061A2E | south of the drop-off, deep corners |
| Marble lit | #E8E4D4 | standing stone in a shaft |
| Marble shade | #6F8C98 | stone out of the sun |
| Bronze | #8A6A3A | clean bronze |
| Verdigris | #3E9A86 | oxidised bronze and engravings |
| Sand | #C9BC98 | floor |
| Kelp | #7C8A3A | blades; darker #4B5A2A in shade |
| Coral rose | #C9788A | accent, sparing |
| Coral ochre | #D4A24C | accent, sparing |
| Warm light | #FFB566 | lamps and relics only |

Colour budget: roughly 70 percent blue and teal, 20 percent stone and sand, 8 percent kelp, 2 percent warm and coral accents. If saturated pink or orange covers more than a few percent of any shot, it is wrong.

## 10. Vegetation, coral and the shelf

- Kelp: tall ribbon blades on thin stems, in clusters of 3 to 9, clustering where there is shelter: lee sides of walls, around column bases, in the Bathhouse pools and the kelp cistern. Blades are 4 to 14 m long, curve with a slow shared current direction, and glow slightly when backlit. Reuse `KelpForest` and `TaperedTube` for the stems.
- Growth over architecture: growth is placed by rules from the surface normal and a decay value. Upward faces get sand, then coral crust. Sheltered vertical faces get kelp holdfasts and moss. Sun-facing vertical faces stay mostly clean marble with sparse barnacles. Undersides stay bare and dark. Growth should follow cracks and edges, not cover everything evenly.
- Coral: crusts and low branching clumps, plus a few larger heads on the reef wall and the Foundry Row. Avoid giant uniform tables. Vary colour by cluster, not per branch.
- Seagrass beds on the sand beyond the court and in the Harbour Mole lee.
- Sand: ripples, drifts against walls, half-buried steps and bases. Every bottom edge of every structure is blended with sand or growth.

## 11. Motion

| Thing | Motion |
|---|---|
| Kelp | slow sway, phase offset by position, 6 to 10 s period |
| Caustics | slow drift, about 0.3 of the surface wave speed |
| Light shafts | slight shimmer in intensity, never flicker |
| Spire rings | very slow turn, one revolution in about 10 minutes |
| Fish schools | silvery schools of 40 to 120 flowing along the Processional Way and around the Spire; small reef fish in the coral; one slow large ray or turtle drifting through the court |
| Motes | slow drift with a slight upward bias |
| Camera | gentle sway at about 0.3 Hz and a few centimetres, off in review shots |

Fish rule: schools move as one body with ripples through them, avoid walls, and part around the player at about 4 m. The player is not prey. Reuse `FIRASystem` and `BatchedMeshPool` instanced fish.

## 12. Lived-in cues (without people)

Show the city was used and is now abandoned, not that it was a film set.

- Bronze lamps on the Spire, a few still holding a faint glow.
- Stacked amphorae and urns in the Foundry Row, some tipped, some silted over.
- Wheel ruts and worn steps in the forge street.
- A hull and a coil of cable on the Harbour Mole.
- Bell-forge moulds, crucibles and a bell lying on its side.
- Bench rows in the Bathhouse, a tipped basin.
- Faint inscription lines on plinths and rings (abstract patterns).
- Small fish living in the urns and arches.

## 13. Shots

Six fixed review shots, defined in `review-shots.json` and bound to keys 1 to 6.

| # | Name | Purpose |
|---|---|---|
| 1 | Over the edge | the hero reveal from the south drop-off: the whole city, the silhouette test |
| 2 | Processional Way | the calm perspective shot: columns, kelp, shafts, a school |
| 3 | Spire rings | the signature shot: the rings, the bars of light on the court |
| 4 | Basilica shaft | the contrast shot: dark hall, a single wide shaft, a relic glimmer |
| 5 | Bathhouse overgrowth | overgrowth rules: kelp over arches, sand, coral on stone |
| 6 | Toward the sun | the backlit shot: Foundry Row against the bright surface, kelp translucency, motes |

Camera: 70 degrees vertical FOV, no sway, fixed seed.

## 14. Review rubric (for the visual critic)

You see only this document and the renders. You do not see the code. Judge each shot and the temporal pairs, and return concrete defects.

### Severity levels

- Blocker: the image does not read as a drowned city, or it looks flat, cartoonish or broken in a way a first-time viewer notices at once. Examples: a missing colour absorption with distance; the Spire not readable; z-fighting; black or white holes; geometry floating off the ground.
- Major: a clear departure from this bible that a viewer would notice after a few seconds. Examples: shafts that are a fan of identical beams; coral in neon colours; bare boxes with no overgrowth; fish moving as individuals instead of schools.
- Minor: noticeable only on a second look. Examples: slightly repetitive columns; one texture crop that shimmers; a caustic that tiles at 100 percent.
- Nit: taste-level polish.

The pass bar is: no Blocker, no Major, and at most 3 Minor per shot.

### Yes or no tests

Answer each with yes or no, and add one line of evidence for every "no".

1. Does colour shift visibly from warm and pale near the camera to blue-green and then deep blue with distance?
2. Is the Astrolabe Spire readable as a slim tower with three tilted bronze rings in shot 1?
3. Are light shafts present, soft-edged, varied in width and broken by geometry or kelp?
4. Do upward-facing stone surfaces show caustic filaments that do not visibly tile?
5. Does every structure meet the floor with sand, growth or contact darkening, with nothing floating?
6. Do marble and bronze read as different materials, with verdigris in recesses and highlights on bevelled edges?
7. Do kelp and coral follow the placement rules (sheltered faces, edges and cracks) rather than covering everything evenly?
8. Is the colour budget respected, with warm light and coral as small accents only?
9. Do fish form schools that move as a body and avoid walls, with sizes that suit the scene?
10. In the Basilica shot, is there a strong contrast between a dark hall and one bright shaft, with the relic as a small warm point?
11. In consecutive frame pairs, is the motion slow and free of popping, flicker, shimmering or temporal ghosting?
12. Does the scene avoid everything listed under Scope and exclusions (people, crystals, treasure, readable text, modern objects)?
