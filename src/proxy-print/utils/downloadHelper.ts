/**
 * PDF Download Helper for Cloudflare Pages
 * Provides multiple fallback methods for reliable PDF downloads
 */

export interface DownloadResult {
  success: boolean;
  method: string;
  error?: string;
}

/**
 * Downloads a PDF file using the best available method
 * Tries multiple methods in order of preference:
 * 1. File System Access API (modern browsers)
 * 2. Blob URL with anchor click (standard)
 * 3. Data URL with anchor click (fallback)
 * 4. Window.open with blob (last resort)
 */
export async function downloadPDF(
  pdfBytes: Uint8Array,
  filename: string = `onepiece-deck-${Date.now()}.pdf`
): Promise<DownloadResult> {
  const pdfArrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;

  // Method 1: File System Access API (Chrome, Edge, Opera)
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'PDF Files',
            accept: {
              'application/pdf': ['.pdf'],
            },
          },
        ],
      });

      const writable = await fileHandle.createWritable();
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      await writable.write(blob);
      await writable.close();

      console.log('PDF downloaded using File System Access API');
      return { success: true, method: 'FileSystemAccessAPI' };
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name === 'AbortError' || error.name === 'NotAllowedError') {
        console.log('File System Access API cancelled or not allowed');
        // Continue to next method
      } else {
        console.error('File System Access API error:', error);
        // Continue to next method
      }
    }
  }

  // Method 2: Blob URL with anchor click (most compatible)
  try {
    const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Create anchor element
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    a.setAttribute('download', filename); // Ensure download attribute is set

    // Add to DOM
    document.body.appendChild(a);

    // Trigger click with a small delay to ensure DOM is ready
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          // Use MouseEvent for better compatibility
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
          });
          a.dispatchEvent(clickEvent);
          resolve();
        } catch (e) {
          // Fallback to direct click
          a.click();
          resolve();
        }
      }, 10);
    });

    // Cleanup after a delay
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        // Element might already be removed
        console.log('Cleanup error (expected):', e);
      }
    }, 200);

    console.log('PDF downloaded using Blob URL method');
    return { success: true, method: 'BlobURL' };
  } catch (error: any) {
    console.error('Blob URL download error:', error);
    // Continue to next method
  }

  // Method 3: Data URL (for browsers that block blob URLs)
  try {
    // Convert to base64 in chunks to avoid memory issues
    const base64 = await convertToBase64(pdfBytes);
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.style.display = 'none';
    a.setAttribute('download', filename);

    document.body.appendChild(a);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
          });
          a.dispatchEvent(clickEvent);
          resolve();
        } catch (e) {
          a.click();
          resolve();
        }
      }, 10);
    });

    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch (e) {
        console.log('Cleanup error (expected):', e);
      }
    }, 200);

    console.log('PDF downloaded using Data URL method');
    return { success: true, method: 'DataURL' };
  } catch (error: any) {
    console.error('Data URL download error:', error);
    // Continue to next method
  }

  // Method 4: Window.open with blob (last resort)
  try {
    const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');

    if (newWindow) {
      // Try to trigger download
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      console.log('PDF opened in new window');
      return { success: true, method: 'WindowOpen' };
    } else {
      throw new Error('Popup blocked');
    }
  } catch (error: any) {
    console.error('Window.open download error:', error);
    return {
      success: false,
      method: 'AllMethodsFailed',
      error: error.message || 'All download methods failed',
    };
  }
}

/**
 * Converts Uint8Array to Base64 string in chunks to avoid memory issues
 */
async function convertToBase64(bytes: Uint8Array): Promise<string> {
  // For large files, process in chunks
  if (bytes.length > 10 * 1024 * 1024) {
    // Files larger than 10MB
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([ab], { type: 'application/pdf' });
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // For smaller files, use direct conversion
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Checks if download is likely to work
 */
export function canDownload(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    ('createObjectURL' in URL || 'showSaveFilePicker' in window)
  );
}
