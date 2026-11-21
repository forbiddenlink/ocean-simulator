import * as THREE from 'three';
import { OceanCascadeCompute, type CascadeFrame, type CascadeParams } from './OceanCascadeCompute';

/**
 * One Tessendorf FFT cascade on the GPU side: the three textures the ocean shader
 * samples. The math lives in OceanCascadeCompute, normally inside OceanWaveWorker;
 * update() runs it on the main thread only when no worker is available.
 * FFTOcean composites a large swell cascade with a smaller high-frequency cascade.
 */
export class OceanCascade {
  readonly resolution: number;
  readonly size: number;

  readonly params: CascadeParams;

  private compute: OceanCascadeCompute | null = null;
  private heightTexture: THREE.DataTexture;
  private normalTexture: THREE.DataTexture;
  private displacementTexture: THREE.DataTexture;

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

    this.params = {
      resolution,
      size,
      windSpeed,
      windDirection: [windDirection.x, windDirection.y],
      waveAmplitude,
      choppiness,
      smallWaveCutoff,
    };

    const dataSize = resolution * resolution;

    // RG: R = height, G = fold/foam factor from Jacobian
    this.heightTexture = this.createTexture(new Float32Array(dataSize * 2), THREE.RGFormat);
    this.normalTexture = this.createTexture(new Float32Array(dataSize * 4), THREE.RGBAFormat);
    this.displacementTexture = this.createTexture(new Float32Array(dataSize * 4), THREE.RGBAFormat);
  }

  private createTexture(data: Float32Array, format: THREE.PixelFormat): THREE.DataTexture {
    const texture = new THREE.DataTexture(data, this.resolution, this.resolution, format, THREE.FloatType);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
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
    this.params.choppiness = choppiness;
    this.compute?.setChoppiness(choppiness);
  }

  setWind(speed: number, direction: THREE.Vector2): void {
    this.params.windSpeed = speed;
    this.params.windDirection = [direction.x, direction.y];
    this.compute?.setWind(speed, this.params.windDirection);
  }

  setWaveAmplitude(amplitude: number): void {
    this.params.waveAmplitude = amplitude;
    this.compute?.setWaveAmplitude(amplitude);
  }

  /** Compute the surface at `time` on the calling thread. */
  update(time: number): void {
    this.compute ??= new OceanCascadeCompute({ ...this.params });
    this.compute.compute(time, this.currentFrame());
    this.markUpdated();
  }

  /**
   * Show a frame computed elsewhere. Returns the arrays it replaced so the caller
   * can hand them back to the worker for the next frame.
   */
  applyFrame(frame: CascadeFrame): CascadeFrame {
    const previous = this.currentFrame();
    this.heightTexture.image.data = frame.height;
    this.normalTexture.image.data = frame.normal;
    this.displacementTexture.image.data = frame.displacement;
    this.markUpdated();
    return previous;
  }

  private currentFrame(): CascadeFrame {
    return {
      height: this.heightTexture.image.data as Float32Array,
      normal: this.normalTexture.image.data as Float32Array,
      displacement: this.displacementTexture.image.data as Float32Array,
    };
  }

  private markUpdated(): void {
    this.heightTexture.needsUpdate = true;
    this.normalTexture.needsUpdate = true;
    this.displacementTexture.needsUpdate = true;
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

  dispose(): void {
    this.heightTexture.dispose();
    this.normalTexture.dispose();
    this.displacementTexture.dispose();
  }
}
