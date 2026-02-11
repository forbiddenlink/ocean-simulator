import * as THREE from 'three';

/**
 * Ocean wave spectrum generator using Phillips spectrum
 * Based on Tessendorf's "Simulating Ocean Water" (2001)
 * and validated by jbouny/ocean production implementation
 */
export class OceanSpectrum {
  private resolution: number;
  private size: number;
  private windSpeed: number;
  private windDirection: THREE.Vector2;
  private gravity: number;
  private waveAmplitude: number;
  private suppressionFactor: number;

  // Spectrum data
  private h0: Float32Array;  // Initial height field
  private h0Conj: Float32Array;  // Complex conjugate
  private omega: Float32Array;  // Angular frequencies

  constructor(
    resolution: number = 512,
    size: number = 1000,
    windSpeed: number = 20,
    windDirection: THREE.Vector2 = new THREE.Vector2(1, 0),
    waveAmplitude: number = 2.0
  ) {
    this.resolution = resolution;
    this.size = size;
    this.windSpeed = windSpeed;
    this.windDirection = windDirection.normalize();
    this.gravity = 9.81;
    this.waveAmplitude = waveAmplitude;
    this.suppressionFactor = 0.07; // Suppress waves against wind

    // Allocate arrays
    const dataSize = resolution * resolution * 2; // Complex numbers (real, imag)
    this.h0 = new Float32Array(dataSize);
    this.h0Conj = new Float32Array(dataSize);
    this.omega = new Float32Array(resolution * resolution);

    // Generate initial spectrum
    this.generateSpectrum();
  }

  /**
   * Generate initial wave spectrum using Phillips spectrum
   */
  private generateSpectrum(): void {
    const N = this.resolution;
    const L = this.size;
    const V = this.windSpeed;
    const g = this.gravity;
    const A = this.waveAmplitude;

    // L_max = V² / g (largest wave length)
    const L_max = (V * V) / g;

    for (let m = 0; m < N; m++) {
      for (let n = 0; n < N; n++) {
        const index = m * N + n;
        const dataIndex = index * 2;

        // Wave vector k
        const kx = (2.0 * Math.PI * (n - N / 2)) / L;
        const ky = (2.0 * Math.PI * (m - N / 2)) / L;

        // Wave number magnitude
        const k_length = Math.sqrt(kx * kx + ky * ky);

        if (k_length < 0.0001) {
          // DC component (k = 0)
          this.h0[dataIndex] = 0;
          this.h0[dataIndex + 1] = 0;
          this.h0Conj[dataIndex] = 0;
          this.h0Conj[dataIndex + 1] = 0;
          this.omega[index] = 0;
          continue;
        }

        // Phillips spectrum
        const phillips = this.phillipsSpectrum(kx, ky, k_length, L_max, A);

        // Generate complex Gaussian random variable
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const sqrt_phillips = Math.sqrt(phillips);

        const xi_real = sqrt_phillips * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const xi_imag = sqrt_phillips * Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

        // h0(k) = 1/√2 * ξ * √P(k)
        this.h0[dataIndex] = xi_real / Math.SQRT2;
        this.h0[dataIndex + 1] = xi_imag / Math.SQRT2;

        // h0*(-k) - complex conjugate for symmetry
        this.h0Conj[dataIndex] = xi_real / Math.SQRT2;
        this.h0Conj[dataIndex + 1] = -xi_imag / Math.SQRT2;

        // Dispersion relation: ω(k) = √(g|k|)
        this.omega[index] = Math.sqrt(g * k_length);
      }
    }
  }

  /**
   * Phillips spectrum P(k)
   * P(k) = A * exp(-1/(kL)²) / k⁴ * |k·ŵ|²
   */
  private phillipsSpectrum(
    kx: number,
    ky: number,
    k_length: number,
    L_max: number,
    A: number
  ): number {
    const k2 = k_length * k_length;
    const k4 = k2 * k2;

    const L2 = L_max * L_max;

    // Exponential term
    const exp_term = Math.exp(-1.0 / (k2 * L2));

    // Directional term: |k · wind_direction|²
    const k_dot_w = kx * this.windDirection.x + ky * this.windDirection.y;
    const k_dot_w_2 = k_dot_w * k_dot_w;

    // Suppress waves moving perpendicular or against wind
    let damping = 1.0;
    if (k_dot_w < 0.0) {
      damping = this.suppressionFactor;
    }

    // Phillips spectrum
    const phillips = (A * exp_term / k4) * k_dot_w_2 * damping;

    // Suppress very small waves (optional, prevents aliasing)
    const l = 0.001; // Small wavelength cutoff
    const l2 = l * l;
    const suppress_small = Math.exp(-k2 * l2);

    return phillips * suppress_small;
  }

  /**
   * Evaluate spectrum at time t
   * h(k, t) = h0(k) * exp(iωt) + h0*(-k) * exp(-iωt)
   */
  public evaluateSpectrum(time: number, output: Float32Array): void {
    const N = this.resolution;

    for (let m = 0; m < N; m++) {
      for (let n = 0; n < N; n++) {
        const index = m * N + n;
        const dataIndex = index * 2;

        const omega_t = this.omega[index] * time;

        // h0(k)
        const h0_real = this.h0[dataIndex];
        const h0_imag = this.h0[dataIndex + 1];

        // h0*(-k)
        const h0_conj_real = this.h0Conj[dataIndex];
        const h0_conj_imag = this.h0Conj[dataIndex + 1];

        // exp(iωt)
        const cos_omega = Math.cos(omega_t);
        const sin_omega = Math.sin(omega_t);

        // h0(k) * exp(iωt)
        const term1_real = h0_real * cos_omega - h0_imag * sin_omega;
        const term1_imag = h0_real * sin_omega + h0_imag * cos_omega;

        // h0*(-k) * exp(-iωt)
        const term2_real = h0_conj_real * cos_omega + h0_conj_imag * sin_omega;
        const term2_imag = -h0_conj_real * sin_omega + h0_conj_imag * cos_omega;

        // Sum
        output[dataIndex] = term1_real + term2_real;
        output[dataIndex + 1] = term1_imag + term2_imag;
      }
    }
  }

  /**
   * Get spectrum resolution
   */
  public getResolution(): number {
    return this.resolution;
  }

  /**
   * Get physical size
   */
  public getSize(): number {
    return this.size;
  }

  /**
   * Update wind parameters
   */
  public setWind(speed: number, direction: THREE.Vector2): void {
    this.windSpeed = speed;
    this.windDirection = direction.normalize();
    this.generateSpectrum(); // Regenerate with new wind
  }

  /**
   * Get wave amplitude
   */
  public getWaveAmplitude(): number {
    return this.waveAmplitude;
  }

  /**
   * Set wave amplitude
   */
  public setWaveAmplitude(amplitude: number): void {
    this.waveAmplitude = amplitude;
    this.generateSpectrum();
  }

  /**
   * Get wind direction
   */
  public getWindDirection(): THREE.Vector2 {
    return this.windDirection.clone();
  }
}
