import * as THREE from 'three';
import { OceanSpectrum } from './OceanSpectrum';
import { FFT } from '../utils/FFT';

/** Everything needed to build one cascade; plain data so it can cross a worker boundary. */
export interface CascadeParams {
  resolution: number;
  size: number;
  windSpeed: number;
  windDirection: [number, number];
  waveAmplitude: number;
  choppiness: number;
  smallWaveCutoff: number;
}

/**
 * Texel data for one cascade update, laid out exactly as the textures expect.
 * height: RG (R = height, G = foam from the Jacobian); normal and displacement: RGBA.
 */
export interface CascadeFrame {
  height: Float32Array;
  normal: Float32Array;
  displacement: Float32Array;
}

export function allocateCascadeFrame(resolution: number): CascadeFrame {
  const texels = resolution * resolution;
  return {
    height: new Float32Array(texels * 2),
    normal: new Float32Array(texels * 4),
    displacement: new Float32Array(texels * 4),
  };
}

/**
 * The math of one Tessendorf cascade: spectrum at time t, inverse FFTs, then height,
 * choppy displacement, normals and foam. Holds no GPU resources, so it runs the same
 * on the main thread or in a worker.
 */
export class OceanCascadeCompute {
  readonly resolution: number;
  readonly size: number;

  private spectrum: OceanSpectrum;
  private fft: FFT;
  private heightField: Float32Array;
  private displacementX: Float32Array;
  private displacementZ: Float32Array;
  private choppiness: number;

  constructor(params: CascadeParams) {
    this.resolution = params.resolution;
    this.size = params.size;
    this.choppiness = params.choppiness;

    this.spectrum = new OceanSpectrum(
      params.resolution,
      params.size,
      params.windSpeed,
      new THREE.Vector2(params.windDirection[0], params.windDirection[1]),
      params.waveAmplitude,
      params.smallWaveCutoff
    );
    this.fft = new FFT(params.resolution);

    const complexDataSize = params.resolution * params.resolution * 2;
    this.heightField = new Float32Array(complexDataSize);
    this.displacementX = new Float32Array(complexDataSize);
    this.displacementZ = new Float32Array(complexDataSize);
  }

  setChoppiness(choppiness: number): void {
    this.choppiness = choppiness;
  }

  setWind(speed: number, direction: [number, number]): void {
    this.spectrum.setWind(speed, new THREE.Vector2(direction[0], direction[1]));
  }

  setWaveAmplitude(amplitude: number): void {
    this.spectrum.setWaveAmplitude(amplitude);
  }

  /** Fill `out` with the surface at `time`. */
  compute(time: number, out: CascadeFrame): void {
    this.spectrum.evaluateSpectrum(time, this.heightField);
    this.computeDisplacement();
    this.fft.ifft2D(this.heightField);
    this.fft.ifft2D(this.displacementX);
    this.fft.ifft2D(this.displacementZ);
    this.writeFrame(out);
  }

  private computeDisplacement(): void {
    const N = this.resolution;
    const L = this.size;

    for (let m = 0; m < N; m++) {
      for (let n = 0; n < N; n++) {
        const index = m * N + n;
        const dataIndex = index * 2;

        const kx = (2.0 * Math.PI * (n - N / 2)) / L;
        const ky = (2.0 * Math.PI * (m - N / 2)) / L;
        const kLength = Math.sqrt(kx * kx + ky * ky);

        if (kLength < 0.0001) {
          this.displacementX[dataIndex] = 0;
          this.displacementX[dataIndex + 1] = 0;
          this.displacementZ[dataIndex] = 0;
          this.displacementZ[dataIndex + 1] = 0;
          continue;
        }

        const hReal = this.heightField[dataIndex];
        const hImag = this.heightField[dataIndex + 1];

        // -i * (k̂) * h → (imag, -real) scaled by direction
        this.displacementX[dataIndex] = hImag * (kx / kLength);
        this.displacementX[dataIndex + 1] = -hReal * (kx / kLength);
        this.displacementZ[dataIndex] = hImag * (ky / kLength);
        this.displacementZ[dataIndex + 1] = -hReal * (ky / kLength);
      }
    }
  }

  private writeFrame(out: CascadeFrame): void {
    const N = this.resolution;
    const L = this.size;
    const scale = L / N;
    const chop = this.choppiness;
    const heightData = out.height;
    const normalData = out.normal;
    const dispData = out.displacement;

    // First pass: height + displacement
    for (let i = 0; i < N * N; i++) {
      heightData[i * 2] = this.heightField[i * 2];
      dispData[i * 4] = this.displacementX[i * 2];
      dispData[i * 4 + 1] = 0;
      dispData[i * 4 + 2] = this.displacementZ[i * 2];
      dispData[i * 4 + 3] = 1;
    }

    // Second pass: normals from height+choppy displacement, foam from Jacobian
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const index = y * N + x;
        const xL = (x - 1 + N) % N;
        const xR = (x + 1) % N;
        const yD = (y - 1 + N) % N;
        const yU = (y + 1) % N;

        const hL = heightData[(y * N + xL) * 2];
        const hR = heightData[(y * N + xR) * 2];
        const hD = heightData[(yD * N + x) * 2];
        const hU = heightData[(yU * N + x) * 2];

        const dxL = dispData[(y * N + xL) * 4];
        const dxR = dispData[(y * N + xR) * 4];
        const dzD = dispData[(yD * N + x) * 4 + 2];
        const dzU = dispData[(yU * N + x) * 4 + 2];
        const dxD = dispData[(yD * N + x) * 4];
        const dxU = dispData[(yU * N + x) * 4];
        const dzL = dispData[(y * N + xL) * 4 + 2];
        const dzR = dispData[(y * N + xR) * 4 + 2];

        // Spatial derivatives including choppiness (Tessendorf)
        const dHdx = (hR - hL) / (2 * scale);
        const dHdz = (hU - hD) / (2 * scale);
        const dDx_dx = ((dxR - dxL) / (2 * scale)) * chop;
        const dDz_dz = ((dzU - dzD) / (2 * scale)) * chop;
        const dDx_dz = ((dxU - dxD) / (2 * scale)) * chop;
        const dDz_dx = ((dzR - dzL) / (2 * scale)) * chop;

        // Jacobian fold → foam when J < ~0
        const jacobian = (1 + dDx_dx) * (1 + dDz_dz) - dDx_dz * dDz_dx;
        const foam = Math.max(0, Math.min(1, -jacobian * 1.8 + 0.15));
        heightData[index * 2 + 1] = foam;

        // Normal from displaced surface: approximate with height slopes + lateral stretch
        const nx = -(dHdx / Math.max(0.15, 1 + dDx_dx));
        const nz = -(dHdz / Math.max(0.15, 1 + dDz_dz));
        const invLen = 1 / Math.sqrt(nx * nx + 1 + nz * nz);

        normalData[index * 4] = nx * invLen * 0.5 + 0.5;
        normalData[index * 4 + 1] = invLen * 0.5 + 0.5;
        normalData[index * 4 + 2] = nz * invLen * 0.5 + 0.5;
        normalData[index * 4 + 3] = 1;
      }
    }
  }
}
