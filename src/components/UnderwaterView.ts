/**
 * UnderwaterView - Underwater camera and effects controller
 *
 * Manages underwater-specific rendering:
 * - Depth-based color grading
 * - Light absorption and scattering
 * - Caustics projection
 * - Snell's window effect
 * - Bubble and particle effects
 */

import * as THREE from "three";
import {
  UnderwaterLighting,
  CausticsGenerator,
  type WaterType,
  ABSORPTION_COEFFICIENTS,
} from "../lib/fluid";

export interface UnderwaterViewConfig {
  /** Three.js scene */
  scene: THREE.Scene;
  /** Three.js camera */
  camera: THREE.PerspectiveCamera;
  /** Three.js renderer */
  renderer: THREE.WebGLRenderer;
  /** Water surface Y position */
  surfaceY?: number;
  /** Water type for absorption */
  waterType?: WaterType;
  /** Enable caustics */
  enableCaustics?: boolean;
  /** Enable god rays */
  enableGodRays?: boolean;
  /** Enable depth fog */
  enableDepthFog?: boolean;
}

/**
 * Underwater view state
 */
export interface UnderwaterState {
  isUnderwater: boolean;
  depth: number;
  visibility: number;
  ambientLight: number;
  waterColor: THREE.Color;
}

/**
 * UnderwaterView class
 */
export class UnderwaterView {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private surfaceY: number;

  private underwaterLighting: UnderwaterLighting;
  private caustics: CausticsGenerator;

  private isUnderwater: boolean = false;
  private currentDepth: number = 0;

  // Fog settings
  private originalFog: THREE.Fog | THREE.FogExp2 | null = null;
  private underwaterFog: THREE.FogExp2;

  // Post-processing elements
  private fullscreenQuad: THREE.Mesh | null = null;
  private _postProcessScene: THREE.Scene;
  private _postProcessCamera: THREE.OrthographicCamera;

  // Settings
  private enableCaustics: boolean;
  private _enableGodRays: boolean;
  private enableDepthFog: boolean;

  constructor(config: UnderwaterViewConfig) {
    this.scene = config.scene;
    this.camera = config.camera;
    this.renderer = config.renderer;
    this.surfaceY = config.surfaceY ?? 0;
    this.enableCaustics = config.enableCaustics ?? true;
    this._enableGodRays = config.enableGodRays ?? true;
    this.enableDepthFog = config.enableDepthFog ?? true;

    // Initialize underwater lighting
    this.underwaterLighting = new UnderwaterLighting({
      waterType: config.waterType ?? "averageOcean",
      surfaceY: this.surfaceY,
    });

    // Initialize caustics
    this.caustics = new CausticsGenerator(this.renderer, 1024);

    // Create underwater fog
    this.underwaterFog = new THREE.FogExp2(0x0a4a6b, 0.015);

    // Setup post-processing
    this._postProcessScene = new THREE.Scene();
    this._postProcessCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Update underwater effects based on camera position
   */
  public update(deltaTime: number): void {
    const wasUnderwater = this.isUnderwater;
    this.isUnderwater = this.camera.position.y < this.surfaceY;
    this.currentDepth = Math.max(0, this.surfaceY - this.camera.position.y);

    // Handle transition
    if (wasUnderwater !== this.isUnderwater) {
      this.onUnderwaterTransition(this.isUnderwater);
    }

    if (this.isUnderwater) {
      this.updateUnderwaterEffects(deltaTime);
    }
  }

  /**
   * Handle transition between above/below water
   */
  private onUnderwaterTransition(underwater: boolean): void {
    if (underwater) {
      // Store original fog
      this.originalFog = this.scene.fog;

      // Apply underwater fog
      if (this.enableDepthFog) {
        this.scene.fog = this.underwaterFog;
      }

      // Update background color
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background = new THREE.Color(0x0a4a6b);
      }
    } else {
      // Restore original fog
      this.scene.fog = this.originalFog;

      // Restore background
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background = new THREE.Color(0x87ceeb);
      }
    }
  }

  /**
   * Update underwater-specific effects
   */
  private updateUnderwaterEffects(deltaTime: number): void {
    // Update fog density based on depth
    const visibility = this.underwaterLighting.calculateVisibility(
      this.currentDepth,
    );
    this.underwaterFog.density = (1 / visibility) * 0.1;

    // Update fog color based on absorption
    const waterColor = this.underwaterLighting.getWaterColorAtDepth(
      this.currentDepth,
    );
    this.underwaterFog.color = waterColor;

    // Update caustics
    if (this.enableCaustics) {
      this.caustics.update(deltaTime, this.renderer);
    }

    // Update ambient light intensity
    const ambientIntensity = this.underwaterLighting.getAmbientIntensityAtDepth(
      this.currentDepth,
      1.0,
    );

    // Apply to scene ambient lights
    this.scene.traverse((object) => {
      if (object instanceof THREE.AmbientLight) {
        object.intensity = ambientIntensity * 0.5;
      }
    });
  }

  /**
   * Get current underwater state
   */
  public getState(): UnderwaterState {
    return {
      isUnderwater: this.isUnderwater,
      depth: this.currentDepth,
      visibility: this.underwaterLighting.calculateVisibility(
        this.currentDepth,
      ),
      ambientLight: this.underwaterLighting.getAmbientIntensityAtDepth(
        this.currentDepth,
      ),
      waterColor: this.underwaterLighting.getWaterColorAtDepth(
        this.currentDepth,
      ),
    };
  }

  /**
   * Set water type for absorption characteristics
   */
  public setWaterType(type: WaterType): void {
    this.underwaterLighting.setWaterType(type);

    // Update fog color based on new water type
    const absorption = ABSORPTION_COEFFICIENTS[type];
    const avgAbsorption = (absorption.x + absorption.y + absorption.z) / 3;
    this.underwaterFog.density = avgAbsorption * 0.1;
  }

  /**
   * Set surface Y position
   */
  public setSurfaceY(y: number): void {
    this.surfaceY = y;
  }

  /**
   * Enable/disable caustics
   */
  public setCausticsEnabled(enabled: boolean): void {
    this.enableCaustics = enabled;
  }

  /**
   * Enable/disable god rays
   */
  public setGodRaysEnabled(enabled: boolean): void {
    this._enableGodRays = enabled;
  }

  /**
   * Enable/disable depth fog
   */
  public setDepthFogEnabled(enabled: boolean): void {
    this.enableDepthFog = enabled;

    if (!enabled && this.isUnderwater) {
      this.scene.fog = this.originalFog;
    } else if (enabled && this.isUnderwater) {
      this.scene.fog = this.underwaterFog;
    }
  }

  /**
   * Get caustics texture for use in materials
   */
  public getCausticsTexture(): THREE.Texture {
    return this.caustics.getTexture();
  }

  /**
   * Check if camera is underwater
   */
  public isCurrentlyUnderwater(): boolean {
    return this.isUnderwater;
  }

  /**
   * Get current depth below surface
   */
  public getCurrentDepth(): number {
    return this.currentDepth;
  }

  /**
   * Calculate light transmission at current depth
   */
  public getTransmission(): THREE.Vector3 {
    return this.underwaterLighting.calculateTransmission(this.currentDepth);
  }

  /**
   * Calculate scattering factor at current depth
   */
  public getScattering(): number {
    return this.underwaterLighting.calculateScattering(this.currentDepth);
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.caustics.dispose();

    if (this.fullscreenQuad) {
      this.fullscreenQuad.geometry.dispose();
      (this.fullscreenQuad.material as THREE.Material).dispose();
    }

    // Restore original fog
    if (this.originalFog) {
      this.scene.fog = this.originalFog;
    }
  }
}

export default UnderwaterView;
