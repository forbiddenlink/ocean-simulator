import { describe, expect, it } from 'vitest';
import { FFT } from '../utils/FFT';

/** Reference 2D DFT, O(N^4): the definition the fast transform must match. */
function naiveDft2D(input: Float32Array, n: number, inverse: boolean): Float64Array {
  const out = new Float64Array(n * n * 2);
  const sign = inverse ? 1 : -1;
  for (let ky = 0; ky < n; ky++) {
    for (let kx = 0; kx < n; kx++) {
      let re = 0;
      let im = 0;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const angle = (sign * 2 * Math.PI * (kx * x + ky * y)) / n;
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const i = (y * n + x) * 2;
          re += input[i] * c - input[i + 1] * s;
          im += input[i] * s + input[i + 1] * c;
        }
      }
      const o = (ky * n + kx) * 2;
      const scale = inverse ? 1 / (n * n) : 1;
      out[o] = re * scale;
      out[o + 1] = im * scale;
    }
  }
  return out;
}

function seeded(n: number, seed: number): Float32Array {
  const data = new Float32Array(n * n * 2);
  let s = seed;
  for (let i = 0; i < data.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    data[i] = (s / 0xffffffff) * 2 - 1;
  }
  return data;
}

describe('FFT', () => {
  it.each([4, 8, 16])('forward 2D transform matches the DFT definition at N=%i', (n) => {
    const input = seeded(n, n * 7 + 1);
    const expected = naiveDft2D(input, n, false);
    const data = input.slice();
    new FFT(n).fft2D(data);
    for (let i = 0; i < data.length; i++) expect(data[i]).toBeCloseTo(expected[i], 3);
  });

  it.each([4, 8, 16])('inverse 2D transform matches the DFT definition at N=%i', (n) => {
    const input = seeded(n, n * 13 + 5);
    const expected = naiveDft2D(input, n, true);
    const data = input.slice();
    new FFT(n).ifft2D(data);
    for (let i = 0; i < data.length; i++) expect(data[i]).toBeCloseTo(expected[i], 4);
  });

  it('round-trips a 256x256 field', () => {
    const n = 256;
    const input = seeded(n, 42);
    const data = input.slice();
    const fft = new FFT(n);
    fft.fft2D(data);
    fft.ifft2D(data);
    let maxErr = 0;
    for (let i = 0; i < data.length; i++) maxErr = Math.max(maxErr, Math.abs(data[i] - input[i]));
    expect(maxErr).toBeLessThan(1e-4);
  });

  it('rejects sizes that are not powers of two', () => {
    expect(() => new FFT(12)).toThrow();
  });
});
