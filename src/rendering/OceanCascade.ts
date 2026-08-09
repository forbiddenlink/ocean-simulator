import * as THREE from 'three';
import { OceanSpectrum } from './OceanSpectrum';
import { FFT } from '../utils/FFT';

/**
 * One Tessendorf FFT cascade: spectrum → IFFT height/displacement → textures.
 * FFTOcean composites a large swell cascade with a smaller high-frequency cascade.
 */
export class OceanCascade {
  readonly resolution: number;
  readonly size: number;

  private spectrum: OceanSpectrum;
  private fft: FFT;
  private heightField: Float32Array;
  private displacementX: Float32Array;
  private displacementZ: Float32Array;
  private heightTexture: THREE.DataTexture;
  private normalTexture: THREE.DataTexture;
  private displacementTexture: THREE.DataTexture;
  private choppiness: number;
  private _tempNormal = new THREE.Vector3();

  constructor(
    resolution: number,
    size: number,
    windSpeed: number,
    windDirection: THREE.Vector2,
    waveAmplitude: number,
    choppiness: number = 1.5,
    smallWaveCutoff: number = 0.001
  ) {
    this.resolution = resolution;
    this.size = size;
    this.choppiness = choppiness;

    this.spectrum = new OceanSpectrum(
      resolution,
      size,
      windSpeed,
      windDirection,
      waveAmplitude,
      smallWaveCutoff
    );
    this.fft = new FFT(resolution);

    const dataSize = resolution * resolution;
    const complexDataSize = dataSize * 2;
    this.heightField = new Float32Array(complexDataSize);
    this.displacementX = new Float32Array(complexDataSize);
    this.displacementZ = new Float32Array(complexDataSize);

    // RG: R = height, G = fold/foam factor from Jacobian
    this.heightTexture = new THREE.DataTexture(
      new Float32Array(dataSize * 2),
      resolution,
      resolution,
      THREE.RGFormat,
      THREE.FloatType
    );
    this.heightTexture.wrapS = this.heightTexture.wrapT = THREE.RepeatWrapping;
    this.heightTexture.magFilter = this.heightTexture.minFilter = THREE.LinearFilter;
    this.heightTexture.needsUpdate = true;

    this.normalTexture = new THREE.DataTexture(
      new Float32Array(dataSize * 4),
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.normalTexture.wrapS = this.normalTexture.wrapT = THREE.RepeatWrapping;
    this.normalTexture.magFilter = this.normalTexture.minFilter = THREE.LinearFilter;
    this.normalTexture.needsUpdate = true;

    this.displacementTexture = new THREE.DataTexture(
      new Float32Array(dataSize * 4),
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.displacementTexture.wrapS = this.displacementTexture.wrapT = THREE.RepeatWrapping;
    this.displacementTexture.magFilter = this.displacementTexture.minFilter = THREE.LinearFilter;
    this.displacementTexture.needsUpdate = true;
  }

  getHeightTexture(): THREE.DataTexture {
    return this.heightTexture;
  }

  getNormalTexture(): THREE.DataTexture {
    return this.normalTexture;
  }

  getDisplacementTexture(): THREE.DataTexture {
    return this.displacementTexture;
  }

  setChoppiness(choppiness: number): void {
    this.choppiness = choppiness;
  }

  setWind(speed: number, direction: THREE.Vector2): void {
    this.spectrum.setWind(speed, direction);
  }

  setWaveAmplitude(amplitude: number): void {
    this.spectrum.setWaveAmplitude(amplitude);
  }

  update(time: number): void {
    this.spectrum.evaluateSpectrum(time, this.heightField);
    this.computeDisplacement();
    this.fft.ifft2D(this.heightField);
    this.fft.ifft2D(this.displacementX);
    this.fft.ifft2D(this.displacementZ);
    this.updateTextures();
  }

  sampleHeight(worldX: number, worldZ: number): number {
    const N = this.resolution;
    const data = this.heightTexture.image.data as Float32Array;
    let u = worldX / this.size + 0.5;
    let v = worldZ / this.size + 0.5;
    u = ((u % 1) + 1) % 1;
    v = ((v % 1) + 1) % 1;
    const x = Math.min(N - 1, Math.floor(u * N));
    const y = Math.min(N - 1, Math.floor(v * N));
    return data[(y * N + x) * 2] ?? 0;
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

  private updateTextures(): void {
    const N = this.resolution;
    const L = this.size;
    const scale = L / N;
    const chop = this.choppiness;
    const heightData = this.heightTexture.image.data as Float32Array;
    const normalData = this.normalTexture.image.data as Float32Array;
    const dispData = this.displacementTexture.image.data as Float32Array;

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
        this._tempNormal.set(nx, 1.0, nz).normalize();

        normalData[index * 4] = this._tempNormal.x * 0.5 + 0.5;
        normalData[index * 4 + 1] = this._tempNormal.y * 0.5 + 0.5;
        normalData[index * 4 + 2] = this._tempNormal.z * 0.5 + 0.5;
        normalData[index * 4 + 3] = 1;
      }
    }

    this.heightTexture.needsUpdate = true;
    this.normalTexture.needsUpdate = true;
    this.displacementTexture.needsUpdate = true;
  }

  dispose(): void {
    this.heightTexture.dispose();
    this.normalTexture.dispose();
    this.displacementTexture.dispose();
  }
}
