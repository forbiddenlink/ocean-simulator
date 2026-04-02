/**
 * Foam and Spray Effects Module
 *
 * Implements realistic foam generation and rendering:
 * - Wave crest foam (whitecaps)
 * - Breaking wave foam
 * - Wake foam from objects
 * - Spray particles
 *
 * References:
 * - Dupuy & Bruneton (2012) "Real-time Animation and Rendering of Ocean Whitecaps"
 * - Cords (2009) "Real-time Open Water Environments with Interacting Objects"
 */

import * as THREE from 'three';

/**
 * Foam particle state
 */
export interface FoamParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
  size: number;
  opacity: number;
  type: 'crest' | 'breaking' | 'wake' | 'spray';
}

/**
 * Foam field configuration
 */
export interface FoamConfig {
  /** Maximum number of foam particles */
  maxParticles: number;
  /** Foam generation rate (particles per second per unit area) */
  generationRate: number;
  /** Minimum foam lifetime in seconds */
  minLifetime: number;
  /** Maximum foam lifetime in seconds */
  maxLifetime: number;
  /** Foam dissipation rate */
  dissipationRate: number;
  /** Wave height threshold for foam generation */
  waveHeightThreshold: number;
  /** Breaking threshold (Jacobian value) */
  breakingThreshold: number;
  /** Spray generation velocity threshold */
  sprayVelocityThreshold: number;
  /** Foam texture scale */
  textureScale: number;
}

/**
 * Default foam configuration
 */
export const DEFAULT_FOAM_CONFIG: FoamConfig = {
  maxParticles: 10000,
  generationRate: 100,
  minLifetime: 0.5,
  maxLifetime: 3.0,
  dissipationRate: 0.5,
  waveHeightThreshold: 1.0,
  breakingThreshold: 0.3,
  sprayVelocityThreshold: 5.0,
  textureScale: 15.0,
};

/**
 * Foam coverage map for shader-based rendering
 */
export class FoamCoverageMap {
  private texture: THREE.DataTexture;
  private data: Float32Array;
  private resolution: number;
  private worldSize: number;
  private time: number = 0;

  constructor(resolution: number = 256, worldSize: number = 500) {
    this.resolution = resolution;
    this.worldSize = worldSize;
    this.data = new Float32Array(resolution * resolution * 4);

    this.texture = new THREE.DataTexture(
      this.data,
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.needsUpdate = true;
  }

  /**
   * Update foam coverage based on wave state
   */
  public update(
    deltaTime: number,
    getWaveState: (x: number, z: number) => { height: number; breaking: number }
  ): void {
    this.time += deltaTime;
    const decay = Math.exp(-deltaTime * DEFAULT_FOAM_CONFIG.dissipationRate);

    for (let y = 0; y < this.resolution; y++) {
      for (let x = 0; x < this.resolution; x++) {
        const worldX = (x / this.resolution - 0.5) * this.worldSize;
        const worldZ = (y / this.resolution - 0.5) * this.worldSize;

        const state = getWaveState(worldX, worldZ);
        const index = (y * this.resolution + x) * 4;

        // Decay existing foam
        this.data[index] *= decay;
        this.data[index + 1] *= decay;
        this.data[index + 2] *= decay;

        // Generate new foam at wave crests
        if (state.height > DEFAULT_FOAM_CONFIG.waveHeightThreshold) {
          const foamIntensity = (state.height - DEFAULT_FOAM_CONFIG.waveHeightThreshold) * 0.5;
          this.data[index] = Math.min(1, this.data[index] + foamIntensity * deltaTime);
        }

        // Generate foam at breaking waves
        if (state.breaking > DEFAULT_FOAM_CONFIG.breakingThreshold) {
          const breakingFoam = state.breaking * 2.0;
          this.data[index + 1] = Math.min(1, this.data[index + 1] + breakingFoam * deltaTime);
        }

        // Combined foam intensity
        this.data[index + 3] = Math.min(1, this.data[index] + this.data[index + 1] + this.data[index + 2]);
      }
    }

    this.texture.needsUpdate = true;
  }

  /**
   * Add wake foam from a moving object
   */
  public addWakeFoam(worldX: number, worldZ: number, intensity: number, radius: number): void {
    const cellSize = this.worldSize / this.resolution;
    const radiusCells = Math.ceil(radius / cellSize);

    const centerX = Math.floor((worldX / this.worldSize + 0.5) * this.resolution);
    const centerY = Math.floor((worldZ / this.worldSize + 0.5) * this.resolution);

    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy) * cellSize;
        if (dist > radius) continue;

        const x = (centerX + dx + this.resolution) % this.resolution;
        const y = (centerY + dy + this.resolution) % this.resolution;
        const index = (y * this.resolution + x) * 4;

        const falloff = 1 - dist / radius;
        this.data[index + 2] = Math.min(1, this.data[index + 2] + intensity * falloff);
        this.data[index + 3] = Math.min(1, this.data[index + 3] + intensity * falloff);
      }
    }

    this.texture.needsUpdate = true;
  }

  /**
   * Get foam texture for shader
   */
  public getTexture(): THREE.DataTexture {
    return this.texture;
  }

  /**
   * Sample foam intensity at world position
   */
  public sample(worldX: number, worldZ: number): number {
    const u = (worldX / this.worldSize + 0.5) % 1;
    const v = (worldZ / this.worldSize + 0.5) % 1;

    const x = Math.floor(u * this.resolution);
    const y = Math.floor(v * this.resolution);
    const index = (y * this.resolution + x) * 4;

    return this.data[index + 3];
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.texture.dispose();
  }
}

/**
 * Spray particle system for breaking waves and impacts
 */
export class SpraySystem {
  private particles: FoamParticle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;
  private maxParticles: number;

  // Buffer arrays
  private positions: Float32Array;
  private sizes: Float32Array;
  private opacities: Float32Array;
  private activeCount: number = 0;

  constructor(scene: THREE.Scene, maxParticles: number = 5000) {
    this.maxParticles = maxParticles;

    // Initialize arrays
    this.positions = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);
    this.opacities = new Float32Array(maxParticles);

    // Create geometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));

    // Create material
    this.material = this.createSprayMaterial();

    // Create points
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /**
   * Create spray particle shader material
   */
  private createSprayMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
        cameraPosition: { value: new THREE.Vector3() },
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;

        varying float vOpacity;

        void main() {
          vOpacity = opacity;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 32.0);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;

        varying float vOpacity;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);

          if (dist > 0.5) discard;

          float alpha = smoothstep(0.5, 0.2, dist) * vOpacity;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  /**
   * Emit spray particles
   */
  public emit(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    count: number,
    spread: number = 0.5
  ): void {
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      // Random direction variation
      const randomDir = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * spread,
        (Math.random() - 0.5) * spread
      );

      const particleVelocity = velocity.clone().add(randomDir);
      const maxAge = DEFAULT_FOAM_CONFIG.minLifetime +
        Math.random() * (DEFAULT_FOAM_CONFIG.maxLifetime - DEFAULT_FOAM_CONFIG.minLifetime);

      this.particles.push({
        position: position.clone(),
        velocity: particleVelocity,
        age: 0,
        maxAge,
        size: 0.1 + Math.random() * 0.3,
        opacity: 0.8 + Math.random() * 0.2,
        type: 'spray',
      });
    }
  }

  /**
   * Emit breaking wave spray
   */
  public emitBreakingWave(
    position: THREE.Vector3,
    waveDirection: THREE.Vector2,
    intensity: number
  ): void {
    const count = Math.floor(intensity * 20);

    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      // Spray goes up and in wave direction
      const angle = (Math.random() - 0.5) * Math.PI * 0.5;
      const speed = 2 + Math.random() * 5 * intensity;

      const velocity = new THREE.Vector3(
        waveDirection.x * Math.cos(angle) * speed * 0.5,
        speed * (0.5 + Math.random() * 0.5),
        waveDirection.y * Math.cos(angle) * speed * 0.5
      );

      this.particles.push({
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random(),
          (Math.random() - 0.5) * 2
        )),
        velocity,
        age: 0,
        maxAge: 1 + Math.random() * 2,
        size: 0.1 + Math.random() * 0.2,
        opacity: 0.6 + Math.random() * 0.4,
        type: 'breaking',
      });
    }
  }

  /**
   * Update spray particles
   */
  public update(deltaTime: number, gravity: number = 9.81): void {
    const gravityVec = new THREE.Vector3(0, -gravity, 0);

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      // Age particle
      particle.age += deltaTime;

      if (particle.age >= particle.maxAge) {
        // Remove dead particle
        this.particles.splice(i, 1);
        continue;
      }

      // Apply gravity
      particle.velocity.addScaledVector(gravityVec, deltaTime);

      // Apply air resistance
      particle.velocity.multiplyScalar(1 - deltaTime * 0.5);

      // Update position
      particle.position.addScaledVector(particle.velocity, deltaTime);

      // Fade out
      particle.opacity = 1 - particle.age / particle.maxAge;
    }

    // Update buffers
    this.updateBuffers();
  }

  /**
   * Update GPU buffers
   */
  private updateBuffers(): void {
    this.activeCount = this.particles.length;

    for (let i = 0; i < this.activeCount; i++) {
      const particle = this.particles[i];
      const i3 = i * 3;

      this.positions[i3] = particle.position.x;
      this.positions[i3 + 1] = particle.position.y;
      this.positions[i3 + 2] = particle.position.z;

      this.sizes[i] = particle.size;
      this.opacities[i] = particle.opacity;
    }

    this.geometry.setDrawRange(0, this.activeCount);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.opacity.needsUpdate = true;
  }

  /**
   * Update camera position for size calculations
   */
  public updateCamera(camera: THREE.Camera): void {
    this.material.uniforms.cameraPosition.value.copy(camera.position);
  }

  /**
   * Get particle count
   */
  public getParticleCount(): number {
    return this.activeCount;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Generate foam shader code for integration with ocean material
 */
export function generateFoamShaderCode(): {
  uniforms: Record<string, THREE.IUniform>;
  vertexChunk: string;
  fragmentChunk: string;
} {
  return {
    uniforms: {
      foamTexture: { value: null },
      foamCoverage: { value: null },
      foamColor: { value: new THREE.Color(0xffffff) },
      foamIntensity: { value: 1.0 },
      foamScale: { value: 15.0 },
      foamEdgeSharpness: { value: 2.0 },
    },
    vertexChunk: `
      varying vec3 vFoamWorldPosition;

      void setupFoam() {
        vFoamWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      }
    `,
    fragmentChunk: `
      uniform sampler2D foamTexture;
      uniform sampler2D foamCoverage;
      uniform vec3 foamColor;
      uniform float foamIntensity;
      uniform float foamScale;
      uniform float foamEdgeSharpness;

      varying vec3 vFoamWorldPosition;

      vec3 applyFoam(vec3 baseColor, float waveHeight, vec2 worldXZ) {
        // Sample foam coverage map
        vec2 coverageUV = worldXZ * 0.001 + 0.5;
        vec4 coverage = texture2D(foamCoverage, coverageUV);

        // Sample foam texture with world-space tiling
        vec2 foamUV = worldXZ * foamScale * 0.01;
        float foamPattern = texture2D(foamTexture, foamUV).r;

        // Combine coverage and pattern
        float foamAmount = coverage.a * foamPattern;

        // Height-based foam (wave crests)
        float heightFoam = smoothstep(0.8, 1.5, waveHeight);
        foamAmount = max(foamAmount, heightFoam * foamPattern);

        // Apply foam
        foamAmount = pow(foamAmount, 1.0 / foamEdgeSharpness) * foamIntensity;

        return mix(baseColor, foamColor, foamAmount);
      }
    `,
  };
}
