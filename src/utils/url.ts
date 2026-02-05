export function getSiteOrigin(): string {
  // Browser always wins (correct for preview/prod/custom domains)
  // This is critical for Cloudflare Pages where domain can vary
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    // Debug log in dev only
    if (process.env.NODE_ENV === 'development') {
      console.log('[getSiteOrigin] Using browser origin:', origin);
    }
    return origin;
  }

  // SSR / build-time fallback (must be set in Cloudflare Pages env)
  const envOrigin =
    (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL)) || '';

  const fallback = envOrigin || 'http://localhost:3000';
  
  // Debug log in dev only
  if (process.env.NODE_ENV === 'development') {
    console.log('[getSiteOrigin] Using fallback origin:', fallback);
  }
  
  return fallback;
}

/**
 * Normalizes a possibly-relative URL ("/images/x.png") into an absolute URL.
 * Also tolerates protocol-relative URLs ("//example.com/x.png").
 * 
 * CRITICAL for Cloudflare Pages: Always ensures absolute URLs for API routes.
 */
export function toAbsoluteUrl(input: string, origin: string = getSiteOrigin()): string {
  const raw = (input || '').trim();
  if (!raw) {
    console.warn('[toAbsoluteUrl] Empty input, returning empty string');
    return raw;
  }

  // Already absolute
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  // Protocol-relative (//example.com/path)
  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  // Ensure origin is valid
  if (!origin || origin === 'undefined' || origin === 'null') {
    console.error('[toAbsoluteUrl] Invalid origin:', origin, 'falling back to window.location');
    if (typeof window !== 'undefined' && window.location?.origin) {
      origin = window.location.origin;
    } else {
      origin = 'http://localhost:3000';
    }
  }

  try {
    const absoluteUrl = new URL(raw, origin).toString();
    
    // Debug log in dev only
    if (process.env.NODE_ENV === 'development') {
      console.log('[toAbsoluteUrl]', raw, '->', absoluteUrl, '(origin:', origin + ')');
    }
    
    return absoluteUrl;
  } catch (error) {
    console.error('[toAbsoluteUrl] Failed to create URL:', { input: raw, origin, error });
    // Fallback: if it's already a valid-looking URL, return as-is
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    // Last resort: prepend origin
    return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }
}

