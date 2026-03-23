import type { Card } from "@/lib/types";
import { normalizeCardId } from "@/lib/cardId";

/**
 * True when `name` is missing or is effectively the same as the card id (any casing / promo form).
 * Used to decide API hydration and to prefer `fullName` in the UI.
 */
export function cardNameLooksLikeId(card: {
  id: string;
  name?: string | null;
}): boolean {
  const n = (card.name ?? "").trim();
  const id = (card.id ?? "").trim();
  if (!n) return true;
  if (n === id) return true;
  return normalizeCardId(n) === normalizeCardId(id);
}

/** Safe display name for tracker UI (client-safe; no DB reads). */
export function cardDisplayName(card: Card): string {
  if (!cardNameLooksLikeId(card)) {
    return (card.name ?? "").trim();
  }
  const fn = card.fullName?.trim();
  if (fn) {
    const part = fn.split(" - ")[0]?.split(" (")[0]?.trim();
    if (part) return part;
  }
  return card.id;
}
