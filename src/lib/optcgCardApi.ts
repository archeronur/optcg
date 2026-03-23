import type { Card } from "@/lib/types";

type OptcgRow = {
  card_name?: string;
  card_image?: string;
  card_image_id?: string;
  card_color?: string;
  card_type?: string;
  card_cost?: string | number | null;
  card_power?: string | number | null;
  rarity?: string;
  card_text?: string;
  attribute?: string;
  sub_types?: string;
  life?: string | number | null;
  set_name?: string;
};

function str(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseName(cardName: string): string {
  if (!cardName) return "";
  return cardName.split(" - ")[0]?.split(" (")[0]?.trim() ?? "";
}

function rowToCard(cardId: string, row: OptcgRow): Card {
  const full = row.card_name ?? "";
  return {
    id: cardId,
    name: parseName(full) || cardId,
    fullName: full || undefined,
    image: str(row.card_image) || "",
    color: str(row.card_color),
    type: str(row.card_type),
    cost: str(row.card_cost),
    power: str(row.card_power),
    rarity: str(row.rarity),
    text: str(row.card_text),
    attribute: str(row.attribute),
    subTypes: str(row.sub_types),
    life: str(row.life),
    set: str(row.set_name),
  };
}

async function tryFetch(url: string): Promise<OptcgRow | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
      return data[0] as OptcgRow;
    }
    return null;
  } catch {
    return null;
  }
}

type LimitlessRow = {
  name?: string;
  card_name?: string;
  color?: string;
  card_color?: string;
  category?: string;
  type?: string;
  cost?: string | number | null;
  card_cost?: string | number | null;
  power?: string | number | null;
  card_power?: string | number | null;
  rarity?: string;
  effect?: string;
  text?: string;
  attribute?: string;
  types?: string;
  life?: string | number | null;
  set_name?: string;
  set?: string;
};

async function tryLimitless(cardId: string): Promise<Card | null> {
  try {
    const url = `https://onepiece.limitlesstcg.com/api/cards/${encodeURIComponent(cardId)}`;
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as LimitlessRow;
    const name = data.name || data.card_name || "";
    if (!name || name === cardId) return null;
    const setPrefix = cardId.split("-")[0]?.toLowerCase() ?? "";
    const image = setPrefix
      ? `https://limitlesstcg.nyc3.digitaloceanspaces.com/one-piece/${setPrefix}/${cardId}_${cardId}.webp`
      : "";
    return {
      id: cardId,
      name: parseName(name) || cardId,
      fullName: name || undefined,
      image,
      color: str(data.color ?? data.card_color),
      type: str(data.category ?? data.type),
      cost: str(data.cost ?? data.card_cost),
      power: str(data.power ?? data.card_power),
      rarity: str(data.rarity),
      text: str(data.effect ?? data.text),
      attribute: str(data.attribute),
      subTypes: str(data.types),
      life: str(data.life),
      set: str(data.set_name ?? data.set),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch card metadata: Limitless first (reliable, avoids optcgapi throttling),
 * then optcgapi.com for cards Limitless does not have.
 */
export async function fetchOptcgCard(cardId: string): Promise<Card | null> {
  try {
    const limitlessFirst = await tryLimitless(cardId);
    if (limitlessFirst) return limitlessFirst;

    const enc = encodeURIComponent(cardId);
    const base = "https://optcgapi.com/api";
    const prefix = cardId.split("-")[0]?.toUpperCase() ?? "";

    if (prefix.startsWith("ST")) {
      const d = await tryFetch(`${base}/decks/card/${enc}/?format=json`);
      if (d) return rowToCard(cardId, d);
    }

    if (prefix.startsWith("EB") || prefix.startsWith("PRB")) {
      let d = await tryFetch(`${base}/sets/card/${enc}/?format=json`);
      if (d) return rowToCard(cardId, d);
      d = await tryFetch(`${base}/decks/card/${enc}/?format=json`);
      if (d) return rowToCard(cardId, d);
    }

    let d = await tryFetch(`${base}/sets/card/${enc}/?format=json`);
    if (d) return rowToCard(cardId, d);

    d = await tryFetch(`${base}/decks/card/${enc}/?format=json`);
    if (d) return rowToCard(cardId, d);

    return null;
  } catch {
    return null;
  }
}
