import type { Card } from "@/lib/types";
import { normalizeCardId, stripCardImageSuffix } from "@/lib/cardId";
import cardsJson from "../../data/cards.json";

const db = cardsJson as unknown as Record<string, Card>;

export function getCardsDB(): Card[] {
  return Object.values(db);
}

function candidateCardIds(rawId: string): string[] {
  const trimmed = rawId.trim();
  const norm = normalizeCardId(trimmed);
  const stripped = stripCardImageSuffix(norm);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of [trimmed, norm, stripped]) {
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/** Resolve a card from the local DB using normalized / de-suffixed IDs. */
export function getCard(cardId: string): Card | undefined {
  for (const key of candidateCardIds(cardId)) {
    const hit = db[key];
    if (hit) return hit;
  }
  return undefined;
}

export function generateCardImageUrl(cardId: string): string {
  const id = normalizeCardId(cardId);
  return `https://en.onepiece-cardgame.com/images/cardlist/card/${id}.png`;
}

export function getCardImage(cardId: string): string {
  const card = getCard(cardId);
  if (card?.image) return card.image;
  return generateCardImageUrl(cardId);
}
