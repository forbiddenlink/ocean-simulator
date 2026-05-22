import * as THREE from 'three';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  SMAAEffect,
  SMAAPreset,
  KernelSize,
  ChromaticAberrationEffect,
  Effect,
  BlendFunction,
} from 'postprocessing';

// Beer-Lambert underwater color grading - subtle, never crushes scene to black.
const underwaterColorGradingShader = /* glsl */ `
  uniform float absorptionR;
  uniform float absorptionG;
  uniform float absorptionB;
  uniform float absorptionScale;
  uniform float turbidity;
  uniform float cameraDepth;
  uniform float cameraNear;
  uniform float cameraFar;

  float readDepth(sampler2D depthSampler, vec2 coord) {
    float fragCoordZ = texture2D(depthSampler, coord).x;
    float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
    return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar) * cameraFar;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    float pixelDistance = clamp(readDepth(depthBuffer, uv), 0.0, 60.0);

    // Spectral absorption - gentle so foreground stays vibrant
    vec3 absorption = vec3(absorptionR, absorptionG, absorptionB) * absorptionScale;
    vec3 transmission = exp(-absorption * pixelDistance);
    color *= transmission;

    // Atmospheric scatter - blue/teal fill toward horizon
    float scatterFactor = 1.0 - exp(-pixelDistance * 0.04);
    vec3 scatterColor = vec3(0.12, 0.42, 0.58);
    color = mix(color, scatterColor, scatterFactor * 0.5);

    // Subtle turbidity tint
    color += vec3(-0.005, 0.005, 0.012) * turbidity * scatterFactor;

    // Camera-depth dim (slight) - never crush to black
    float depthFactor = clamp(cameraDepth / 80.0, 0.0, 1.0);
    color *= (1.0 - depthFactor * 0.12);

    outputColor = vec4(color, 1.0);
  }
`;

class UnderwaterColorGradingEffect extends Effect {
  constructor() {
    super('UnderwaterColorGrading', underwaterColorGradingShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['absorptionR', new THREE.Uniform(0.45)],
        ['absorptionG', new THREE.Uniform(0.10)],
        ['absorptionB', new THREE.Uniform(0.03)],
        ['absorptionScale', new THREE.Uniform(0.04)],
        ['turbidity', new THREE.Uniform(0.3)],
        ['cameraDepth', new THREE.Uniform(8.0)],
        ['cameraNear', new THREE.Uniform(0.1)],
        ['cameraFar', new THREE.Uniform(1000.0)],
      ]),
    });
  }

  updateDepth(cameraY: number): void {
    const depth = Math.max(0, -cameraY);
    (this.uniforms.get('cameraDepth') as THREE.Uniform).value = depth;
  }

  updateCamera(camera: THREE.PerspectiveCamera): void {
    (this.uniforms.get('cameraNear') as THREE.Uniform).value = camera.near;
    (this.uniforms.get('cameraFar') as THREE.Uniform).value = camera.far;
  }
}

/**
 * Cinematic underwater post-processing pipeline.
 * Chain: Render -> [Bloom + ColorGrade + ToneMap + Vignette + SMAA] -> Chroma.
 */
export class PostProcessingPipeline {
  private composer: EffectComposer;
  private bloomEffect: BloomEffect;
  private underwaterColorGrading: UnderwaterColorGradingEffect;
  private vignetteEffect: VignetteEffect;
  private chromaAberration: ChromaticAberrationEffect;
  private sunMesh?: THREE.Mesh;
  private sunMaterial?: THREE.MeshBasicMaterial;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.UnsignedByteType,
    });

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Decorative sun disc (legacy + for visual richness near surface)
    this.createSunMesh(scene);

    this.bloomEffect = new BloomEffect({
      intensity: 0.9,
      luminanceThreshold: 0.55,
      luminanceSmoothing: 0.4,
      mipmapBlur: true,
      kernelSize: KernelSize.LARGE,
    });

    this.underwaterColorGrading = new UnderwaterColorGradingEffect();

    const toneMappingEffect = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    });

    this.vignetteEffect = new VignetteEffect({
      offset: 0.32,
      darkness: 0.45,
    });

    this.chromaAberration = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.0008, 0.0005),
      radialModulation: true,
      modulationOffset: 0.3,
    });

    const smaaEffect = new SMAAEffect({
      preset: SMAAPreset.HIGH,
    });

    // Main effect pass: scene shading + look
    const mainEffectPass = new EffectPass(
      camera,
      this.underwaterColorGrading,
      this.bloomEffect,
      toneMappingEffect,
      this.vignetteEffect,
      smaaEffect,
    );
    this.composer.addPass(mainEffectPass);

    // Chroma in its own pass - it's a convolution effect
    const chromaPass = new EffectPass(camera, this.chromaAberration);
    this.composer.addPass(chromaPass);
  }

  private createSunMesh(scene: THREE.Scene): void {
    const sunGeometry = new THREE.SphereGeometry(6, 24, 24);
    this.sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff4d0,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    this.sunMesh = new THREE.Mesh(sunGeometry, this.sunMaterial);
    this.sunMesh.position.set(10, 80, 5);
    this.sunMesh.frustumCulled = false;
    scene.add(this.sunMesh);
  }

  render(deltaTime?: number): void {
    this.composer.render(deltaTime);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  updateSunPosition(position: THREE.Vector3): void {
    if (this.sunMesh) {
      this.sunMesh.position.copy(position);
    }
  }

  updateCameraDepth(cameraY: number): void {
    this.underwaterColorGrading.updateDepth(cameraY);
  }

  updateCamera(camera: THREE.PerspectiveCamera): void {
    this.underwaterColorGrading.updateCamera(camera);
  }

  setBloomIntensity(intensity: number): void {
    this.bloomEffect.intensity = intensity;
  }

  setBloomThreshold(luminanceThreshold: number, luminanceSmoothing: number = 0.4): void {
    this.bloomEffect.luminanceMaterial.threshold = luminanceThreshold;
    this.bloomEffect.luminanceMaterial.smoothing = luminanceSmoothing;
  }

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

  setGodRaysEnabled(_enabled: boolean): void {
    // Stub - god rays removed for stability; sun mesh kept for visual flair.
  }

  updateGodRayDepth(_cameraY: number): void {}

  updateGodRayTimeOfDay(timeOfDay: number): void {
    if (!this.sunMaterial) return;
    const sunAngle = Math.sin(timeOfDay * Math.PI);
    const dawnDusk = Math.exp(-Math.pow((timeOfDay - 0.25) * 4, 2))
                   + Math.exp(-Math.pow((timeOfDay - 0.75) * 4, 2));
    const r = 0.95 + 0.05 * dawnDusk;
    const g = 0.92 - 0.08 * dawnDusk;
    const b = 0.8 - 0.25 * dawnDusk;
    this.sunMaterial.color.setRGB(r, g, b);
    this.sunMaterial.opacity = 0.15 + 0.55 * Math.max(0, sunAngle);
  }

  dispose(): void {
    this.composer.dispose();
    if (this.sunMesh) {
      this.sunMesh.geometry.dispose();
      this.sunMaterial?.dispose();
    }
  }
}
