export function getSiteOrigin(): string {
  // Browser always wins (correct for preview/prod/custom domains)
  // This is critical for Cloudflare Pages where domain can vary
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    // ALWAYS log - critical for debugging prod issues
    console.log('[getSiteOrigin] Using browser origin:', origin, {
      href: window.location.href,
      pathname: window.location.pathname
    });
    return origin;
  }

  // SSR / build-time fallback (must be set in Cloudflare Pages env)
  const envOrigin =
    (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL)) || '';

  const fallback = envOrigin || 'http://localhost:3000';
  
  // ALWAYS log - critical for debugging
  console.warn('[getSiteOrigin] Using fallback origin (no window):', fallback, {
    hasWindow: typeof window !== 'undefined',
    envOrigin,
    isSSR: typeof window === 'undefined'
  });
  
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
    
    // ALWAYS log - critical for debugging prod issues
    console.log('[toAbsoluteUrl]', raw, '->', absoluteUrl, '(origin:', origin + ')');
    
    return absoluteUrl;
  } catch (error) {
    console.error('[toAbsoluteUrl] Failed to create URL:', { 
      input: raw, 
      origin, 
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined
    });
    // Fallback: if it's already a valid-looking URL, return as-is
    if (/^https?:\/\//i.test(raw)) {
      console.log('[toAbsoluteUrl] Input already absolute, returning as-is:', raw);
      return raw;
    }
    // Last resort: prepend origin
    const fallbackUrl = `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
    console.warn('[toAbsoluteUrl] Using fallback URL:', fallbackUrl);
    return fallbackUrl;
  }
}

