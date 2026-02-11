# Implementation Plan: Ocean Simulator Overhaul

**Generated:** 2025-01-28
**Goal:** Fix critical issues making fish movement unrealistic, ocean floor too bright, fish appearance washed out, and add missing marine life variety.

---

## Executive Summary

This plan addresses six categories of issues in priority order:
1. **Visibility & Debugging** - Verify spawning works, creatures are in camera view
2. **Fish Movement** - Fix velocity parameters for natural swimming
3. **Ocean Floor & Lighting** - Apply proper depth-based attenuation
4. **Fish Appearance** - Restore absorption, use enhanced materials
5. **New Creatures** - Add missing marine life (turtles, whales, crabs, etc.)
6. **Polish** - Caustics, effects, final tuning

---

## Research Summary

### Real Fish Swimming Behavior
- Typical cruising speeds: 0.5-1.5 body lengths/second
- For a 30cm fish: 0.15-0.45 m/s cruising, up to 3 m/s burst
- Fish CAN hover and stop - most species don't require continuous movement
- Burst-and-glide is common efficiency strategy (already partially implemented)

### Beer-Lambert Law for Underwater Light
```
I(d) = I_0 * e^(-k*d)
```
Absorption coefficients (per meter) in clear ocean water:
- Red (680nm): 0.45/m - gone by 10m
- Green (550nm): 0.15/m - penetrates to ~30m
- Blue (475nm): 0.05/m - penetrates to 200m+

At 30m depth:
- Red: 1.5% remains
- Green: 1.1% remains
- Blue: 22% remains

### Ocean Floor at 30m Depth
- Ambient light should be 15-25% of surface (not 60%)
- Colors shift to blue-green (no reds visible)
- Sand appears gray-blue, not golden/warm

---

## Phase 1: Visibility & Debugging

**Priority:** CRITICAL
**Goal:** Confirm creatures spawn and are visible before making other changes

### Task 1.1: Add Debug Visualization

**File:** `src/OceanSimulator.ts`

Add temporary debug markers at spawn locations:

```typescript
// In spawnInitialFish(), after each createFish call:
// Add visible debug sphere at spawn location
const debugGeo = new THREE.SphereGeometry(0.5);
const debugMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const debugSphere = new THREE.Mesh(debugGeo, debugMat);
debugSphere.position.set(x, y, z);
this.renderEngine.scene.add(debugSphere);
```

### Task 1.2: Verify Camera Position vs Spawn Area

**File:** `src/rendering/RenderingEngine.ts` (line 58-66)

Current camera: `(0, -10, 30)` looking at `(0, -10, 0)`
Current spawns: Y from -3 to -28, X/Z spread of -40 to +40

**Issue:** Camera may be too close to see spread-out fish. Adjust:

```typescript
// Change from:
this.camera.position.set(0, -10, 30);
this.camera.lookAt(0, -10, 0);

// To:
this.camera.position.set(0, -12, 50); // Further back
this.camera.lookAt(0, -12, 0);        // Looking at typical fish depth
```

### Task 1.3: Add Entity Count Logging

**File:** `src/OceanSimulator.ts`

Add per-frame entity count in loop to verify entities aren't being deleted:

```typescript
// In loop(), after pipeline execution:
if (Math.random() < 0.005) { // Every ~200 frames
  const entities = getAllEntities(this.world);
  const fishCount = entities.filter(e => CreatureType.type[e] === 0).length;
  console.log(`[DEBUG] Total entities: ${entities.length}, Fish: ${fishCount}`);
}
```

### Acceptance Criteria
- [ ] Can see red debug spheres at spawn locations
- [ ] Console shows expected entity counts (~500+ creatures)
- [ ] At least some fish visible in camera view
- [ ] Scene children count stable (not growing unbounded)

---

## Phase 2: Fish Movement Fixes

**Priority:** HIGH
**Goal:** Fish swim at realistic speeds with natural behavior

### Task 2.1: Fix Initial Velocity

**File:** `src/core/EntityFactory.ts` (lines 27-32)

Current: 2.0-4.0 m/s initial speed
Fix: 0.3-0.8 m/s (realistic cruising speed)

```typescript
// Change from:
const speed = 2.0 + Math.random() * 2.0; // 2.0-4.0 m/s - very visible movement

// To:
const speed = 0.3 + Math.random() * 0.5; // 0.3-0.8 m/s - realistic cruising
```

### Task 2.2: Remove Minimum Speed Enforcement

**File:** `src/core/EntityFactory.ts` (line 87)

Current: `FIRA.minSpeed[eid] = 1.0;`
Fix: Allow fish to slow down and hover

```typescript
// Change from:
FIRA.minSpeed[eid] = 1.0; // Always moving fast

// To:
FIRA.minSpeed[eid] = 0.0; // Fish can hover/slow down
```

**File:** `src/systems/FIRASystem.ts` (lines 222-234)

The minSpeed enforcement is also in the FIRA system. Update:

```typescript
// Change from:
const minSpeed = FIRA.minSpeed[eid] || 0.5; // Minimum to keep swimming

// To:
const minSpeed = FIRA.minSpeed[eid]; // Allow 0 for hovering
// Only enforce if minSpeed > 0
if (minSpeed > 0 && speed < minSpeed && speed > 0.0001) {
```

### Task 2.3: Fix Max Speed for Different Species

**File:** `src/core/EntityFactory.ts` (line 85)

Current: `FIRA.maxSpeed[eid] = 3.0 + Math.random() * 2.0;` (3-5 m/s)
Fix: Scale to body size

```typescript
// Change from:
FIRA.maxSpeed[eid] = 3.0 + Math.random() * 2.0; // 3.0-5.0 m/s

// To:
const bodyLength = Size.length[eid];
FIRA.maxSpeed[eid] = bodyLength * 3.0 + Math.random() * bodyLength; // 3-4 BL/s max burst
```

### Task 2.4: Restore Natural Wander Behavior

**File:** `src/systems/FIRASystem.ts` (line 39)

Current: `Wander.rate[eid] * 0.5` - reduced randomness
Fix: Restore natural variation

```typescript
// Change from:
Wander.angle[eid] += (Math.random() - 0.5) * Wander.rate[eid] * 0.5; // Reduced randomness

// To:
Wander.angle[eid] += (Math.random() - 0.5) * Wander.rate[eid]; // Natural randomness
```

### Task 2.5: Initialize Burst-Glide Parameters on Spawn

**File:** `src/core/EntityFactory.ts`

Import and call initialization function:

```typescript
// Add import at top:
import { initializeBurstGlideParams } from '../systems/BiomechanicalAnimationSystem';

// At end of createFish function, before return:
initializeBurstGlideParams(eid);
```

### Acceptance Criteria
- [ ] Fish cruise at 0.3-0.8 m/s (not shooting across screen)
- [ ] Fish can slow down and occasionally hover
- [ ] Wander behavior creates natural variation
- [ ] Burst-glide animation works from spawn
- [ ] Schools maintain cohesion without frantic movement

---

## Phase 3: Ocean Floor & Lighting

**Priority:** HIGH
**Goal:** Realistic underwater lighting at 30m depth

### Task 3.1: Fix Ocean Floor Ambient Light

**File:** `src/rendering/RealisticOceanFloor.ts` (lines 144-146)

Current ambient: 0.6 (60%)
Fix: 0.15-0.20 at 30m depth

```typescript
// Change from:
float ambient = 0.6;
vec3 litColor = sandColor * (ambient + 0.8 * diffuse);

// To:
float depthFactor = 30.0; // meters
float ambient = 0.15; // Much darker at depth
vec3 litColor = sandColor * (ambient + 0.4 * diffuse); // Less diffuse contribution
```

### Task 3.2: Add Beer-Lambert Absorption to Floor Shader

**File:** `src/rendering/RealisticOceanFloor.ts`

Add uniforms and absorption calculation:

```glsl
// Add to uniforms (around line 56):
absorptionCoeffs: { value: new THREE.Vector3(0.45, 0.15, 0.05) },
waterDepth: { value: 30.0 }

// In fragment shader, before gl_FragColor:
// Apply wavelength-dependent absorption
vec3 absorption = exp(-absorptionCoeffs * waterDepth);
litColor *= absorption;

// Shift toward blue-green at depth
vec3 depthTint = vec3(0.2, 0.5, 0.7); // Blue-green underwater tint
litColor = mix(litColor, litColor * depthTint, 0.6);
```

### Task 3.3: Fix Sand Colors for Depth

**File:** `src/rendering/RealisticOceanFloor.ts` (lines 58-60)

Current: Warm sandy colors that don't account for red absorption
Fix: Blue-shifted sand colors

```typescript
// Change from:
sandColor1: { value: new THREE.Color(0xe8d4b5) }, // Warm sandy beige
sandColor2: { value: new THREE.Color(0xd4b896) }, // Golden sand

// To:
sandColor1: { value: new THREE.Color(0x8a9a9e) }, // Blue-gray sand (red absorbed)
sandColor2: { value: new THREE.Color(0x7a8a8e) }, // Darker blue-gray
```

### Task 3.4: Fix Light Direction for Underwater

**File:** `src/rendering/RealisticOceanFloor.ts` (line 62)

Add underwater light scattering (light comes from above but diffused):

```typescript
// Change from:
lightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() }

// To:
lightDirection: { value: new THREE.Vector3(0.1, 1.0, 0.1).normalize() } // More vertical (from surface)
```

### Task 3.5: Reduce Scene Ambient Light at Depth

**File:** `src/rendering/RenderingEngine.ts` (lines 186-187)

```typescript
// Change from:
const ambientLight = new THREE.AmbientLight(0x2a6080, 1.2);

// To:
const ambientLight = new THREE.AmbientLight(0x1a4060, 0.4); // Much dimmer, bluer
```

### Acceptance Criteria
- [ ] Ocean floor appears dark blue-gray (not bright golden)
- [ ] No warm colors visible at 30m depth
- [ ] Light comes primarily from above (scattered)
- [ ] Floor blends naturally with water color
- [ ] Depth feels realistic (dark but not black)

---

## Phase 4: Fish Appearance

**Priority:** MEDIUM-HIGH
**Goal:** Fish look realistic with proper depth absorption and enhanced materials

### Task 4.1: Restore Full Absorption in EnhancedFishMaterial

**File:** `src/rendering/EnhancedFishMaterial.ts` (line 44)

Current: Absorption reduced to 0.3x
Fix: Restore proper values but adjust for visibility balance

```typescript
// Change from:
absorptionCoeff: { value: new THREE.Vector3(0.08, 0.03, 0.01) }, // Much less absorption

// To:
absorptionCoeff: { value: new THREE.Vector3(0.25, 0.10, 0.03) }, // Balanced for visibility + realism
```

### Task 4.2: Use EnhancedFishMaterial for Instanced Mesh

**File:** `src/rendering/BatchedMeshPool.ts` (lines 61-67)

Current: Uses simple MeshStandardMaterial
Fix: Use EnhancedFishMaterial with instancing support

```typescript
// Change from:
this.fishMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 0.4,
  roughness: 0.3,
  flatShading: false,
  vertexColors: false,
});

// To:
import { createEnhancedFishMaterial } from './EnhancedFishMaterial';

// In constructor:
this.fishMaterial = createEnhancedFishMaterial({
  species: 'tropical',
  metallic: 0.5,
  roughness: 0.2
});
// Enable instancing in the material
(this.fishMaterial as THREE.ShaderMaterial).defines = {
  USE_INSTANCING: '',
  USE_INSTANCING_COLOR: ''
};
```

### Task 4.3: Add Countershading to Fish

Countershading (dark back, light belly) is already in EnhancedFishGeometry vertex colors.
Verify it's being used by checking the material applies vertex colors correctly.

**File:** `src/rendering/EnhancedFishMaterial.ts`

Ensure `vertexColors: true` is preserved and used in the shader.

### Task 4.4: Improve Scale Variation

**File:** `src/OceanSimulator.ts` (lines 162-183)

Current: Scale variation is minimal
Fix: Add more natural size variation within schools

```typescript
// In spawnFishSchool, after createFish:
const eid = createFish(this.world, x, y, z, Math.floor(sizeScale * 2));

// Add size variation (0.7x to 1.3x)
const sizeVariation = 0.7 + Math.random() * 0.6;
Scale.x[eid] *= sizeScale * sizeVariation;
Scale.y[eid] *= sizeScale * sizeVariation;
Scale.z[eid] *= sizeScale * sizeVariation;
```

### Task 4.5: Fix Fog Capping

**File:** `src/rendering/EnhancedFishMaterial.ts` (lines 391-393)

Current: Fog capped at 40% which can make fish washed out
Fix: Adjust fog curve for better visibility at mid-depths

```typescript
// Change from:
float fogAmount = 1.0 - exp(-fogDensity * vDepth * 0.5);
fogAmount = min(fogAmount, 0.4); // Cap fog effect at 40%

// To:
float fogAmount = 1.0 - exp(-fogDensity * vDepth * 0.3);
fogAmount = min(fogAmount, 0.6) * smoothstep(5.0, 30.0, vDepth); // Gradual fog increase
```

### Acceptance Criteria
- [ ] Fish colors shift toward blue-green at depth
- [ ] Red/orange fish still visible but muted
- [ ] Fish have visible countershading (darker backs)
- [ ] Size variation visible within schools
- [ ] Fish don't appear washed out or overly bright

---

## Phase 5: New Creatures

**Priority:** MEDIUM
**Goal:** Add missing marine life variety

### Task 5.1: Create Sea Turtle Geometry and Factory

**New File:** `src/creatures/TurtleGeometry.ts`

```typescript
export class TurtleGeometry {
  static create(length: number = 1.0): THREE.BufferGeometry {
    // Domed shell (carapace)
    // Flat plastron (belly)
    // Four flippers
    // Head with beak
    // Realistic proportions
  }
}
```

**File:** `src/core/EntityFactory.ts`

Add `createTurtle()` function:
- SwimmingStyle: 1 (pectoral/flipper)
- Slow, graceful movement
- Can hover and rest
- maxSpeed: 2.0 m/s, cruising: 0.5 m/s

### Task 5.2: Create Whale Geometry and Factory

**New File:** `src/creatures/WhaleGeometry.ts`

```typescript
export class WhaleGeometry {
  static createHumpback(length: number = 12.0): THREE.BufferGeometry {
    // Long body with distinctive shape
    // Pectoral fins (very long for humpback)
    // Dorsal fin
    // Flukes (tail)
    // Ventral grooves
  }
}
```

**File:** `src/core/EntityFactory.ts`

Add `createWhale()` function:
- SwimmingStyle: 3 (flukes)
- Very slow, majestic movement
- Large perception radius
- Solitary or small groups

### Task 5.3: Create Bottom-Dweller Creatures

**New File:** `src/creatures/BottomDwellers.ts`

```typescript
export class BottomDwellerGeometry {
  static createCrab(size: number = 0.2): THREE.BufferGeometry
  static createStarfish(size: number = 0.3): THREE.BufferGeometry
  static createSeaUrchin(size: number = 0.15): THREE.BufferGeometry
  static createSeaCucumber(length: number = 0.4): THREE.BufferGeometry
}
```

These don't use FIRA system - they have simple crawling/stationary behavior:
- Crabs: Side-scuttle movement, stay on floor
- Starfish: Extremely slow movement, stationary
- Sea urchins: Stationary
- Sea cucumbers: Very slow crawl

### Task 5.4: Create Additional Fish Species

**File:** `src/creatures/EnhancedFishGeometry.ts`

Add species variants:
- Eel (long, serpentine body)
- Seahorse (vertical posture, unique shape)
- Pufferfish (round body)
- Flatfish (flounder/sole - lies on bottom)

### Task 5.5: Add Bioluminescent Deep-Sea Creatures

**New File:** `src/creatures/DeepSeaCreatures.ts`

```typescript
export class DeepSeaCreatures {
  static createAnglerfish(): THREE.Group // With glowing lure
  static createLanternfish(): THREE.BufferGeometry // Body lights
  static createCtenophore(): THREE.BufferGeometry // Comb jelly with light
}
```

These spawn below -50m and have:
- Bioluminescence component
- Very slow movement
- Unique swimming patterns

### Task 5.6: Spawn New Creatures

**File:** `src/OceanSimulator.ts`

Add spawn calls in `spawnInitialFish()`:

```typescript
// Sea turtles (rare, graceful)
for (let i = 0; i < 3; i++) {
  createTurtle(this.world, randomX, -8 - Math.random() * 10, randomZ);
}

// Humpback whale (very rare, 1-2)
if (Math.random() > 0.5) {
  createWhale(this.world, 80, -20, 50, 'humpback');
}

// Bottom dwellers (distributed across floor)
for (let i = 0; i < 50; i++) {
  createCrab(this.world, randomX, -29.5, randomZ); // Just above floor
}
for (let i = 0; i < 30; i++) {
  createStarfish(this.world, randomX, -29.8, randomZ);
}

// Deep sea creatures (below -40m)
for (let i = 0; i < 10; i++) {
  createAnglerfish(this.world, randomX, -45 - Math.random() * 20, randomZ);
}
```

### Acceptance Criteria
- [ ] Sea turtles swim gracefully with flipper motion
- [ ] Whale visible in distance, majestic movement
- [ ] Bottom-dwellers visible on ocean floor
- [ ] Multiple new fish species visible
- [ ] Deep-sea creatures have working bioluminescence

---

## Phase 6: Polish

**Priority:** LOW
**Goal:** Final visual enhancements and tuning

### Task 6.1: Enhance Caustics

**File:** `src/rendering/Caustics.ts`

- Increase caustic pattern complexity
- Animate caustics based on surface wave data from FFT ocean
- Make caustics stronger near surface, fade with depth

### Task 6.2: Add Light Shafts (God Rays) - Carefully

**File:** `src/rendering/GodRays.ts`

Currently disabled due to "vine-like patterns". Investigate and fix:
- Use proper volumetric scattering shader
- Limit ray count
- Apply depth-based fade
- Test thoroughly before re-enabling

### Task 6.3: Particle System Tuning

**Files:** `src/rendering/UnderwaterParticles.ts`, `src/rendering/Bioluminescence.ts`

- Adjust particle sizes for depth
- Add more marine snow (organic particles)
- Vary bioluminescence pulse patterns

### Task 6.4: Final Lighting Balance

Run full scene test and adjust:
- Sun light intensity
- Ambient light color/intensity
- Fill light from below
- Hemisphere light gradient

### Task 6.5: Performance Optimization

- Profile with large creature counts
- Ensure instancing working correctly
- Optimize spatial grid if needed
- Add LOD for distant creatures

### Acceptance Criteria
- [ ] Caustics look natural and animate smoothly
- [ ] No visual artifacts (vines, glitches)
- [ ] Particles enhance atmosphere without clutter
- [ ] Lighting feels natural and immersive
- [ ] 60fps maintained with full creature population

---

## Implementation Order

| Phase | Priority | Estimated Effort | Dependencies |
|-------|----------|------------------|--------------|
| 1     | CRITICAL | 1-2 hours        | None         |
| 2     | HIGH     | 2-3 hours        | Phase 1      |
| 3     | HIGH     | 2-3 hours        | Phase 1      |
| 4     | MED-HIGH | 3-4 hours        | Phase 3      |
| 5     | MEDIUM   | 4-6 hours        | Phases 2, 4  |
| 6     | LOW      | 2-4 hours        | All above    |

**Total Estimated:** 14-22 hours

---

## Testing Strategy

### Per-Phase Testing
1. **Phase 1:** Visual confirmation - spawn points visible, entity counts correct
2. **Phase 2:** Record fish positions over time, verify speed distribution
3. **Phase 3:** Screenshot comparison at different depths
4. **Phase 4:** Side-by-side fish appearance comparison
5. **Phase 5:** Verify each creature type spawns and animates correctly
6. **Phase 6:** Full scene visual regression test

### Integration Testing
- Run simulation for 10+ minutes, verify stability
- Check for memory leaks (scene.children count)
- Verify creature populations remain balanced
- Test camera movement through full scene

---

## Risks & Considerations

### Performance Risk
- Adding creatures increases entity count
- Enhanced materials are more expensive than MeshStandardMaterial
- **Mitigation:** Use instancing, LOD, spatial culling

### Visual Regression Risk
- Lighting changes may break other effects
- Material changes affect all fish
- **Mitigation:** Test incrementally, keep screenshots for comparison

### Behavioral Complexity
- New creatures need unique movement patterns
- Bottom-dwellers don't fit FIRA system
- **Mitigation:** Create separate simple movement system for non-swimming creatures

---

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `src/core/EntityFactory.ts` | Creature spawning, initial parameters |
| `src/systems/FIRASystem.ts` | Flocking behavior, speed enforcement |
| `src/systems/BiomechanicalAnimationSystem.ts` | Swimming animations |
| `src/rendering/RealisticOceanFloor.ts` | Floor shader, lighting |
| `src/rendering/EnhancedFishMaterial.ts` | Fish material, absorption |
| `src/rendering/BatchedMeshPool.ts` | Instanced rendering |
| `src/OceanSimulator.ts` | Main spawning, simulation loop |
| `src/rendering/RenderingEngine.ts` | Scene setup, lighting |
| `src/creatures/ProceduralFishGeometry.ts` | Fish geometry |
| `src/creatures/EnhancedFishGeometry.ts` | High-detail fish geometry |
