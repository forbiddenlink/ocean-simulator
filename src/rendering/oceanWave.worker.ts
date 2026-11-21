import { OceanCascadeCompute, type CascadeFrame, type CascadeParams } from './OceanCascadeCompute';

/** Messages the main thread sends to the wave worker. */
export type WaveWorkerRequest =
  | { type: 'init'; generation: number; cascades: CascadeParams[] }
  | { type: 'choppiness'; values: number[] }
  | { type: 'compute'; generation: number; time: number; frames: CascadeFrame[] };

/** Message the wave worker sends back: one filled frame per cascade. */
export interface WaveWorkerResult {
  generation: number;
  frames: CascadeFrame[];
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WaveWorkerRequest>) => void) | null;
  postMessage(message: WaveWorkerResult, transfer: ArrayBuffer[]): void;
};

let cascades: OceanCascadeCompute[] = [];
let generation = 0;

ctx.onmessage = (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      generation = msg.generation;
      cascades = msg.cascades.map((params) => new OceanCascadeCompute(params));
      break;
    case 'choppiness':
      msg.values.forEach((value, i) => cascades[i]?.setChoppiness(value));
      break;
    case 'compute': {
      // A compute queued before a re-init belongs to cascades that no longer exist.
      if (msg.generation !== generation) return;
      msg.frames.forEach((frame, i) => cascades[i].compute(msg.time, frame));
      const transfer = msg.frames.flatMap((f) => [
        f.height.buffer as ArrayBuffer,
        f.normal.buffer as ArrayBuffer,
        f.displacement.buffer as ArrayBuffer,
      ]);
      ctx.postMessage({ generation, frames: msg.frames }, transfer);
      break;
    }
  }
};
