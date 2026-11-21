import * as THREE from 'three';
import { BlendFunction, BloomEffect, Effect, EffectAttribute } from 'postprocessing';

/**
 * One physical model of the water, used by every pass that needs it.
 *
 * Before this existed, each system invented its own water: scene FogExp2, a post
 * "colour grade", per-material fog in the sand shader, flat ambient fills and emissive
 * boosts. They disagreed, which is why the scene read as a grey wash with a hard band
 * at the horizon. Here the water is a participating medium with per-channel extinction:
 *
 *   surface radiance  L_s * exp(-Kd * depth_below_surface)   (sunlight that reached it)
 *   seen through      exp(-sigma * viewDistance)              (absorption + out-scatter)
 *   plus in-scatter   integral of sunlit water along the view ray (closed form)
 *   plus light shafts raymarched through caustic-focused sunlight
 *
 * Coefficients are per metre, RGB. Red dies first, then green, so distance and depth
 * both shift toward blue-green without any hand-picked fog colour.
 */
export const WATER = {
  /** Beam extinction for the view ray (1/m). Horizontal visibility ~60 m in green. */
  extinction: new THREE.Vector3(0.09, 0.04, 0.032),
  /** Diffuse downwelling attenuation for sunlight going down (1/m). */
  downwelling: new THREE.Vector3(0.07, 0.027, 0.021),
  /** Radiance of an infinitely deep column of sunlit water just under the surface. */
  mediumColor: new THREE.Color(0.16, 0.56, 0.78),
  /** Colour of the focused light inside shafts. */
  shaftColor: new THREE.Color(0.72, 0.92, 1.0),
} as const;

/**
 * Animated caustic network: sunlight focused by surface waves lands as bright
 * filaments along the borders of moving cells. Shared by the seabed shader and any
 * material that wants dapples, so every surface agrees on where the light falls.
 */
export const CAUSTIC_GLSL = /* glsl */ `
  vec2 wm_hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  // Distance between the nearest and second-nearest moving feature point:
  // ~0 on cell borders, where refracted light piles up.
  float wm_cellEdge(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = wm_hash22(i + g);
        o = 0.5 + 0.42 * sin(t * 0.85 + 6.2831 * o);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return sqrt(d2) - sqrt(d1);
  }

  // p in metres on the surface-projected plane. Returns ~0..1.6, mean ~0.35.
  float wm_caustic(vec2 p, float t) {
    p *= 0.62;
    p += 0.3 * vec2(sin(p.y * 0.8 + t * 0.45), cos(p.x * 0.7 - t * 0.38));
    float a = 1.0 - smoothstep(0.0, 0.22, wm_cellEdge(p, t));
    float b = 1.0 - smoothstep(0.0, 0.3, wm_cellEdge(p * 1.83 + vec2(4.1, 1.3), t * 1.21));
    return pow(a, 2.2) * 1.1 + pow(b, 2.6) * 0.5;
  }

  // Chromatic caustic: the three wavelengths refract by slightly different amounts.
  vec3 wm_causticRGB(vec2 p, float t) {
    return vec3(
      wm_caustic(p + vec2(0.035, 0.02), t),
      wm_caustic(p, t),
      wm_caustic(p - vec2(0.035, 0.02), t)
    );
  }

  // Where on the surface the sunlight reaching worldPos came through.
  vec2 wm_surfaceEntry(vec3 worldPos, vec3 sunDir) {
    float pathUp = max(-worldPos.y, 0.0) / max(sunDir.y, 0.15);
    return worldPos.xz + sunDir.xz * pathUp;
  }
`;

/**
 * Depth-buffer value at or above which a pixel is open water (the cleared background, with
 * only additive sprites drawn over it). Geometry must stay below it, because open water
 * adds the pixel's colour unfogged. The old 0.99999 classed everything past about 910 m of
 * the 1000 m far plane as open water, so far geometry such as the 10 km basic-water
 * surface showed through unfogged. The depth texture is 32-bit float, so this catches only
 * the last metre or so before the far plane.
 */
export const SKY_DEPTH = 0.9999999;

/**
 * Height of the sea surface. Above it the camera sees the sky and the water medium does
 * nothing; the sky and this pass must switch at the same height.
 */
export const SURFACE_Y = 0;

/**
 * View ray and surface attenuation, shared by every shader that needs to see the scene
 * through the water. Expects the uniforms declared here to share values with the water
 * medium effect.
 */
const waterRayChunk = /* glsl */ `
  uniform mat4 uInvProjection;
  uniform mat4 uCameraWorld;
  uniform vec3 uCameraPos;
  uniform vec3 uExtinction;
  uniform vec3 uDownwelling;
  uniform float uDensity;
  uniform float uExposure;

  const float SKY_DISTANCE = 600.0;

  struct WaterRay {
    vec3 worldPos;
    vec3 rd;
    float dist;
    bool isSky;
  };

  WaterRay waterRay(vec2 uv, float depth) {
    WaterRay r;
    r.isSky = depth >= ${SKY_DEPTH.toFixed(7)};
    vec4 ndc = vec4(uv * 2.0 - 1.0, (r.isSky ? 1.0 : depth) * 2.0 - 1.0, 1.0);
    vec4 viewPos = uInvProjection * ndc;
    viewPos /= viewPos.w;
    r.worldPos = (uCameraWorld * vec4(viewPos.xyz, 1.0)).xyz;
    vec3 toP = r.worldPos - uCameraPos;
    r.dist = r.isSky ? SKY_DISTANCE : length(toP);
    r.rd = normalize(toP);
    return r;
  }

  // Light from the surface behind the pixel as the camera sees it: sunlight lost on the
  // way down to the surface, then light lost along the view ray. Open water has no
  // surface behind the ray; additive sprites (marine snow, bubbles) drawn over the black
  // background stay unfogged.
  vec3 waterSurfaceLight(vec3 color, WaterRay r) {
    if (r.isSky) return color;
    vec3 sigma = uExtinction * uDensity;
    return color * exp(-uDownwelling * max(-r.worldPos.y, 0.0)) * exp(-sigma * r.dist);
  }
`;

const waterMediumShader = /* glsl */ `
  ${waterRayChunk}
  uniform vec3 uSunDir;
  uniform float uSunStrength;
  uniform vec3 uMediumColor;
  uniform vec3 uShaftColor;
  uniform float uShaftStrength;
  uniform float uTime;
  const int SHAFT_STEPS = 22;
  const float SHAFT_RANGE = 55.0;
  // Share of the sunlight the surface redistributes into shafts (1 = gaps fully dark).
  const float SHAFT_CONTRAST = 0.55;

  // Low-frequency focusing pattern for the shafts: from a distance, caustic
  // filaments integrate into streaks rather than a fine net. Mean 1 over the
  // surface (measured: E[v^4] = 0.13), because the surface focuses sunlight,
  // it does not add any.
  float shaftPattern(vec2 q, float t) {
    float a = sin(q.x * 0.55 + t * 0.35 + 1.6 * sin(q.y * 0.31 + t * 0.21));
    float b = sin(q.y * 0.5 - t * 0.29 + 1.6 * sin(q.x * 0.27 - t * 0.17));
    float c = sin((q.x - q.y) * 0.37 + t * 0.23);
    float v = clamp(a * b * 0.6 + c * 0.4, -1.0, 1.0) * 0.5 + 0.5;
    float v2 = v * v;
    return v2 * v2 * 7.7;
  }

  float phaseHG(float mu, float g) {
    float g2 = g * g;
    return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * mu, 1.5);
  }

  float ign(vec2 px) {
    return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    WaterRay ray = waterRay(uv, depth);
    vec3 ro = uCameraPos;
    float dist = ray.dist;
    vec3 rd = ray.rd;

    vec3 sigma = uExtinction * uDensity;
    vec3 kd = uDownwelling;
    float camDepth = max(-ro.y, 0.0);

    // Underwater only: above the surface the medium does nothing.
    if (ro.y > ${SURFACE_Y.toFixed(1)}) {
      outputColor = vec4(inputColor.rgb * uExposure, inputColor.a);
      return;
    }

    // 1-2. Sunlight that reached the surface we are looking at, seen through the water.
    vec3 surface = waterSurfaceLight(inputColor.rgb, ray);

    // 3. Single-scattered sunlight along the ray, closed form. Light at ray point t is
    //    exp(-kd * depth(t)); depth changes linearly with t, so the integral is analytic.
    //    Looking up (rd.y > 0) the water gets brighter, looking down it falls into blue-black.
    //    Looking up, the light can grow along the ray faster than the water absorbs it, so
    //    the coefficient can be negative. Keep its sign, take the limit dist only near zero,
    //    and stop the ray at the surface so the growing term stays bounded.
    float waterDist = rd.y > 1e-4 ? min(dist, camDepth / rd.y) : dist;
    vec3 a = sigma - kd * rd.y;
    vec3 nearZero = step(abs(a), vec3(1e-4));
    // Divide by 1 where a is near zero: dividing by zero gives NaN, which mix() keeps.
    vec3 aSafe = mix(a, vec3(1.0), nearZero);
    vec3 column = mix((1.0 - exp(-aSafe * waterDist)) / aSafe, vec3(waterDist), nearZero);
    vec3 lightAtCam = exp(-kd * camDepth);
    float mu = dot(rd, uSunDir);
    float phase = 0.55 + 0.45 * phaseHG(mu, 0.45) * 0.35;
    vec3 inscatter = uMediumColor * sigma * column * lightAtCam * phase * uSunStrength;

    // 4. Light shafts. The same single scattering as step 3, except the sunlight at
    //    each sample is focused or defocused by the surface (pattern mean 1). Only the
    //    deviation from 1 is marched, so shafts move the water's own light into
    //    streaks and leave its average colour alone instead of laying a pale veil.
    vec3 shafts = vec3(0.0);
    if (uShaftStrength > 0.001 && uSunStrength > 0.02) {
      float tMax = min(dist, SHAFT_RANGE);
      float dt = tMax / float(SHAFT_STEPS);
      // Fixed per pixel: a jitter that changes every frame shimmers without TAA.
      float jitter = ign(uv * resolution);
      vec3 acc = vec3(0.0);
      for (int i = 0; i < SHAFT_STEPS; i++) {
        float t = (float(i) + jitter) * dt;
        vec3 p = ro + rd * t;
        if (p.y > -0.2) continue;
        float depthP = -p.y;
        vec2 q = p.xz + uSunDir.xz * (depthP / max(uSunDir.y, 0.15));
        // Focus is sharpest a few metres down and smears out with depth. Scattered skylight
        // and the surface's own blur keep real gaps between shafts from going fully dark,
        // so only part of the light is redistributed (still mean zero).
        float focus = SHAFT_CONTRAST * (shaftPattern(q, uTime) - 1.0) * exp(-max(depthP - 2.0, 0.0) * 0.035);
        acc += focus * exp(-kd * depthP) * exp(-sigma * t) * dt;
      }
      // Shafts are seen mostly looking toward the sun: extra forward lobe.
      float shaftPhase = phase + 0.35 * phaseHG(mu, 0.7);
      shafts = uMediumColor * uShaftColor * sigma * acc * shaftPhase * uShaftStrength * uSunStrength;
    }

    vec3 color = surface + inscatter + shafts;
    // Dark streaks between shafts subtract light; never below black.
    color = max(color, vec3(0.0));

    outputColor = vec4(color * uExposure, inputColor.a);
  }
`;

/**
 * Post effect that renders the water medium from the depth buffer. Runs before bloom
 * and tone mapping so highlights it produces bloom and compress like real light.
 */
export class WaterMediumEffect extends Effect {
  private readonly _sun = new THREE.Vector3(0.3, 1, 0.2).normalize();

  constructor() {
    super('WaterMedium', waterMediumShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['uInvProjection', new THREE.Uniform(new THREE.Matrix4())],
        ['uCameraWorld', new THREE.Uniform(new THREE.Matrix4())],
        ['uCameraPos', new THREE.Uniform(new THREE.Vector3())],
        ['uSunDir', new THREE.Uniform(new THREE.Vector3(0.3, 1, 0.2).normalize())],
        ['uSunStrength', new THREE.Uniform(1.0)],
        ['uExtinction', new THREE.Uniform(WATER.extinction.clone())],
        ['uDownwelling', new THREE.Uniform(WATER.downwelling.clone())],
        ['uMediumColor', new THREE.Uniform(WATER.mediumColor.clone())],
        ['uShaftColor', new THREE.Uniform(WATER.shaftColor.clone())],
        ['uDensity', new THREE.Uniform(1.0)],
        ['uShaftStrength', new THREE.Uniform(1.0)],
        ['uExposure', new THREE.Uniform(1.0)],
        ['uTime', new THREE.Uniform(0)],
      ]),
    });
  }

  private u<T>(name: string): THREE.Uniform<T> {
    return this.uniforms.get(name) as THREE.Uniform<T>;
  }

  /** Call once per frame before rendering. */
  updateCamera(camera: THREE.PerspectiveCamera, deltaTime: number): void {
    camera.updateMatrixWorld();
    this.u<THREE.Matrix4>('uInvProjection').value.copy(camera.projectionMatrixInverse);
    this.u<THREE.Matrix4>('uCameraWorld').value.copy(camera.matrixWorld);
    camera.getWorldPosition(this.u<THREE.Vector3>('uCameraPos').value);
    this.u<number>('uTime').value += deltaTime;
  }

  /** Sun direction (toward the sun) and strength: 1 = noon, 0 = night. */
  setSun(direction: THREE.Vector3, strength: number): void {
    this._sun.copy(direction).normalize();
    // Below the horizon the water is lit only by sky; keep a floor so the maths stays sane.
    if (this._sun.y < 0.15) this._sun.y = 0.15;
    this._sun.normalize();
    this.u<THREE.Vector3>('uSunDir').value.copy(this._sun);
    this.u<number>('uSunStrength').value = strength;
  }

  /** Scales all extinction: 1 = clear coastal water, 2 = murky. */
  setDensity(density: number): void {
    this.u<number>('uDensity').value = density;
  }

  setShaftStrength(strength: number): void {
    this.u<number>('uShaftStrength').value = strength;
  }

  setMediumColor(hex: number): void {
    this.u<THREE.Color>('uMediumColor').value.setHex(hex);
  }

  setExposure(exposure: number): void {
    this.u<number>('uExposure').value = exposure;
  }
}

/** Water uniforms the bloom extraction reads; shared objects, so values stay in step. */
const BLOOM_WATER_UNIFORMS = [
  'uInvProjection',
  'uCameraWorld',
  'uCameraPos',
  'uExtinction',
  'uDownwelling',
  'uDensity',
  'uExposure',
] as const;

/** Where the library's luminance shader reads the pixel it extracts highlights from. */
const LUMINANCE_TEXEL = 'vec4 texel=texture2D(inputBuffer,vUv);';

const bloomSourceChunk = /* glsl */ `
  #include <packing>
  uniform highp sampler2D depthBuffer;
  ${waterRayChunk}

  float waterReadDepth(vec2 uv) {
    #if DEPTH_PACKING == 3201
      return unpackRGBAToDepth(texture2D(depthBuffer, uv));
    #else
      return texture2D(depthBuffer, uv).r;
    #endif
  }

  // The pixel as the water medium shows it, before in-scatter and shafts are added.
  vec3 waterBloomSource(vec3 color, vec2 uv) {
    if (uCameraPos.y > ${SURFACE_Y.toFixed(1)}) return color * uExposure;
    return waterSurfaceLight(color, waterRay(uv, waterReadDepth(uv))) * uExposure;
  }
`;

/**
 * Bloom that extracts its highlights from the scene as the water shows it.
 *
 * Bloom extracts highlights from its pass input, which is the scene before the water
 * medium runs, so a bright surface the water hides still left a halo. Running the water
 * in its own earlier pass fixes that but costs a full-screen pass (on an M4 Pro at
 * 1512x900, 0% late frames at a 0.85 render scale became about 12% late at 0.5). Instead
 * the extraction applies the same surface attenuation as the water, in the pass it
 * already runs. In-scatter and shafts are left out: they are dim and costly.
 */
export class UnderwaterBloomEffect extends BloomEffect {
  constructor(water: WaterMediumEffect, options: ConstructorParameters<typeof BloomEffect>[0]) {
    super(options);
    const material = this.luminanceMaterial;
    if (!material.fragmentShader.includes(LUMINANCE_TEXEL)) {
      throw new Error('UnderwaterBloomEffect: luminance shader changed; update LUMINANCE_TEXEL');
    }
    material.fragmentShader = material.fragmentShader
      .replace('varying vec2 vUv;', `varying vec2 vUv;\n${bloomSourceChunk}\n`)
      .replace(LUMINANCE_TEXEL, `${LUMINANCE_TEXEL}texel.rgb=waterBloomSource(texel.rgb,vUv);`);
    material.uniforms.depthBuffer = new THREE.Uniform<THREE.Texture | null>(null);
    for (const name of BLOOM_WATER_UNIFORMS) {
      material.uniforms[name] = water.uniforms.get(name) as THREE.Uniform;
    }
    material.defines.DEPTH_PACKING = String(THREE.BasicDepthPacking);
  }

  override setDepthTexture(
    depthTexture: THREE.Texture,
    depthPacking: THREE.DepthPackingStrategies = THREE.BasicDepthPacking,
  ): void {
    const material = this.luminanceMaterial;
    material.uniforms.depthBuffer.value = depthTexture;
    material.defines.DEPTH_PACKING = String(depthPacking);
    material.needsUpdate = true;
  }
}
