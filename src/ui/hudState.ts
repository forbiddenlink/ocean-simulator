/**
 * Pure HUD helpers, kept free of DOM access so they can be unit tested in node.
 */

/** Shown in place of a count until the first entities exist. */
export const HUD_PLACEHOLDER = '–';

export interface HudTotalState {
  /** True once at least one entity has spawned. Latched by the caller. */
  ready: boolean;
  /** Text for the big total counter. */
  totalText: string;
  /** Text for the label next to the total. */
  label: string;
}

/**
 * Decide what the total counter and its label show.
 * Before data is ready the counter shows a placeholder instead of a misleading 0.
 */
export function getHudTotalState(total: number, hasSpawned: boolean): HudTotalState {
  const ready = hasSpawned || (Number.isFinite(total) && total > 0);
  if (!ready) {
    return { ready: false, totalText: HUD_PLACEHOLDER, label: 'Loading ocean life' };
  }
  return { ready: true, totalText: formatHudCount(total), label: 'Living entities' };
}

/** Format a population count for display. Invalid values render as the placeholder. */
export function formatHudCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return HUD_PLACEHOLDER;
  return String(Math.round(value));
}

/**
 * Whether the HUD stats should refresh now. Uses wall-clock time, not simulation time:
 * simulation delta is clamped per frame and is zero while paused, so a sim-time timer
 * starves on slow renderers (software GL) and never fires at all when paused.
 * The first refresh is immediate (lastUpdateMs of null).
 */
export function shouldRefreshStats(
  nowMs: number,
  lastUpdateMs: number | null,
  intervalMs = 1000,
): boolean {
  return lastUpdateMs === null || nowMs - lastUpdateMs >= intervalMs;
}

/** Build a sortable, filesystem-safe filename such as ocean-simulator-20261127-142530.png. */
export function buildCaptureFilename(date: Date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const stamp =
    `${p(date.getFullYear(), 4)}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `ocean-simulator-${stamp}.png`;
}
