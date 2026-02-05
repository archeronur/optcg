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
  preferProxy?: boolean;
  cache?: boolean;
  forcedContentType?: string;
};

const inMemoryCache = new Map<string, ImageDataUriResult>();

function sniffContentType(bytes: Uint8Array): string {
  // PNG: 89 50 4E 47
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  // WEBP: RIFF....WEBP
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

function toBase64(bytes: Uint8Array): string {
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
      cache: 'no-store' as RequestCache,
      signal: controller.signal,
      headers: { Accept: 'image/*' },
    });

    console.log(`[fetchBytes] Response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      // Check if response is JSON error
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const json = await res.json();
          console.error(`[fetchBytes] JSON error:`, json);
          throw new Error(`Proxy error: ${json?.error || JSON.stringify(json)}`);
        } catch (jsonErr) {
          // JSON parse failed, continue
        }
      }
      
      const errorText = await res.text().catch(() => res.statusText);
      console.error(`[fetchBytes] HTTP error ${res.status}:`, errorText.substring(0, 200));
      
      // Provide helpful error messages
      if (res.status === 403) throw new Error(`Access forbidden (403) - Check allowed domains`);
      if (res.status === 404) throw new Error(`Not found (404) - API route may not be deployed`);
      if (res.status === 500) throw new Error(`Server error (500) - Internal proxy error`);
      if (res.status === 502) throw new Error(`Bad gateway (502) - Upstream server error`);
      if (res.status === 504) throw new Error(`Gateway timeout (504) - Request timed out`);
      
      throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const responseContentType = res.headers.get('content-type') || '';
    
    console.log(`[fetchBytes] Received ${bytes.length} bytes, Content-Type: ${responseContentType}`);
    
    // Validate we got actual image data
    if (bytes.length < 500) {
      try {
        const text = new TextDecoder().decode(bytes);
        if (text.includes('error') || text.includes('Error') || text.startsWith('{') || text.startsWith('<')) {
          console.error(`[fetchBytes] Response looks like error text:`, text.substring(0, 200));
          throw new Error(`Response is not image data: ${text.substring(0, 100)}`);
        }
      } catch (decodeErr) {
        // Not decodable as text
      }
      throw new Error(`Image data too small: ${bytes.length} bytes`);
    }
    
    return { bytes, contentType: responseContentType };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    console.error(`[fetchBytes] Error:`, error.message);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches an image and returns it as a base64 data URI.
 * Uses same-origin proxy to bypass CORS for external images.
 */
export async function getImageAsDataUri(inputUrl: string, options: GetImageAsDataUriOptions = {}): Promise<ImageDataUriResult> {
  const {
    timeoutMs = 30000,
    preferProxy = true,
    cache = true,
    forcedContentType,
  } = options;

  // Normalize URL to absolute
  const absoluteSourceUrl = toAbsoluteUrl(inputUrl);
  const cacheKey = `${preferProxy ? 'p' : 'd'}:${absoluteSourceUrl}`;

  // Check cache
  if (cache && inMemoryCache.has(cacheKey)) {
    const cached = inMemoryCache.get(cacheKey)!;
    console.log(`[getImageAsDataUri] Cache hit: ${absoluteSourceUrl.substring(0, 60)}...`);
    return { ...cached, fromCache: true };
  }

  // Get site origin for proxy URL construction
  const siteOrigin = getSiteOrigin();
  
  console.log(`[getImageAsDataUri] Starting fetch:`, {
    inputUrl: inputUrl.substring(0, 60),
    absoluteSourceUrl: absoluteSourceUrl.substring(0, 60),
    siteOrigin,
    preferProxy,
  });

  // Strategy 1: Use proxy (preferred for external images)
  if (preferProxy) {
    const proxyPath = `/api/image-proxy?url=${encodeURIComponent(absoluteSourceUrl)}`;
    const proxyUrl = `${siteOrigin}${proxyPath}`;
    
    console.log(`[getImageAsDataUri] Using proxy: ${proxyUrl.substring(0, 100)}...`);
    
    try {
      const { bytes, contentType } = await fetchBytes(proxyUrl, timeoutMs);
      
      if (bytes.length < 500) {
        throw new Error(`Image bytes too small from proxy: ${bytes.length}`);
      }

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
      console.log(`[getImageAsDataUri] ✓ Success via proxy: ${bytes.length} bytes`);
      return result;
      
    } catch (proxyError: any) {
      console.error(`[getImageAsDataUri] Proxy failed:`, proxyError.message);
      
      // Strategy 2: Try direct fetch (might work for same-origin or CORS-enabled images)
      console.log(`[getImageAsDataUri] Trying direct fetch as fallback...`);
      
      try {
        const { bytes, contentType } = await fetchBytes(absoluteSourceUrl, timeoutMs);
        
        if (bytes.length < 500) {
          throw new Error(`Image bytes too small: ${bytes.length}`);
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
        console.log(`[getImageAsDataUri] ✓ Success via direct fetch: ${bytes.length} bytes`);
        return result;
        
      } catch (directError: any) {
        console.error(`[getImageAsDataUri] Direct fetch also failed:`, directError.message);
        
        // Both strategies failed
        throw new Error(
          `Failed to load image: Proxy error: ${proxyError.message} | Direct error: ${directError.message}`
        );
      }
    }
  }

  // Strategy 2 only: Direct fetch (no proxy)
  console.log(`[getImageAsDataUri] Direct fetch (no proxy): ${absoluteSourceUrl.substring(0, 80)}...`);
  
  const { bytes, contentType } = await fetchBytes(absoluteSourceUrl, timeoutMs);
  
  if (bytes.length < 500) {
    throw new Error(`Image bytes too small: ${bytes.length}`);
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
  return result;
}

// Export cache clearing function for testing
export function clearImageCache(): void {
  inMemoryCache.clear();
  console.log('[getImageAsDataUri] Cache cleared');
}
