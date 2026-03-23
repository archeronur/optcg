/**
 * Proxies external image URLs through our /api/image-proxy endpoint
 * to avoid CORS/CORP (Cross-Origin-Resource-Policy: same-site) restrictions
 * from domains like en.onepiece-cardgame.com
 *
 * Never returns "" — empty src on <img> triggers React/Next warnings and bad browser behavior.
 */
const EMPTY_IMG_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function proxyImageUrl(url: string | undefined | null): string {
  if (url == null || String(url).trim() === "") {
    return EMPTY_IMG_PLACEHOLDER;
  }
  if (url.startsWith("/api/") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return url.trim() === "" ? EMPTY_IMG_PLACEHOLDER : url;
    }
  } catch {
    // Allow same-origin paths; otherwise invalid for <img src>
    return url.startsWith("/") ? url : EMPTY_IMG_PLACEHOLDER;
  }

  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}
