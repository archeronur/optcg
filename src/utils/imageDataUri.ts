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
  const cacheKey = `${preferProxy ? 'p' : 'd'}:${absoluteSourceUrl}`;

  if (cache && inMemoryCache.has(cacheKey)) {
    const cached = inMemoryCache.get(cacheKey)!;
    return { ...cached, fromCache: true };
  }

  // 1) Prefer same-origin proxy to bypass upstream CORS
  if (preferProxy) {
    const proxyPath = `/api/image-proxy?url=${encodeURIComponent(absoluteSourceUrl)}`;
    // Always make proxy calls absolute to survive basePath/assetPrefix/proxying differences.
    // CRITICAL: Use getSiteOrigin() to ensure correct origin in Cloudflare Pages prod
    const siteOrigin = getSiteOrigin();
    const proxyUrl = toAbsoluteUrl(proxyPath, siteOrigin);
    
    // Debug log - ALWAYS log in prod to diagnose issues
    console.log('[getImageAsDataUri] Using proxy:', proxyUrl, 'for source:', absoluteSourceUrl, 'origin:', siteOrigin);
    
    try {
      const { bytes, contentType } = await fetchBytes(proxyUrl, timeoutMs);
      console.log('[getImageAsDataUri] Proxy success:', proxyUrl, 'bytes:', bytes.length);
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
      return result;
    } catch (proxyError: any) {
      // If proxy fails, log and try direct fetch as fallback
      console.error('[getImageAsDataUri] Proxy failed:', {
        proxyUrl,
        sourceUrl: absoluteSourceUrl,
        error: proxyError?.message || proxyError,
        errorName: proxyError?.name,
        stack: proxyError?.stack
      });
      
      // Try direct fetch as fallback (for any proxy error)
      console.log('[getImageAsDataUri] Trying direct fetch as fallback:', absoluteSourceUrl);
      try {
        const { bytes, contentType } = await fetchBytes(absoluteSourceUrl, timeoutMs);
        console.log('[getImageAsDataUri] Direct fetch success:', absoluteSourceUrl, 'bytes:', bytes.length);
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
      } catch (directError: any) {
        console.error('[getImageAsDataUri] Direct fetch also failed:', {
          sourceUrl: absoluteSourceUrl,
          error: directError?.message || directError,
          errorName: directError?.name
        });
        // Re-throw the original proxy error
        throw proxyError;
      }
    }
  }

  // 2) Direct fetch (works for same-origin images; often blocked for external images due to CORS)
  try {
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
  } catch (directError: any) {
    // Enhanced error message for debugging
    const errorMsg = directError?.message || String(directError);
    console.error('[getImageAsDataUri] Direct fetch failed:', {
      url: absoluteSourceUrl,
      error: errorMsg,
      isCors: errorMsg.includes('CORS') || errorMsg.includes('cross-origin'),
    });
    throw new Error(`Failed to fetch image: ${errorMsg}`);
  }
}

