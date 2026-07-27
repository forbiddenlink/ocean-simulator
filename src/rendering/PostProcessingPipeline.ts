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
  NoiseEffect,
  DepthOfFieldEffect,
  Effect,
  BlendFunction,
} from 'postprocessing';

// Beer-Lambert underwater colour grading. Depth-driven spectral absorption + scatter +
// desaturation is the single biggest thing that reads as "deep ocean" vs "swimming pool".
const underwaterColorGradingShader = /* glsl */ `
  uniform float absorptionR;
  uniform float absorptionG;
  uniform float absorptionB;
  uniform float absorptionScale;
  uniform float turbidity;
  uniform float cameraDepth;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float exposure;
  uniform float scatterStrength;
  uniform float depthDesat;
  uniform vec3  scatterColor;
  uniform vec2  sunScreenPos;
  uniform vec3  inscatterColor;
  uniform float inscatterStrength;

  float readDepth(sampler2D depthSampler, vec2 coord) {
    float fragCoordZ = texture2D(depthSampler, coord).x;
    float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
    return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar) * cameraFar;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    float pixelDistance = clamp(readDepth(depthBuffer, uv), 0.0, 90.0);

    // Per-channel spectral absorption: red dies fast, cyan/blue persists.
    vec3 absorption = vec3(absorptionR, absorptionG, absorptionB) * absorptionScale;
    color *= exp(-absorption * pixelDistance);

    // Exponential-squared scatter: distance dissolves into deep-water tint.
    float sd = pixelDistance * 0.03;
    float scatterFactor = 1.0 - exp(-sd * sd);
    color = mix(color, scatterColor, scatterFactor * scatterStrength);

    // Desaturate + gently lift blacks with distance (contrast falls off in murk).
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(color, vec3(luma), scatterFactor * depthDesat);

    // Turbidity: greenish particulate tint that grows with distance.
    color += vec3(-0.01, 0.012, 0.02) * turbidity * scatterFactor;

    // Sunlight in-scattering: a soft warm glow blooming around the sun's screen
    // position, growing with the distance-scatter term — light diffusing through the
    // water column. The single biggest "there is a sun up there" atmosphere cue.
    float sunUvDist = distance(uv, sunScreenPos);
    float inscatter = exp(-sunUvDist * sunUvDist * 2.4) * (0.35 + 0.65 * scatterFactor);
    color += inscatterColor * inscatter * inscatterStrength;

    // Camera-depth exposure falloff — deeper = darker overall.
    float depthFactor = clamp(cameraDepth / 90.0, 0.0, 1.0);
    color *= (1.0 - depthFactor * 0.18);

    color *= exposure;

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
        ['exposure', new THREE.Uniform(1.0)],
        ['scatterStrength', new THREE.Uniform(0.5)],
        ['depthDesat', new THREE.Uniform(0.35)],
        ['scatterColor', new THREE.Uniform(new THREE.Color(0.06, 0.26, 0.36))],
        ['sunScreenPos', new THREE.Uniform(new THREE.Vector2(0.5, 0.12))],
        ['inscatterColor', new THREE.Uniform(new THREE.Color(0.55, 0.72, 0.78))],
        ['inscatterStrength', new THREE.Uniform(0.5)],
      ]),
    });
  }

  setSunScreen(x: number, y: number): void {
    (this.uniforms.get('sunScreenPos') as THREE.Uniform).value.set(x, y);
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
  private grainEffect: NoiseEffect;
  private dofEffect: DepthOfFieldEffect;
  private dofPass: EffectPass;
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

    // Depth of field — the Abzú signature. Mid-field stays crisp while the far murk
    // softens into bokeh, giving real depth separation between foreground creatures and
    // the hazy background. Kept gentle + half-res so it reads cinematic, not macro-lens.
    this.dofEffect = new DepthOfFieldEffect(camera, {
      worldFocusDistance: 16,
      worldFocusRange: 42,
      bokehScale: 2.2,
      resolutionScale: 0.5,
    });
    this.dofPass = new EffectPass(camera, this.dofEffect);
    this.composer.addPass(this.dofPass);

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

    // AgX preserves saturated teal/cyan midtones better than ACES (which washes
    // blue-green underwater), giving a more filmic deep-ocean grade.
    const toneMappingEffect = new ToneMappingEffect({
      mode: ToneMappingMode.AGX,
    });

    // Subtle animated film grain — breaks up flat gradients, adds a cinematic texture.
    this.grainEffect = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply: true,
    });
    this.grainEffect.blendMode.opacity.value = 0.055;

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
      this.grainEffect,
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

  private _sunProj = new THREE.Vector3();
  /** Project the sun into screen space so the in-scatter glow tracks it (or fades when behind). */
  updateSunScreen(camera: THREE.PerspectiveCamera): void {
    if (!this.sunMesh) return;
    this._sunProj.copy(this.sunMesh.position).project(camera);
    // project() gives NDC [-1,1]; convert to uv [0,1]. Behind-camera z>1 → park it off-screen.
    const x = this._sunProj.x * 0.5 + 0.5;
    const y = this._sunProj.y * 0.5 + 0.5;
    const behind = this._sunProj.z > 1.0;
    this.underwaterColorGrading.setSunScreen(x, behind ? -1.0 : y);
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

  setExposure(exposure: number): void {
    (this.underwaterColorGrading.uniforms.get('exposure') as THREE.Uniform).value = exposure;
  }

  setScatterStrength(strength: number): void {
    (this.underwaterColorGrading.uniforms.get('scatterStrength') as THREE.Uniform).value = strength;
  }

  setDepthDesat(amount: number): void {
    (this.underwaterColorGrading.uniforms.get('depthDesat') as THREE.Uniform).value = amount;
  }

  setScatterColor(hex: number): void {
    ((this.underwaterColorGrading.uniforms.get('scatterColor') as THREE.Uniform).value as THREE.Color).setHex(hex);
  }

  setVignette(offset: number, darkness: number): void {
    this.vignetteEffect.offset = offset;
    this.vignetteEffect.darkness = darkness;
  }

  setChromaticAberration(x: number, y: number): void {
    this.chromaAberration.offset.set(x, y);
  }

  /** Toggle depth of field (gated by quality preset — off on Low for performance). */
  setDofEnabled(enabled: boolean): void {
    this.dofPass.enabled = enabled;
  }

  /** Focus the DOF on a world-space distance (e.g. the creature the camera looks at). */
  setDofFocus(worldDistance: number): void {
    this.dofEffect.cocMaterial.worldFocusDistance = worldDistance;
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
