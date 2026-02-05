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
};

const imageCache = new Map<string, ImageDataUriResult>();

// Detect image type from bytes
function detectImageType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp'; // RIFF
  return 'image/png';
}

// Convert bytes to base64
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1024) {
    const chunk = bytes.subarray(i, Math.min(i + 1024, len));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

// Fetch image bytes with timeout
async function fetchImageBytes(url: string, timeoutMs: number): Promise<{ bytes: Uint8Array; contentType: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'image/*' },
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Try to get error message from JSON response
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${response.status}`);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const contentType = response.headers.get('content-type') || '';
    
    return { bytes, contentType };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw err;
  }
}

/**
 * Fetch image and convert to base64 data URI.
 * Uses proxy for cross-origin images.
 */
export async function getImageAsDataUri(
  inputUrl: string,
  options: GetImageAsDataUriOptions = {}
): Promise<ImageDataUriResult> {
  const {
    timeoutMs = 30000,
    preferProxy = true,
    cache = true,
  } = options;

  const absoluteUrl = toAbsoluteUrl(inputUrl);
  const cacheKey = absoluteUrl;

  // Check cache
  if (cache && imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey)!;
    return { ...cached, fromCache: true };
  }

  let bytes: Uint8Array;
  let contentType: string;
  let via: 'api-proxy' | 'direct';
  let finalUrl: string;

  if (preferProxy) {
    // Use proxy to bypass CORS
    const origin = getSiteOrigin();
    const proxyUrl = `${origin}/api/image-proxy?url=${encodeURIComponent(absoluteUrl)}`;
    
    console.log(`[getImageAsDataUri] Proxy fetch: ${proxyUrl.substring(0, 100)}`);
    
    try {
      const result = await fetchImageBytes(proxyUrl, timeoutMs);
      bytes = result.bytes;
      contentType = result.contentType;
      via = 'api-proxy';
      finalUrl = proxyUrl;
    } catch (proxyErr: any) {
      console.warn(`[getImageAsDataUri] Proxy failed: ${proxyErr.message}, trying direct...`);
      
      // Fallback to direct fetch
      try {
        const result = await fetchImageBytes(absoluteUrl, timeoutMs);
        bytes = result.bytes;
        contentType = result.contentType;
        via = 'direct';
        finalUrl = absoluteUrl;
      } catch (directErr: any) {
        throw new Error(`Proxy: ${proxyErr.message} | Direct: ${directErr.message}`);
      }
    }
  } else {
    // Direct fetch only
    const result = await fetchImageBytes(absoluteUrl, timeoutMs);
    bytes = result.bytes;
    contentType = result.contentType;
    via = 'direct';
    finalUrl = absoluteUrl;
  }

  // Validate bytes
  if (bytes.length < 100) {
    throw new Error(`Image too small: ${bytes.length} bytes`);
  }

  // Detect content type from bytes if not provided
  const finalContentType = contentType.startsWith('image/') ? contentType : detectImageType(bytes);
  
  // Create data URI
  const base64 = bytesToBase64(bytes);
  const dataUri = `data:${finalContentType};base64,${base64}`;
  
  // Validate data URI format
  if (!dataUri.startsWith('data:image/')) {
    throw new Error('Invalid data URI format');
  }

  const result: ImageDataUriResult = {
    finalUrl,
    contentType: finalContentType,
    bytes,
    dataUri,
    fromCache: false,
    via,
  };

  if (cache) {
    imageCache.set(cacheKey, result);
  }

  console.log(`[getImageAsDataUri] Success: ${bytes.length} bytes via ${via}`);
  return result;
}

export function clearImageCache(): void {
  imageCache.clear();
}
