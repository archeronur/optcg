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
      // Cloudflare Pages: Add headers for better compatibility
      headers: {
        ...options.headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
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
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
}

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

    // URL'i doğrula
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
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

    // Görseli fetch et (timeout ile - edge runtime compatible, Cloudflare Pages optimized)
    let response: Response;
    try {
      // Cloudflare Pages: Use fetch directly with proper headers
      response = await fetchWithTimeout(imageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/*,image/jpeg,image/png,image/webp,image/avif',
          'Referer': url.origin,
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Cloudflare Pages: Ensure redirects are followed
        redirect: 'follow',
        // Cloudflare Pages: Don't include credentials
        credentials: 'omit'
      }, 30000); // 30 saniye timeout (Cloudflare Pages için optimize edildi)
    } catch (error: any) {
      if (error.message === 'Request timeout') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }
      throw error;
    }

    if (!response.ok) {
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
      return NextResponse.json(
        { error: 'Image data too small' },
        { status: 400 }
      );
    }

    // CORS header'ları ekle (Cloudflare Pages optimized)
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Max-Age': '86400',
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
