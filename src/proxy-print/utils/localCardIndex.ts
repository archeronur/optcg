import type { Card } from "@/proxy-print/types";

type TrackerRow = {
  id?: string;
  name?: string;
  fullName?: string;
  image?: string;
  /** OPTCG tracker: filename stem (e.g. EB01-001_p2) when image URL is missing */
  imageId?: string;
  color?: string;
  type?: string;
  cost?: string | number | null;
  rarity?: string;
  subTypes?: string;
  set?: string;
};

function idToSetAndNumber(cardId: string): { set_code: string; number: string } {
  const p = cardId.match(/^P-(\d+)$/i);
  if (p) return { set_code: "PRB", number: p[1].padStart(3, "0") };
  const m = cardId.match(/^([A-Za-z]{2,4})(\d{2})-(\d{3})(_[A-Za-z0-9]+)?$/i);
  if (m) {
    return {
      set_code: `${m[1]}${m[2]}`,
      number: `${m[3]}${m[4] ?? ""}`,
    };
  }
  const dash = cardId.indexOf("-");
  if (dash > 0) {
    return { set_code: cardId.slice(0, dash), number: cardId.slice(dash + 1) };
  }
  return { set_code: "", number: "" };
}

function detectVariantQuick(
  cardId: string,
  rarity: string,
): Pick<Card, "variant" | "variantLabel"> {
  const id = cardId.toLowerCase();
  const r = (rarity || "").toLowerCase();
  if (id.includes("_aa")) return { variant: "alternate-art", variantLabel: "AA" };
  if (/_sp\b|_sp$/i.test(cardId)) return { variant: "sp", variantLabel: "SP" };
  if (/_manga/i.test(cardId)) return { variant: "manga", variantLabel: "Manga" };
  if (/_p\d/i.test(cardId)) {
    const mm = cardId.match(/_p(\d+)/i);
    return { variant: "parallel", variantLabel: mm ? `P${mm[1]}` : "P" };
  }
  if (id.startsWith("p-") || id.startsWith("prb")) {
    return { variant: "promo", variantLabel: "Promo" };
  }
  if (r === "l" || r === "leader") return { variant: "standard", variantLabel: "Leader" };
  if (r === "sec" || r.includes("secret")) return { variant: "sp", variantLabel: "SEC" };
  return { variant: "standard" };
}

export function trackerRowToSearchCard(key: string, row: TrackerRow): Card | null {
  const id = (row.id || key || "").trim();
  if (!id) return null;
  const fromRow = (row.image || "").trim();
  const fromImageId = (row.imageId || "").trim();
  let img = fromRow;
  if (!img && fromImageId) {
    img = `https://en.onepiece-cardgame.com/images/cardlist/card/${fromImageId}.png`;
  }
  if (!img) {
    img = `https://en.onepiece-cardgame.com/images/cardlist/card/${id}.png`;
  }
  const { set_code, number } = idToSetAndNumber(id);
  const colors = row.color
    ? row.color.split(/\s+/).filter(Boolean)
    : [];
  let cost: number | undefined;
  if (row.cost != null && row.cost !== "") {
    const n = parseInt(String(row.cost), 10);
    if (!Number.isNaN(n)) cost = n;
  }
  const { variant, variantLabel } = detectVariantQuick(id, row.rarity || "");

  return {
    id,
    // fullName often includes set treatment (e.g. "(SPR)") — matches op / deck list search better
    name: ((row.fullName || row.name || id) as string).trim(),
    set_code,
    set_name: (row.set || set_code || "").trim(),
    number,
    rarity: (row.rarity || "").trim(),
    image_uris: {
      full: img,
      large: img,
      small: img,
    },
    colors,
    cost,
    type: (row.type || "").trim(),
    subtypes: row.subTypes ? row.subTypes.split(/\s+/).filter(Boolean) : [],
    variant,
    variantLabel,
  };
}

/** Build proxy-print search cards from repo `data/cards.json` (tracker shape). */
export function cardsJsonToSearchCards(
  raw: Record<string, unknown>,
): Card[] {
  const out: Card[] = [];
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== "object") continue;
    const card = trackerRowToSearchCard(key, val as TrackerRow);
    if (card) out.push(card);
  }
  return out;
}
