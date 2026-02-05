import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Edge runtime compatible timeout helper (Cloudflare Pages optimized)
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  
  // Cloudflare Edge Runtime: Use AbortController with timeout
  // Note: setTimeout works in Cloudflare Edge Runtime but we use a more compatible approach
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    // Use setTimeout if available (works in Cloudflare Edge Runtime)
    if (typeof setTimeout !== 'undefined') {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Request timeout'));
      }, timeoutMs);
    } else {
      // Fallback: Use a promise that never resolves (timeout handled by Cloudflare)
      // Cloudflare Workers have a default timeout of 30s
      reject(new Error('Timeout not supported in this runtime'));
    }
  });

  try {
    const fetchPromise = fetch(url, {
      ...options,
      signal: controller.signal,
      // NOTE (Edge runtime): Do not set forbidden headers like `User-Agent`, `Referer`, `Accept-Encoding`.
      // Cloudflare Pages/Workers implement a fetch() that rejects these headers.
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    // Cleanup timeout if fetch succeeded
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    return response;
  } catch (error: any) {
    // Cleanup timeout on error
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    if (error.name === 'AbortError' || controller.signal.aborted || error.message === 'Request timeout') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Cloudflare Pages: Handle OPTIONS for CORS preflight
// CRITICAL: This allows browser to make CORS requests for PDF image loading
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}

// Simple request counter for debug logging (in-memory, resets on worker restart)
let debugRequestCount = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // DEBUG: Log first 5 requests (prod debug mode)
    debugRequestCount++;
    if (debugRequestCount <= 5) {
      console.log(`[image-proxy] DEBUG: Request #${debugRequestCount}:`, {
        url: imageUrl.substring(0, 100),
        origin: request.headers.get('origin') || 'none',
        referer: request.headers.get('referer')?.substring(0, 80) || 'none'
      });
    }

    // URL'i doğrula
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      console.error(`[image-proxy] Invalid URL format: ${imageUrl.substring(0, 100)}`);
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Sadece HTTPS ve izin verilen domain'ler (URL allowlist for security)
    const allowedDomains = [
      'optcgapi.com',
      'onepiece-cardgame.com',
      'en.onepiece-cardgame.com',
      'onepiece.limitlesstcg.com'
    ];

    const hostname = url.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      console.error(`[image-proxy] Domain not allowed: ${hostname}`);
      return NextResponse.json(
        { error: 'Domain not allowed' },
        { status: 403 }
      );
    }

    // Ensure HTTPS (security)
    if (url.protocol !== 'https:') {
      console.error(`[image-proxy] Non-HTTPS URL rejected: ${imageUrl.substring(0, 100)}`);
      return NextResponse.json(
        { error: 'Only HTTPS URLs are allowed' },
        { status: 400 }
      );
    }

    // Görseli fetch et (timeout ile - edge runtime compatible, Cloudflare Pages optimized)
    let response: Response;
    try {
      // DEBUG: Log fetch attempt
      if (debugRequestCount <= 5) {
        console.log(`[image-proxy] DEBUG: Fetching image from: ${imageUrl.substring(0, 80)}...`);
      }
      
      response = await fetchWithTimeout(imageUrl, {
        method: 'GET',
        // NOTE (Edge runtime): keep headers minimal & safe.
        // We only need `Accept` to hint image formats. Other headers can break on Workers.
        headers: { 'Accept': 'image/*' },
        // Cloudflare Pages: Ensure redirects are followed
        redirect: 'follow',
        // Cloudflare Pages: Don't include credentials
        credentials: 'omit'
      }, 30000); // 30 saniye timeout (Cloudflare Pages için optimize edildi)
      
      // DEBUG: Log redirect status if any
      if (response.redirected) {
        console.log(`[image-proxy] Redirect followed: ${imageUrl.substring(0, 60)}... -> ${response.url.substring(0, 60)}...`);
      }
      
      // DEBUG: Log response status
      if (debugRequestCount <= 5) {
        console.log(`[image-proxy] DEBUG: Response status: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      console.error(`[image-proxy] Fetch error for ${imageUrl.substring(0, 80)}...:`, {
        error: error?.message || error,
        errorName: error?.name
      });
      if (error.message === 'Request timeout') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[image-proxy] Non-OK response for ${imageUrl.substring(0, 80)}...:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 200)
      });
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Content-Type kontrolü
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) {
      console.warn(`Unexpected content type: ${contentType} for URL: ${imageUrl}`);
      // Yine de devam et, bazı sunucular yanlış header gönderebilir
    }

    // Görsel verisini al
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    if (uint8Array.length < 1000) {
      console.error(`[image-proxy] Image data too small: ${uint8Array.length} bytes`);
      return NextResponse.json(
        { error: 'Image data too small' },
        { status: 400 }
      );
    }

    // DEBUG: Log successful fetch
    if (debugRequestCount <= 5) {
      console.log(`[image-proxy] DEBUG: Successfully fetched image:`, {
        url: imageUrl.substring(0, 60),
        bytes: uint8Array.length,
        contentType: contentType || 'unknown'
      });
    }

    // CORS header'ları ekle (Cloudflare Pages optimized)
    // CRITICAL: These headers ensure images can be fetched from client-side PDF generation
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/png',
        // CRITICAL: CORS headers for PDF generation
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
        // Cloudflare Pages: Add Vary header for better caching
        'Vary': 'Accept-Encoding',
        // Cloudflare Pages: Add CORS preflight support
        'X-Content-Type-Options': 'nosniff'
      }
    });

  } catch (error: any) {
    console.error('Image proxy error:', error);
    
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
