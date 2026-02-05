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
  
  console.log('[fetchBytes] Fetching:', url);
  
  try {
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

    console.log('[fetchBytes] Response:', {
      url,
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
      ok: res.ok
    });

    if (!res.ok) {
      // Try to provide more context when the proxy returns JSON
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json().catch(() => null);
        const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
        console.error('[fetchBytes] JSON error response:', json);
        throw new Error(msg);
      }
      const errorText = await res.text().catch(() => res.statusText);
      console.error('[fetchBytes] HTTP error:', res.status, errorText.substring(0, 200));
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const contentType = res.headers.get('content-type') || '';
    
    console.log('[fetchBytes] Success:', url, 'bytes:', bytes.length, 'contentType:', contentType);
    
    return { bytes, contentType };
  } catch (error: any) {
    console.error('[fetchBytes] Fetch error:', {
      url,
      error: error?.message || error,
      errorName: error?.name,
      aborted: controller.signal.aborted
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
  const cacheKey = `any:${absoluteSourceUrl}`; // Unified cache key

  if (cache && inMemoryCache.has(cacheKey)) {
    const cached = inMemoryCache.get(cacheKey)!;
    console.log('[getImageAsDataUri] Using cached result for:', absoluteSourceUrl);
    return { ...cached, fromCache: true };
  }

  // MANDATORY FIX: Always use same-origin proxy FIRST to avoid CORS/canvas taint issues
  // This ensures images are fetched server-side and become same-origin
  if (preferProxy) {
    const proxyPath = `/api/image-proxy?url=${encodeURIComponent(absoluteSourceUrl)}`;
    const siteOrigin = getSiteOrigin();
    // CRITICAL: Ensure absolute URL for proxy (same-origin guarantee)
    const proxyUrl = toAbsoluteUrl(proxyPath, siteOrigin);
    
    console.log('[getImageAsDataUri] Using same-origin proxy:', {
      proxyUrl,
      sourceUrl: absoluteSourceUrl,
      origin: siteOrigin
    });
    
    try {
      const { bytes, contentType } = await fetchBytes(proxyUrl, timeoutMs);
      console.log('[getImageAsDataUri] Proxy SUCCESS:', {
        proxyUrl,
        bytes: bytes.length,
        contentType
      });
      
      if (bytes.length < 1000) {
        throw new Error(`Image bytes too small: ${bytes.length} bytes`);
      }

      // Convert to base64 data URL (guaranteed same-origin, zero network dependency)
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
      
      if (cache) {
        inMemoryCache.set(cacheKey, result);
        console.log('[getImageAsDataUri] Cached result for:', absoluteSourceUrl);
      }
      
      return result;
    } catch (proxyError: any) {
      console.error('[getImageAsDataUri] Proxy failed, trying direct fetch as fallback:', {
        proxyUrl,
        sourceUrl: absoluteSourceUrl,
        error: proxyError?.message || proxyError,
        errorName: proxyError?.name,
        status: proxyError?.message?.match(/HTTP (\d+)/)?.[1]
      });
      
      // Fallback to direct fetch if proxy fails (e.g., proxy route not available)
      try {
        console.log('[getImageAsDataUri] Attempting direct fetch as fallback:', absoluteSourceUrl);
        const { bytes, contentType } = await fetchBytes(absoluteSourceUrl, timeoutMs);
        
        if (bytes.length < 1000) {
          throw new Error(`Image bytes too small: ${bytes.length} bytes`);
        }

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
        
        console.log('[getImageAsDataUri] Direct fetch SUCCESS (fallback):', absoluteSourceUrl);
        return result;
      } catch (directError: any) {
        console.error('[getImageAsDataUri] Both proxy and direct fetch failed:', {
          proxyError: proxyError?.message || proxyError,
          directError: directError?.message || directError,
          sourceUrl: absoluteSourceUrl
        });
        
        // Throw comprehensive error
        throw new Error(`Failed to fetch image via proxy and direct: Proxy: ${proxyError?.message || 'unknown'}, Direct: ${directError?.message || 'unknown'}`);
      }
    }
  }

  // This code path should not be reached if preferProxy is true (handled above)
  // But keep it as fallback for when preferProxy is false
  throw new Error('No fetch method available (preferProxy=false and direct fetch not attempted)');
}

