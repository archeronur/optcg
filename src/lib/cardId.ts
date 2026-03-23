/**
 * Normalize One Piece TCG card IDs for DB / CDN lookup.
 * Handles casing, hyphen variants, missing zero padding, and common image suffixes.
 */
export function normalizeCardId(raw: string): string {
  const s = raw
    .trim()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, "");

  const base = s.replace(/_[a-zA-Z0-9]+$/i, "");

  const promo = base.match(/^P[-_]?(\d+)$/i);
  if (promo) {
    return `P-${promo[1].padStart(3, "0")}`;
  }

  const m = base.match(/^([A-Za-z]{2,})(\d{1,3})-(\d{1,3})$/i);
  if (m) {
    const letters = m[1].toUpperCase();
    const mid = m[2].padStart(2, "0");
    const last = m[3].padStart(3, "0");
    return `${letters}${mid}-${last}`;
  }

  return base;
}

export function stripCardImageSuffix(id: string): string {
  return id.replace(/_p\d+$/i, "").replace(/_aa$/i, "");
}
