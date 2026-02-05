import { getSiteOrigin, toAbsoluteUrl } from '@/utils/url';

export type ImageDataUriResult = {
  finalUrl: string;
  contentType: string;
  bytes: Uint8Array;
  dataUri: string;
  fromCache: boolean;
  via: 'api-proxy' | 'direct';
};

export type GetImageAsDataUriOptions = {
  timeoutMs?: number;
  /**
   * When true (default), will try same-origin `/api/image-proxy` first to bypass CORS.
   */
  preferProxy?: boolean;
  /**
   * Cache results in-memory for the current session (default true).
   */
  cache?: boolean;
  /**
   * Optionally provide a known content-type when the server doesn't.
   */
  forcedContentType?: string;
};

const inMemoryCache = new Map<string, ImageDataUriResult>();

function sniffContentType(bytes: Uint8Array): string {
  // PNG
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  // JPEG
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  // WEBP: "RIFF....WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

function toBase64(bytes: Uint8Array): string {
  // Chunked conversion to avoid call stack limits
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

async function fetchBytes(url: string, timeoutMs: number): Promise<{ bytes: Uint8Array; contentType: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    console.log(`[fetchBytes] Fetching: ${url.substring(0, 100)}...`);
    
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store' as any,
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
      },
    });

    console.log(`[fetchBytes] Response status: ${res.status} ${res.statusText} for ${url.substring(0, 60)}...`);

    if (!res.ok) {
      // CRITICAL: Check if response is JSON error from proxy
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try {
          const json = await res.json().catch(() => null);
          const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
          console.error(`[fetchBytes] JSON error response from proxy:`, json);
          throw new Error(`Proxy error: ${msg}`);
        } catch (jsonError: any) {
          // If JSON parse fails, continue with text error
          console.error(`[fetchBytes] Failed to parse JSON error:`, jsonError);
        }
      }
      
      // Try to get error text
      const errorText = await res.text().catch(() => res.statusText);
      console.error(`[fetchBytes] HTTP error ${res.status}:`, errorText.substring(0, 200));
      
      // Provide more context for common errors
      if (res.status === 403) {
        throw new Error(`Access forbidden (403) - Domain may not be allowed in proxy`);
      } else if (res.status === 404) {
        throw new Error(`Not found (404) - Proxy route may not be deployed correctly`);
      } else if (res.status === 500) {
        throw new Error(`Server error (500) - Proxy route internal error`);
      } else if (res.status === 504) {
        throw new Error(`Timeout (504) - Image fetch timed out`);
      }
      
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorText.substring(0, 100)}`);
    }

    // CRITICAL: Read response as arrayBuffer (works for both binary and text)
    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const contentType = res.headers.get('content-type') || '';
    
    // CRITICAL: Verify we got actual image data, not an error message
    if (bytes.length < 1000) {
      // Try to decode as text to see if it's an error message
      try {
        const text = new TextDecoder().decode(bytes);
        if (text.includes('error') || text.includes('Error') || text.startsWith('{')) {
          console.error(`[fetchBytes] Response appears to be error text:`, text.substring(0, 200));
          throw new Error(`Proxy returned error: ${text.substring(0, 100)}`);
        }
      } catch {
        // Not text, just too small
      }
      throw new Error(`Image data too small: ${bytes.length} bytes`);
    }
    
    console.log(`[fetchBytes] Success: ${bytes.length} bytes, contentType: ${contentType} for ${url.substring(0, 60)}...`);
    
    return { bytes, contentType };
  } catch (error: any) {
    console.error(`[fetchBytes] Error fetching ${url.substring(0, 100)}...:`, {
      error: error?.message || error,
      errorName: error?.name,
      aborted: controller.signal.aborted,
      url: url.substring(0, 100)
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches an image and returns it as a data URI, with CORS-proofing via same-origin proxy.
 * This is designed specifically for PDF embedding (pdf-lib) where we need raw bytes.
 */
export async function getImageAsDataUri(inputUrl: string, options: GetImageAsDataUriOptions = {}): Promise<ImageDataUriResult> {
  const {
    timeoutMs = 30000,
    preferProxy = true,
    cache = true,
    forcedContentType,
  } = options;

  const absoluteSourceUrl = toAbsoluteUrl(inputUrl);
  const cacheKey = `${preferProxy ? 'p' : 'd'}:${absoluteSourceUrl}`;

  if (cache && inMemoryCache.has(cacheKey)) {
    const cached = inMemoryCache.get(cacheKey)!;
    console.log(`[getImageAsDataUri] Cache hit for: ${absoluteSourceUrl.substring(0, 60)}...`);
    return { ...cached, fromCache: true };
  }

  // 1) Prefer same-origin proxy to bypass upstream CORS
  if (preferProxy) {
    const proxyPath = `/api/image-proxy?url=${encodeURIComponent(absoluteSourceUrl)}`;
    
    // CRITICAL: Get site origin - must be correct for production
    const siteOrigin = getSiteOrigin();
    const proxyUrl = toAbsoluteUrl(proxyPath, siteOrigin);
    
    // DEBUG: Log proxy URL construction (first 5 requests)
    if (inMemoryCache.size < 5) {
      console.log(`[getImageAsDataUri] DEBUG: Proxy URL construction:`, {
        inputUrl: inputUrl.substring(0, 60),
        absoluteSourceUrl: absoluteSourceUrl.substring(0, 60),
        siteOrigin: siteOrigin,
        proxyPath: proxyPath.substring(0, 80),
        proxyUrl: proxyUrl.substring(0, 80)
      });
    }
    
    try {
      const { bytes, contentType } = await fetchBytes(proxyUrl, timeoutMs);
      if (bytes.length < 1000) throw new Error('Image bytes too small');

      const finalType = forcedContentType || (contentType && contentType.startsWith('image/') ? contentType : sniffContentType(bytes));
      const dataUri = `data:${finalType};base64,${toBase64(bytes)}`;
      const result: ImageDataUriResult = {
        finalUrl: proxyUrl,
        contentType: finalType,
        bytes,
        dataUri,
        fromCache: false,
        via: 'api-proxy',
      };
      if (cache) inMemoryCache.set(cacheKey, result);
      
      console.log(`[getImageAsDataUri] ✓ Success via proxy: ${absoluteSourceUrl.substring(0, 60)}...`);
      return result;
    } catch (proxyError: any) {
      // Proxy failed, fallback to direct fetch
      console.error(`[getImageAsDataUri] ✗ Proxy failed for ${absoluteSourceUrl.substring(0, 60)}...:`, {
        error: proxyError?.message || proxyError,
        errorName: proxyError?.name,
        proxyUrl: proxyUrl.substring(0, 80),
        siteOrigin: siteOrigin
      });
      
      // Try direct fetch as fallback
      try {
        console.log(`[getImageAsDataUri] Attempting direct fetch fallback for: ${absoluteSourceUrl.substring(0, 60)}...`);
        const { bytes, contentType } = await fetchBytes(absoluteSourceUrl, timeoutMs);
        if (bytes.length < 1000) throw new Error('Image bytes too small');

        const finalType = forcedContentType || (contentType && contentType.startsWith('image/') ? contentType : sniffContentType(bytes));
        const dataUri = `data:${finalType};base64,${toBase64(bytes)}`;
        const result: ImageDataUriResult = {
          finalUrl: absoluteSourceUrl,
          contentType: finalType,
          bytes,
          dataUri,
          fromCache: false,
          via: 'direct',
        };
        if (cache) inMemoryCache.set(cacheKey, result);
        
        console.log(`[getImageAsDataUri] ✓ Success via direct fetch: ${absoluteSourceUrl.substring(0, 60)}...`);
        return result;
      } catch (directError: any) {
        // Both proxy and direct failed
        console.error(`[getImageAsDataUri] ✗ Both proxy and direct fetch failed:`, {
          proxyError: proxyError?.message || proxyError,
          directError: directError?.message || directError,
          absoluteSourceUrl: absoluteSourceUrl.substring(0, 60)
        });
        throw new Error(`Failed to fetch image (proxy: ${proxyError?.message || 'unknown'}, direct: ${directError?.message || 'unknown'})`);
      }
    }
  }

  // 2) Direct fetch (works for same-origin images; often blocked for external images due to CORS)
  const { bytes, contentType } = await fetchBytes(absoluteSourceUrl, timeoutMs);
  if (bytes.length < 1000) throw new Error('Image bytes too small');

  const finalType = forcedContentType || (contentType && contentType.startsWith('image/') ? contentType : sniffContentType(bytes));
  const dataUri = `data:${finalType};base64,${toBase64(bytes)}`;
  const result: ImageDataUriResult = {
    finalUrl: absoluteSourceUrl,
    contentType: finalType,
    bytes,
    dataUri,
    fromCache: false,
    via: 'direct',
  };
  if (cache) inMemoryCache.set(cacheKey, result);
  return result;
}
