import type { Card, Deck, LeaderStats } from "@/lib/types";
import { normalizeCardId } from "@/lib/cardId";
import { getCard, generateCardImageUrl } from "@/lib/cards";
import { cardDisplayName as cardDisplayNameFn } from "@/lib/cardDisplay";

export { cardDisplayName } from "@/lib/cardDisplay";

/** Resolve a card from a hydrated map when deck ids differ by case / promo formatting. */
export function lookupCardData(
  map: Record<string, Card>,
  rawId: string,
): Card | undefined {
  if (!rawId) return undefined;
  const direct = map[rawId];
  if (direct) return direct;
  const norm = normalizeCardId(rawId);
  if (map[norm]) return map[norm];
  const lower = rawId.toLowerCase();
  for (const k of Object.keys(map)) {
    if (k.toLowerCase() === lower) return map[k];
    if (normalizeCardId(k) === norm) return map[k];
  }
  return undefined;
}

export const LEADER_COLOR_FALLBACK: Record<string, string> = {
  "OP01-003": "Red Green",
  "OP01-060": "Blue Purple",
  "OP01-061": "Purple Blue",
  "OP02-002": "Red Black",
  "OP02-025": "Green",
  "OP02-049": "Blue",
  "OP02-071": "Purple",
  "OP02-072": "Black Purple",
  "OP03-021": "Green",
  "OP03-022": "Yellow Green",
  "OP03-076": "Black",
  "OP03-077": "Black Yellow",
  "OP04-019": "Purple Green",
  "OP04-039": "Black Blue",
  "OP05-041": "Blue Black",
  "OP05-060": "Red",
  "OP05-098": "Yellow",
  "OP06-080": "Black Purple",
  "OP07-019": "Green Yellow",
  "OP07-079": "Black",
  "OP09-062": "Purple Yellow",
  "OP13-079": "Black",
  "OP14-020": "Green",
  "OP14-040": "Blue",
  "OP14-041": "Purple",
  "ST01-001": "Red",
  "ST02-001": "Green",
  "ST03-001": "Blue",
  "ST07-001": "Yellow",
  "ST08-001": "Purple",
  "ST09-001": "Yellow",
  "ST10-001": "Blue Green",
  "ST10-003": "Green",
  "ST12-001": "Green Blue",
  "ST13-003": "Black Yellow",
};

export function getLeaderImage(leaderId: string): string {
  const card = getCard(leaderId);
  if (card?.image) return card.image;
  const norm = normalizeCardId(leaderId);
  return generateCardImageUrl(norm);
}

export function getLeaderColor(leaderId: string): string {
  const card = getCard(leaderId);
  if (card?.color) return card.color;
  const norm = normalizeCardId(leaderId);
  return LEADER_COLOR_FALLBACK[leaderId] ?? LEADER_COLOR_FALLBACK[norm] ?? "Black";
}

export function getLeaderInfo(leaderId: string): {
  name: string;
  image: string;
  color: string;
} {
  const card = getCard(leaderId);
  const norm = normalizeCardId(leaderId);
  const resolved = card
    ? { ...card, id: leaderId }
    : ({
        id: leaderId,
        name: leaderId,
        image: generateCardImageUrl(norm),
        color: LEADER_COLOR_FALLBACK[leaderId] ?? LEADER_COLOR_FALLBACK[norm] ?? "Black",
        type: "",
        cost: "",
        power: "",
        rarity: "",
        text: "",
        attribute: "",
        subTypes: "",
        life: "",
        set: "",
      } satisfies Card);
  return {
    name: cardDisplayNameFn(resolved),
    image: resolved.image,
    color: resolved.color || getLeaderColor(leaderId),
  };
}

function fallbackCard(rawId: string): Card {
  const norm = normalizeCardId(rawId);
  return {
    id: rawId,
    name: norm,
    image: generateCardImageUrl(norm),
    color: LEADER_COLOR_FALLBACK[norm] ?? LEADER_COLOR_FALLBACK[rawId] ?? "",
    type: "",
    cost: "",
    power: "",
    rarity: "",
    text: "",
    attribute: "",
    subTypes: "",
    life: "",
    set: norm.split("-")[0] || "",
  };
}

function isStubCard(card: Card): boolean {
  const n = (card.name ?? "").trim();
  return (!n || n === card.id) && !card.image;
}

export function getCardsForDecks(decks: Deck[]): Record<string, Card> {
  const cardIds = new Set<string>();
  for (const deck of decks) {
    if (deck.leaderId) cardIds.add(deck.leaderId);
    for (const c of deck.cards ?? []) {
      if (c?.id) cardIds.add(c.id);
    }
  }

  const result: Record<string, Card> = {};

  for (const rawId of cardIds) {
    const fromDb = getCard(rawId);
    if (fromDb && !isStubCard(fromDb)) {
      result[rawId] = { ...fromDb, id: rawId };
    } else {
      const fb = fallbackCard(rawId);
      if (fromDb) {
        fb.name = fromDb.name && fromDb.name !== fromDb.id ? fromDb.name : fb.name;
        fb.color = fromDb.color || fb.color;
        fb.type = fromDb.type || fb.type;
      }
      result[rawId] = fb;
    }
  }

  return result;
}

/** Include core/flex stat card IDs so they hydrate and display even if absent from every deck list. */
export function enrichCardMapWithStats(
  map: Record<string, Card>,
  stats: Pick<LeaderStats, "coreCards" | "flexCards">,
): Record<string, Card> {
  const out = { ...map };
  for (const c of [...(stats.coreCards ?? []), ...(stats.flexCards ?? [])]) {
    if (out[c.id]) continue;
    const fromDb = getCard(c.id);
    if (fromDb && !isStubCard(fromDb)) {
      out[c.id] = { ...fromDb, id: c.id };
    } else {
      out[c.id] = fallbackCard(c.id);
    }
  }
  return out;
}

/** Same card under normalized id (e.g. p-048 → P-048) so deck lookups always resolve. */
export function addCanonicalCardIdAliases(map: Record<string, Card>): void {
  for (const k of Object.keys(map)) {
    const norm = normalizeCardId(k);
    if (norm !== k && map[norm] === undefined) {
      map[norm] = map[k];
    }
    if (norm !== k && map[k] === undefined && map[norm] !== undefined) {
      map[k] = map[norm];
    }
  }
}
