/**
 * Picks a render scale (a multiplier on the pixel ratio) that keeps frames inside the
 * refresh interval.
 *
 * A fixed pixel budget cannot fit every machine: on an M4 Pro at 1512x900 the old
 * budget of 2.3M pixels made one frame in eight miss the 60 Hz refresh, while 1.8M
 * pixels made almost none miss. The cost is not linear in pixels, so the controller
 * measures and steps instead of predicting.
 *
 * It reads animation-frame deltas, not GPU timer queries: on Apple GPUs
 * EXT_disjoint_timer_query reported 17 to 23 ms per frame while every frame still
 * arrived on time, because the tiled GPU overlaps work from consecutive frames.
 * Deltas wait for vsync, so they show when frames are late but not how much headroom
 * is left. The controller therefore lowers the scale on late frames and raises it
 * only by cautious probes that stay under any scale that has already missed, and
 * waits longer between probes after each miss.
 */
export interface DynamicResolutionOptions {
  /** Frame budget in ms (16.7 for 60 fps). */
  targetMs: number;
  /** Frames to skip at start, where shader compiles and texture uploads spike. */
  warmupFrames?: number;
  /** Frames per decision. */
  windowFrames?: number;
  /** Clean windows in a row before probing a higher scale. */
  probeWindows?: number;
  /** Lowest scale allowed; below this the image gets too soft. */
  minScale?: number;
}

/** A frame counts as late when it took this many budgets. */
const LATE_FRAME = 1.5;
/**
 * Frames longer than this many budgets are hitches (shader compiles, texture uploads,
 * garbage collection), not fill-rate misses, which hold a frame for one extra refresh.
 * A lower resolution does not shorten a hitch, so these count only when most frames
 * in a window are this slow, which means the GPU is far too slow for the scale.
 */
const HITCH_FRAME = 2.5;
/** Lower when a window has more late frames than this; one is a stray pause. */
const MAX_LATE_FRAMES = 1;
const STEP_DOWN = 0.9;
const STEP_UP = 1.05;
/** Probes stay this far under the lowest scale that has missed the refresh. */
const CEILING_MARGIN = 0.95;
/** Each late window doubles the clean time needed before the next probe, up to this. */
const MAX_PROBE_BACKOFF = 8;
/** Gaps longer than this are a paused or hidden tab, not slow rendering. */
const PAUSE_MS = 100;

export class DynamicResolution {
  public scale = 1;

  private readonly targetMs: number;
  private readonly warmupFrames: number;
  private readonly windowFrames: number;
  private readonly probeWindows: number;
  private readonly minScale: number;
  private seen = 0;
  private frames = 0;
  private lateFrames = 0;
  private slowFrames = 0;
  private cleanWindows = 0;
  private probeBackoff = 1;
  /** Scale before the current probe; a failed probe returns here. */
  private beforeProbe: number | null = null;
  /** Lowest scale that has missed the refresh; the scale stays below it. */
  private ceiling = Infinity;

  constructor(options: DynamicResolutionOptions) {
    this.targetMs = options.targetMs;
    this.warmupFrames = options.warmupFrames ?? 120;
    this.windowFrames = options.windowFrames ?? 120;
    this.probeWindows = options.probeWindows ?? 5;
    this.minScale = options.minScale ?? 0.5;
  }

  /** Feeds the time between two animation frames. Returns true when the scale changed. */
  public addFrameDelta(ms: number): boolean {
    if (ms > PAUSE_MS) return false;
    this.seen++;
    if (this.seen <= this.warmupFrames) return false;
    this.frames++;
    if (ms > this.targetMs * LATE_FRAME) {
      this.slowFrames++;
      if (ms <= this.targetMs * HITCH_FRAME) this.lateFrames++;
    }
    if (this.frames < this.windowFrames) return false;

    const late = this.lateFrames > MAX_LATE_FRAMES || this.slowFrames > this.windowFrames / 2;
    this.frames = 0;
    this.lateFrames = 0;
    this.slowFrames = 0;

    if (late) {
      this.cleanWindows = 0;
      this.ceiling = Math.min(this.ceiling, this.scale);
      // The flythrough moves between light and heavy views, so a scale can pass for a
      // while and miss later. Back off so the controller does not keep paying for probes.
      this.probeBackoff = Math.min(MAX_PROBE_BACKOFF, this.probeBackoff * 2);
      const next = this.beforeProbe ?? this.scale * STEP_DOWN;
      this.beforeProbe = null;
      return this.setScale(next);
    }

    this.beforeProbe = null;
    this.cleanWindows++;
    if (this.cleanWindows < this.probeWindows * this.probeBackoff) return false;
    this.cleanWindows = 0;
    const next = Math.min(1, this.scale * STEP_UP, this.ceiling * CEILING_MARGIN);
    if (next <= this.scale) return false;
    const before = this.scale;
    if (!this.setScale(next)) return false;
    this.beforeProbe = before;
    return true;
  }

  /** Starts learning again, for example after a resize changes the pixel count. */
  public reset(): void {
    this.seen = 0;
    this.frames = 0;
    this.lateFrames = 0;
    this.slowFrames = 0;
    this.cleanWindows = 0;
    this.beforeProbe = null;
    this.ceiling = Infinity;
    this.probeBackoff = 1;
  }

  private setScale(next: number): boolean {
    const clamped = Math.min(1, Math.max(this.minScale, next));
    if (Math.abs(clamped - this.scale) < 0.005) return false;
    this.scale = clamped;
    return true;
  }
}
