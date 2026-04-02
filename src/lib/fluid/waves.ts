/**
 * Wave Physics Module
 *
 * Implements various wave models for ocean simulation:
 * - Gerstner waves (trochoidal waves)
 * - Linear wave theory
 * - Breaking wave detection
 * - Wave interaction with objects
 *
 * References:
 * - Fournier & Reeves (1986) "A Simple Model of Ocean Waves"
 * - Tessendorf (2001) "Simulating Ocean Water"
 */

import * as THREE from 'three';

const GRAVITY = 9.81;
const TWO_PI = Math.PI * 2;

/**
 * Wave parameters for a single wave component
 */
export interface WaveComponent {
  /** Wavelength in meters */
  wavelength: number;
  /** Wave amplitude in meters */
  amplitude: number;
  /** Wave direction (normalized 2D vector) */
  direction: THREE.Vector2;
  /** Steepness factor (0-1, higher = more peaked) */
  steepness: number;
  /** Phase offset in radians */
  phase: number;
  /** Wave angular frequency (computed) */
  omega: number;
  /** Wave number k = 2*PI/wavelength (computed) */
  k: number;
}

/**
 * Wave field state at a point
 */
export interface WaveFieldState {
  /** Surface height */
  height: number;
  /** Surface normal */
  normal: THREE.Vector3;
  /** Horizontal displacement */
  displacement: THREE.Vector2;
  /** Particle velocity at surface */
  velocity: THREE.Vector3;
  /** Acceleration at surface */
  acceleration: THREE.Vector3;
  /** Wave breaking factor (0 = calm, 1 = fully breaking) */
  breaking: number;
}

/**
 * Configuration for wave field generation
 */
export interface WaveFieldConfig {
  /** Primary wind direction */
  windDirection: THREE.Vector2;
  /** Wind speed in m/s */
  windSpeed: number;
  /** Number of wave components */
  waveCount: number;
  /** Minimum wavelength */
  minWavelength: number;
  /** Maximum wavelength */
  maxWavelength: number;
  /** Overall amplitude scale */
  amplitudeScale: number;
  /** Angular spread of wave directions (radians) */
  directionalSpread: number;
  /** Water depth (affects dispersion) */
  depth: number;
}

/**
 * Default wave field configuration
 */
export const DEFAULT_WAVE_CONFIG: WaveFieldConfig = {
  windDirection: new THREE.Vector2(1, 0),
  windSpeed: 15,
  waveCount: 8,
  minWavelength: 0.5,
  maxWavelength: 50,
  amplitudeScale: 1.0,
  directionalSpread: Math.PI / 4,
  depth: 100,
};

/**
 * Gerstner Wave System
 *
 * Implements trochoidal (Gerstner) waves which provide realistic
 * wave shapes with sharp crests and flat troughs.
 */
export class GerstnerWaveSystem {
  private waves: WaveComponent[] = [];
  private config: WaveFieldConfig;
  private time: number = 0;

  // Pre-allocated vectors for performance
  private _tempVec2 = new THREE.Vector2();
  private _tempVec3 = new THREE.Vector3();

  constructor(config: Partial<WaveFieldConfig> = {}) {
    this.config = { ...DEFAULT_WAVE_CONFIG, ...config };
    this.generateWaves();
  }

  /**
   * Generate wave components based on configuration
   */
  private generateWaves(): void {
    this.waves = [];
    const { waveCount, minWavelength, maxWavelength, directionalSpread } = this.config;
    const windDir = this.config.windDirection.clone().normalize();

    for (let i = 0; i < waveCount; i++) {
      // Distribute wavelengths logarithmically
      const t = i / (waveCount - 1);
      const wavelength = minWavelength * Math.pow(maxWavelength / minWavelength, t);

      // Amplitude follows a power law (longer waves have more energy)
      const baseAmplitude = Math.pow(wavelength / maxWavelength, 0.5) * this.config.amplitudeScale;

      // Direction varies around wind direction
      const angle = (Math.random() - 0.5) * directionalSpread;
      const direction = new THREE.Vector2(
        windDir.x * Math.cos(angle) - windDir.y * Math.sin(angle),
        windDir.x * Math.sin(angle) + windDir.y * Math.cos(angle)
      ).normalize();

      // Steepness decreases with wavelength (shorter waves are steeper)
      const steepness = Math.min(0.7, 0.3 + 0.4 * (1 - t));

      const k = TWO_PI / wavelength;
      const omega = this.computeDispersion(k);

      this.waves.push({
        wavelength,
        amplitude: baseAmplitude,
        direction,
        steepness,
        phase: Math.random() * TWO_PI,
        omega,
        k,
      });
    }
  }

  /**
   * Compute dispersion relation omega(k)
   * For deep water: omega = sqrt(g*k)
   * For finite depth: omega = sqrt(g*k*tanh(k*d))
   */
  private computeDispersion(k: number): number {
    const d = this.config.depth;
    if (d > 50 / k) {
      // Deep water approximation
      return Math.sqrt(GRAVITY * k);
    }
    // Finite depth
    return Math.sqrt(GRAVITY * k * Math.tanh(k * d));
  }

  /**
   * Evaluate a single Gerstner wave contribution
   */
  private evaluateWave(
    wave: WaveComponent,
    x: number,
    z: number,
    time: number
  ): { height: number; dx: number; dz: number; nx: number; nz: number } {
    const { k, omega, amplitude, direction, steepness, phase } = wave;

    // Phase angle
    const theta = k * (direction.x * x + direction.y * z) - omega * time + phase;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    // Gerstner wave formulas
    const Q = steepness / (k * amplitude * this.waves.length); // Steepness factor
    const height = amplitude * sinTheta;
    const dx = -Q * amplitude * direction.x * cosTheta;
    const dz = -Q * amplitude * direction.y * cosTheta;

    // Normal contribution (partial derivatives)
    const nx = -direction.x * k * amplitude * cosTheta;
    const nz = -direction.y * k * amplitude * cosTheta;

    return { height, dx, dz, nx, nz };
  }

  /**
   * Evaluate wave field at a position
   */
  public evaluate(x: number, z: number): WaveFieldState {
    let height = 0;
    let dx = 0;
    let dz = 0;
    let nx = 0;
    let nz = 0;
    let vx = 0;
    let vy = 0;
    let vz = 0;
    let ax = 0;
    let ay = 0;
    let az = 0;

    for (const wave of this.waves) {
      const result = this.evaluateWave(wave, x + dx, z + dz, this.time);
      height += result.height;
      dx += result.dx;
      dz += result.dz;
      nx += result.nx;
      nz += result.nz;

      // Particle velocity (orbital motion)
      const theta = wave.k * (wave.direction.x * x + wave.direction.y * z) - wave.omega * this.time + wave.phase;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      vx += wave.omega * wave.amplitude * wave.direction.x * cosTheta;
      vy += wave.omega * wave.amplitude * sinTheta;
      vz += wave.omega * wave.amplitude * wave.direction.y * cosTheta;

      // Particle acceleration
      ax += wave.omega * wave.omega * wave.amplitude * wave.direction.x * sinTheta;
      ay += -wave.omega * wave.omega * wave.amplitude * cosTheta;
      az += wave.omega * wave.omega * wave.amplitude * wave.direction.y * sinTheta;
    }

    // Normalize normal
    const normal = this._tempVec3.set(-nx, 1, -nz).normalize();

    // Calculate breaking factor based on wave steepness
    const breaking = this.calculateBreaking(height, nx, nz);

    return {
      height,
      normal: normal.clone(),
      displacement: this._tempVec2.set(dx, dz).clone(),
      velocity: new THREE.Vector3(vx, vy, vz),
      acceleration: new THREE.Vector3(ax, ay, az),
      breaking,
    };
  }

  /**
   * Calculate wave breaking factor
   * Waves break when steepness exceeds critical value
   */
  private calculateBreaking(_height: number, nx: number, nz: number): number {
    // Steepness is proportional to slope magnitude
    const slopeMagnitude = Math.sqrt(nx * nx + nz * nz);

    // Critical steepness for breaking (Stokes limit)
    const criticalSteepness = 0.142 * TWO_PI; // H/L limit

    // Smooth transition to breaking
    const breakingFactor = Math.max(0, (slopeMagnitude - criticalSteepness * 0.5) / (criticalSteepness * 0.5));

    return Math.min(1, breakingFactor);
  }

  /**
   * Update simulation time
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
   * Set wind parameters and regenerate waves
   */
  public setWind(speed: number, direction?: THREE.Vector2): void {
    this.config.windSpeed = speed;
    if (direction) {
      this.config.windDirection = direction.clone().normalize();
    }
    this.generateWaves();
  }

  /**
   * Set amplitude scale
   */
  public setAmplitudeScale(scale: number): void {
    const ratio = scale / this.config.amplitudeScale;
    for (const wave of this.waves) {
      wave.amplitude *= ratio;
    }
    this.config.amplitudeScale = scale;
  }

  /**
   * Get wave components for shader integration
   */
  public getWaveComponents(): ReadonlyArray<WaveComponent> {
    return this.waves;
  }

  /**
   * Generate GLSL code for Gerstner waves
   */
  public generateGLSL(): string {
    let code = `
// Gerstner wave evaluation
vec3 evaluateGerstnerWaves(vec3 position, float time) {
  vec3 result = vec3(0.0);
  vec3 normal = vec3(0.0, 1.0, 0.0);
`;

    for (let i = 0; i < this.waves.length; i++) {
      const w = this.waves[i];
      code += `
  // Wave ${i}
  {
    float k = ${w.k.toFixed(6)};
    float omega = ${w.omega.toFixed(6)};
    float amplitude = ${w.amplitude.toFixed(6)};
    vec2 direction = vec2(${w.direction.x.toFixed(6)}, ${w.direction.y.toFixed(6)});
    float steepness = ${w.steepness.toFixed(6)};
    float phase = ${w.phase.toFixed(6)};

    float theta = k * (direction.x * position.x + direction.y * position.z) - omega * time + phase;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);

    float Q = steepness / (k * amplitude * ${this.waves.length}.0);
    result.y += amplitude * sinTheta;
    result.x += -Q * amplitude * direction.x * cosTheta;
    result.z += -Q * amplitude * direction.y * cosTheta;
  }
`;
    }

    code += `
  return result;
}
`;

    return code;
  }
}

/**
 * Wave-object interaction utilities
 */
export class WaveInteraction {
  /**
   * Calculate buoyancy force on a floating object
   */
  public static calculateBuoyancy(
    waveSystem: GerstnerWaveSystem,
    position: THREE.Vector3,
    volume: number,
    waterDensity: number = 1025 // kg/m^3 for seawater
  ): THREE.Vector3 {
    const state = waveSystem.evaluate(position.x, position.z);
    const submergedDepth = Math.max(0, state.height - position.y);

    // Buoyancy = rho * g * V_submerged
    const submergedVolume = Math.min(volume, volume * (submergedDepth / 1)); // Simplified
    const buoyancyMagnitude = waterDensity * GRAVITY * submergedVolume;

    return new THREE.Vector3(0, buoyancyMagnitude, 0);
  }

  /**
   * Calculate drag force from wave motion
   */
  public static calculateWaveDrag(
    waveSystem: GerstnerWaveSystem,
    position: THREE.Vector3,
    objectVelocity: THREE.Vector3,
    dragCoefficient: number = 1.0,
    crossSectionalArea: number = 1.0,
    waterDensity: number = 1025
  ): THREE.Vector3 {
    const state = waveSystem.evaluate(position.x, position.z);

    // Relative velocity
    const relativeVelocity = state.velocity.clone().sub(objectVelocity);
    const speed = relativeVelocity.length();

    if (speed < 0.001) {
      return new THREE.Vector3();
    }

    // Drag = 0.5 * rho * Cd * A * v^2
    const dragMagnitude = 0.5 * waterDensity * dragCoefficient * crossSectionalArea * speed * speed;

    return relativeVelocity.normalize().multiplyScalar(dragMagnitude);
  }

  /**
   * Check if a point is underwater
   */
  public static isUnderwater(
    waveSystem: GerstnerWaveSystem,
    position: THREE.Vector3
  ): boolean {
    const state = waveSystem.evaluate(position.x, position.z);
    return position.y < state.height;
  }

  /**
   * Get underwater depth (negative if above water)
   */
  public static getUnderwaterDepth(
    waveSystem: GerstnerWaveSystem,
    position: THREE.Vector3
  ): number {
    const state = waveSystem.evaluate(position.x, position.z);
    return state.height - position.y;
  }
}

/**
 * Wave statistics calculator
 */
export class WaveStatistics {
  /**
   * Calculate significant wave height (H_s)
   * Defined as mean of highest 1/3 of waves
   */
  public static calculateSignificantHeight(waveComponents: ReadonlyArray<WaveComponent>): number {
    // For spectrum-based waves, H_s = 4 * sqrt(m_0)
    // where m_0 is the zeroth moment (total variance)
    let variance = 0;
    for (const wave of waveComponents) {
      variance += 0.5 * wave.amplitude * wave.amplitude;
    }
    return 4 * Math.sqrt(variance);
  }

  /**
   * Calculate peak wave period
   */
  public static calculatePeakPeriod(waveComponents: ReadonlyArray<WaveComponent>): number {
    let maxEnergy = 0;
    let peakPeriod = 0;

    for (const wave of waveComponents) {
      const energy = wave.amplitude * wave.amplitude;
      if (energy > maxEnergy) {
        maxEnergy = energy;
        peakPeriod = TWO_PI / wave.omega;
      }
    }

    return peakPeriod;
  }

  /**
   * Calculate mean wave direction
   */
  public static calculateMeanDirection(waveComponents: ReadonlyArray<WaveComponent>): THREE.Vector2 {
    const meanDir = new THREE.Vector2();

    for (const wave of waveComponents) {
      const energy = wave.amplitude * wave.amplitude;
      meanDir.x += wave.direction.x * energy;
      meanDir.y += wave.direction.y * energy;
    }

    return meanDir.normalize();
  }
}
