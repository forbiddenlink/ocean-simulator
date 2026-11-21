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
 * Chain: Render -> DOF -> [WaterMedium + Bloom + ToneMap + Grain + Vignette] -> SMAA -> Chroma.
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
  private mainPass: EffectPass;
  private smaaPass: EffectPass;
  private chromaPass: EffectPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.composer = new EffectComposer(renderer, {
      // HalfFloat keeps headroom above 1.0 until tone mapping and avoids banding in the
      // dark blue gradients of deep water.
      frameBufferType: THREE.HalfFloatType,
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
    // Off unless a quality preset asks for it: it costs a full-resolution pass and its
    // focus eases as the camera turns, which reads as the whole frame pulsing.
    this.dofPass.enabled = false;
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

    // Fixed Khronos PBR Neutral curve. An adaptive curve re-exposes the frame as the
    // camera turns, which reads as the whole image pumping. The library's REINHARD2
    // multiplies the colour by its compressed luminance, which squares a dim
    // underwater frame toward black; AgX greys out the blue-green water. Neutral keeps
    // the hue and saturation of the medium and only rolls off the highlights.
    const toneMappingEffect = new ToneMappingEffect({
      mode: ToneMappingMode.NEUTRAL,
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

    // Main effect pass: scene shading + look.
    // Bloom extracts its highlights from this pass's input, so it sees the scene before
    // the water attenuates it. Giving the water its own earlier pass fixes that, but on an
    // M4 Pro at 1512x900 it took frames from 0% late at a 0.85 render scale to about 12%
    // late at the 0.5 minimum. Measure before splitting this pass again.
    this.mainPass = new EffectPass(
      camera,
      this.water,
      this.bloomEffect,
      toneMappingEffect,
      this.grainEffect,
      this.vignetteEffect,
    );
    this.composer.addPass(this.mainPass);

    // SMAA in its own pass, after the water. An EffectPass runs convolution effects
    // first, so merged into the main pass it blended each edge pixel with its
    // neighbours before the water medium read that pixel's depth. Along every far edge
    // a pixel with open-water depth picked up lit sand or surface colour, which the
    // open-water branch adds unfogged: a dashed bright line across the horizon.
    this.smaaPass = new EffectPass(camera, smaaEffect);
    this.composer.addPass(this.smaaPass);

    // Chroma in its own pass - it's a convolution effect
    this.chromaPass = new EffectPass(camera, this.chromaAberration);
    this.composer.addPass(this.chromaPass);
    this.setChromaticAberration(0, 0);
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
    // A whole extra full-screen pass, so skip it when there is nothing to shift.
    // The composer only marks the last added pass for the screen, so hand that over
    // too, or a disabled chroma pass leaves the canvas black.
    const on = x !== 0 || y !== 0;
    this.chromaPass.enabled = on;
    this.chromaPass.renderToScreen = on;
    this.smaaPass.renderToScreen = !on;
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
