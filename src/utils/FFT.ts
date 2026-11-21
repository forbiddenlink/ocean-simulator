/**
 * Radix-2 Cooley-Tukey FFT for square power-of-two complex fields stored as
 * interleaved [re, im] pairs in a Float32Array.
 *
 * Twiddle factors and the bit-reversal permutation are computed once per size,
 * and rows and columns are transformed in place with a stride, so a transform
 * allocates nothing and calls no trig. The ocean runs six of these at 256² and
 * 128² every wave update, which is why this has to stay cheap.
 */
export class FFT {
  private readonly resolution: number;
  private readonly cosTable: Float64Array;
  private readonly sinTable: Float64Array;
  private readonly bitReverse: Uint32Array;

  constructor(resolution: number) {
    if (resolution < 1 || (resolution & (resolution - 1)) !== 0) {
      throw new Error('FFT resolution must be a power of 2');
    }
    this.resolution = resolution;

    const half = resolution >> 1;
    this.cosTable = new Float64Array(half);
    this.sinTable = new Float64Array(half);
    for (let i = 0; i < half; i++) {
      const angle = (-2 * Math.PI * i) / resolution;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }

    const bits = Math.log2(resolution);
    this.bitReverse = new Uint32Array(resolution);
    for (let i = 0; i < resolution; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.bitReverse[i] = r;
    }
  }

  /**
   * In-place 1D transform of `resolution` complex values starting at float index
   * `offset`, with consecutive values `stride` complex elements apart.
   */
  private transform1D(data: Float32Array, offset: number, stride: number, inverse: boolean): void {
    const n = this.resolution;
    const step2 = stride * 2;
    const rev = this.bitReverse;

    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const a = offset + i * step2;
        const b = offset + j * step2;
        const re = data[a];
        const im = data[a + 1];
        data[a] = data[b];
        data[a + 1] = data[b + 1];
        data[b] = re;
        data[b + 1] = im;
      }
    }

    const cosT = this.cosTable;
    const sinT = this.sinTable;
    const sign = inverse ? -1 : 1;

    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const tableStep = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = cosT[k * tableStep];
          const wi = sign * sinT[k * tableStep];
          const a = offset + (start + k) * step2;
          const b = a + half * step2;
          const br = data[b];
          const bi = data[b + 1];
          const tr = wr * br - wi * bi;
          const ti = wr * bi + wi * br;
          const ar = data[a];
          const ai = data[a + 1];
          data[a] = ar + tr;
          data[a + 1] = ai + ti;
          data[b] = ar - tr;
          data[b + 1] = ai - ti;
        }
      }
    }
  }

  /** 2D transform: every row, then every column. Inverse scales by 1/N². */
  public fft2D(data: Float32Array, inverse = false): void {
    const n = this.resolution;
    for (let y = 0; y < n; y++) this.transform1D(data, y * n * 2, 1, inverse);
    for (let x = 0; x < n; x++) this.transform1D(data, x * 2, n, inverse);

    if (inverse) {
      const scale = 1 / (n * n);
      for (let i = 0; i < data.length; i++) data[i] *= scale;
    }
  }

  public ifft2D(data: Float32Array): void {
    this.fft2D(data, true);
  }
}
