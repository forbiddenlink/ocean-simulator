import * as THREE from 'three';

/**
 * SPH (Smoothed Particle Hydrodynamics) Fluid Simulation
 *
 * Implements Position-Based Fluids (PBF) algorithm for real-time fluid dynamics.
 * Reference: Macklin & Muller, "Position Based Fluids" (SIGGRAPH 2013)
 *
 * WebGPU Migration Notes:
 * - This CPU implementation can be ported to WebGPU compute shaders
 * - Key compute passes: neighbor search, density constraint, viscosity
 * - Consider WebGPU-Ocean patterns: https://github.com/nicksiscoe/webgpu-ocean
 */

// Fluid configuration constants
const FLUID_CONFIG = {
  // SPH kernel parameters
  SMOOTHING_RADIUS: 1.5,        // h: SPH smoothing length
  REST_DENSITY: 1000.0,         // rho_0: Rest density of water (kg/m^3)
  RELAXATION: 0.01,             // epsilon: Relaxation for density constraint

  // Solver parameters
  SOLVER_ITERATIONS: 4,         // PBF solver iterations per frame
  VISCOSITY: 0.01,              // c: XSPH viscosity coefficient
  VORTICITY_EPSILON: 0.001,     // Vorticity confinement strength

  // Time step
  MAX_TIMESTEP: 1 / 60,         // Maximum simulation timestep
  SUBSTEPS: 2,                  // Substeps per frame for stability

  // Bounds
  BOUNDS_MIN: new THREE.Vector3(-50, -35, -50),
  BOUNDS_MAX: new THREE.Vector3(50, 5, 50),

  // Gravity
  GRAVITY: new THREE.Vector3(0, -9.81, 0),
};

// Pre-computed kernel constants
const PI = Math.PI;
const h = FLUID_CONFIG.SMOOTHING_RADIUS;
const h2 = h * h;
const h3 = h * h * h;
const h6 = h3 * h3;
const h9 = h6 * h3;

// Poly6 kernel normalization constant (for density)
const POLY6_COEFF = 315 / (64 * PI * h9);
// Spiky kernel gradient normalization (for pressure)
const SPIKY_GRAD_COEFF = -45 / (PI * h6);

/**
 * Fluid particle structure
 */
interface FluidParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  predictedPosition: THREE.Vector3;
  acceleration: THREE.Vector3;

  // SPH quantities
  density: number;
  lambda: number;           // Lagrange multiplier for density constraint
  deltaPosition: THREE.Vector3;

  // Neighbor cache
  neighbors: number[];
}

/**
 * Spatial hash grid for O(n) neighbor search
 */
class SpatialHashGrid {
  private cellSize: number;
  private cells: Map<number, number[]> = new Map();

  constructor(cellSize: number = FLUID_CONFIG.SMOOTHING_RADIUS) {
    this.cellSize = cellSize;
  }

  private hash(x: number, y: number, z: number): number {
    const ix = Math.floor(x / this.cellSize);
    const iy = Math.floor(y / this.cellSize);
    const iz = Math.floor(z / this.cellSize);
    // Large primes for spatial hashing
    return (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(particleIndex: number, position: THREE.Vector3): void {
    const hash = this.hash(position.x, position.y, position.z);
    if (!this.cells.has(hash)) {
      this.cells.set(hash, []);
    }
    this.cells.get(hash)!.push(particleIndex);
  }

  queryNeighbors(position: THREE.Vector3): number[] {
    const neighbors: number[] = [];
    const cx = Math.floor(position.x / this.cellSize);
    const cy = Math.floor(position.y / this.cellSize);
    const cz = Math.floor(position.z / this.cellSize);

    // Check 27 neighboring cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const hash = this.hash(
            (cx + dx) * this.cellSize,
            (cy + dy) * this.cellSize,
            (cz + dz) * this.cellSize
          );
          const cell = this.cells.get(hash);
          if (cell) {
            neighbors.push(...cell);
          }
        }
      }
    }

    return neighbors;
  }
}

/**
 * Position-Based Fluids simulation
 */
export class FluidSimulation {
  private particles: FluidParticle[] = [];
  private spatialGrid: SpatialHashGrid;
  private maxParticles: number;

  // Visualization
  private pointCloud: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private velocities: Float32Array;

  // Temporary vectors (reused to avoid GC)
  private _tempVec = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector3();
  private _tempVec3 = new THREE.Vector3();

  constructor(scene: THREE.Scene, maxParticles: number = 5000) {
    this.maxParticles = maxParticles;
    this.spatialGrid = new SpatialHashGrid();

    // Initialize geometry for visualization
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxParticles * 3);
    this.velocities = new Float32Array(maxParticles * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('velocity', new THREE.BufferAttribute(this.velocities, 3));

    // Create point cloud material with fluid-like appearance
    const material = new THREE.ShaderMaterial({
      uniforms: {
        pointSize: { value: 8.0 },
        waterColor: { value: new THREE.Color(0x1a4a6b) },
        foamColor: { value: new THREE.Color(0xaaddff) },
        cameraPosition: { value: new THREE.Vector3() },
      },
      vertexShader: `
        attribute vec3 velocity;

        varying vec3 vColor;
        varying float vAlpha;
        varying float vSpeed;

        uniform float pointSize;
        uniform vec3 waterColor;
        uniform vec3 foamColor;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Calculate speed for coloring
          float speed = length(velocity);
          vSpeed = speed;

          // Blend water to foam color based on speed
          vColor = mix(waterColor, foamColor, smoothstep(0.0, 5.0, speed));

          // Distance-based alpha
          float distance = length(mvPosition.xyz);
          vAlpha = smoothstep(100.0, 20.0, distance);

          // Depth-based alpha (fade near surface)
          float depthFade = smoothstep(-2.0, -8.0, position.y);
          vAlpha *= depthFade;

          // Size attenuation
          gl_PointSize = pointSize * (100.0 / max(-mvPosition.z, 1.0));
          gl_PointSize = clamp(gl_PointSize, 2.0, 20.0);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vSpeed;

        void main() {
          // Circular particle
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);

          if (dist > 0.5) discard;

          // Soft edge
          float alpha = smoothstep(0.5, 0.2, dist) * vAlpha;

          // Add rim highlight for depth
          float rim = smoothstep(0.35, 0.5, dist) * 0.3;
          vec3 color = vColor + vec3(rim);

          gl_FragColor = vec4(color, alpha * 0.8);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.pointCloud = new THREE.Points(this.geometry, material);
    this.pointCloud.frustumCulled = false;
    scene.add(this.pointCloud);
  }

  /**
   * Spawn fluid particles in a region
   */
  spawnParticles(
    center: THREE.Vector3,
    dimensions: THREE.Vector3,
    spacing: number = 0.8,
    initialVelocity?: THREE.Vector3
  ): void {
    const halfDim = dimensions.clone().multiplyScalar(0.5);
    const start = center.clone().sub(halfDim);
    const end = center.clone().add(halfDim);

    for (let x = start.x; x <= end.x; x += spacing) {
      for (let y = start.y; y <= end.y; y += spacing) {
        for (let z = start.z; z <= end.z; z += spacing) {
          if (this.particles.length >= this.maxParticles) return;

          const particle: FluidParticle = {
            position: new THREE.Vector3(x, y, z),
            velocity: initialVelocity?.clone() ?? new THREE.Vector3(),
            predictedPosition: new THREE.Vector3(),
            acceleration: new THREE.Vector3(),
            density: 0,
            lambda: 0,
            deltaPosition: new THREE.Vector3(),
            neighbors: [],
          };

          // Add small random jitter to break symmetry
          particle.position.x += (Math.random() - 0.5) * spacing * 0.1;
          particle.position.y += (Math.random() - 0.5) * spacing * 0.1;
          particle.position.z += (Math.random() - 0.5) * spacing * 0.1;

          this.particles.push(particle);
        }
      }
    }

    this.updateGeometry();
  }

  /**
   * Spawn a splash/wave effect
   */
  spawnSplash(position: THREE.Vector3, radius: number = 3, particleCount: number = 100): void {
    for (let i = 0; i < particleCount && this.particles.length < this.maxParticles; i++) {
      // Random position in sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * Math.cbrt(Math.random()); // Cube root for uniform volume

      const x = position.x + r * Math.sin(phi) * Math.cos(theta);
      const y = position.y + r * Math.sin(phi) * Math.sin(theta) * 0.3; // Flatten vertically
      const z = position.z + r * Math.cos(phi);

      // Outward velocity
      const velocity = new THREE.Vector3(
        x - position.x,
        Math.abs(y - position.y) + 1, // Upward bias
        z - position.z
      ).normalize().multiplyScalar(5 + Math.random() * 5);

      const particle: FluidParticle = {
        position: new THREE.Vector3(x, y, z),
        velocity,
        predictedPosition: new THREE.Vector3(),
        acceleration: new THREE.Vector3(),
        density: 0,
        lambda: 0,
        deltaPosition: new THREE.Vector3(),
        neighbors: [],
      };

      this.particles.push(particle);
    }

    this.updateGeometry();
  }

  /**
   * SPH Poly6 kernel
   */
  private kernelPoly6(r2: number): number {
    if (r2 >= h2) return 0;
    const diff = h2 - r2;
    return POLY6_COEFF * diff * diff * diff;
  }

  /**
   * SPH Spiky kernel gradient
   */
  private kernelSpikyGrad(r: THREE.Vector3, rLen: number): THREE.Vector3 {
    if (rLen >= h || rLen < 0.0001) {
      return this._tempVec3.set(0, 0, 0);
    }
    const diff = h - rLen;
    const scale = SPIKY_GRAD_COEFF * diff * diff / rLen;
    return this._tempVec3.copy(r).multiplyScalar(scale);
  }

  /**
   * Main simulation step
   */
  update(deltaTime: number): void {
    if (this.particles.length === 0) return;

    const dt = Math.min(deltaTime, FLUID_CONFIG.MAX_TIMESTEP);
    const subDt = dt / FLUID_CONFIG.SUBSTEPS;

    for (let sub = 0; sub < FLUID_CONFIG.SUBSTEPS; sub++) {
      this.simulationStep(subDt);
    }

    this.updateGeometry();
  }

  /**
   * Single simulation substep (PBF algorithm)
   */
  private simulationStep(dt: number): void {
    const { GRAVITY, BOUNDS_MIN, BOUNDS_MAX, REST_DENSITY, RELAXATION, SOLVER_ITERATIONS, VISCOSITY } = FLUID_CONFIG;

    // 1. Apply external forces and predict positions
    for (const particle of this.particles) {
      // Apply gravity
      particle.velocity.addScaledVector(GRAVITY, dt);

      // Predict position
      particle.predictedPosition.copy(particle.position).addScaledVector(particle.velocity, dt);
    }

    // 2. Build spatial hash
    this.spatialGrid.clear();
    for (let i = 0; i < this.particles.length; i++) {
      this.spatialGrid.insert(i, this.particles[i].predictedPosition);
    }

    // 3. Find neighbors
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const potentialNeighbors = this.spatialGrid.queryNeighbors(particle.predictedPosition);

      particle.neighbors = [];
      for (const j of potentialNeighbors) {
        if (i === j) continue;

        const neighbor = this.particles[j];
        this._tempVec.copy(particle.predictedPosition).sub(neighbor.predictedPosition);
        const r2 = this._tempVec.lengthSq();

        if (r2 < h2) {
          particle.neighbors.push(j);
        }
      }
    }

    // 4. Solver iterations
    for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
      // 4a. Calculate density and lambda
      for (let i = 0; i < this.particles.length; i++) {
        const particle = this.particles[i];

        // Calculate density using Poly6 kernel
        let density = this.kernelPoly6(0); // Self-contribution

        for (const j of particle.neighbors) {
          const neighbor = this.particles[j];
          this._tempVec.copy(particle.predictedPosition).sub(neighbor.predictedPosition);
          const r2 = this._tempVec.lengthSq();
          density += this.kernelPoly6(r2);
        }

        particle.density = density;

        // Calculate constraint gradient
        let sumGrad2 = 0;
        const gradI = this._tempVec2.set(0, 0, 0);

        for (const j of particle.neighbors) {
          const neighbor = this.particles[j];
          this._tempVec.copy(particle.predictedPosition).sub(neighbor.predictedPosition);
          const rLen = this._tempVec.length();

          const grad = this.kernelSpikyGrad(this._tempVec, rLen);
          grad.divideScalar(REST_DENSITY);

          sumGrad2 += grad.lengthSq();
          gradI.add(grad);
        }

        sumGrad2 += gradI.lengthSq();

        // Calculate lambda
        const constraint = density / REST_DENSITY - 1;
        particle.lambda = -constraint / (sumGrad2 + RELAXATION);
      }

      // 4b. Calculate position correction (delta p)
      for (const particle of this.particles) {
        particle.deltaPosition.set(0, 0, 0);

        for (const j of particle.neighbors) {
          const neighbor = this.particles[j];
          this._tempVec.copy(particle.predictedPosition).sub(neighbor.predictedPosition);
          const rLen = this._tempVec.length();

          const grad = this.kernelSpikyGrad(this._tempVec, rLen);

          // s_corr: artificial pressure for surface tension
          const q = rLen / (0.3 * h);
          const sCorr = -0.0001 * Math.pow(this.kernelPoly6(q * q * h2) / this.kernelPoly6(0.01 * h2), 4);

          const scale = (particle.lambda + neighbor.lambda + sCorr) / REST_DENSITY;
          particle.deltaPosition.addScaledVector(grad, scale);
        }
      }

      // 4c. Apply position correction
      for (const particle of this.particles) {
        particle.predictedPosition.add(particle.deltaPosition);
      }
    }

    // 5. Update velocities and apply viscosity (XSPH)
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      // Update velocity from position change
      particle.velocity.copy(particle.predictedPosition).sub(particle.position).divideScalar(dt);

      // XSPH viscosity
      const viscosityCorrection = this._tempVec2.set(0, 0, 0);

      for (const j of particle.neighbors) {
        const neighbor = this.particles[j];
        this._tempVec.copy(particle.predictedPosition).sub(neighbor.predictedPosition);
        const r2 = this._tempVec.lengthSq();

        const kernel = this.kernelPoly6(r2);
        this._tempVec.copy(neighbor.velocity).sub(particle.velocity);
        viscosityCorrection.addScaledVector(this._tempVec, kernel);
      }

      particle.velocity.addScaledVector(viscosityCorrection, VISCOSITY);

      // Update position
      particle.position.copy(particle.predictedPosition);

      // Boundary collision
      this.enforceBounds(particle, BOUNDS_MIN, BOUNDS_MAX);
    }
  }

  /**
   * Enforce simulation bounds with damping
   */
  private enforceBounds(particle: FluidParticle, min: THREE.Vector3, max: THREE.Vector3): void {
    const damping = 0.5;

    if (particle.position.x < min.x) {
      particle.position.x = min.x;
      particle.velocity.x *= -damping;
    }
    if (particle.position.x > max.x) {
      particle.position.x = max.x;
      particle.velocity.x *= -damping;
    }

    if (particle.position.y < min.y) {
      particle.position.y = min.y;
      particle.velocity.y *= -damping;
    }
    if (particle.position.y > max.y) {
      particle.position.y = max.y;
      particle.velocity.y *= -damping;
    }

    if (particle.position.z < min.z) {
      particle.position.z = min.z;
      particle.velocity.z *= -damping;
    }
    if (particle.position.z > max.z) {
      particle.position.z = max.z;
      particle.velocity.z *= -damping;
    }
  }

  /**
   * Update Three.js geometry from particle data
   */
  private updateGeometry(): void {
    const count = this.particles.length;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const particle = this.particles[i];

      this.positions[i3] = particle.position.x;
      this.positions[i3 + 1] = particle.position.y;
      this.positions[i3 + 2] = particle.position.z;

      this.velocities[i3] = particle.velocity.x;
      this.velocities[i3 + 1] = particle.velocity.y;
      this.velocities[i3 + 2] = particle.velocity.z;
    }

    // Set draw range to only render active particles
    this.geometry.setDrawRange(0, count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.velocity.needsUpdate = true;
  }

  /**
   * Get particle count
   */
  getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * Sample velocity at a point (for creature interaction)
   */
  sampleVelocity(position: THREE.Vector3): THREE.Vector3 {
    const result = new THREE.Vector3();
    let totalWeight = 0;

    // Query nearby particles
    const neighbors = this.spatialGrid.queryNeighbors(position);

    for (const i of neighbors) {
      const particle = this.particles[i];
      this._tempVec.copy(position).sub(particle.position);
      const r2 = this._tempVec.lengthSq();

      if (r2 < h2) {
        const weight = this.kernelPoly6(r2);
        result.addScaledVector(particle.velocity, weight);
        totalWeight += weight;
      }
    }

    if (totalWeight > 0) {
      result.divideScalar(totalWeight);
    }

    return result;
  }

  /**
   * Apply impulse at a point (for creature displacement)
   */
  applyImpulse(position: THREE.Vector3, impulse: THREE.Vector3, radius: number = 3): void {
    for (const particle of this.particles) {
      this._tempVec.copy(position).sub(particle.position);
      const dist = this._tempVec.length();

      if (dist < radius) {
        const falloff = 1 - dist / radius;
        particle.velocity.addScaledVector(impulse, falloff);
      }
    }
  }

  /**
   * Update camera position for shader
   */
  updateCamera(camera: THREE.Camera): void {
    const material = this.pointCloud.material as THREE.ShaderMaterial;
    material.uniforms.cameraPosition.value.copy(camera.position);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.geometry.dispose();
    (this.pointCloud.material as THREE.Material).dispose();
  }
}

/**
 * Lightweight wave simulation for surface effects
 * Uses 2D height field simulation (much faster than full SPH)
 */
export class WaveSimulation {
  private width: number;
  private height: number;
  private heightField: Float32Array;
  private velocityField: Float32Array;

  private damping = 0.99;
  private waveSpeed = 4.0;
  private cellSize: number;
  private originX: number;
  private originZ: number;

  constructor(
    width: number = 64,
    height: number = 64,
    worldSize: number = 100
  ) {
    this.width = width;
    this.height = height;
    this.cellSize = worldSize / width;
    this.originX = -worldSize / 2;
    this.originZ = -worldSize / 2;

    const size = width * height;
    this.heightField = new Float32Array(size);
    this.velocityField = new Float32Array(size);
  }

  /**
   * Update wave simulation
   */
  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 1 / 30);
    const c2 = this.waveSpeed * this.waveSpeed * dt;

    // Wave equation: d2h/dt2 = c^2 * (laplacian h)
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const i = y * this.width + x;

        // Laplacian (4-neighbor stencil)
        const laplacian =
          this.heightField[i - 1] +
          this.heightField[i + 1] +
          this.heightField[i - this.width] +
          this.heightField[i + this.width] -
          4 * this.heightField[i];

        this.velocityField[i] += c2 * laplacian;
        this.velocityField[i] *= this.damping;
      }
    }

    // Update heights
    for (let i = 0; i < this.heightField.length; i++) {
      this.heightField[i] += this.velocityField[i] * dt;
    }
  }

  /**
   * Create a ripple at a world position
   */
  createRipple(worldX: number, worldZ: number, amplitude: number = 1): void {
    const cellX = Math.floor((worldX - this.originX) / this.cellSize);
    const cellZ = Math.floor((worldZ - this.originZ) / this.cellSize);

    if (cellX < 0 || cellX >= this.width || cellZ < 0 || cellZ >= this.height) {
      return;
    }

    const i = cellZ * this.width + cellX;
    this.velocityField[i] += amplitude;
  }

  /**
   * Sample height at a world position
   */
  sampleHeight(worldX: number, worldZ: number): number {
    const cellX = (worldX - this.originX) / this.cellSize;
    const cellZ = (worldZ - this.originZ) / this.cellSize;

    // Bilinear interpolation
    const x0 = Math.floor(cellX);
    const z0 = Math.floor(cellZ);
    const x1 = Math.min(x0 + 1, this.width - 1);
    const z1 = Math.min(z0 + 1, this.height - 1);

    if (x0 < 0 || z0 < 0 || x0 >= this.width || z0 >= this.height) {
      return 0;
    }

    const fx = cellX - x0;
    const fz = cellZ - z0;

    const h00 = this.heightField[z0 * this.width + x0];
    const h10 = this.heightField[z0 * this.width + x1];
    const h01 = this.heightField[z1 * this.width + x0];
    const h11 = this.heightField[z1 * this.width + x1];

    return (
      h00 * (1 - fx) * (1 - fz) +
      h10 * fx * (1 - fz) +
      h01 * (1 - fx) * fz +
      h11 * fx * fz
    );
  }
}
