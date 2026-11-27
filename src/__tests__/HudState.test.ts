import { describe, expect, it } from 'vitest';
import {
  HUD_PLACEHOLDER,
  buildCaptureFilename,
  formatHudCount,
  getHudTotalState,
  shouldRefreshStats,
} from '../ui/hudState';

describe('getHudTotalState', () => {
  it('shows a placeholder and loading label before anything has spawned', () => {
    const s = getHudTotalState(0, false);
    expect(s.ready).toBe(false);
    expect(s.totalText).toBe(HUD_PLACEHOLDER);
    expect(s.totalText).not.toBe('0');
    expect(s.label).toBe('Loading ocean life');
  });

  it('becomes ready as soon as the total is positive', () => {
    const s = getHudTotalState(42, false);
    expect(s).toEqual({ ready: true, totalText: '42', label: 'Living entities' });
  });

  it('stays ready after spawning even if the population later hits zero', () => {
    expect(getHudTotalState(0, true).totalText).toBe('0');
  });

  it('treats NaN as not ready', () => {
    expect(getHudTotalState(Number.NaN, false).ready).toBe(false);
  });
});

describe('formatHudCount', () => {
  it('formats whole numbers', () => {
    expect(formatHudCount(0)).toBe('0');
    expect(formatHudCount(12.6)).toBe('13');
  });
  it('uses the placeholder for invalid values', () => {
    expect(formatHudCount(-1)).toBe(HUD_PLACEHOLDER);
    expect(formatHudCount(Number.POSITIVE_INFINITY)).toBe(HUD_PLACEHOLDER);
  });
});

describe('shouldRefreshStats', () => {
  it('refreshes immediately on the first call', () => {
    expect(shouldRefreshStats(5, null)).toBe(true);
  });
  it('waits for the interval in wall-clock time', () => {
    expect(shouldRefreshStats(1500, 1000)).toBe(false);
    expect(shouldRefreshStats(2000, 1000)).toBe(true);
  });
});

describe('buildCaptureFilename', () => {
  it('builds a zero-padded png name from local time', () => {
    expect(buildCaptureFilename(new Date(2026, 0, 5, 3, 4, 9))).toBe('ocean-simulator-20260105-030409.png');
  });
  it('is filesystem safe', () => {
    expect(buildCaptureFilename()).toMatch(/^ocean-simulator-\d{8}-\d{6}\.png$/);
  });
});
