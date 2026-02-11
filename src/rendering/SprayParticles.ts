import * as THREE from 'three';

/**
 * Spray particle system for wave crests and breaking waves
 * Creates realistic water spray and mist effects
 */
export class SprayParticles {
  private scene: THREE.Scene;
  private particleSystem: THREE.Points;
  private particleCount: number;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private sizes: Float32Array;
  private time: number = 0;
  private spawnTimer: number = 0;
  private spawnRate: number = 0.016; // Spawn every ~60fps

  constructor(scene: THREE.Scene, particleCount: number = 2000) {
    this.scene = scene;
    this.particleCount = particleCount;
    
    // Initialize particle data
    this.positions = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount * 3);
    this.lifetimes = new Float32Array(particleCount);
    this.sizes = new Float32Array(particleCount);
    
    // Initialize all particles as inactive
    for (let i = 0; i < particleCount; i++) {
      this.lifetimes[i] = 0;
    }
    
    // Create particle geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    
    // Create particle material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
        opacity: { value: 0.6 },
      },
      vertexShader: `
        attribute float size;
        varying float vLifetime;
        
        void main() {
          vLifetime = size; // Reuse size attribute for lifetime visualization
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        varying float vLifetime;
        
        void main() {
          // Circular particle shape
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          // Soft edges
          float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
          
          // Fade based on lifetime
          alpha *= vLifetime * opacity;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  /**
   * Update particle simulation
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.spawnTimer += deltaTime;
    
    // Update existing particles
    for (let i = 0; i < this.particleCount; i++) {
      const lifetime = this.lifetimes[i];
      
      if (lifetime > 0) {
        // Update position
        const idx = i * 3;
        this.positions[idx] += this.velocities[idx] * deltaTime;
        this.positions[idx + 1] += this.velocities[idx + 1] * deltaTime;
        this.positions[idx + 2] += this.velocities[idx + 2] * deltaTime;
        
        // Apply gravity
        this.velocities[idx + 1] -= 9.81 * deltaTime;
        
        // Air resistance
        this.velocities[idx] *= 0.98;
        this.velocities[idx + 1] *= 0.98;
        this.velocities[idx + 2] *= 0.98;
        
        // Decrease lifetime
        this.lifetimes[i] -= deltaTime;
        
        // Update size (fade out)
        this.sizes[i] = Math.max(0, this.lifetimes[i]);
      }
    }
    
    // Spawn new particles
    if (this.spawnTimer >= this.spawnRate) {
      this.spawnParticles(10); // Spawn 10 particles per frame
      this.spawnTimer = 0;
    }
    
    // Update buffer
    const geometry = this.particleSystem.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    
    // Update shader time
    (this.particleSystem.material as THREE.ShaderMaterial).uniforms.time.value = this.time;
  }

  /**
   * Spawn new spray particles at wave crests
   */
  private spawnParticles(count: number): void {
    for (let n = 0; n < count; n++) {
      // Find inactive particle
      let particleIndex = -1;
      for (let i = 0; i < this.particleCount; i++) {
        if (this.lifetimes[i] <= 0) {
          particleIndex = i;
          break;
        }
      }
      
      if (particleIndex === -1) continue; // No free particles
      
      // Spawn position (simulate wave crests)
      // In production, this should be based on actual wave height data
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 50 + 10;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.random() * 2 - 1; // Slightly above/below water surface
      
      const idx = particleIndex * 3;
      this.positions[idx] = x;
      this.positions[idx + 1] = y;
      this.positions[idx + 2] = z;
      
      // Initial velocity (upward and outward)
      const speed = 2 + Math.random() * 3;
      const upwardAngle = Math.PI / 4 + Math.random() * Math.PI / 6;
      
      this.velocities[idx] = Math.cos(angle) * Math.cos(upwardAngle) * speed;
      this.velocities[idx + 1] = Math.sin(upwardAngle) * speed;
      this.velocities[idx + 2] = Math.sin(angle) * Math.cos(upwardAngle) * speed;
      
      // Lifetime (1-2 seconds)
      this.lifetimes[particleIndex] = 1 + Math.random();
      
      // Initial size
      this.sizes[particleIndex] = 1.0;
    }
  }

  /**
   * Spawn particles at specific location (for shore interaction, etc.)
   */
  public spawnAt(position: THREE.Vector3, count: number = 5): void {
    for (let n = 0; n < count; n++) {
      // Find inactive particle
      let particleIndex = -1;
      for (let i = 0; i < this.particleCount; i++) {
        if (this.lifetimes[i] <= 0) {
          particleIndex = i;
          break;
        }
      }
      
      if (particleIndex === -1) continue;
      
      const idx = particleIndex * 3;
      this.positions[idx] = position.x + (Math.random() - 0.5) * 2;
      this.positions[idx + 1] = position.y;
      this.positions[idx + 2] = position.z + (Math.random() - 0.5) * 2;
      
      // Random velocity
      const speed = 1 + Math.random() * 2;
      const angle = Math.random() * Math.PI * 2;
      this.velocities[idx] = Math.cos(angle) * speed;
      this.velocities[idx + 1] = 2 + Math.random() * 2;
      this.velocities[idx + 2] = Math.sin(angle) * speed;
      
      this.lifetimes[particleIndex] = 0.5 + Math.random() * 0.5;
      this.sizes[particleIndex] = 1.0;
    }
  }

  /**
   * Set spawn rate (particles per second)
   */
  public setSpawnRate(rate: number): void {
    this.spawnRate = 1.0 / rate;
  }

  /**
   * Set particle opacity
   */
  public setOpacity(opacity: number): void {
    (this.particleSystem.material as THREE.ShaderMaterial).uniforms.opacity.value = opacity;
  }

  /**
   * Set spray density (controls spawn rate)
   */
  public setDensity(density: number): void {
    // Density 0-2: map to spawn rate 10-100 particles per second
    const spawnRate = 10 + (density * 45);
    this.setSpawnRate(spawnRate);
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.particleSystem.geometry.dispose();
    (this.particleSystem.material as THREE.ShaderMaterial).dispose();
    this.scene.remove(this.particleSystem);
  }
}
