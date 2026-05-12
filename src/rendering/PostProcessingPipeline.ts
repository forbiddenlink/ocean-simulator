import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  GodRaysEffect,
  ToneMappingEffect,
  VignetteEffect,
  SMAAEffect,
  SMAAPreset,
  KernelSize,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  NoiseEffect,
  Effect,
  BlendFunction,
} from 'postprocessing';

// Custom underwater spectral absorption effect shader
// Implements Beer-Lambert law for realistic wavelength-dependent light absorption
const underwaterColorGradingShader = /* glsl */ `
  uniform float absorptionR;
  uniform float absorptionG;
  uniform float absorptionB;
  uniform float absorptionScale;
  uniform float turbidity;
  uniform float cameraDepth;
  uniform float cameraNear;
  uniform float cameraFar;

  // Read depth from the depth buffer (provided by postprocessing library)
  float readDepth(sampler2D depthSampler, vec2 coord) {
    float fragCoordZ = texture2D(depthSampler, coord).x;
    float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
    return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar) * cameraFar;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    // Get distance from camera to this pixel using depth buffer
    float pixelDistance = readDepth(depthBuffer, uv);

    // Clamp distance to prevent extreme values
    pixelDistance = clamp(pixelDistance, 0.0, 100.0);

    // === BEER-LAMBERT SPECTRAL ABSORPTION ===
    // Light traveling through water is absorbed at different rates per wavelength
    // Red light is absorbed fastest, blue light penetrates deepest
    // I(λ) = I₀(λ) * e^(-k(λ) * distance)

    // Absorption coefficients (per meter): Red=0.45, Green=0.15, Blue=0.05
    // absorptionScale controls overall strength (tunable for cinematic look)
    vec3 absorption = vec3(absorptionR, absorptionG, absorptionB) * absorptionScale;
    vec3 transmission = exp(-absorption * pixelDistance);

    // Apply spectral absorption - red fades first, then green, blue persists
    color *= transmission;

    // === DEPTH-BASED SCATTERING ===
    // Water scatters light, adding a blue-green tint at distance
    // Enhanced for more realistic underwater atmosphere
    float scatterFactor = 1.0 - exp(-pixelDistance * 0.035);
    vec3 scatterColor = vec3(0.15, 0.35, 0.55) * (1.0 + cameraDepth * 0.015);
    color = mix(color, scatterColor, scatterFactor * 0.35);

    // === CAMERA DEPTH EFFECTS ===
    // Additional effects based on how deep the camera is
    float depthFactor = clamp(cameraDepth / 60.0, 0.0, 1.0);

    // Gentle desaturation at extreme depth
    float saturation = 1.0 - depthFactor * 0.05;
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luminance), color, saturation);

    // Subtle contrast reduction at depth
    float contrast = 1.0 - depthFactor * 0.08;
    color = mix(vec3(0.4), color, contrast);

    // Turbidity adds slight blue-green tint (suspended particles)
    color += vec3(-0.01, 0.005, 0.015) * turbidity * (1.0 + pixelDistance * 0.02);

    outputColor = vec4(color, inputColor.a);
  }
`;

// Custom underwater distortion effect shader (heat-haze/refraction)
const underwaterDistortionShader = /* glsl */ `
  uniform float time;
  uniform float intensity;
  uniform float frequency;
  uniform float speed;

  void mainUv(inout vec2 uv) {
    // Multi-layered wave distortion for organic underwater feel
    float wave1 = sin(uv.y * frequency + time * speed) * intensity;
    float wave2 = sin(uv.x * frequency * 0.7 + time * speed * 1.3) * intensity * 0.7;
    float wave3 = sin((uv.x + uv.y) * frequency * 0.5 + time * speed * 0.8) * intensity * 0.5;

    // Apply distortion - subtle horizontal and vertical shift
    uv.x += wave1 * 0.003 + wave3 * 0.002;
    uv.y += wave2 * 0.002 + wave3 * 0.001;
  }
`;

/**
 * Custom underwater distortion post-processing effect.
 * Creates subtle heat-haze/refraction wavering for underwater atmosphere.
 */
class UnderwaterDistortionEffect extends Effect {
  constructor() {
    super('UnderwaterDistortion', underwaterDistortionShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['time', new THREE.Uniform(0.0)],
        ['intensity', new THREE.Uniform(1.0)],     // Overall distortion strength
        ['frequency', new THREE.Uniform(15.0)],    // Wave frequency
        ['speed', new THREE.Uniform(0.8)],         // Animation speed
      ]),
    });
  }

  /**
   * Update animation time
   */
  updateTime(time: number): void {
    (this.uniforms.get('time') as THREE.Uniform).value = time;
  }

  /**
   * Set distortion intensity (0-2, where 1.0 is default)
   */
  setIntensity(intensity: number): void {
    (this.uniforms.get('intensity') as THREE.Uniform).value = intensity;
  }
}

/**
 * Custom underwater spectral absorption post-processing effect.
 * Implements Beer-Lambert law for realistic wavelength-dependent light absorption.
 * Red light fades first, then green, leaving blue at distance - just like real underwater.
 */
class UnderwaterColorGradingEffect extends Effect {
  constructor() {
    super('UnderwaterColorGrading', underwaterColorGradingShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        // Beer-Lambert absorption coefficients (per meter)
        // Tuned for dramatic, physically-motivated underwater color shift
        ['absorptionR', new THREE.Uniform(0.25)],   // Red fades fastest — gentle
        ['absorptionG', new THREE.Uniform(0.06)],   // Green barely fades
        ['absorptionB', new THREE.Uniform(0.02)],   // Blue penetrates deepest
        ['absorptionScale', new THREE.Uniform(0.05)], // Light absorption for tropical clarity
        ['turbidity', new THREE.Uniform(0.25)],      // Low turbidity — crystal clear tropical water
        ['cameraDepth', new THREE.Uniform(12.0)],
        // Camera projection parameters for depth buffer reading
        ['cameraNear', new THREE.Uniform(0.1)],
        ['cameraFar', new THREE.Uniform(1000.0)],
      ]),
    });
  }

  /**
   * Update the camera depth uniform for depth-based color grading.
   * @param cameraY - The camera's Y position (negative = underwater depth)
   */
  updateDepth(cameraY: number): void {
    const depth = Math.max(0, -cameraY);
    (this.uniforms.get('cameraDepth') as THREE.Uniform).value = depth;
  }

  /**
   * Update camera projection parameters for accurate depth reading.
   * @param camera - The scene camera
   */
  updateCamera(camera: THREE.PerspectiveCamera): void {
    (this.uniforms.get('cameraNear') as THREE.Uniform).value = camera.near;
    (this.uniforms.get('cameraFar') as THREE.Uniform).value = camera.far;
  }
}

/**
 * Advanced post-processing pipeline for underwater effects.
 * Implements bloom, god rays, underwater color grading, tone mapping,
 * chromatic aberration, vignette, and SMAA antialiasing.
 */
export class PostProcessingPipeline {
  private composer: EffectComposer;
  private godRaysEffect?: GodRaysEffect;
  private bloomEffect: BloomEffect;
  private sunMesh?: THREE.Mesh;
  private sunMaterial?: THREE.MeshBasicMaterial;
  private underwaterColorGrading: UnderwaterColorGradingEffect;
  private vignetteEffect: VignetteEffect;
  private chromaAberration: ChromaticAberrationEffect;
  private depthOfField: DepthOfFieldEffect;
  private filmGrain: NoiseEffect;
  private underwaterDistortion: UnderwaterDistortionEffect;
  private distortionTime: number = 0;
  private godRayBaseWeight: number = 0.35;
  private godRayBaseExposure: number = 0.4;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    // Create effect composer
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    });

    // Render pass - renders the scene
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Create sun mesh for god rays (positioned above water surface)
    this.createSunMesh(scene);

    // Bloom effect - tuned for soft underwater glow and bioluminescent highlights
    this.bloomEffect = new BloomEffect({
      intensity: 0.8,
      luminanceThreshold: 0.45,
      luminanceSmoothing: 0.85,
      mipmapBlur: true,
      kernelSize: KernelSize.LARGE,
    });

    // Depth of Field - cinematic underwater focus (objects in mid-ground sharp, bg/fg soft)
    this.depthOfField = new DepthOfFieldEffect(camera, {
      focusDistance: 0.012,   // Focus at ~12m — matches typical fish viewing distance
      focalLength: 0.04,      // Wider aperture for more noticeable bokeh
      bokehScale: 2.5,        // Slightly larger bokeh discs
      height: 480,
    });

    // Film grain - subtle cinematic texture
    this.filmGrain = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
    });
    this.filmGrain.blendMode.opacity.value = 0.08; // Very subtle

    // Underwater distortion - subtle refraction wavering for immersive atmosphere
    this.underwaterDistortion = new UnderwaterDistortionEffect();
    this.underwaterDistortion.setIntensity(0.8); // Slightly less aggressive for realism

    // God rays effect - dramatic underwater light shafts with higher quality
    if (this.sunMesh) {
      this.godRaysEffect = new GodRaysEffect(camera, this.sunMesh, {
        height: 480,
        kernelSize: KernelSize.MEDIUM,
        density: 0.96,
        decay: 0.94,
        weight: 0.35,       // Stronger visible rays for dramatic underwater shafts
        exposure: 0.4,      // Brighter exposure for more visible beams
        samples: 60,        // Higher sample count for smoother, artifact-free rays
        clampMax: 0.9,
      });
    }

    // Underwater color grading effect (Phase 3)
    this.underwaterColorGrading = new UnderwaterColorGradingEffect();

    // Tone mapping - ACES Filmic for cinematic underwater look with rich contrast
    const toneMappingEffect = new ToneMappingEffect({
      mode: 2, // ACES Filmic — best for underwater with wide dynamic range
      resolution: 256,
      whitePoint: 5.0, // Slightly higher to preserve bright caustics and specular
      middleGrey: 0.65, // Brighter midtones for underwater visibility
      minLuminance: 0.005,
      averageLuminance: 0.35,
      adaptationRate: 0.8, // Slower adaptation for smoother exposure changes
    });

    // Chromatic aberration — mimics light refraction through water
    this.chromaAberration = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.001, 0.0006),
      radialModulation: true,   // Stronger at edges like a real underwater lens
      modulationOffset: 0.2,
    });

    // Vignette — natural underwater visibility falloff at edges
    this.vignetteEffect = new VignetteEffect({
      offset: 0.35,
      darkness: 0.35,
    });

    // SMAA antialiasing for smooth edges
    const smaaEffect = new SMAAEffect({
      preset: SMAAPreset.HIGH,
    });

    // Build effect passes - ChromaticAberrationEffect is a convolution effect
    // and CANNOT be merged with other effects in the same EffectPass.
    // Split into: main effects pass, then convolution pass.
    const mainEffects: Effect[] = [this.bloomEffect];

    if (this.godRaysEffect) {
      mainEffects.push(this.godRaysEffect);
    }

    mainEffects.push(
      this.depthOfField,
      this.underwaterColorGrading,
      toneMappingEffect,
      this.vignetteEffect,
      this.filmGrain,
    );

    // SMAA goes with the main non-convolution effects
    mainEffects.push(smaaEffect);

    // Main effects pass (non-convolution effects + SMAA)
    const mainEffectPass = new EffectPass(camera, ...mainEffects);
    this.composer.addPass(mainEffectPass);

    // Underwater distortion transforms UVs - convolution effect, needs own pass
    const distortionPass = new EffectPass(camera, this.underwaterDistortion);
    this.composer.addPass(distortionPass);

    // Chromatic aberration is a convolution effect - must be in its own pass
    const chromaPass = new EffectPass(camera, this.chromaAberration);
    this.composer.addPass(chromaPass);
  }

  /**
   * Create a subtle sun disc mesh for god rays.
   * Positioned above the water surface as a bright emissive sphere.
   */
  private createSunMesh(scene: THREE.Scene): void {
    const sunGeometry = new THREE.SphereGeometry(8, 16, 16);
    this.sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.85,
    });

    this.sunMesh = new THREE.Mesh(sunGeometry, this.sunMaterial);
    this.sunMesh.position.set(10, 40, 5);
    this.sunMesh.frustumCulled = false;
    scene.add(this.sunMesh);
  }

  /**
   * Render the scene with post-processing
   */
  render(deltaTime?: number): void {
    // Update underwater distortion animation
    if (deltaTime) {
      this.distortionTime += deltaTime;
      this.underwaterDistortion.updateTime(this.distortionTime);
    }
    this.composer.render(deltaTime);
  }

  /**
   * Update god ray intensity based on camera depth.
   * Stronger rays when looking up near the surface, fading with depth.
   */
  updateGodRayDepth(cameraY: number): void {
    if (!this.godRaysEffect) return;
    const depth = Math.max(0, -cameraY);
    // God rays strongest at 0-15m, fade out by 40m
    const depthFactor = Math.exp(-depth * 0.04);
    this.godRaysEffect.godRaysMaterial.weight = this.godRayBaseWeight * (0.3 + 0.7 * depthFactor);
    this.godRaysEffect.godRaysMaterial.exposure = this.godRayBaseExposure * (0.4 + 0.6 * depthFactor);
  }

  /**
   * Update god ray color based on time of day.
   * Warm at sunrise/sunset, cool at noon, dim at night.
   */
  updateGodRayTimeOfDay(timeOfDay: number): void {
    if (!this.sunMaterial) return;
    // timeOfDay: 0 = midnight, 0.5 = noon, 1.0 = midnight
    const sunAngle = Math.sin(timeOfDay * Math.PI);
    // Dawn/dusk warmth
    const dawnDusk = Math.exp(-Math.pow((timeOfDay - 0.25) * 4, 2))
                   + Math.exp(-Math.pow((timeOfDay - 0.75) * 4, 2));
    const r = 0.85 + 0.15 * dawnDusk;
    const g = 0.9 - 0.1 * dawnDusk;
    const b = 1.0 - 0.25 * dawnDusk;
    this.sunMaterial.color.setRGB(r, g, b);
    // Dim sun mesh at night
    this.sunMaterial.opacity = 0.2 + 0.65 * Math.max(0, sunAngle);
  }

  /**
   * Update pipeline on window resize
   */
  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /**
   * Update god rays sun position
   */
  updateSunPosition(position: THREE.Vector3): void {
    if (this.sunMesh) {
      this.sunMesh.position.copy(position);
    }
  }

  /**
   * Update the underwater color grading effect based on camera depth.
   * @param cameraY - The camera's Y world position (negative = deeper underwater)
   */
  updateCameraDepth(cameraY: number): void {
    this.underwaterColorGrading.updateDepth(cameraY);
  }

  /**
   * Update camera parameters for accurate depth-based effects.
   * @param camera - The scene camera
   */
  updateCamera(camera: THREE.PerspectiveCamera): void {
    this.underwaterColorGrading.updateCamera(camera);
  }

  /**
   * Adjust bloom intensity (e.g., for time of day changes)
   */
  setBloomIntensity(intensity: number): void {
    this.bloomEffect.intensity = intensity;
  }

  /**
   * Set bloom threshold/smoothing to control "wow" highlights
   */
  setBloomThreshold(luminanceThreshold: number, luminanceSmoothing: number = 0.8): void {
    this.bloomEffect.luminanceMaterial.threshold = luminanceThreshold;
    this.bloomEffect.luminanceMaterial.smoothing = luminanceSmoothing;
  }

  /**
   * Underwater absorption strength (Beer-Lambert scale).
   * Higher = more red/green lost at distance (more underwater feel).
   */
  setAbsorptionScale(scale: number): void {
    (this.underwaterColorGrading.uniforms.get('absorptionScale') as THREE.Uniform).value = scale;
  }

  setTurbidity(turbidity: number): void {
    (this.underwaterColorGrading.uniforms.get('turbidity') as THREE.Uniform).value = turbidity;
  }

  setVignette(offset: number, darkness: number): void {
    this.vignetteEffect.offset = offset;
    this.vignetteEffect.darkness = darkness;
  }

  setChromaticAberration(x: number, y: number): void {
    this.chromaAberration.offset.set(x, y);
  }

  /**
   * Enable/disable god rays
   */
  setGodRaysEnabled(enabled: boolean): void {
    if (this.godRaysEffect) {
      this.godRaysEffect.blendMode.opacity.value = enabled ? 1.0 : 0.0;
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.composer.dispose();
  }
}
