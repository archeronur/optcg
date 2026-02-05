import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Cloudflare Pages Edge Runtime: Timeout helper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 25000): Promise<Response> {
  const controller = new AbortController();
  
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const fetchPromise = fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    const response = await fetchPromise;
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError' || controller.signal.aborted) {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

// Handle OPTIONS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// Simple request counter for debug
let requestCount = 0;

export async function GET(request: NextRequest) {
  requestCount++;
  const reqId = requestCount;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    // DEBUG: Always log request (helps diagnose prod issues)
    console.log(`[image-proxy #${reqId}] Request received:`, {
      url: imageUrl?.substring(0, 80) || 'MISSING',
      host: request.headers.get('host'),
      origin: request.headers.get('origin'),
    });

    if (!imageUrl) {
      console.error(`[image-proxy #${reqId}] Missing URL parameter`);
      return new Response(
        JSON.stringify({ error: 'URL parameter is required', reqId }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      console.error(`[image-proxy #${reqId}] Invalid URL format:`, imageUrl.substring(0, 100));
      return new Response(
        JSON.stringify({ error: 'Invalid URL format', reqId }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Security: Only allow HTTPS and specific domains
    const allowedDomains = [
      'optcgapi.com',
      'onepiece-cardgame.com',
      'en.onepiece-cardgame.com',
      'onepiece.limitlesstcg.com',
    ];

    const hostname = url.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      console.error(`[image-proxy #${reqId}] Domain not allowed:`, hostname);
      return new Response(
        JSON.stringify({ error: 'Domain not allowed', domain: hostname, reqId }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (url.protocol !== 'https:') {
      console.error(`[image-proxy #${reqId}] Non-HTTPS rejected:`, url.protocol);
      return new Response(
        JSON.stringify({ error: 'Only HTTPS URLs allowed', reqId }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the image
    console.log(`[image-proxy #${reqId}] Fetching:`, imageUrl.substring(0, 80));
    
    let response: Response;
    try {
      response = await fetchWithTimeout(imageUrl, {
        method: 'GET',
        headers: { 'Accept': 'image/*' },
        redirect: 'follow',
        credentials: 'omit',
      }, 25000);
      
      console.log(`[image-proxy #${reqId}] Fetch response:`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        redirected: response.redirected,
      });
    } catch (fetchError: any) {
      console.error(`[image-proxy #${reqId}] Fetch error:`, fetchError.message);
      
      const status = fetchError.message === 'Request timeout' ? 504 : 502;
      return new Response(
        JSON.stringify({ error: `Fetch failed: ${fetchError.message}`, reqId }),
        { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[image-proxy #${reqId}] Non-OK response:`, {
        status: response.status,
        body: errorText.substring(0, 200),
      });
      return new Response(
        JSON.stringify({ error: `Upstream error: ${response.status}`, body: errorText.substring(0, 100), reqId }),
        { status: response.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Read image data
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (bufferError: any) {
      console.error(`[image-proxy #${reqId}] ArrayBuffer error:`, bufferError.message);
      return new Response(
        JSON.stringify({ error: `Failed to read response: ${bufferError.message}`, reqId }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const imageBytes = new Uint8Array(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';

    console.log(`[image-proxy #${reqId}] Image data:`, {
      size: imageBytes.length,
      contentType,
      firstBytes: Array.from(imageBytes.slice(0, 8)),
    });

    // Validate image size
    if (imageBytes.length < 500) {
      // Try to decode as text to check if it's an error
      try {
        const text = new TextDecoder().decode(imageBytes);
        console.error(`[image-proxy #${reqId}] Response too small, text:`, text.substring(0, 200));
        return new Response(
          JSON.stringify({ error: 'Response too small', size: imageBytes.length, text: text.substring(0, 100), reqId }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch {
        // Not text
      }
      return new Response(
        JSON.stringify({ error: 'Image too small', size: imageBytes.length, reqId }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Validate image signature (JPEG or PNG)
    const isJPEG = imageBytes[0] === 0xFF && imageBytes[1] === 0xD8;
    const isPNG = imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4E && imageBytes[3] === 0x47;
    
    if (!isJPEG && !isPNG) {
      console.warn(`[image-proxy #${reqId}] Unknown image format, first bytes:`, Array.from(imageBytes.slice(0, 8)));
      // Continue anyway, might be WEBP or other format
    }

    console.log(`[image-proxy #${reqId}] SUCCESS: Returning ${imageBytes.length} bytes`);

    // CRITICAL: Return binary data using Response (not NextResponse for better compatibility)
    // Cloudflare Pages Edge Runtime works better with native Response
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType.startsWith('image/') ? contentType : 'image/png',
        'Content-Length': imageBytes.length.toString(),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
        'X-Image-Proxy-Status': 'success',
        'X-Image-Size': imageBytes.length.toString(),
      },
    });

  } catch (error: any) {
    console.error(`[image-proxy #${reqId}] Unhandled error:`, error.message, error.stack);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error', reqId }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
