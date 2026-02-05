export function getSiteOrigin(): string {
  // Browser always wins (correct for preview/prod/custom domains)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // SSR / build-time fallback (must be set in Cloudflare Pages env)
  const envOrigin =
    (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL)) || '';

  return envOrigin || 'http://localhost:3000';
}

/**
 * Normalizes a possibly-relative URL ("/images/x.png") into an absolute URL.
 * Also tolerates protocol-relative URLs ("//example.com/x.png").
 */
export function toAbsoluteUrl(input: string, origin: string = getSiteOrigin()): string {
  const raw = (input || '').trim();
  if (!raw) return raw;

  // Already absolute
  if (/^https?:\/\//i.test(raw)) return raw;

  // Protocol-relative
  if (raw.startsWith('//')) return `https:${raw}`;

  return new URL(raw, origin).toString();
}

