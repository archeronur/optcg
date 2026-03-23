import type {
  SummaryData,
  MetaData,
  EventData,
  Deck,
  DeckCard,
  LeaderStats,
  CardAnalysis,
} from "@/lib/types";
import summaryJson from "../../data/summary.json";
import op01Meta from "../../data/metas/op01.json";
import op02Meta from "../../data/metas/op02.json";
import op03Meta from "../../data/metas/op03.json";
import op04Meta from "../../data/metas/op04.json";
import op05Meta from "../../data/metas/op05.json";
import op06Meta from "../../data/metas/op06.json";
import op07Meta from "../../data/metas/op07.json";
import op08Meta from "../../data/metas/op08.json";
import op09Meta from "../../data/metas/op09.json";
import op10Meta from "../../data/metas/op10.json";
import op11Meta from "../../data/metas/op11.json";
import op12Meta from "../../data/metas/op12.json";
import op13Meta from "../../data/metas/op13.json";
import op14Meta from "../../data/metas/op14.json";
import op15Meta from "../../data/metas/op15.json";

/** Basenames under `data/metas/` — keep in sync when adding meta JSON files. */
const KNOWN_META_IDS = [
  "op01",
  "op02",
  "op03",
  "op04",
  "op05",
  "op06",
  "op07",
  "op08",
  "op09",
  "op10",
  "op11",
  "op12",
  "op13",
  "op14",
  "op15",
] as const;

const META_JSON_BY_ID: Record<string, unknown> = {
  op01: op01Meta,
  op02: op02Meta,
  op03: op03Meta,
  op04: op04Meta,
  op05: op05Meta,
  op06: op06Meta,
  op07: op07Meta,
  op08: op08Meta,
  op09: op09Meta,
  op10: op10Meta,
  op11: op11Meta,
  op12: op12Meta,
  op13: op13Meta,
  op14: op14Meta,
  op15: op15Meta,
};

function normalizeDeckCard(c: unknown): DeckCard | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const count =
    typeof o.count === "number" && !Number.isNaN(o.count)
      ? o.count
      : Number(o.count) || 0;
  return { id, count };
}

function normalizeDeck(d: unknown): Deck {
  if (!d || typeof d !== "object") {
    return {
      placing: "",
      leader: "",
      leaderId: "",
      player: "",
      deckUrl: "",
      cards: [],
    };
  }
  const o = d as Record<string, unknown>;
  const cardsRaw = Array.isArray(o.cards) ? o.cards : [];
  const cards = cardsRaw
    .map(normalizeDeckCard)
    .filter((x): x is DeckCard => x !== null);
  return {
    placing:
      typeof o.placing === "string"
        ? o.placing
        : o.placing != null
          ? String(o.placing)
          : "",
    leader: typeof o.leader === "string" ? o.leader : "",
    leaderId: typeof o.leaderId === "string" ? o.leaderId : "",
    player: typeof o.player === "string" ? o.player : "",
    deckUrl: typeof o.deckUrl === "string" ? o.deckUrl : "",
    cards,
  };
}

function normalizeLeaderDistribution(
  raw: unknown,
): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

function normalizeEvent(e: unknown): EventData {
  if (!e || typeof e !== "object") {
    return {
      name: "",
      url: "",
      type: "",
      date: "",
      players: 0,
      rounds: "",
      leaderDistribution: {},
      decks: [],
    };
  }
  const o = e as Record<string, unknown>;
  const decksRaw = Array.isArray(o.decks) ? o.decks : [];
  return {
    name: typeof o.name === "string" ? o.name : "",
    url: typeof o.url === "string" ? o.url : "",
    type: typeof o.type === "string" ? o.type : "",
    date: typeof o.date === "string" ? o.date : "",
    players:
      typeof o.players === "number" && !Number.isNaN(o.players)
        ? o.players
        : Number(o.players) || 0,
    rounds: typeof o.rounds === "string" ? o.rounds : "",
    leaderDistribution: normalizeLeaderDistribution(o.leaderDistribution),
    decks: decksRaw.map(normalizeDeck),
  };
}

function normalizeCardAnalysis(c: unknown): CardAnalysis | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  return {
    id,
    inclusionRate: Number(o.inclusionRate) || 0,
    avgCount: Number(o.avgCount) || 0,
  };
}

function normalizeCardAnalysisList(raw: unknown): CardAnalysis[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map(normalizeCardAnalysis)
    .filter((x): x is CardAnalysis => x !== null);
  return out.length ? out : undefined;
}

function normalizeLeaderStats(l: unknown): LeaderStats | null {
  if (!l || typeof l !== "object") return null;
  const o = l as Record<string, unknown>;
  const leaderId = typeof o.leaderId === "string" ? o.leaderId : "";
  if (!leaderId) return null;
  const num = (v: unknown) =>
    typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0;
  return {
    leader: typeof o.leader === "string" ? o.leader : leaderId,
    leaderId,
    totalAppearances: num(o.totalAppearances),
    wins: num(o.wins),
    second: num(o.second),
    third: num(o.third),
    fourth: num(o.fourth),
    top4: num(o.top4),
    top8: num(o.top8),
    top16: num(o.top16),
    top32: num(o.top32),
    uniquePlayers: num(o.uniquePlayers),
    uniqueEvents: num(o.uniqueEvents),
    players: Array.isArray(o.players)
      ? o.players.filter((x): x is string => typeof x === "string")
      : [],
    events: Array.isArray(o.events)
      ? o.events.filter((x): x is string => typeof x === "string")
      : [],
    winRate: typeof o.winRate === "number" ? o.winRate : undefined,
    topRate: typeof o.topRate === "number" ? o.topRate : undefined,
    conversionRate:
      typeof o.conversionRate === "number" ? o.conversionRate : undefined,
    metaShare: typeof o.metaShare === "number" ? o.metaShare : undefined,
    points: typeof o.points === "number" ? o.points : undefined,
    coreCards: normalizeCardAnalysisList(o.coreCards),
    flexCards: normalizeCardAnalysisList(o.flexCards),
  };
}

/** Coerce scraped/partial JSON so missing arrays/objects never crash RSC render. */
function normalizeMetaData(raw: unknown): MetaData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const eventsRaw = Array.isArray(o.events) ? o.events : [];
  const leaderStatsRaw = Array.isArray(o.leaderStats) ? o.leaderStats : [];
  const leaderStats = leaderStatsRaw
    .map(normalizeLeaderStats)
    .filter((x): x is LeaderStats => x !== null);
  return {
    id,
    name: typeof o.name === "string" ? o.name : id,
    url: typeof o.url === "string" ? o.url : "",
    events: eventsRaw.map(normalizeEvent),
    leaderStats,
  };
}

export function getSummary(): SummaryData {
  const data = summaryJson as SummaryData;
  if (!data.metas || !Array.isArray(data.metas)) {
    return { metas: [], totalEvents: 0, totalDecks: 0 };
  }
  const out: SummaryData = { ...data, metas: [...data.metas] };
  if (out.totalEvents == null) {
    out.totalEvents = out.metas.reduce((sum, m) => sum + m.eventCount, 0);
  }
  if (out.totalDecks == null) {
    out.totalDecks = out.metas.reduce(
      (sum, m) => sum + (m.totalDecks ?? m.deckCount ?? 0),
      0,
    );
  }
  return out;
}

async function loadMetaFromFs(metaId: string): Promise<MetaData | null> {
  try {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const raw = readFileSync(
      join(process.cwd(), "data", "metas", `${metaId}.json`),
      "utf-8",
    );
    return normalizeMetaData(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function loadMetaFromStaticAsset(metaId: string): Promise<MetaData | null> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;
    const proto = h.get("x-forwarded-proto") ?? "https";
    const url = `${proto}://${host}/data/metas/${metaId}.json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return normalizeMetaData((await res.json()) as unknown);
  } catch {
    return null;
  }
}

/**
 * Loads meta JSON from disk during `next build` / Node, and from `/data/metas/*.json`
 * on Cloudflare Workers (no filesystem).
 */
export async function getMetaData(metaId: string): Promise<MetaData | null> {
  const id = metaId.toLowerCase();
  const fromImport = normalizeMetaData(META_JSON_BY_ID[id]);
  if (fromImport) return fromImport;
  const fromFs = await loadMetaFromFs(id);
  if (fromFs) return fromFs;
  return loadMetaFromStaticAsset(id);
}

export function getAllMetaIds(): string[] {
  const summary = getSummary();
  const ids = new Set(summary.metas.map((m) => m.id.toLowerCase()));
  for (const id of KNOWN_META_IDS) ids.add(id);
  return [...ids].sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
    return numB - numA;
  });
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
