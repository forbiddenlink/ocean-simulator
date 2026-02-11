import * as THREE from 'three';

/**
 * Tiling prevention system using noise-based blending
 * Based on Ubisoft's 2024 technique for aperiodic ocean surfaces
 * 
 * Prevents visible repetition patterns in FFT ocean by:
 * 1. Multiple FFT layers with different offsets
 * 2. Noise-based blending between layers
 * 3. Dynamic spectrum variation
 * 4. Procedural detail overlay
 */
export class TilingPrevention {
  private noiseTexture: THREE.DataTexture;
  private blendTexture: THREE.DataTexture;
  
  constructor(resolution: number = 512) {
    // Generate noise texture for blending
    this.noiseTexture = this.generateNoiseTexture(resolution);
    
    // Generate blend weight texture
    this.blendTexture = this.generateBlendTexture(resolution);
  }

  /**
   * Generate procedural noise texture
   */
  private generateNoiseTexture(resolution: number): THREE.DataTexture {
    const size = resolution * resolution;
    const data = new Float32Array(size * 4); // RGBA
    
    // Generate multi-octave noise
    for (let i = 0; i < size; i++) {
      const x = (i % resolution) / resolution;
      const y = Math.floor(i / resolution) / resolution;
      
      // Multi-octave value noise
      let noise = 0;
      let amplitude = 1.0;
      let frequency = 1.0;
      
      for (let octave = 0; octave < 4; octave++) {
        noise += this.valueNoise(x * frequency, y * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
      }
      
      // Normalize to [0, 1]
      noise = (noise + 1.0) * 0.5;
      
      const idx = i * 4;
      data[idx] = noise;
      data[idx + 1] = noise;
      data[idx + 2] = noise;
      data[idx + 3] = 1.0;
    }
    
    const texture = new THREE.DataTexture(
      data,
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.needsUpdate = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    return texture;
  }

  /**
   * Generate blend weight texture
   */
  private generateBlendTexture(resolution: number): THREE.DataTexture {
    const size = resolution * resolution;
    const data = new Float32Array(size * 4);
    
    for (let i = 0; i < size; i++) {
      const x = (i % resolution) / resolution;
      const y = Math.floor(i / resolution) / resolution;
      
      // Radial gradient from center
      const dx = x - 0.5;
      const dy = y - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy) * 2.0;
      const weight = 1.0 - Math.min(dist, 1.0);
      
      const idx = i * 4;
      data[idx] = weight;
      data[idx + 1] = weight;
      data[idx + 2] = weight;
      data[idx + 3] = 1.0;
    }
    
    const texture = new THREE.DataTexture(
      data,
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.needsUpdate = true;
    
    return texture;
  }

  /**
   * Simple value noise function
   */
  private valueNoise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    
    // Smooth interpolation
    const u = fx * fx * (3.0 - 2.0 * fx);
    const v = fy * fy * (3.0 - 2.0 * fy);
    
    // Grid corners
    const a = this.hash(ix, iy);
    const b = this.hash(ix + 1, iy);
    const c = this.hash(ix, iy + 1);
    const d = this.hash(ix + 1, iy + 1);
    
    // Bilinear interpolation
    return this.mix(
      this.mix(a, b, u),
      this.mix(c, d, u),
      v
    ) * 2.0 - 1.0; // Map to [-1, 1]
  }

  /**
   * Hash function for noise
   */
  private hash(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  /**
   * Linear interpolation
   */
  private mix(a: number, b: number, t: number): number {
    return a * (1.0 - t) + b * t;
  }

  /**
   * Get shader code for tiling prevention
   */
  public getShaderCode(): string {
    return `
      uniform sampler2D noiseTexture;
      uniform sampler2D blendTexture;
      uniform vec2 offset1;
      uniform vec2 offset2;
      uniform float blendFactor;
      
      // Sample FFT with tiling prevention
      vec4 sampleFFTWithBlending(sampler2D fftTexture, vec2 uv) {
        // Sample at multiple offsets
        vec2 uv1 = uv + offset1;
        vec2 uv2 = uv + offset2;
        
        vec4 sample1 = texture2D(fftTexture, uv1);
        vec4 sample2 = texture2D(fftTexture, uv2);
        
        // Get blend weights from noise
        float noise = texture2D(noiseTexture, uv * 2.0).r;
        float blendWeight = texture2D(blendTexture, uv).r;
        
        // Blend samples based on noise
        float blend = mix(blendFactor, 1.0 - blendFactor, noise) * blendWeight;
        return mix(sample1, sample2, blend);
      }
      
      // Add procedural detail to hide tiling
      float addProceduralDetail(vec2 uv, float baseHeight) {
        // High-frequency detail
        float detail = 0.0;
        vec2 p = uv * 100.0;
        
        for (int i = 0; i < 3; i++) {
          float scale = pow(2.0, float(i));
          detail += texture2D(noiseTexture, p * scale).r * (1.0 / scale);
        }
        
        // Scale detail based on base height (more detail on peaks)
        detail *= abs(baseHeight) * 0.1;
        
        return baseHeight + detail;
      }
    `;
  }

  /**
   * Get noise texture
   */
  public getNoiseTexture(): THREE.DataTexture {
    return this.noiseTexture;
  }

  /**
   * Get blend texture
   */
  public getBlendTexture(): THREE.DataTexture {
    return this.blendTexture;
  }

  /**
   * Calculate offsets for frame (animated)
   */
  public getAnimatedOffsets(time: number): { offset1: THREE.Vector2; offset2: THREE.Vector2 } {
    return {
      offset1: new THREE.Vector2(
        Math.sin(time * 0.01) * 0.1,
        Math.cos(time * 0.015) * 0.1
      ),
      offset2: new THREE.Vector2(
        Math.cos(time * 0.012) * 0.1,
        Math.sin(time * 0.008) * 0.1
      ),
    };
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.noiseTexture.dispose();
    this.blendTexture.dispose();
  }
}
