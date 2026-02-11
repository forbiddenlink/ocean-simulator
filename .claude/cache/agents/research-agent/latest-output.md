# Research Report: Realistic Underwater Rendering Techniques for Three.js / WebGL
Generated: 2026-02-05

## Executive Summary

This report covers the state-of-the-art in real-time underwater rendering for Three.js and WebGL, spanning god rays, underwater fog, creature materials, ocean floor rendering, coral generation, water surface effects from below, color grading, and notable demos from 2024-2026. The project at `/Volumes/LizsDisk/ocean-simulator` already has implementations for many of these systems (GodRays, Caustics, DepthBasedFog, CoralFormations, etc.) -- this report provides the latest techniques and best practices that could improve or replace those implementations.

## Research Question

What are the latest techniques and best practices for realistic underwater rendering in Three.js and WebGL (2024-2026)?

---

## Key Findings

### Finding 1: God Rays / Volumetric Light Scattering

**Best-in-class library: `three-good-godrays`**

The `three-good-godrays` library by Ameobea is the current gold standard for screen-space god rays in Three.js. It uses **screen-space raymarching combined with shadow map sampling** -- a fundamentally different (and superior) approach to the particle-based god rays currently in the project.

**How it works:**
1. Raymarches through screen space from each pixel toward the light source
2. At each step, samples the shadow map to determine if that point is in shadow
3. Accumulates light contributions to create volumetric shafts

**Integration (uses pmndrs `postprocessing`):**
```typescript
import { EffectComposer, RenderPass } from 'postprocessing';
import { GodraysPass } from 'three-good-godrays';

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const sunLight = new THREE.DirectionalLight(0xffeedd, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
scene.add(sunLight);

const composer = new EffectComposer(renderer, {
  frameBufferType: THREE.HalfFloatType
});

const godraysPass = new GodraysPass(sunLight, camera, {
  density: 1 / 128,        // Light scattering density
  maxDensity: 0.5,          // Cap to prevent blowout
  edgeStrength: 2,          // Edge detection
  edgeRadius: 2,
  distanceAttenuation: 2,   // Falloff with distance
  color: new THREE.Color(0x88ccff),  // Underwater tint
  raymarchSteps: 60,        // Quality vs perf tradeoff
  blur: true,
  gammaCorrection: true
});
composer.addPass(godraysPass);
```

**Key requirements:** All meshes must have `castShadow = true` and `receiveShadow = true`.

**Alternative approach -- Classic Volumetric Light Scattering (Crepuscular Rays):**
Uses a multi-pass technique from GPU Gems 3:
1. Render occluding geometry as black silhouettes
2. Render the light source normally
3. Combine into an "occlusion texture"
4. In a post-processing pass, sample along rays from each pixel to the light source position

Key shader parameters:
- `exposure` -- overall intensity/brightness
- `decay` -- falloff from the light source
- `density` -- separation between samples along the ray
- `weight` -- secondary brightness control

**Recommendation for the project:** Replace the current particle-based `GodRays.ts` with either `three-good-godrays` (easiest integration) or implement the multi-pass volumetric scattering approach as a custom post-processing effect. The current approach using 3000 particles arranged in 8 rays produces artifacts.

- Sources:
  - https://github.com/Ameobea/three-good-godrays
  - https://medium.com/@andrew_b_berg/volumetric-light-scattering-in-three-js-6e1850680a41
  - https://tympanus.net/codrops/2022/06/27/volumetric-light-rays-with-three-js/

---

### Finding 2: Underwater Fog and Depth Haze

**The problem with basic FogExp2:**
The project currently uses `THREE.FogExp2` with a single color (`0x0d5f7d`) at density `0.012`. This is a single-color exponential falloff, which does not account for:
- Wavelength-dependent absorption (red absorbs first, then green, then blue)
- Scattering vs absorption distinction
- Depth-varying fog color

**Beer-Lambert Law for Underwater Attenuation:**
Real underwater visibility follows the Beer-Lambert law where different wavelengths attenuate at different rates:

```glsl
// Fragment shader: wavelength-dependent underwater fog
uniform float underwaterDepth;  // Distance light travels through water
uniform vec3 absorptionCoeff;   // e.g., vec3(0.45, 0.06, 0.03) for ocean water
uniform vec3 scatteringCoeff;   // e.g., vec3(0.008, 0.006, 0.004)

vec3 extinction = absorptionCoeff + scatteringCoeff;
vec3 transmittance = exp(-underwaterDepth * extinction);

// Apply to object color
vec3 attenuatedColor = objectColor * transmittance;

// Add in-scatter (ambient water color at depth)
vec3 inScatter = scatteringCoeff / extinction * (1.0 - transmittance);
vec3 finalColor = attenuatedColor + inScatter * waterAmbientColor;
```

**Real-world absorption coefficients (per meter):**
| Wavelength | Color | Absorption |
|-----------|-------|------------|
| 680nm | Red | ~0.45/m |
| 550nm | Green | ~0.06/m |
| 440nm | Blue | ~0.03/m |

This means red disappears within ~5m, green within ~20m, and blue persists to ~80m+ depth.

**Implementing Custom Fog via `onBeforeCompile`:**
Three.js allows overriding the fog shader chunk:

```typescript
// Custom underwater fog material modification
material.onBeforeCompile = (shader) => {
  shader.uniforms.absorptionCoeff = {
    value: new THREE.Vector3(0.45, 0.06, 0.03)
  };
  shader.uniforms.scatterCoeff = {
    value: new THREE.Vector3(0.008, 0.006, 0.004)
  };
  shader.uniforms.waterColor = {
    value: new THREE.Color(0x0a4a6a)
  };

  // Add uniform declarations
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
     uniform vec3 absorptionCoeff;
     uniform vec3 scatterCoeff;
     uniform vec3 waterColor;
    `
  );

  // Replace fog fragment chunk
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <fog_fragment>',
    `
    #ifdef USE_FOG
      vec3 extinction = absorptionCoeff + scatterCoeff;
      float fogDepth = length(vFogPosition);
      vec3 transmittance = exp(-fogDepth * extinction);
      gl_FragColor.rgb = gl_FragColor.rgb * transmittance +
        waterColor * (1.0 - transmittance);
    #endif
    `
  );
};
```

**Fog rework proposal (gsimone):**
There is an open proposal to make Three.js fog extensible by storing custom shader chunks in a `shaders` property and implementing custom `refreshFogUniforms()`, allowing proper wavelength-dependent fog classes:

```javascript
class UnderwaterFog extends Fog {
  constructor() {
    super();
    this.shaders = {
      fog_vertex: ShaderChunk.fog_vertex,
      fog_pars_vertex: /* custom glsl for underwater */,
      fog_fragment: /* wavelength-dependent absorption */,
    };
  }
  refreshFogUniforms(uniforms) {
    uniforms.absorptionCoeff.value = this.absorptionCoeff;
    uniforms.scatterCoeff.value = this.scatterCoeff;
  }
}
```

**Recommendation for the project:** Replace the simple `FogExp2` in `DepthBasedFog.ts` with a custom fog implementation using `onBeforeCompile` that applies wavelength-dependent absorption via the Beer-Lambert law. This will create the characteristic "everything turns blue with distance" effect that is the hallmark of underwater scenes.

- Sources:
  - https://webglfundamentals.org/webgl/lessons/webgl-fog.html
  - https://gist.github.com/gsimone/08b5e0cbe65ad3917581fa2b7acd004d
  - https://threejs.org/docs/api/en/scenes/FogExp2.html

---

### Finding 3: Realistic Fish/Creature Materials and Shading

**Three.js MeshPhysicalMaterial -- Built-in Iridescence:**

Three.js natively supports iridescence (thin-film interference) on `MeshPhysicalMaterial`, perfect for fish scales:

```typescript
const fishScaleMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x4488aa,
  metalness: 0.3,
  roughness: 0.4,

  // Iridescence -- fish scale shimmer
  iridescence: 0.8,              // 0.0 to 1.0 intensity
  iridescenceIOR: 1.5,           // Index of refraction, 1.0-2.333
  iridescenceThicknessRange: [100, 400],  // nm thickness range

  // Optional: use iridescence thickness map for variation
  // iridescenceThicknessMap: thicknessTexture,  // green channel

  // Sheen for velvet/fabric-like quality (useful for ray skin)
  sheen: 0.5,
  sheenColor: new THREE.Color(0x88bbcc),
  sheenRoughness: 0.5,
});
```

**Subsurface Scattering (SSS) for Translucent Creatures:**

For jellyfish, thin fish fins, and translucent creatures, Three.js offers two approaches:

*Approach A: MeshSSSNodeMaterial (WebGPU/TSL -- modern):*
```typescript
const jellyfishMaterial = new THREE.MeshSSSNodeMaterial();
jellyfishMaterial.color = new THREE.Color(0.8, 0.6, 1.0);
jellyfishMaterial.roughness = 0.3;
jellyfishMaterial.thicknessColorNode = texture(thicknessMap).mul(vec3(0.5, 0.3, 0.8));
jellyfishMaterial.thicknessDistortionNode = uniform(0.1);
jellyfishMaterial.thicknessAmbientNode = uniform(0.4);
jellyfishMaterial.thicknessAttenuationNode = uniform(0.8);
jellyfishMaterial.thicknessPowerNode = uniform(2.0);
jellyfishMaterial.thicknessScaleNode = uniform(16.0);
```

*Approach B: Fast SSS via onBeforeCompile (WebGL -- compatible now):*
Based on the mattdesl gist, extend MeshStandardMaterial with translucency:

```typescript
// Key uniforms for SSS
const sssUniforms = {
  thicknessMap: { value: thicknessTexture },  // baked thickness
  thicknessPower: { value: 20.0 },   // scattering falloff
  thicknessScale: { value: 4.0 },    // intensity
  thicknessDistortion: { value: 0.185 }, // normal distortion
  thicknessAmbient: { value: 0.0 },
};
```

The core SSS algorithm per light:
1. Calculate light direction and attenuation
2. Distort surface normal using `thicknessDistortion`
3. Compute `dot(viewDir, -(lightDir + normal * distortion))`
4. Apply `pow(saturate(dot), power) * scale`
5. Multiply by thickness texture and add ambient

**MeshPhysicalMaterial Transmission for Glass-like Creatures:**
```typescript
const transparentCreatureMaterial = new THREE.MeshPhysicalMaterial({
  transmission: 0.95,        // Near-full transparency
  thickness: 0.5,            // Volume thickness
  ior: 1.33,                 // Water IOR
  roughness: 0.1,
  attenuationColor: new THREE.Color(0x88bbff),
  attenuationDistance: 2.0,
  dispersion: 0.3,           // Chromatic aberration
});
```

**MeshPhysicalNodeMaterial (TSL) Properties for Advanced Control:**
The node-based material system provides granular control over all physical properties:
- `.iridescenceNode` (float) -- dynamic iridescence intensity
- `.iridescenceIORNode` (float) -- dynamic IOR
- `.iridescenceThicknessNode` (float) -- per-pixel thickness control
- `.transmissionNode` (color) -- transmission amount
- `.thicknessNode` (float) -- volume thickness
- `.attenuationDistanceNode` (float) -- light falloff in volume
- `.attenuationColorNode` (color) -- volume color tint
- `.dispersionNode` (float) -- chromatic aberration strength
- `.sheenNode` (color) -- fabric-like sheen

**Recommendation for the project:** The current `EnhancedFishMaterial.ts` could be upgraded to use `MeshPhysicalMaterial` with iridescence for fish scales and transmission for jellyfish. The SSS approach is valuable for translucent fins and thin membranes.

- Sources:
  - https://threejs.org/docs/api/en/materials/MeshPhysicalMaterial.html
  - https://gist.github.com/mattdesl/2ee82157a86962347dedb6572142df7c
  - https://github.com/DerSchmale/threejs-thin-film-iridescence
  - https://threejs.org/examples/webgl_materials_subsurface_scattering.html

---

### Finding 4: Ocean Floor Rendering Techniques

**Parallax Occlusion Mapping:**

The `shapespark/parallax-mapping` Three.js example demonstrates steep parallax mapping for adding depth detail to flat surfaces -- ideal for ocean floor sand ripples and rocky surfaces.

Implementation via custom ShaderMaterial with `onBeforeCompile`:

```glsl
// Parallax Occlusion Mapping in fragment shader
uniform sampler2D heightMap;
uniform float parallaxScale;  // 0.02-0.05 for subtle effect

vec2 parallaxMapping(vec2 texCoords, vec3 viewDir) {
    const float minLayers = 8.0;
    const float maxLayers = 32.0;
    float numLayers = mix(maxLayers, minLayers, abs(dot(vec3(0,0,1), viewDir)));

    float layerDepth = 1.0 / numLayers;
    float currentLayerDepth = 0.0;
    vec2 P = viewDir.xy * parallaxScale;
    vec2 deltaTexCoords = P / numLayers;

    vec2 currentTexCoords = texCoords;
    float currentDepthMapValue = texture2D(heightMap, currentTexCoords).r;

    // Steep parallax mapping loop
    for(int i = 0; i < 32; i++) {
        if(currentLayerDepth >= currentDepthMapValue) break;
        currentTexCoords -= deltaTexCoords;
        currentDepthMapValue = texture2D(heightMap, currentTexCoords).r;
        currentLayerDepth += layerDepth;
    }

    // Occlusion interpolation for smooth result
    vec2 prevTexCoords = currentTexCoords + deltaTexCoords;
    float afterDepth  = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture2D(heightMap, prevTexCoords).r
                        - currentLayerDepth + layerDepth;
    float weight = afterDepth / (afterDepth - beforeDepth);
    return prevTexCoords * weight + currentTexCoords * (1.0 - weight);
}
```

**Multi-texture Detail Blending:**

For realistic ocean floors, use multiple texture scales:
- Base texture at 1x scale (large-scale sand/rock patterns)
- Detail texture at 10-20x scale (fine grain, small pebbles)
- Macro variation at 0.1x scale (color patches, zones)

```typescript
material.onBeforeCompile = (shader) => {
  shader.uniforms.detailMap = { value: detailTexture };
  shader.uniforms.macroMap = { value: macroTexture };

  // Add declarations
  shader.fragmentShader = shader.fragmentShader.replace(
    '#define STANDARD',
    `#define STANDARD
     uniform sampler2D detailMap;
     uniform sampler2D macroMap;
    `
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    `
    #include <map_fragment>
    // Detail texture overlay
    vec4 detailColor = texture2D(detailMap, vMapUv * 15.0);
    diffuseColor.rgb *= mix(vec3(1.0), detailColor.rgb, 0.3);
    // Macro variation
    vec4 macroColor = texture2D(macroMap, vMapUv * 0.1);
    diffuseColor.rgb *= mix(vec3(1.0), macroColor.rgb, 0.15);
    `
  );
};
```

**Tiling Prevention:**

The project already has `TilingPrevention.ts`. Best practice approaches include:
- Texture bombing / stochastic sampling
- Hash-based UV offset per tile
- Blending rotated copies of the same texture

**Recommendation for the project:** The `RealisticOceanFloor.ts` and `OceanFloorGenerator.ts` should incorporate parallax occlusion mapping for sand ripples and a multi-scale texture approach (base + detail + macro) to prevent tiling and add visual richness.

- Sources:
  - https://github.com/shapespark/parallax-mapping
  - http://mebiusbox.github.io/contents/pixyjs/samples/shader_parallax_occlusion.html
  - https://discourse.threejs.org/t/parallax-mapping-with-meshstandardmaterial-pbr/6105

---

### Finding 5: Coral Reef Rendering and Organic Structures

**Recursive Queue-Based Branching (Best Approach for Real-Time):**

The Codrops "Fractals to Forests" article (Jan 2025) presents a highly applicable technique:

```typescript
interface Branch {
  origin: THREE.Vector3;
  orientation: THREE.Quaternion;
  length: number;
  radius: number;
  level: number;       // recursion depth
  sectionCount: number;
  segmentCount: number;
}

// Process queue instead of recursive calls (prevents stack overflow)
const branchQueue: Branch[] = [rootBranch];
while (branchQueue.length > 0) {
  const branch = branchQueue.shift()!;
  // Generate geometry for this branch section-by-section
  // Each section: rotate circle of vertices around branch axis
  // Spawn child branches into queue based on branching rules
}
```

**Key parameters for coral-like growth:**
- **Taper**: `radius *= 1 - taper * (position / sectionCount)` -- thinner toward tips
- **Gnarliness**: Random rotation per section, inverse to radius (thin branches twist more):
  `strength = max(1, 1/sqrt(radius)) * gnarliness[level]`
- **Growth force**: Quaternion rotation toward light direction (phototropism):
  `section.rotateTowards(forceDirection, strength/radius)`
- **Child placement**: Radial distribution with `2*PI * (offset + i/count)`

**Coral-specific type adaptations:**

| Coral Type | Branching Depth | Gnarliness | Angle | Constraint |
|-----------|----------------|------------|-------|------------|
| Brain coral | 1-2 | High | N/A | Sphere-bound, surface folds |
| Staghorn | 5-8 | Low | 15-25deg | Elongated, narrow |
| Table coral | 1-2 | Low | 85-90deg | Flat top, wide single level |
| Fan coral | 3-5 | Medium | 20-40deg | Planar (2D growth in 3D) |
| Pillar coral | 2-3 | Low | 5-10deg | Mostly vertical |

**InstancedMesh for Performance:**

For rendering thousands of coral polyps or small features:
```typescript
const coralPolyp = new THREE.InstancedMesh(
  polypGeometry,
  polypMaterial,
  polypCount  // e.g., 5000
);

// Set transforms per instance
const matrix = new THREE.Matrix4();
for (let i = 0; i < polypCount; i++) {
  matrix.compose(position, quaternion, scale);
  coralPolyp.setMatrixAt(i, matrix);
}
coralPolyp.instanceMatrix.needsUpdate = true;
```

**Wind/Current Animation via GLSL (adapted from tree wind shader):**
```glsl
// Vertex shader for coral sway in current
uniform float time;
uniform float currentStrength;
uniform vec3 currentDirection;

// Use UV.y as height factor (base stays still, tips sway)
float swayFactor = uv.y;
float windOffset = 6.28318 * simplex3(position / 10.0);
float sway = swayFactor * currentStrength * (
  0.5 * sin(time * 0.5 + windOffset) +
  0.3 * sin(time * 1.0 + 1.3 * windOffset) +
  0.2 * sin(time * 2.5 + 1.5 * windOffset)
);
vec3 displaced = position + currentDirection * sway;
```

**yomboprime/coral-growth:**
A Three.js project investigating hierarchical mesh subdivision for coral-like structures. Uses iterative subdivision of a starting mesh, adding perturbation at each step to simulate organic growth patterns.

**Recommendation for the project:** The current `CoralFormations.ts` uses basic geometry primitives. Replace with the recursive queue-based branching system with coral-specific parameters, and use InstancedMesh for polyp details. This would dramatically improve visual quality.

- Sources:
  - https://tympanus.net/codrops/2025/01/27/fractals-to-forests-creating-realistic-3d-trees-with-three-js/
  - https://github.com/yomboprime/coral-growth
  - https://github.com/FrancescoGradi/L-System-Trees

---

### Finding 6: Water Surface Rendering from Below (Snell's Window)

**The Physics:**
Snell's window is the circular area on the water surface through which an underwater observer can see the above-water world. Outside this circle (~97.2 degrees total cone, ~48.6 degrees from vertical), total internal reflection occurs, creating a mirror of the underwater scene.

**Implementation Approach:**

```glsl
// Fragment shader for water surface seen from below
uniform samplerCube envMap;         // Above-water environment
uniform sampler2D underwaterScene;  // Reflection of underwater
uniform float waterIOR;             // 1.33 for water
uniform vec2 normalDistortion;      // From wave normal map
uniform float time;

varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
    // Perturb normal with wave animation
    vec3 normal = normalize(vWorldNormal);
    normal.xz += sin(time * 0.5 + gl_FragCoord.xy * 0.01) * normalDistortion;
    normal = normalize(normal);

    // Compute angle of incidence
    float cosTheta = abs(dot(normalize(vViewDir), normal));

    // Critical angle for water-air interface
    float criticalAngle = asin(1.0 / waterIOR); // ~48.75 degrees
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    float sinCritical = sin(criticalAngle);

    // Fresnel equation (Schlick's approximation for water->air)
    float R0 = pow((1.0 - waterIOR) / (1.0 + waterIOR), 2.0);
    float fresnel = R0 + (1.0 - R0) * pow(1.0 - cosTheta, 5.0);

    if (sinTheta > sinCritical) {
        // Total internal reflection -- mirror the underwater world
        vec3 reflected = reflect(normalize(vViewDir), normal);
        gl_FragColor = vec4(textureCube(envMap, reflected).rgb * 0.3, 1.0);
    } else {
        // Inside Snell's window -- refracted view of above-water
        vec3 refracted = refract(-normalize(vViewDir), normal, waterIOR);
        vec3 skyColor = textureCube(envMap, refracted).rgb;

        // Blend based on Fresnel
        vec3 reflected = reflect(normalize(vViewDir), normal);
        vec3 reflectedColor = textureCube(envMap, reflected).rgb * 0.3;
        gl_FragColor = vec4(mix(skyColor, reflectedColor, fresnel), 1.0);
    }

    // Bright caustic ring at the edge of Snell's window
    float edgeFactor = smoothstep(sinCritical - 0.02, sinCritical + 0.02, sinTheta);
    gl_FragColor.rgb += vec3(0.15, 0.18, 0.2) * edgeFactor;
}
```

**2024 Research (Monzon et al., Computer Graphics Forum 2024):**
"Real-Time Underwater Spectral Rendering" describes:
- Using two separate directional lights: one for above-surface sky rendering and one for underwater objects, with the underwater light oriented according to Snell's law
- The underwater directional light direction is refracted at the water surface boundary
- Multi-spectral approach handles wavelength-dependent IOR variations
- Physically-based pipeline handles moving caustics, the dielectric water surface, and the Snell window in real-time

**Chromatic Snell's window:** Because different wavelengths have slightly different IOR in water, the edge of Snell's window shows chromatic dispersion (a rainbow-like ring):
```glsl
// Separate critical angles per channel
float sinCriticalR = sin(asin(1.0 / 1.331)); // Red
float sinCriticalG = sin(asin(1.0 / 1.333)); // Green
float sinCriticalB = sin(asin(1.0 / 1.337)); // Blue

float edgeR = smoothstep(sinCriticalR - 0.01, sinCriticalR + 0.01, sinTheta);
float edgeG = smoothstep(sinCriticalG - 0.01, sinCriticalG + 0.01, sinTheta);
float edgeB = smoothstep(sinCriticalB - 0.01, sinCriticalB + 0.01, sinTheta);
```

**Recommendation for the project:** Implement a water surface plane visible from below with a custom shader that computes Snell's window, total internal reflection, and Fresnel blending. Animate the normal with wave data from the existing FFT system. Add a subtle bright ring at the critical angle boundary.

- Sources:
  - https://en.wikipedia.org/wiki/Snell's_window
  - https://onlinelibrary.wiley.com/doi/10.1111/cgf.15009
  - https://discourse.threejs.org/t/reflections-and-refractions-in-three-js/55391

---

### Finding 7: Color Grading for Underwater Scenes

**Physical Basis -- Wavelength Absorption:**
Underwater color grading must follow the physics of light absorption in water:
- 0-5m: Full spectrum, slight warm tint reduction
- 5-15m: Reds disappear, scene becomes cyan/green
- 15-30m: Oranges and yellows fade, predominantly blue-green
- 30-60m: Only blues remain, everything appears monochromatic blue
- 60m+: Near-darkness, deep blue/black

**Post-Processing Color Grading Pipeline:**

Using pmndrs `postprocessing` library:

```typescript
import { Effect, BlendFunction } from 'postprocessing';

// Custom underwater color correction effect
class UnderwaterColorEffect extends Effect {
  constructor(depth: number = 10) {
    super('UnderwaterColor', /* glsl */`
      uniform float depth;
      uniform vec3 absorptionCoeff;

      void mainImage(const in vec4 inputColor, const in vec2 uv,
                     out vec4 outputColor) {
        // Depth-based wavelength absorption
        vec3 absorption = exp(-depth * absorptionCoeff);
        vec3 corrected = inputColor.rgb * absorption;

        // Blue shift at depth
        float blueShift = smoothstep(0.0, 60.0, depth);
        float luma = dot(corrected, vec3(0.2126, 0.7152, 0.0722));
        corrected = mix(corrected,
                        vec3(luma) * vec3(0.3, 0.5, 1.0),
                        blueShift * 0.5);

        // Slight desaturation with depth (scattering)
        float gray = dot(corrected, vec3(0.299, 0.587, 0.114));
        corrected = mix(corrected,
                        vec3(gray) * vec3(0.4, 0.6, 0.9),
                        blueShift * 0.3);

        // Contrast reduction (scattering reduces contrast)
        corrected = mix(vec3(0.05, 0.1, 0.15), corrected,
                        mix(1.0, 0.6, blueShift));

        outputColor = vec4(corrected, inputColor.a);
      }
    `, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['depth', new THREE.Uniform(depth)],
        ['absorptionCoeff',
         new THREE.Uniform(new THREE.Vector3(0.45, 0.06, 0.03))],
      ])
    });
  }

  set depth(value: number) {
    this.uniforms.get('depth')!.value = value;
  }
}
```

**Method 2: 3D LUT Approach:**
Pre-bake an underwater color grade into a 3D LUT texture:

```typescript
// Load underwater LUT
const lutTexture = new THREE.TextureLoader().load('underwater-lut.png');
const lutEffect = new LUT3DEffect(lutTexture);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera, lutEffect));
```

**Additional color grading effects for underwater:**
- Slight green/cyan tint (algae scatter in shallow water)
- Reduced contrast at distance (forward scattering)
- Vignette (light falloff at edges of view, simulating mask/goggles)
- Chromatic aberration (water causes slight color fringing)
- Bloom on bright objects (light scatter in turbid water)
- Depth-of-field blur (water reduces clarity at distance)

**Recommendation for the project:** Implement a custom post-processing effect in `PostProcessingPipeline.ts` that applies wavelength-dependent absorption based on camera depth and viewing distance. Layer this with existing bloom and optionally a subtle vignette.

- Sources:
  - https://threejsfundamentals.org/threejs/lessons/threejs-post-processing-3dlut.html
  - https://github.com/pmndrs/postprocessing
  - https://threejs-journey.com/lessons/post-processing

---

### Finding 8: Underwater Caustics (Enhanced)

**Technique 1: Animated Dual-Layer Texture Projection (Fast, Good Quality)**

Project animated caustic textures onto the ocean floor with two layers at different scales and speeds:

```glsl
// In ocean floor fragment shader
uniform sampler2D causticsTexture;
uniform float time;
uniform float causticsScale;
uniform float causticsIntensity;

// World-space projection (top-down)
vec2 causticsUV = worldPosition.xz * causticsScale;

// Two layers at different speeds for variety
vec3 caustics1 = texture2D(causticsTexture, causticsUV + time * 0.02).rgb;
vec3 caustics2 = texture2D(causticsTexture,
                            causticsUV * 1.3 - time * 0.015).rgb;

// Combine with min() for realistic pattern intersection
vec3 caustics = min(caustics1, caustics2);

// Depth falloff (caustics weaker at depth)
float depthFactor = exp(-abs(worldPosition.y) * 0.05);
finalColor += caustics * causticsIntensity * depthFactor;
```

**Technique 2: Physically-Based Area-Ratio Caustics (Martin Renou / Evan Wallace)**

Compute caustics from the water surface mesh using light refraction geometry:
1. Create a "light front" mesh matching the water surface
2. For each vertex, apply Snell's law to refract toward the floor
3. The area change of triangles after refraction determines light concentration
4. Use `dFdx()` and `dFdy()` GLSL partial derivatives for area computation

```glsl
// In caustics computation shader
vec3 refractedPos = waterSurfacePos +
    refract(lightDir, waterNormal, 1.0/1.33) * waterDepth;
float oldArea = length(dFdx(waterSurfacePos.xz))
              * length(dFdy(waterSurfacePos.xz));
float newArea = length(dFdx(refractedPos.xz))
              * length(dFdy(refractedPos.xz));
float causticsIntensity = oldArea / max(newArea, 0.001);
```

**Technique 3: RGB Chromatic Caustics (Anderson Mancini, 2024-2025)**

Split caustics into R, G, B channels with slightly different refraction indices for chromatic dispersion:
```glsl
float causticsR = computeCaustics(waterNormal, 1.0 / 1.33);
float causticsG = computeCaustics(waterNormal, 1.0 / 1.34);
float causticsB = computeCaustics(waterNormal, 1.0 / 1.35);
vec3 chromaticCaustics = vec3(causticsR, causticsG, causticsB);
```

**Procedural Caustics (Shadertoy-style):**
Purely procedural caustics using voronoi noise and sin/cos wave functions:
```glsl
// From Shadertoy underwater caustics
float water_caustics(vec2 uv, float time) {
    vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
    float t = time * 0.5;
    vec2 i = vec2(p);
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 5; n++) {
        float t2 = t * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(cos(t2 - i.x) + sin(t2 + i.y),
                      sin(t2 - i.y) + cos(t2 + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten),
                                p.y / (cos(i.y + t) / inten)));
    }
    c /= 5.0;
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
}
```

**@react-three/drei Caustics component** provides a production-ready implementation that can be studied.

**Recommendation for the project:** The existing `Caustics.ts` already has chromatic aberration. Consider integrating with the FFT wave data more tightly and using the physically-based area-ratio technique for higher quality, or use the dual-layer animated texture approach for better performance.

- Sources:
  - https://medium.com/@martinRenou/real-time-rendering-of-water-caustics-59cda1d74aa
  - https://blog.maximeheckel.com/posts/caustics-in-webgl/
  - https://water-simulation.vercel.app/
  - https://www.shadertoy.com/view/XttyRX
  - https://discourse.threejs.org/t/underwater-add-caustic-shader-on-sand-texture/7720

---

### Finding 9: Underwater Particle Systems

**Floating Particulate Matter (Marine Snow):**

```typescript
const particleCount = 2000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 100;
  positions[i * 3 + 1] = Math.random() * -50;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
  sizes[i] = Math.random() * 0.3 + 0.05;
}

geometry.setAttribute('position',
  new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('size',
  new THREE.BufferAttribute(sizes, 1));

const material = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    currentDir: { value: new THREE.Vector3(1, 0, 0.3) },
  },
  vertexShader: /* glsl */`
    attribute float size;
    uniform float time;
    uniform vec3 currentDir;
    varying float vAlpha;

    void main() {
      vec3 pos = position;
      // Gentle drift with ocean current
      pos += currentDir * sin(time * 0.1 + position.z * 0.5) * 0.5;
      // Slow vertical bobbing
      pos.y += sin(time * 0.05 + position.x) * 0.2;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;

      // Fade with distance
      vAlpha = smoothstep(50.0, 5.0, -mvPosition.z) * 0.6;
    }
  `,
  fragmentShader: /* glsl */`
    varying float vAlpha;
    void main() {
      float dist = length(gl_PointCoord - 0.5);
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
      gl_FragColor = vec4(0.8, 0.85, 0.9, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);
```

**2026 Best Practice: Compute Shader Particles (WebGPU)**

For >50,000 particles, move to compute shaders:
- Storage buffers persist particle state between frames
- No CPU-GPU data transfer bottleneck
- Can handle millions of particles at 60fps

The project already has `UnderwaterParticles.ts` -- the above pattern can enhance it with current-based drift and distance-based alpha.

- Sources:
  - https://threejs.org/examples/webgl_buffergeometry_points.html
  - https://blog.maximeheckel.com/posts/the-magical-world-of-particles-with-react-three-fiber-and-shaders/

---

### Finding 10: Notable Three.js Underwater Demos and Projects (2024-2026)

| Project | Description | Key Tech |
|---------|------------|----------|
| **Water Simulation (Mancini)** | RGB caustics, underwater distortion, screen droplets | R3F, GLSL, MeshTransmissionMaterial |
| **Three.js Water Pro** | Commercial FFT ocean: Fresnel, SSS, caustics, foam, buoyancy | TSL, WebGPU, FFT |
| **jbouny/ocean** | Classic realistic water shader with reflection/refraction | Custom GLSL, dual normal maps |
| **liquid.fish** | Building the ocean with Three.js -- comprehensive tutorial | Gerstner waves, GPGPU |
| **Immersive Underwater (Chotia)** | R3F underwater scene with flora, submarines, bubbles | React Three Fiber |
| **Stylized Water (Codrops, Mar 2025)** | Stylized water effects with R3F | Custom shaders |
| **WebXR Water** | VR-compatible water simulation with caustics | WebXR, R3F, GLSL |
| **Evan Wallace WebGL Water** | Foundational caustics demo with interactive ripples | Pure WebGL |

**Three.js Water Pro (Commercial, TSL/WebGPU):**
- FFT wave generation (film/AAA quality)
- Fresnel reflections, subsurface scattering through wave peaks
- Caustic patterns on seafloor, procedural foam
- Four-point buoyancy system for floating objects
- 50+ adjustable parameters, 10 environment presets
- 4 performance presets (calm to storm)
- Dynamic Rayleigh sky model with volumetric clouds

**Emerging: WebGPU and TSL (Three.js Shading Language)**

As of 2025-2026, Three.js is transitioning to WebGPU with TSL as the new shader system:
- TSL is a node-based, JavaScript-like shading language
- Compiles to both WebGPU (WGSL) and WebGL (GLSL) backends
- Includes built-in noise functions (no need for external noise libraries)
- Compute shaders enable millions of particles (vs ~50K on CPU)
- Safari 26+ ships WebGPU support (Sept 2025), making it viable for all major browsers
- `MeshPhysicalNodeMaterial` provides node-based control over every physical property

**2026 Best Practices:**
- Prefer TSL over raw GLSL for future-proofing
- Target under 100 draw calls per frame for 60fps
- Use compute shaders for particle systems when on WebGPU
- Use InstancedMesh for coral/vegetation (massive draw call reduction)
- Use environment maps for ambient light rather than multiple real-time lights
- Merge compatible post-processing effects into single shader passes

- Sources:
  - https://water-simulation.vercel.app/
  - https://threejsroadmap.com/assets/threejs-water-pro
  - https://www.liquid.fish/current/threejs
  - https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
  - https://www.utsubo.com/blog/threejs-best-practices-100-tips

---

## Codebase Analysis

The project at `/Volumes/LizsDisk/ocean-simulator` already has substantial underwater rendering infrastructure:

| File | Current Approach | Suggested Upgrade |
|------|-----------------|-------------------|
| `src/rendering/GodRays.ts` | Particle-based (3000 points, 8 rays) | Screen-space raymarching via three-good-godrays |
| `src/rendering/DepthBasedFog.ts` | Simple FogExp2, single color | Beer-Lambert wavelength-dependent absorption |
| `src/rendering/Caustics.ts` | ShaderMaterial with chromatic aberration | Tighter FFT integration, dual-layer animated textures |
| `src/rendering/CoralFormations.ts` | Basic geometry primitives | Recursive branching + InstancedMesh polyps |
| `src/rendering/EnhancedFishMaterial.ts` | Custom material | MeshPhysicalMaterial with iridescence |
| `src/rendering/PostProcessingPipeline.ts` | Exists | Add underwater color correction effect |
| `src/rendering/VolumetricFog.ts` | Exists | Integrate with wavelength absorption |
| `src/rendering/WavelengthLighting.ts` | Exists | Good foundation, extend with Beer-Lambert |
| `src/rendering/UnderwaterParticles.ts` | Exists | Add current drift, distance alpha |
| `src/rendering/Bioluminescence.ts` | Exists | Good as-is |
| `src/shaders/caustics.frag` | Custom shader | Enhance with area-ratio or procedural technique |
| `src/shaders/underwater.frag` | Custom shader | Add wavelength absorption |

---

## Sources

- [three-good-godrays (GitHub)](https://github.com/Ameobea/three-good-godrays) -- Screen-space god rays for Three.js
- [Volumetric Light Scattering in Three.js (Medium)](https://medium.com/@andrew_b_berg/volumetric-light-scattering-in-three-js-6e1850680a41) -- Classic multi-pass approach
- [Real-Time Underwater Spectral Rendering (CGF 2024)](https://onlinelibrary.wiley.com/doi/10.1111/cgf.15009) -- Monzon et al.
- [MeshPhysicalMaterial docs](https://threejs.org/docs/api/en/materials/MeshPhysicalMaterial.html) -- Iridescence, transmission, SSS
- [Fast SSS gist (mattdesl)](https://gist.github.com/mattdesl/2ee82157a86962347dedb6572142df7c) -- Translucency shader
- [Parallax Mapping for Three.js (shapespark)](https://github.com/shapespark/parallax-mapping) -- Ocean floor depth
- [Fractals to Forests (Codrops 2025)](https://tympanus.net/codrops/2025/01/27/fractals-to-forests-creating-realistic-3d-trees-with-three-js/) -- Branching algorithms
- [coral-growth (GitHub)](https://github.com/yomboprime/coral-growth) -- Hierarchical mesh subdivision
- [Real-time caustics (Martin Renou)](https://medium.com/@martinRenou/real-time-rendering-of-water-caustics-59cda1d74aa) -- Physically-based caustics
- [Caustics in WebGL (Maxime Heckel, 2024)](https://blog.maximeheckel.com/posts/caustics-in-webgl/) -- R3F caustics
- [Water Simulation (Anderson Mancini)](https://water-simulation.vercel.app/) -- RGB caustics demo
- [Three.js Water Pro](https://threejsroadmap.com/assets/threejs-water-pro) -- Commercial FFT ocean
- [TSL Field Guide (Maxime Heckel)](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/) -- WebGPU shading
- [100 Three.js Best Practices 2026](https://www.utsubo.com/blog/threejs-best-practices-100-tips) -- Performance tips
- [WebGL Fog Fundamentals](https://webglfundamentals.org/webgl/lessons/webgl-fog.html) -- Fog techniques
- [Three.js Fog Rework (gsimone)](https://gist.github.com/gsimone/08b5e0cbe65ad3917581fa2b7acd004d) -- Custom fog proposal
- [Snell's Window (Wikipedia)](https://en.wikipedia.org/wiki/Snell's_window) -- Physics reference
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) -- Post-processing library
- [Shadertoy Underwater Caustics](https://www.shadertoy.com/view/XttyRX) -- GLSL caustics reference
- [Three.js SSS Example](https://threejs.org/examples/webgl_materials_subsurface_scattering.html) -- Official SSS demo
- [Thin Film Iridescence (DerSchmale)](https://github.com/DerSchmale/threejs-thin-film-iridescence) -- Alternative iridescence
- [Three.js onBeforeCompile (manual)](https://github.com/mrdoob/three.js/blob/dev/manual/en/indexed-textures.html) -- Shader modification
- [WaterMaterial onBeforeCompile (official example)](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_gpgpu_water.html) -- Water material pattern

---

## Recommendations

**Priority 1 (Highest Visual Impact):**
1. Replace particle god rays with screen-space raymarching (`three-good-godrays` or custom)
2. Implement Beer-Lambert wavelength-dependent fog (replace simple FogExp2)
3. Add underwater color grading post-processing effect

**Priority 2 (Material Quality):**
4. Upgrade fish materials to MeshPhysicalMaterial with iridescence
5. Add SSS to jellyfish and translucent creatures
6. Add parallax occlusion mapping to ocean floor

**Priority 3 (Environmental Richness):**
7. Implement recursive branching for coral with InstancedMesh
8. Add Snell's window effect for water surface from below
9. Enhance caustics with FFT wave data integration

**Priority 4 (Future-Proofing):**
10. Consider TSL migration for WebGPU compatibility
11. Move particle systems to compute shaders for higher counts

---

## Open Questions

1. **WebGPU readiness:** Is the project targeting WebGPU or staying with WebGL? TSL migration would affect all shader code.
2. **Performance budget:** What's the target FPS and device tier? Some techniques (physically-based caustics, POM) are expensive.
3. **three-good-godrays compatibility:** Needs testing with the project's current Three.js version (library tested with r125-r182).
4. **Existing shader files:** The `.frag` and `.vert` files in `src/shaders/` need review to understand current custom shader state before modifying.
5. **Post-processing pipeline:** Need to understand what's already in `PostProcessingPipeline.ts` before adding new effects.
