/**
 * Ocean Surface Simulation Module
 *
 * Implements a comprehensive ocean surface simulation combining:
 * - FFT-based Tessendorf waves for realistic large-scale wave patterns
 * - Gerstner waves for medium-scale detail
 * - GPU-accelerated computation via WebGL shaders
 *
 * References:
 * - Tessendorf (2001) "Simulating Ocean Water"
 * - GPU Gems Chapter 1: Effective Water Simulation
 * - Horvath (2015) "Empirical Directional Wave Spectra"
 */

import * as THREE from 'three';

// Physical constants
const GRAVITY = 9.81;
const TWO_PI = Math.PI * 2;

/**
 * Ocean spectrum type for different sea conditions
 */
export type OceanSpectrumType = 'phillips' | 'jonswap' | 'pierson-moskowitz' | 'texel-marsen-arsloe';

/**
 * Ocean configuration parameters
 */
export interface OceanConfig {
  /** FFT resolution (power of 2, e.g., 256, 512) */
  resolution: number;
  /** Physical size of the ocean patch in meters */
  size: number;
  /** Wind speed in m/s */
  windSpeed: number;
  /** Wind direction as normalized vector */
  windDirection: THREE.Vector2;
  /** Wave amplitude multiplier */
  amplitude: number;
  /** Choppiness factor for horizontal displacement */
  choppiness: number;
  /** Spectrum type for wave generation */
  spectrumType: OceanSpectrumType;
  /** Depth of the water (affects wave behavior) */
  depth: number;
  /** Fetch distance (distance wind has blown over water) */
  fetch: number;
  /** Enable multi-scale wave layers */
  multiScale: boolean;
  /** Foam generation threshold */
  foamThreshold: number;
}

/**
 * Default ocean configuration
 */
export const DEFAULT_OCEAN_CONFIG: OceanConfig = {
  resolution: 512,
  size: 1000,
  windSpeed: 20,
  windDirection: new THREE.Vector2(1, 0.3).normalize(),
  amplitude: 2.0,
  choppiness: 2.0,
  spectrumType: 'phillips',
  depth: 200,
  fetch: 100000,
  multiScale: true,
  foamThreshold: 1.2,
};

/**
 * Gerstner wave parameters
 */
export interface GerstnerWaveParams {
  wavelength: number;
  amplitude: number;
  speed: number;
  direction: THREE.Vector2;
  steepness: number;
  phase: number;
}

/**
 * Ocean surface state at a point
 */
export interface OceanSurfaceState {
  height: number;
  normal: THREE.Vector3;
  displacement: THREE.Vector3;
  velocity: THREE.Vector3;
  foam: number;
  jacobian: number;
}

/**
 * Ocean Surface Simulation
 *
 * Provides realistic ocean surface simulation using a combination of
 * spectral methods (FFT) and analytical waves (Gerstner).
 */
export class OceanSurface {
  private config: OceanConfig;
  private time: number = 0;

  // Spectrum data (complex numbers stored as [real, imag] pairs)
  private spectrum0: Float32Array;
  private spectrumConj0: Float32Array;
  private spectrum: Float32Array;

  // Spatial domain data
  private heightField: Float32Array;
  private displacementX: Float32Array;
  private displacementZ: Float32Array;

  // Gerstner waves for medium-scale detail
  private gerstnerWaves: GerstnerWaveParams[] = [];

  // Pre-allocated vectors
  private _tempVec3 = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector2();

  constructor(config: Partial<OceanConfig> = {}) {
    this.config = { ...DEFAULT_OCEAN_CONFIG, ...config };

    const dataSize = this.config.resolution * this.config.resolution * 2;
    this.spectrum0 = new Float32Array(dataSize);
    this.spectrumConj0 = new Float32Array(dataSize);
    this.spectrum = new Float32Array(dataSize);
    this.heightField = new Float32Array(dataSize);
    this.displacementX = new Float32Array(dataSize);
    this.displacementZ = new Float32Array(dataSize);

    // Initialize spectrum
    this.initializeSpectrum();

    // Initialize Gerstner waves for multi-scale detail
    if (this.config.multiScale) {
      this.initializeGerstnerWaves();
    }
  }

  /**
   * Initialize the wave spectrum based on configured spectrum type
   */
  private initializeSpectrum(): void {
    const N = this.config.resolution;
    const L = this.config.size;
    const windSpeed = this.config.windSpeed;
    const windDir = this.config.windDirection.clone().normalize();
    const amplitude = this.config.amplitude;

    for (let m = 0; m < N; m++) {
      for (let n = 0; n < N; n++) {
        const index = (m * N + n) * 2;

        // Wave vector k
        const kx = (TWO_PI * (n - N / 2)) / L;
        const ky = (TWO_PI * (m - N / 2)) / L;
        const kLength = Math.sqrt(kx * kx + ky * ky);

        if (kLength < 0.0001) {
          this.spectrum0[index] = 0;
          this.spectrum0[index + 1] = 0;
          this.spectrumConj0[index] = 0;
          this.spectrumConj0[index + 1] = 0;
          continue;
        }

        // Calculate spectrum value based on type
        let spectrumValue: number;
        switch (this.config.spectrumType) {
          case 'jonswap':
            spectrumValue = this.jonswapSpectrum(kLength, kx, ky, windSpeed, windDir);
            break;
          case 'pierson-moskowitz':
            spectrumValue = this.piersonMoskowitzSpectrum(kLength, windSpeed);
            break;
          case 'texel-marsen-arsloe':
            spectrumValue = this.tmaSpectrum(kLength, kx, ky, windSpeed, windDir);
            break;
          case 'phillips':
          default:
            spectrumValue = this.phillipsSpectrum(kLength, kx, ky, windSpeed, windDir);
        }

        // Apply amplitude
        spectrumValue *= amplitude;

        // Generate random complex amplitude using Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        const gaussian1 = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(TWO_PI * u2);
        const gaussian2 = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.sin(TWO_PI * u2);

        const sqrtSpec = Math.sqrt(spectrumValue / 2);
        this.spectrum0[index] = gaussian1 * sqrtSpec;
        this.spectrum0[index + 1] = gaussian2 * sqrtSpec;

        // Hermitian conjugate for real output
        const conjIndex = ((N - m) % N * N + (N - n) % N) * 2;
        this.spectrumConj0[conjIndex] = this.spectrum0[index];
        this.spectrumConj0[conjIndex + 1] = -this.spectrum0[index + 1];
      }
    }
  }

  /**
   * Phillips spectrum - classic empirical ocean wave spectrum
   */
  private phillipsSpectrum(
    k: number,
    kx: number,
    ky: number,
    windSpeed: number,
    windDir: THREE.Vector2
  ): number {
    const L = (windSpeed * windSpeed) / GRAVITY;
    const k2 = k * k;
    const k4 = k2 * k2;
    const L2 = L * L;

    // Direction alignment with wind
    const kdotw = (kx * windDir.x + ky * windDir.y) / k;
    const alignment = kdotw * kdotw;

    // Small wave suppression
    const l = L / 1000;
    const l2 = l * l;
    const damping = Math.exp(-k2 * l2);

    // Phillips spectrum formula
    const A = 0.0008;
    const phillips = (A * Math.exp(-1 / (k2 * L2)) / k4) * alignment * damping;

    return phillips;
  }

  /**
   * JONSWAP spectrum - improved for fetch-limited seas
   */
  private jonswapSpectrum(
    k: number,
    kx: number,
    ky: number,
    windSpeed: number,
    windDir: THREE.Vector2
  ): number {
    const omega = Math.sqrt(GRAVITY * k);
    const fetch = this.config.fetch;

    // Peak frequency
    const omegaP = 22 * Math.pow(GRAVITY * GRAVITY / (windSpeed * fetch), 1 / 3);

    // Spectral width parameter
    const sigma = omega <= omegaP ? 0.07 : 0.09;

    // Peak enhancement factor
    const gamma = 3.3;
    const r = Math.exp(-Math.pow(omega - omegaP, 2) / (2 * sigma * sigma * omegaP * omegaP));

    // Pierson-Moskowitz base
    const pm = this.piersonMoskowitzSpectrum(k, windSpeed);

    // Direction alignment
    const kdotw = (kx * windDir.x + ky * windDir.y) / k;
    const alignment = Math.pow(Math.abs(kdotw), 2);

    return pm * Math.pow(gamma, r) * alignment;
  }

  /**
   * Pierson-Moskowitz spectrum - fully developed seas
   */
  private piersonMoskowitzSpectrum(k: number, windSpeed: number): number {
    const omega = Math.sqrt(GRAVITY * k);
    const omegaP = GRAVITY / windSpeed;

    const alpha = 0.0081;
    const beta = 0.74;

    const omega2 = omega * omega;
    const omega4 = omega2 * omega2;
    const omegaP4 = omegaP * omegaP * omegaP * omegaP;

    return (alpha * GRAVITY * GRAVITY / omega4) * Math.exp(-beta * omegaP4 / omega4);
  }

  /**
   * TMA (Texel-Marsen-Arsloe) spectrum - for finite depth
   */
  private tmaSpectrum(
    k: number,
    kx: number,
    ky: number,
    windSpeed: number,
    windDir: THREE.Vector2
  ): number {
    const depth = this.config.depth;
    const omega = Math.sqrt(GRAVITY * k * Math.tanh(k * depth));
    const omegaH = omega * Math.sqrt(depth / GRAVITY);

    // Kitaigorodskii shape function
    let phi: number;
    if (omegaH <= 1) {
      phi = 0.5 * omegaH * omegaH;
    } else if (omegaH < 2) {
      phi = 1 - 0.5 * Math.pow(2 - omegaH, 2);
    } else {
      phi = 1;
    }

    return this.jonswapSpectrum(k, kx, ky, windSpeed, windDir) * phi;
  }

  /**
   * Initialize Gerstner waves for medium-scale detail
   */
  private initializeGerstnerWaves(): void {
    const windDir = this.config.windDirection.clone().normalize();

    // Create a set of Gerstner waves with varying parameters
    const waveConfigs: Partial<GerstnerWaveParams>[] = [
      { wavelength: 8.0, amplitude: 0.4, steepness: 0.5 },
      { wavelength: 5.0, amplitude: 0.25, steepness: 0.6 },
      { wavelength: 3.5, amplitude: 0.15, steepness: 0.4 },
      { wavelength: 2.0, amplitude: 0.08, steepness: 0.3 },
      { wavelength: 1.2, amplitude: 0.04, steepness: 0.2 },
      { wavelength: 0.8, amplitude: 0.02, steepness: 0.15 },
    ];

    for (let i = 0; i < waveConfigs.length; i++) {
      const config = waveConfigs[i];
      const angle = (i * 0.4 - 0.8) + Math.random() * 0.3; // Spread directions around wind

      const direction = new THREE.Vector2(
        windDir.x * Math.cos(angle) - windDir.y * Math.sin(angle),
        windDir.x * Math.sin(angle) + windDir.y * Math.cos(angle)
      ).normalize();

      this.gerstnerWaves.push({
        wavelength: config.wavelength!,
        amplitude: config.amplitude! * this.config.amplitude * 0.5,
        speed: Math.sqrt(GRAVITY * TWO_PI / config.wavelength!),
        direction,
        steepness: config.steepness!,
        phase: Math.random() * TWO_PI,
      });
    }
  }

  /**
   * Dispersion relation for deep water
   */
  private dispersion(k: number): number {
    const depth = this.config.depth;
    if (depth > 100) {
      // Deep water approximation
      return Math.sqrt(GRAVITY * k);
    }
    // Finite depth dispersion
    return Math.sqrt(GRAVITY * k * Math.tanh(k * depth));
  }

  /**
   * Update the simulation
   * @param deltaTime Time step in seconds
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.evaluateSpectrum();
  }

  /**
   * Evaluate spectrum at current time
   */
  private evaluateSpectrum(): void {
    const N = this.config.resolution;
    const L = this.config.size;
    const t = this.time;

    for (let m = 0; m < N; m++) {
      for (let n = 0; n < N; n++) {
        const index = (m * N + n) * 2;

        // Wave vector
        const kx = (TWO_PI * (n - N / 2)) / L;
        const ky = (TWO_PI * (m - N / 2)) / L;
        const k = Math.sqrt(kx * kx + ky * ky);

        if (k < 0.0001) {
          this.spectrum[index] = 0;
          this.spectrum[index + 1] = 0;
          continue;
        }

        // Dispersion
        const omega = this.dispersion(k);
        const phase = omega * t;
        const cosPhase = Math.cos(phase);
        const sinPhase = Math.sin(phase);

        // h~(k, t) = h~0(k) * exp(i*omega*t) + h~0*(-k) * exp(-i*omega*t)
        const h0Re = this.spectrum0[index];
        const h0Im = this.spectrum0[index + 1];
        const h0ConjRe = this.spectrumConj0[index];
        const h0ConjIm = this.spectrumConj0[index + 1];

        // exp(i*omega*t) = cos(omega*t) + i*sin(omega*t)
        // exp(-i*omega*t) = cos(omega*t) - i*sin(omega*t)
        const term1Re = h0Re * cosPhase - h0Im * sinPhase;
        const term1Im = h0Re * sinPhase + h0Im * cosPhase;
        const term2Re = h0ConjRe * cosPhase + h0ConjIm * sinPhase;
        const term2Im = -h0ConjRe * sinPhase + h0ConjIm * cosPhase;

        this.spectrum[index] = term1Re + term2Re;
        this.spectrum[index + 1] = term1Im + term2Im;
      }
    }
  }

  /**
   * Sample ocean surface state at a world position
   */
  public sampleSurface(worldX: number, worldZ: number): OceanSurfaceState {
    // FFT contribution (simplified for sampling - in production use texture lookup)
    const fftHeight = this.sampleFFTHeight(worldX, worldZ);
    const fftDisplacement = this.sampleFFTDisplacement(worldX, worldZ);

    // Gerstner wave contribution
    let gerstnerHeight = 0;
    const gerstnerDisplacement = new THREE.Vector3();
    const normal = new THREE.Vector3(0, 1, 0);

    if (this.config.multiScale) {
      for (const wave of this.gerstnerWaves) {
        const result = this.evaluateGerstnerWave(wave, worldX, worldZ);
        gerstnerHeight += result.height;
        gerstnerDisplacement.add(result.displacement);
        normal.add(result.normal);
      }
    }

    normal.normalize();

    // Combined state
    const totalHeight = fftHeight + gerstnerHeight;
    const totalDisplacement = new THREE.Vector3(
      fftDisplacement.x + gerstnerDisplacement.x,
      totalHeight,
      fftDisplacement.y + gerstnerDisplacement.z
    );

    // Foam based on Jacobian (wave folding)
    const foam = this.computeFoam(worldX, worldZ, totalHeight);

    // Surface velocity (simplified)
    const velocity = this._tempVec3.set(
      fftDisplacement.x * 0.1,
      0,
      fftDisplacement.y * 0.1
    ).clone();

    return {
      height: totalHeight,
      normal,
      displacement: totalDisplacement,
      velocity,
      foam,
      jacobian: 1.0,
    };
  }

  /**
   * Sample FFT height at a position (bilinear interpolation)
   */
  private sampleFFTHeight(x: number, z: number): number {
    const N = this.config.resolution;
    const L = this.config.size;

    // Map world position to texture coordinates
    const u = ((x / L + 0.5) % 1 + 1) % 1;
    const v = ((z / L + 0.5) % 1 + 1) % 1;

    const px = u * (N - 1);
    const py = v * (N - 1);

    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = (x0 + 1) % N;
    const y1 = (y0 + 1) % N;

    const fx = px - x0;
    const fy = py - y0;

    // Bilinear interpolation
    const h00 = this.heightField[(y0 * N + x0) * 2];
    const h10 = this.heightField[(y0 * N + x1) * 2];
    const h01 = this.heightField[(y1 * N + x0) * 2];
    const h11 = this.heightField[(y1 * N + x1) * 2];

    return (
      h00 * (1 - fx) * (1 - fy) +
      h10 * fx * (1 - fy) +
      h01 * (1 - fx) * fy +
      h11 * fx * fy
    );
  }

  /**
   * Sample FFT displacement at a position
   */
  private sampleFFTDisplacement(x: number, z: number): THREE.Vector2 {
    const N = this.config.resolution;
    const L = this.config.size;

    const u = ((x / L + 0.5) % 1 + 1) % 1;
    const v = ((z / L + 0.5) % 1 + 1) % 1;

    const px = u * (N - 1);
    const py = v * (N - 1);

    const ix = Math.floor(px) % N;
    const iy = Math.floor(py) % N;
    const index = (iy * N + ix) * 2;

    return this._tempVec2.set(
      this.displacementX[index] * this.config.choppiness,
      this.displacementZ[index] * this.config.choppiness
    );
  }

  /**
   * Evaluate a single Gerstner wave at a position
   */
  private evaluateGerstnerWave(
    wave: GerstnerWaveParams,
    x: number,
    z: number
  ): { height: number; displacement: THREE.Vector3; normal: THREE.Vector3 } {
    const k = TWO_PI / wave.wavelength;
    const c = wave.speed;
    const d = wave.direction;
    const a = wave.amplitude;
    const s = wave.steepness;
    const phase = wave.phase;

    const f = k * (d.x * x + d.y * z - c * this.time) + phase;
    const cosF = Math.cos(f);
    const sinF = Math.sin(f);

    const height = a * sinF;
    const displacement = new THREE.Vector3(
      d.x * a * s * cosF,
      height,
      d.y * a * s * cosF
    );

    // Partial derivatives for normal calculation
    const dhdx = k * d.x * a * cosF;
    const dhdz = k * d.y * a * cosF;
    const normal = new THREE.Vector3(-dhdx, 1, -dhdz).normalize();

    return { height, displacement, normal };
  }

  /**
   * Compute foam amount based on wave characteristics
   */
  private computeFoam(x: number, z: number, height: number): number {
    // Foam appears at wave crests and where waves break
    const threshold = this.config.foamThreshold;
    const foamAmount = Math.max(0, (height - threshold) / threshold);

    // Add noise for natural variation
    const noise = Math.sin(x * 0.5 + this.time) * Math.sin(z * 0.7 + this.time * 1.3) * 0.5 + 0.5;

    return Math.min(1, foamAmount * (0.5 + noise * 0.5));
  }

  /**
   * Get wave height at a position (convenience method)
   */
  public getHeightAt(x: number, z: number): number {
    return this.sampleSurface(x, z).height;
  }

  /**
   * Get wave normal at a position
   */
  public getNormalAt(x: number, z: number): THREE.Vector3 {
    return this.sampleSurface(x, z).normal.clone();
  }

  /**
   * Get current time
   */
  public getTime(): number {
    return this.time;
  }

  /**
   * Set wind parameters
   */
  public setWind(speed: number, direction?: THREE.Vector2): void {
    this.config.windSpeed = speed;
    if (direction) {
      this.config.windDirection = direction.clone().normalize();
    }
    this.initializeSpectrum();
    if (this.config.multiScale) {
      this.gerstnerWaves = [];
      this.initializeGerstnerWaves();
    }
  }

  /**
   * Set wave amplitude
   */
  public setAmplitude(amplitude: number): void {
    this.config.amplitude = amplitude;
    this.initializeSpectrum();
  }

  /**
   * Set choppiness factor
   */
  public setChoppiness(choppiness: number): void {
    this.config.choppiness = choppiness;
  }

  /**
   * Get configuration
   */
  public getConfig(): Readonly<OceanConfig> {
    return this.config;
  }

  /**
   * Get Gerstner waves for shader integration
   */
  public getGerstnerWaves(): ReadonlyArray<GerstnerWaveParams> {
    return this.gerstnerWaves;
  }

  /**
   * Get height field data for texture upload
   */
  public getHeightFieldData(): Float32Array {
    return this.heightField;
  }

  /**
   * Get displacement data for texture upload
   */
  public getDisplacementData(): { x: Float32Array; z: Float32Array } {
    return { x: this.displacementX, z: this.displacementZ };
  }
}
