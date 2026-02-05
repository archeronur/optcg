import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Allowed domains
const ALLOWED_DOMAINS = [
  'optcgapi.com',
  'onepiece-cardgame.com',
  'en.onepiece-cardgame.com',
  'onepiece.limitlesstcg.com',
];

// Helper: Create JSON response (Cloudflare Workers compatible)
function jsonResponse(data: object, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

// Helper: Create binary response
function binaryResponse(data: ArrayBuffer, contentType: string): Response {
  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(data.byteLength),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// OPTIONS handler
export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// GET handler
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const url = request.nextUrl.searchParams.get('url');
    
    console.log('[proxy] Request:', url?.substring(0, 80) || 'none');
    
    if (!url) {
      return jsonResponse({ error: 'URL required' }, 400);
    }
    
    // Parse URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return jsonResponse({ error: 'Invalid URL' }, 400);
    }
    
    // Check domain
    const host = parsedUrl.hostname.toLowerCase();
    const allowed = ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
    if (!allowed) {
      console.log('[proxy] Blocked:', host);
      return jsonResponse({ error: 'Domain not allowed' }, 403);
    }
    
    // Require HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return jsonResponse({ error: 'HTTPS required' }, 400);
    }
    
    // Fetch image
    console.log('[proxy] Fetching:', url.substring(0, 80));
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'image/*' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      console.error('[proxy] Fetch error:', fetchErr.message);
      if (fetchErr.name === 'AbortError') {
        return jsonResponse({ error: 'Timeout' }, 504);
      }
      return jsonResponse({ error: fetchErr.message }, 502);
    }
    
    console.log('[proxy] Response:', response.status);
    
    if (!response.ok) {
      return jsonResponse({ error: `HTTP ${response.status}` }, response.status);
    }
    
    // Read body
    let buffer: ArrayBuffer;
    try {
      buffer = await response.arrayBuffer();
    } catch (bufErr: any) {
      console.error('[proxy] Buffer error:', bufErr.message);
      return jsonResponse({ error: 'Read failed' }, 500);
    }
    
    console.log('[proxy] Success:', buffer.byteLength, 'bytes');
    
    if (buffer.byteLength < 100) {
      return jsonResponse({ error: 'Too small' }, 400);
    }
    
    const ct = response.headers.get('content-type') || 'image/png';
    return binaryResponse(buffer, ct);
    
  } catch (err: any) {
    console.error('[proxy] Error:', err.message);
    return jsonResponse({ error: err.message || 'Unknown error' }, 500);
  }
}
