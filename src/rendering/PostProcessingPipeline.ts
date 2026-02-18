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
    // This simulates light scattered from the water itself into the view
    float scatterFactor = 1.0 - exp(-pixelDistance * 0.03);
    vec3 scatterColor = vec3(0.1, 0.25, 0.35) * (1.0 + cameraDepth * 0.01);
    color = mix(color, scatterColor, scatterFactor * 0.5);

    // === CAMERA DEPTH EFFECTS ===
    // Additional effects based on how deep the camera is
    float depthFactor = clamp(cameraDepth / 60.0, 0.0, 1.0);

    // Gentle desaturation at extreme depth
    float saturation = 1.0 - depthFactor * 0.15;
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
        // Red absorbed fastest (0.45/m), blue slowest (0.05/m)
        ['absorptionR', new THREE.Uniform(0.45)],
        ['absorptionG', new THREE.Uniform(0.15)],
        ['absorptionB', new THREE.Uniform(0.05)],
        ['absorptionScale', new THREE.Uniform(0.08)],
        ['turbidity', new THREE.Uniform(0.5)],
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
  private underwaterColorGrading: UnderwaterColorGradingEffect;
  private vignetteEffect: VignetteEffect;
  private chromaAberration: ChromaticAberrationEffect;

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

    // Bloom effect - for glowing highlights and bioluminescence
    // Phase 5 visual fix: reduced intensity and higher threshold for less harsh contrast
    this.bloomEffect = new BloomEffect({
      intensity: 0.5, // Reduced from 0.8
      luminanceThreshold: 0.6, // Increased from 0.4
      luminanceSmoothing: 0.8,
      mipmapBlur: true,
      kernelSize: KernelSize.MEDIUM,
    });

    // God rays effect - re-enabled with conservative parameters to avoid
    // vine-like artifacts (Phase 2)
    if (this.sunMesh) {
      this.godRaysEffect = new GodRaysEffect(camera, this.sunMesh, {
        height: 480,
        kernelSize: KernelSize.VERY_SMALL,
        density: 0.90,
        decay: 0.95,
        weight: 0.15,
        exposure: 0.25,
        samples: 30,
        clampMax: 0.6,
      });
    }

    // Underwater color grading effect (Phase 3)
    this.underwaterColorGrading = new UnderwaterColorGradingEffect();

    // Tone mapping for HDR-like appearance - balanced for underwater
    const toneMappingEffect = new ToneMappingEffect({
      mode: 2, // ACES Filmic
      resolution: 256,
      whitePoint: 4.0, // Reduced from 6.0 to prevent over-bright areas
      middleGrey: 0.6, // Reduced from 0.8 for better dark tones
      minLuminance: 0.01,
      averageLuminance: 0.4,
      adaptationRate: 1.0,
    });

    // Chromatic aberration for subtle underwater lens distortion
    this.chromaAberration = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.0008, 0.0005),
      radialModulation: false,
      modulationOffset: 0.15,
    });

    // Vignette for cinematic look - subtle darkening at edges
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
      this.underwaterColorGrading,
      toneMappingEffect,
      this.vignetteEffect,
    );

    // SMAA goes with the main non-convolution effects
    mainEffects.push(smaaEffect);

    // Main effects pass (non-convolution effects + SMAA)
    const mainEffectPass = new EffectPass(camera, ...mainEffects);
    this.composer.addPass(mainEffectPass);

    // Chromatic aberration is a convolution effect - must be in its own pass
    const chromaPass = new EffectPass(camera, this.chromaAberration);
    this.composer.addPass(chromaPass);
  }

  /**
   * Create a subtle sun disc mesh for god rays.
   * Positioned above the water surface as a bright emissive sphere.
   */
  private createSunMesh(scene: THREE.Scene): void {
    const sunGeometry = new THREE.SphereGeometry(5, 16, 16);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xaaccdd,
      transparent: true,
      opacity: 0.7,
    });

    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunMesh.position.set(15, 45, 10);
    this.sunMesh.frustumCulled = false;
    scene.add(this.sunMesh);
  }

  /**
   * Render the scene with post-processing
   */
  render(deltaTime?: number): void {
    this.composer.render(deltaTime);
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
