import { buildCaptureFilename } from './hudState';

export type CaptureResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** Encode a canvas as PNG. Resolves null if the browser cannot produce a blob. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Share the image with the native share sheet when the browser can share files
 * (mostly phones); otherwise, or if sharing fails, download it.
 */
export async function deliverPhoto(blob: Blob, filename = buildCaptureFilename()): Promise<CaptureResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Ocean Simulator' });
      return 'shared';
    } catch (err) {
      // Dismissing the share sheet is not an error and should not trigger a download.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Any other failure falls through to a plain download.
    }
  }
  try {
    downloadBlob(blob, filename);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
