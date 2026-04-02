/**
 * Underwater Effects Module
 *
 * Implements realistic underwater visual effects:
 * - Caustics (light patterns on surfaces)
 * - Light absorption and scattering
 * - God rays / light shafts
 * - Depth-based color grading
 *
 * References:
 * - Wyman & Davis (2006) "Interactive Image-Space Techniques for Approximating Caustics"
 * - Premoze & Ashikhmin (2001) "Rendering Natural Waters"
 */

import * as THREE from 'three';

// Physical constants for underwater optics
const WATER_IOR = 1.333; // Index of refraction for water
const CRITICAL_ANGLE = Math.asin(1 / WATER_IOR); // ~48.6 degrees

/**
 * Light absorption coefficients per meter for different water types
 * Based on Jerlov water types
 */
export const ABSORPTION_COEFFICIENTS = {
  // Type I - Clearest ocean water
  clearOcean: new THREE.Vector3(0.0405, 0.0268, 0.0196),
  // Type II - Clear coastal water
  clearCoastal: new THREE.Vector3(0.114, 0.057, 0.025),
  // Type III - Average ocean water
  averageOcean: new THREE.Vector3(0.141, 0.088, 0.044),
  // Coastal water with sediment
  coastal: new THREE.Vector3(0.40, 0.25, 0.15),
  // Turbid harbor water
  harbor: new THREE.Vector3(1.0, 0.6, 0.3),
} as const;

/**
 * Scattering coefficients per meter
 */
export const SCATTERING_COEFFICIENTS = {
  clearOcean: 0.003,
  clearCoastal: 0.008,
  averageOcean: 0.015,
  coastal: 0.05,
  harbor: 0.15,
} as const;

export type WaterType = keyof typeof ABSORPTION_COEFFICIENTS;

/**
 * Underwater rendering configuration
 */
export interface UnderwaterConfig {
  /** Water type for absorption/scattering */
  waterType: WaterType;
  /** Custom absorption coefficient (overrides waterType) */
  absorptionCoeff?: THREE.Vector3;
  /** Custom scattering coefficient (overrides waterType) */
  scatteringCoeff?: number;
  /** Maximum visibility distance in meters */
  maxVisibility: number;
  /** Caustics intensity */
  causticsIntensity: number;
  /** Caustics scale */
  causticsScale: number;
  /** God ray intensity */
  godRayIntensity: number;
  /** God ray samples */
  godRaySamples: number;
  /** Water surface Y position */
  surfaceY: number;
}

/**
 * Default underwater configuration
 */
export const DEFAULT_UNDERWATER_CONFIG: UnderwaterConfig = {
  waterType: 'averageOcean',
  maxVisibility: 50,
  causticsIntensity: 1.0,
  causticsScale: 20,
  godRayIntensity: 0.8,
  godRaySamples: 32,
  surfaceY: 0,
};

/**
 * Caustics generator using animated Voronoi patterns
 */
export class CausticsGenerator {
  private texture: THREE.WebGLRenderTarget;
  private material: THREE.ShaderMaterial;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private quad: THREE.Mesh;
  private time: number = 0;

  constructor(_renderer: THREE.WebGLRenderer, resolution: number = 1024) {
    // Create render target
    this.texture = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });

    // Create orthographic camera
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create scene
    this.scene = new THREE.Scene();

    // Create material
    this.material = this.createCausticsMaterial();

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.quad);
  }

  /**
   * Create caustics generation shader
   */
  private createCausticsMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        scale: { value: 8.0 },
        speed: { value: 0.4 },
        brightness: { value: 1.5 },
        chromaticAberration: { value: 0.03 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float scale;
        uniform float speed;
        uniform float brightness;
        uniform float chromaticAberration;

        varying vec2 vUv;

        // Hash function
        vec2 hash22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.xx + p3.yz) * p3.zy);
        }

        // Voronoi distance
        float voronoi(vec2 uv, float time) {
          vec2 p = floor(uv);
          vec2 f = fract(uv);

          float minDist = 1.0;

          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 neighbor = vec2(float(x), float(y));
              vec2 point = hash22(p + neighbor);

              // Animate point
              point = 0.5 + 0.5 * sin(time * speed + 6.2831 * point);

              vec2 diff = neighbor + point - f;
              float dist = length(diff);
              minDist = min(minDist, dist);
            }
          }

          return minDist;
        }

        // Multi-scale caustics
        float caustics(vec2 uv, float time) {
          float c = 0.0;
          float amplitude = 1.0;

          for (int i = 0; i < 4; i++) {
            float scale_i = scale * pow(1.8, float(i));
            float time_i = time * (1.0 + float(i) * 0.2);
            c += amplitude * voronoi(uv * scale_i, time_i);
            amplitude *= 0.5;
          }

          // Convert distance to brightness (bright at cell edges)
          c = pow(c, 1.5);
          c = 1.0 - c;
          c = pow(max(c, 0.0), 2.0);

          return c * brightness;
        }

        void main() {
          // Chromatic aberration for color separation
          vec2 uvR = vUv + vec2(chromaticAberration, 0.0);
          vec2 uvG = vUv;
          vec2 uvB = vUv - vec2(chromaticAberration, 0.0);

          float r = caustics(uvR, time);
          float g = caustics(uvG, time + 0.5);
          float b = caustics(uvB, time + 1.0);

          // Add slight blue tint for underwater feel
          vec3 color = vec3(r * 0.9, g * 0.95, b);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }

  /**
   * Update and render caustics texture
   */
  public update(deltaTime: number, renderer: THREE.WebGLRenderer): void {
    this.time += deltaTime;
    this.material.uniforms.time.value = this.time;

    const currentRenderTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.texture);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(currentRenderTarget);
  }

  /**
   * Get caustics texture
   */
  public getTexture(): THREE.Texture {
    return this.texture.texture;
  }

  /**
   * Set caustics parameters
   */
  public setParams(scale: number, speed: number, brightness: number): void {
    this.material.uniforms.scale.value = scale;
    this.material.uniforms.speed.value = speed;
    this.material.uniforms.brightness.value = brightness;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}

/**
 * Underwater light absorption and scattering calculator
 */
export class UnderwaterLighting {
  private config: UnderwaterConfig;
  private absorptionCoeff: THREE.Vector3;
  private scatteringCoeff: number;

  constructor(config: Partial<UnderwaterConfig> = {}) {
    this.config = { ...DEFAULT_UNDERWATER_CONFIG, ...config };
    this.absorptionCoeff = config.absorptionCoeff ||
      ABSORPTION_COEFFICIENTS[this.config.waterType].clone();
    this.scatteringCoeff = config.scatteringCoeff ||
      SCATTERING_COEFFICIENTS[this.config.waterType];
  }

  /**
   * Apply Beer-Lambert absorption law
   * Returns transmission factor for each color channel
   */
  public calculateTransmission(distance: number): THREE.Vector3 {
    return new THREE.Vector3(
      Math.exp(-this.absorptionCoeff.x * distance),
      Math.exp(-this.absorptionCoeff.y * distance),
      Math.exp(-this.absorptionCoeff.z * distance)
    );
  }

  /**
   * Calculate fog/haze factor based on scattering
   */
  public calculateScattering(distance: number): number {
    return 1 - Math.exp(-this.scatteringCoeff * distance);
  }

  /**
   * Calculate visibility at depth
   */
  public calculateVisibility(depth: number): number {
    // Visibility decreases exponentially with depth
    const depthFactor = Math.exp(-depth * 0.02);
    return this.config.maxVisibility * depthFactor;
  }

  /**
   * Get water color at depth based on absorption
   */
  public getWaterColorAtDepth(depth: number): THREE.Color {
    const transmission = this.calculateTransmission(depth);

    // Base water color (what remains after absorption)
    // As red is absorbed first, deeper water appears more blue-green
    const r = 0.1 + 0.3 * transmission.x;
    const g = 0.2 + 0.4 * transmission.y;
    const b = 0.3 + 0.5 * transmission.z;

    return new THREE.Color(r, g, b);
  }

  /**
   * Calculate ambient light intensity at depth
   */
  public getAmbientIntensityAtDepth(depth: number, surfaceLightIntensity: number = 1.0): number {
    // Light intensity follows Beer-Lambert law
    // Using average of RGB absorption for ambient
    const avgAbsorption = (
      this.absorptionCoeff.x +
      this.absorptionCoeff.y +
      this.absorptionCoeff.z
    ) / 3;

    return surfaceLightIntensity * Math.exp(-avgAbsorption * depth);
  }

  /**
   * Check if Snell's window is visible from position
   * Looking up from underwater, sky is only visible within critical angle
   */
  public isInSnellsWindow(viewDirection: THREE.Vector3, surfaceNormal: THREE.Vector3): boolean {
    const cosAngle = Math.abs(viewDirection.dot(surfaceNormal));
    return cosAngle > Math.cos(CRITICAL_ANGLE);
  }

  /**
   * Calculate Snell's window edge factor (for rendering transition)
   */
  public getSnellsWindowFactor(viewDirection: THREE.Vector3, surfaceNormal: THREE.Vector3): number {
    const cosAngle = Math.abs(viewDirection.dot(surfaceNormal));
    const criticalCos = Math.cos(CRITICAL_ANGLE);

    // Smooth transition at edge of Snell's window
    return smoothstep(criticalCos - 0.1, criticalCos + 0.1, cosAngle);
  }

  /**
   * Set water type
   */
  public setWaterType(type: WaterType): void {
    this.config.waterType = type;
    this.absorptionCoeff = ABSORPTION_COEFFICIENTS[type].clone();
    this.scatteringCoeff = SCATTERING_COEFFICIENTS[type];
  }

  /**
   * Get configuration
   */
  public getConfig(): Readonly<UnderwaterConfig> {
    return this.config;
  }

  /**
   * Get absorption coefficient
   */
  public getAbsorptionCoeff(): THREE.Vector3 {
    return this.absorptionCoeff.clone();
  }

  /**
   * Get scattering coefficient
   */
  public getScatteringCoeff(): number {
    return this.scatteringCoeff;
  }
}

/**
 * Generate underwater post-processing shader code
 */
export function generateUnderwaterShaderCode(config: UnderwaterConfig): {
  uniforms: Record<string, THREE.IUniform>;
  fragmentShader: string;
} {
  const absorption = config.absorptionCoeff ||
    ABSORPTION_COEFFICIENTS[config.waterType];
  const scattering = config.scatteringCoeff ||
    SCATTERING_COEFFICIENTS[config.waterType];

  return {
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      tCaustics: { value: null },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 1000 },
      cameraPosition: { value: new THREE.Vector3() },
      surfaceY: { value: config.surfaceY },
      absorptionCoeff: { value: absorption },
      scatteringCoeff: { value: scattering },
      waterColor: { value: new THREE.Color(0x0a4f6b) },
      causticsIntensity: { value: config.causticsIntensity },
      time: { value: 0 },
    },
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform sampler2D tCaustics;

      uniform float cameraNear;
      uniform float cameraFar;
      uniform vec3 cameraPosition;
      uniform float surfaceY;
      uniform vec3 absorptionCoeff;
      uniform float scatteringCoeff;
      uniform vec3 waterColor;
      uniform float causticsIntensity;
      uniform float time;

      varying vec2 vUv;

      float getLinearDepth(float fragCoordZ) {
        float viewZ = (cameraNear * cameraFar) / (cameraFar - fragCoordZ * (cameraFar - cameraNear));
        return viewZ;
      }

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        float depth = texture2D(tDepth, vUv).r;
        float linearDepth = getLinearDepth(depth);

        // Only apply underwater effects below surface
        float underwaterDepth = max(0.0, surfaceY - cameraPosition.y);

        if (underwaterDepth <= 0.0) {
          gl_FragColor = color;
          return;
        }

        // Calculate distance through water
        float waterDistance = linearDepth + underwaterDepth;

        // Beer-Lambert absorption
        vec3 transmission = exp(-absorptionCoeff * waterDistance);
        color.rgb *= transmission;

        // Scattering (fog)
        float scatterFactor = 1.0 - exp(-scatteringCoeff * waterDistance);
        color.rgb = mix(color.rgb, waterColor, scatterFactor);

        // Add caustics
        vec2 causticsUv = vUv * 2.0 + time * 0.02;
        vec3 caustics = texture2D(tCaustics, causticsUv).rgb;
        float causticsDepthFade = exp(-underwaterDepth * 0.05);
        color.rgb += caustics * causticsIntensity * causticsDepthFade * (1.0 - scatterFactor);

        // Depth-based color shift (more blue with depth)
        float depthColorShift = 1.0 - exp(-underwaterDepth * 0.02);
        color.rgb = mix(color.rgb, color.rgb * vec3(0.7, 0.85, 1.0), depthColorShift);

        gl_FragColor = color;
      }
    `,
  };
}

/**
 * Smoothstep utility function
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
