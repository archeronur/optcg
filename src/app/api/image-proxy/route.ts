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
      // Add cache control for preflight
      'Cache-Control': 'public, max-age=86400'
    },
  });
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    console.log('[image-proxy] Request received:', {
      url: imageUrl,
      referer: request.headers.get('referer'),
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent')?.substring(0, 50)
    });

    if (!imageUrl) {
      console.error('[image-proxy] Missing URL parameter');
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // URL'i doğrula
    let url: URL;
    try {
      url = new URL(imageUrl);
      console.log('[image-proxy] Parsed URL:', {
        hostname: url.hostname,
        pathname: url.pathname,
        protocol: url.protocol
      });
    } catch (error) {
      console.error('[image-proxy] Invalid URL format:', imageUrl, error);
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Sadece HTTPS ve izin verilen domain'ler
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
      return NextResponse.json(
        { error: 'Domain not allowed' },
        { status: 403 }
      );
    }

    // MANDATORY: Fetch image server-side (same-origin guarantee, avoids CORS)
    // Cloudflare Edge Runtime fetches from external API, returns as binary
    let response: Response;
    try {
      console.log('[image-proxy] Fetching image server-side:', imageUrl);
      response = await fetchWithTimeout(imageUrl, {
        method: 'GET',
        // NOTE (Edge runtime): keep headers minimal & safe.
        // We only need `Accept` to hint image formats. Other headers can break on Workers.
        headers: { 'Accept': 'image/*' },
        // Cloudflare Pages: Ensure redirects are followed
        redirect: 'follow',
        // Cloudflare Pages: Don't include credentials
        credentials: 'omit'
      }, 45000); // 45 saniye timeout (increased for Cloudflare Pages stability)
      
      console.log('[image-proxy] Fetch response:', {
        url: imageUrl,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        ok: response.ok
      });
    } catch (error: any) {
      console.error('[image-proxy] Fetch error:', {
        url: imageUrl,
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
      console.error('[image-proxy] Non-OK response:', {
        url: imageUrl,
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

    console.log('[image-proxy] Image data received:', {
      url: imageUrl,
      bytes: uint8Array.length,
      contentType: contentType
    });

    if (uint8Array.length < 1000) {
      console.error('[image-proxy] Image data too small:', uint8Array.length);
      return NextResponse.json(
        { error: 'Image data too small' },
        { status: 400 }
      );
    }

    const duration = Date.now() - startTime;
    console.log('[image-proxy] Success:', {
      url: imageUrl,
      bytes: uint8Array.length,
      duration: `${duration}ms`
    });

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
        // Cache control - allow caching but ensure fresh images for PDF generation
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        // Cloudflare Pages: Add Vary header for better caching
        'Vary': 'Accept-Encoding',
        // Cloudflare Pages: Add CORS preflight support
        'X-Content-Type-Options': 'nosniff',
        // Ensure content length is set
        'Content-Length': uint8Array.length.toString()
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[image-proxy] Error:', {
      error: error?.message || error,
      errorName: error?.name,
      stack: error?.stack,
      duration: `${duration}ms`
    });
    
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
