/**
 * Extract base64 image data from already-loaded DOM img elements
 * This avoids re-fetching images that are already loaded in the browser
 */

export interface ImageFromDOMResult {
  success: boolean;
  dataUri?: string;
  bytes?: Uint8Array;
  error?: string;
}

/**
 * Convert a loaded img element to base64 data URI
 * This is more reliable than re-fetching, especially in Cloudflare Pages
 */
export async function getImageFromDOM(img: HTMLImageElement): Promise<ImageFromDOMResult> {
  try {
    // Check if image is loaded
    if (!img.complete) {
      // Wait for image to load
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 10000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Image load error'));
        };
        
        // If already loaded, resolve immediately
        if (img.complete && img.naturalWidth > 0) {
          clearTimeout(timeout);
          resolve();
        }
      });
    }
    
    // Verify image is actually loaded
    if (!img.complete || img.naturalWidth === 0) {
      return {
        success: false,
        error: 'Image not fully loaded'
      };
    }
    
    // CRITICAL: Check if image is cross-origin (will taint canvas)
    // If cross-origin, we need to fetch via proxy instead
    try {
      // Try to access image data - will throw if cross-origin
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 1;
      testCanvas.height = 1;
      const testCtx = testCanvas.getContext('2d');
      if (testCtx) {
        testCtx.drawImage(img, 0, 0, 1, 1);
        // If we get here, image is same-origin or CORS-enabled
        testCtx.getImageData(0, 0, 1, 1);
      }
    } catch (e: any) {
      // Canvas is tainted (cross-origin without CORS)
      console.warn('[getImageFromDOM] Canvas tainted, cannot extract from DOM:', img.src);
      return {
        success: false,
        error: 'Image is cross-origin and cannot be extracted from canvas'
      };
    }
    
    // Use canvas to convert to base64 (handles CORS automatically for same-origin images)
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        success: false,
        error: 'Could not get canvas context'
      };
    }
    
    // Draw image to canvas
    ctx.drawImage(img, 0, 0);
    
    // Convert to blob first, then to base64 (more reliable)
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve({
            success: false,
            error: 'Failed to convert canvas to blob'
          });
          return;
        }
        
        // Convert blob to bytes directly (faster than base64)
        blob.arrayBuffer().then(arrayBuffer => {
          const bytes = new Uint8Array(arrayBuffer);
          
          // Also create data URI for compatibility
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUri = reader.result as string;
            
            resolve({
              success: true,
              dataUri,
              bytes
            });
          };
          
          reader.onerror = () => {
            // Even if data URI fails, bytes are available
            resolve({
              success: true,
              bytes,
              dataUri: `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`
            });
          };
          
          reader.readAsDataURL(blob);
        }).catch(err => {
          resolve({
            success: false,
            error: `Failed to convert to bytes: ${err.message}`
          });
        });
      }, 'image/png'); // Always use PNG for consistency
    });
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Unknown error'
    };
  }
}

/**
 * Find img element in DOM by src URL (fuzzy match)
 * Handles normalized URLs and relative/absolute URL differences
 */
export function findImageInDOM(imageUrl: string): HTMLImageElement | null {
  // Normalize URLs for comparison
  const normalizeUrl = (url: string): string => {
    try {
      // Remove protocol, domain, and normalize path
      const urlObj = new URL(url, window.location.origin);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };
  
  const normalizedTarget = normalizeUrl(imageUrl);
  
  // Try exact match first
  const exactMatch = Array.from(document.querySelectorAll('img')).find(
    img => {
      const src = img.src || img.getAttribute('src') || '';
      if (!src) return false;
      
      // Exact match
      if (src === imageUrl || img.getAttribute('src') === imageUrl) {
        return true;
      }
      
      // Normalized match
      const normalizedSrc = normalizeUrl(src);
      if (normalizedSrc === normalizedTarget) {
        return true;
      }
      
      return false;
    }
  );
  
  if (exactMatch) return exactMatch;
  
  // Try fuzzy match (URL contains the image URL or vice versa)
  const fuzzyMatch = Array.from(document.querySelectorAll('img')).find(
    img => {
      const src = img.src || img.getAttribute('src') || '';
      if (!src) return false;
      
      // Extract filename/path for comparison
      const targetPath = imageUrl.split('/').pop() || imageUrl;
      const srcPath = src.split('/').pop() || src;
      
      // Check if paths match
      if (src.includes(targetPath) || imageUrl.includes(srcPath)) {
        return true;
      }
      
      // Check if URLs overlap significantly
      const targetParts = imageUrl.split('/').filter(p => p.length > 3);
      const srcParts = src.split('/').filter(p => p.length > 3);
      const matchingParts = targetParts.filter(p => srcParts.includes(p));
      
      if (matchingParts.length >= 2) {
        return true;
      }
      
      return false;
    }
  );
  
  return fuzzyMatch || null;
}

/**
 * Get image from DOM if available, otherwise return null
 * This is a fast check before attempting fetch
 */
export async function tryGetImageFromDOM(imageUrl: string): Promise<ImageFromDOMResult | null> {
  const img = findImageInDOM(imageUrl);
  
  if (!img) {
    return null; // Image not found in DOM
  }
  
  console.log('[tryGetImageFromDOM] Found image in DOM:', imageUrl);
  return getImageFromDOM(img);
}
