import * as THREE from 'three';

/**
 * Multi-scale wave system for photorealistic ocean
 * 
 * Combines three wave scales:
 * 1. Large waves (10-100m) - FFT ocean simulation
 * 2. Medium waves (1-10m) - Gerstner waves
 * 3. Small ripples (0.1-1m) - Procedural noise
 * 
 * This prevents the flat, unrealistic appearance at different viewing distances
 * and provides rich detail from horizon to close-up.
 */

export interface GerstnerWave {
  wavelength: number;
  amplitude: number;
  speed: number;
  direction: THREE.Vector2;
  steepness: number;
}

export class MultiScaleWaves {
  private gerstnerWaves: GerstnerWave[] = [];
  private time: number = 0;

  constructor() {
    this.initializeGerstnerWaves();
  }

  /**
   * Initialize medium-scale Gerstner waves
   * These add detail between large FFT waves and small ripples
   */
  private initializeGerstnerWaves(): void {
    // Create 6-8 Gerstner waves with varying parameters
    const waveConfigs = [
      { wavelength: 8.0, amplitude: 0.4, direction: new THREE.Vector2(1, 0), steepness: 0.5 },
      { wavelength: 5.0, amplitude: 0.25, direction: new THREE.Vector2(0.8, 0.6), steepness: 0.6 },
      { wavelength: 3.5, amplitude: 0.15, direction: new THREE.Vector2(-0.7, 0.7), steepness: 0.4 },
      { wavelength: 2.0, amplitude: 0.08, direction: new THREE.Vector2(0.5, -0.9), steepness: 0.3 },
      { wavelength: 1.2, amplitude: 0.04, direction: new THREE.Vector2(-0.9, -0.4), steepness: 0.2 },
      { wavelength: 0.8, amplitude: 0.02, direction: new THREE.Vector2(0.3, 0.95), steepness: 0.15 },
    ];

    for (const config of waveConfigs) {
      const wave: GerstnerWave = {
        ...config,
        direction: config.direction.normalize(),
        speed: Math.sqrt(9.81 * (2 * Math.PI) / config.wavelength), // √(g * k)
      };
      this.gerstnerWaves.push(wave);
    }
  }

  /**
   * Get Gerstner waves shader code for vertex shader
   */
  public getGerstnerShaderCode(): string {
    return `
      // Gerstner wave function
      vec3 gerstnerWave(vec3 position, float wavelength, float amplitude, float speed, vec2 direction, float steepness, float time) {
        float k = 2.0 * 3.14159265 / wavelength;
        float c = speed;
        vec2 d = normalize(direction);
        float f = k * (dot(d, position.xz) - c * time);
        float a = amplitude;
        float s = steepness;
        
        return vec3(
          d.x * a * s * cos(f),
          a * sin(f),
          d.y * a * s * cos(f)
        );
      }
      
      // Apply all Gerstner waves
      vec3 applyGerstnerWaves(vec3 position, float time) {
        vec3 offset = vec3(0.0);
        
        // Wave 1
        offset += gerstnerWave(position, 8.0, 0.4, ${this.gerstnerWaves[0]?.speed || 3.5}, 
                               vec2(1.0, 0.0), 0.5, time);
        
        // Wave 2
        offset += gerstnerWave(position, 5.0, 0.25, ${this.gerstnerWaves[1]?.speed || 2.8}, 
                               vec2(0.8, 0.6), 0.6, time);
        
        // Wave 3
        offset += gerstnerWave(position, 3.5, 0.15, ${this.gerstnerWaves[2]?.speed || 2.3}, 
                               vec2(-0.7, 0.7), 0.4, time);
        
        // Wave 4
        offset += gerstnerWave(position, 2.0, 0.08, ${this.gerstnerWaves[3]?.speed || 1.75}, 
                               vec2(0.5, -0.9), 0.3, time);
        
        // Wave 5
        offset += gerstnerWave(position, 1.2, 0.04, ${this.gerstnerWaves[4]?.speed || 1.35}, 
                               vec2(-0.9, -0.4), 0.2, time);
        
        // Wave 6
        offset += gerstnerWave(position, 0.8, 0.02, ${this.gerstnerWaves[5]?.speed || 1.1}, 
                               vec2(0.3, 0.95), 0.15, time);
        
        return offset;
      }
    `;
  }

  /**
   * Get ripple noise shader code (small-scale detail)
   */
  public getRippleNoiseShaderCode(): string {
    return `
      // Hash function for noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      
      // 2D noise
      float noise2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      // Fractal Brownian Motion (multiple octaves of noise)
      float fbm(vec2 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for (int i = 0; i < octaves; i++) {
          value += amplitude * noise2D(p * frequency);
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        
        return value;
      }
      
      // Apply ripple noise (small-scale detail)
      float applyRippleNoise(vec3 position, float time) {
        vec2 uv = position.xz * 2.0;
        
        // Animate ripples
        vec2 uv1 = uv + vec2(time * 0.03, time * 0.02);
        vec2 uv2 = uv * 1.5 - vec2(time * 0.04, -time * 0.025);
        
        // Multi-octave noise for detail
        float ripple1 = fbm(uv1, 3);
        float ripple2 = fbm(uv2, 3);
        
        // Combine ripples
        float ripples = (ripple1 + ripple2) * 0.5;
        
        // Scale to small amplitude
        return (ripples - 0.5) * 0.08;
      }
    `;
  }

  /**
   * Update time (for shader uniform)
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;
  }

  /**
   * Get current time
   */
  public getTime(): number {
    return this.time;
  }

  /**
   * Get Gerstner waves for CPU calculations (if needed)
   */
  public getGerstnerWaves(): GerstnerWave[] {
    return this.gerstnerWaves;
  }

  /**
   * Add a custom Gerstner wave
   */
  public addWave(wave: GerstnerWave): void {
    this.gerstnerWaves.push(wave);
  }

  /**
   * Clear all waves
   */
  public clearWaves(): void {
    this.gerstnerWaves = [];
  }

  /**
   * Reset to default waves
   */
  public resetToDefaults(): void {
    this.clearWaves();
    this.initializeGerstnerWaves();
  }
}
