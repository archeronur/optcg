import { NextRequest, NextResponse } from 'next/server';

// Cloudflare Pages için Edge Runtime
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const src = searchParams.get('src');

    if (!src) {
      return NextResponse.json({ error: 'src parameter is required' }, { status: 400 });
    }

    // URL'yi doğrula
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Sadece HTTP/HTTPS URL'lere izin ver
    if (!['http:', 'https:'].includes(url.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
    }

    // Görseli indir
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(src, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*,image/jpeg,image/png,image/webp,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return NextResponse.json({ error: `HTTP ${response.status}` }, { status: response.status });
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        return NextResponse.json({ error: 'Not an image' }, { status: 400 });
      }

      // Görsel verisini al
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      if (uint8Array.length < 1000) {
        return NextResponse.json({ error: 'Image too small' }, { status: 400 });
      }

      // CORS headers ile yanıt döndür
      return new NextResponse(uint8Array, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': uint8Array.length.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=3600',
        },
      });
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Image proxy error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
