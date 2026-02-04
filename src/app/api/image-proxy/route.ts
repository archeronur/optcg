import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Edge runtime compatible timeout helper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 20000): Promise<Response> {
  const controller = new AbortController();
  
  // Create timeout promise
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
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

    // Görseli fetch et (timeout ile - edge runtime compatible)
    let response: Response;
    try {
      response = await fetchWithTimeout(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,image/jpeg,image/png,image/webp',
          'Referer': url.origin
        }
      }, 20000); // 20 saniye timeout (Cloudflare Pages için daha uzun)
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

    // CORS header'ları ekle
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=31536000, immutable'
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
