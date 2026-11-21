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
  BlendFunction,
} from 'postprocessing';
import { WaterMediumEffect } from './WaterMedium';

/**
 * Cinematic underwater post-processing pipeline.
 * Chain: Render -> DOF -> [WaterMedium + Bloom + ToneMap + Grain + Vignette + SMAA] -> Chroma.
 */
export class PostProcessingPipeline {
  private composer: EffectComposer;
  private bloomEffect: BloomEffect;
  public readonly water: WaterMediumEffect;
  private vignetteEffect: VignetteEffect;
  private chromaAberration: ChromaticAberrationEffect;
  private grainEffect: NoiseEffect;
  private dofEffect: DepthOfFieldEffect;
  private dofPass: EffectPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.composer = new EffectComposer(renderer, {
      // Half float keeps highlights above 1.0 until tone mapping, so the sun, caustics
      // and shafts bloom and roll off instead of clipping to flat white.
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

    this.bloomEffect = new BloomEffect({
      intensity: 0.9,
      luminanceThreshold: 0.55,
      luminanceSmoothing: 0.4,
      mipmapBlur: true,
      kernelSize: KernelSize.LARGE,
    });

    // Physical water medium: depth attenuation, extinction, in-scatter, light shafts.
    this.water = new WaterMediumEffect();

    // AgX preserves saturated teal/cyan midtones better than ACES (which washes
    // blue-green underwater), giving a more filmic deep-ocean grade.
    const toneMappingEffect = new ToneMappingEffect({
      mode: ToneMappingMode.REINHARD2_ADAPTIVE,
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
      this.water,
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

  render(deltaTime?: number): void {
    this.composer.render(deltaTime);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  setBloomIntensity(intensity: number): void {
    this.bloomEffect.intensity = intensity;
  }

  setBloomThreshold(luminanceThreshold: number, luminanceSmoothing: number = 0.4): void {
    this.bloomEffect.luminanceMaterial.threshold = luminanceThreshold;
    this.bloomEffect.luminanceMaterial.smoothing = luminanceSmoothing;
  }

  setExposure(exposure: number): void {
    this.water.setExposure(exposure);
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

  setDofBokeh(scale: number): void {
    this.dofEffect.bokehScale = scale;
  }

  dispose(): void {
    this.composer.dispose();
  }
}
