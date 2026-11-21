import type { OceanCascade } from './OceanCascade';
import { allocateCascadeFrame, type CascadeFrame } from './OceanCascadeCompute';
import type { WaveWorkerRequest, WaveWorkerResult } from './oceanWave.worker';

/**
 * Runs the FFT cascades on a worker thread so the wave update (about 17 ms for the
 * 256² and 128² cascades) never blocks a rendered frame.
 *
 * One set of arrays sits in the textures while the other is in the worker; buffers are
 * transferred, not copied. The worker owns the only spectrum, so its random phases
 * never disagree with a main-thread copy.
 */
export class OceanWaveWorker {
  /** True once the worker failed to start or crashed; the caller falls back to update(). */
  failed = false;

  private worker: Worker;
  private cascades: OceanCascade[] = [];
  private spare: CascadeFrame[] | null = null;
  private busy = false;
  private generation = 0;
  private hasFrame = false;

  constructor(cascades: OceanCascade[]) {
    this.worker = new Worker(new URL('./oceanWave.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WaveWorkerResult>) => this.onResult(event.data);
    this.worker.onerror = (event) => {
      event.preventDefault();
      console.warn('Ocean wave worker failed; computing waves on the main thread.', event.message);
      this.failed = true;
    };
    this.reset(cascades);
  }

  /** True after the first worker frame reached the textures. */
  get ready(): boolean {
    return this.hasFrame;
  }

  /** Rebuild the worker's cascades from the current parameters (new spectrum). */
  reset(cascades: OceanCascade[]): void {
    this.cascades = cascades;
    this.generation++;
    this.busy = false;
    this.spare = cascades.map((c) => allocateCascadeFrame(c.resolution));
    this.post({
      type: 'init',
      generation: this.generation,
      cascades: cascades.map((c) => ({ ...c.params, windDirection: [...c.params.windDirection] })),
    });
  }

  setChoppiness(values: number[]): void {
    this.post({ type: 'choppiness', values });
  }

  /** Ask for the surface at `time`. Ignored while the previous frame is still computing. */
  request(time: number): void {
    if (this.busy || this.failed || !this.spare) return;
    const frames = this.spare;
    this.spare = null;
    this.busy = true;
    const transfer = frames.flatMap((f) => [
      f.height.buffer as ArrayBuffer,
      f.normal.buffer as ArrayBuffer,
      f.displacement.buffer as ArrayBuffer,
    ]);
    this.post({ type: 'compute', generation: this.generation, time, frames }, transfer);
  }

  dispose(): void {
    this.worker.terminate();
  }

  private onResult(result: WaveWorkerResult): void {
    // Frames from before a reset have the old resolution; reset() already allocated new ones.
    if (result.generation !== this.generation) return;
    this.spare = result.frames.map((frame, i) => this.cascades[i].applyFrame(frame));
    this.busy = false;
    this.hasFrame = true;
  }

  private post(message: WaveWorkerRequest, transfer: ArrayBuffer[] = []): void {
    this.worker.postMessage(message, transfer);
  }
}
