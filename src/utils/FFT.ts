/**
 * Fast Fourier Transform (FFT) implementation
 * Cooley-Tukey algorithm for 2D FFT
 * 
 * Note: In production, this should be replaced with:
 * - WebGPU compute shader for GPU acceleration
 * - fft.js or similar library for optimized CPU FFT
 * 
 * This is a simplified implementation for initial functionality.
 */

export class FFT {
  private resolution: number;
  
  constructor(resolution: number) {
    if ((resolution & (resolution - 1)) !== 0) {
      throw new Error('FFT resolution must be a power of 2');
    }
    this.resolution = resolution;
  }

  /**
   * 1D FFT (Cooley-Tukey algorithm)
   */
  private fft1D(data: Float32Array, inverse: boolean = false): void {
    const n = data.length / 2; // Complex pairs
    
    if (n <= 1) return;
    
    // Bit-reversal permutation
    this.bitReversal(data);
    
    // Cooley-Tukey FFT
    const sign = inverse ? 1 : -1;
    
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2;
      const step = Math.PI / halfSize;
      
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < halfSize; j++) {
          const angle = sign * step * j;
          const twiddle_real = Math.cos(angle);
          const twiddle_imag = Math.sin(angle);
          
          const idx1 = (i + j) * 2;
          const idx2 = (i + j + halfSize) * 2;
          
          const real1 = data[idx1];
          const imag1 = data[idx1 + 1];
          const real2 = data[idx2];
          const imag2 = data[idx2 + 1];
          
          // Complex multiplication: twiddle * data[idx2]
          const temp_real = twiddle_real * real2 - twiddle_imag * imag2;
          const temp_imag = twiddle_real * imag2 + twiddle_imag * real2;
          
          // Butterfly operation
          data[idx1] = real1 + temp_real;
          data[idx1 + 1] = imag1 + temp_imag;
          data[idx2] = real1 - temp_real;
          data[idx2 + 1] = imag1 - temp_imag;
        }
      }
    }
    
    // Normalize inverse FFT
    if (inverse) {
      for (let i = 0; i < data.length; i++) {
        data[i] /= n;
      }
    }
  }

  /**
   * Bit-reversal permutation
   */
  private bitReversal(data: Float32Array): void {
    const n = data.length / 2;
    let j = 0;
    
    for (let i = 0; i < n; i++) {
      if (j > i) {
        // Swap complex pairs
        const temp_real = data[i * 2];
        const temp_imag = data[i * 2 + 1];
        data[i * 2] = data[j * 2];
        data[i * 2 + 1] = data[j * 2 + 1];
        data[j * 2] = temp_real;
        data[j * 2 + 1] = temp_imag;
      }
      
      // Compute next j
      let k = n / 2;
      while (k <= j) {
        j -= k;
        k /= 2;
      }
      j += k;
    }
  }

  /**
   * 2D FFT (separable approach: rows then columns)
   */
  public fft2D(data: Float32Array, inverse: boolean = false): void {
    const N = this.resolution;
    
    // FFT on rows
    const rowData = new Float32Array(N * 2);
    for (let y = 0; y < N; y++) {
      // Extract row
      for (let x = 0; x < N; x++) {
        const srcIdx = (y * N + x) * 2;
        rowData[x * 2] = data[srcIdx];
        rowData[x * 2 + 1] = data[srcIdx + 1];
      }
      
      // FFT
      this.fft1D(rowData, inverse);
      
      // Write back
      for (let x = 0; x < N; x++) {
        const dstIdx = (y * N + x) * 2;
        data[dstIdx] = rowData[x * 2];
        data[dstIdx + 1] = rowData[x * 2 + 1];
      }
    }
    
    // FFT on columns
    const colData = new Float32Array(N * 2);
    for (let x = 0; x < N; x++) {
      // Extract column
      for (let y = 0; y < N; y++) {
        const srcIdx = (y * N + x) * 2;
        colData[y * 2] = data[srcIdx];
        colData[y * 2 + 1] = data[srcIdx + 1];
      }
      
      // FFT
      this.fft1D(colData, inverse);
      
      // Write back
      for (let y = 0; y < N; y++) {
        const dstIdx = (y * N + x) * 2;
        data[dstIdx] = colData[y * 2];
        data[dstIdx + 1] = colData[y * 2 + 1];
      }
    }
  }

  /**
   * Inverse 2D FFT
   */
  public ifft2D(data: Float32Array): void {
    this.fft2D(data, true);
  }
}
