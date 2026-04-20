import type { CardAnalysis, LeaderStats, MetaData } from "@/lib/types";

export const POINT_WEIGHTS = {
  first: 10,
  second: 8,
  third: 7,
  fourth: 6,
  top8: 4,
  top16: 2,
  top32: 1,
} as const;

type Bucket = "first" | "second" | "third" | "fourth" | "top8" | "top16" | "top32";

function parseRankFromPlacing(placing: string): number | null {
  const p = String(placing || "").trim().toLowerCase();
  if (!p) return null;

  // If the source writes "top16", keep it numeric for range checks.
  const topMatch = p.match(/top\s*(\d+)\b/);
  if (topMatch?.[1]) {
    const topN = Number.parseInt(topMatch[1], 10);
    return Number.isNaN(topN) ? null : topN;
  }

  // Handles "9th", "10th", also common typos like "7h".
  const startNumberMatch = p.match(/^(\d+)\s*[a-z]*$/i);
  if (startNumberMatch?.[1]) {
    const n = Number.parseInt(startNumberMatch[1], 10);
    return Number.isNaN(n) ? null : n;
  }

  const anywhereNumberMatch = p.match(/\b(\d+)\b/);
  if (anywhereNumberMatch?.[1]) {
    const n = Number.parseInt(anywhereNumberMatch[1], 10);
    return Number.isNaN(n) ? null : n;
  }

  return null;
}

export function classifyPlacing(placing: string): Bucket | null {
  const p = String(placing || "").trim().toLowerCase();
  if (!p) return null;
  if (p === "1st") return "first";
  if (p === "2nd") return "second";
  if (p === "3rd") return "third";
  if (p === "4th") return "fourth";
  // Many event pages only publish "Top 4" instead of separate 3rd/4th.
  if (/top\s*4\b/.test(p)) return "fourth";

  if (["5th", "6th", "7th", "8th"].includes(p) || /top\s*8\b/.test(p)) return "top8";
  if (/top\s*16\b/.test(p)) return "top16";
  if (/top\s*32\b/.test(p)) return "top32";

  const rank = parseRankFromPlacing(p);
  if (rank == null) return null;
  if (rank === 1) return "first";
  if (rank === 2) return "second";
  if (rank === 3) return "third";
  if (rank === 4) return "fourth";
  if (rank >= 5 && rank <= 8) return "top8";
  if (rank >= 9 && rank <= 16) return "top16";
  if (rank >= 17 && rank <= 32) return "top32";
  return null;
}

function emptyStats(leaderId: string): LeaderStats {
  return {
    leader: leaderId,
    leaderId,
    totalAppearances: 0,
    wins: 0,
    second: 0,
    third: 0,
    fourth: 0,
    top4: 0,
    top8: 0,
    top16: 0,
    top32: 0,
    uniquePlayers: 0,
    uniqueEvents: 0,
    players: [],
    events: [],
    points: 0,
    winRate: 0,
    conversionRate: 0,
    metaShare: 0,
  };
}

/**
 * Build per-leader card usage analysis from raw deck lists.
 *
 * Older meta JSONs (op06-op13) ship with precomputed `coreCards`/`flexCards`
 * baked into `meta.leaderStats`. Newer import scripts (op14, op15, …) never
 * populated these fields, which leaves the Core/Flex sections empty on the
 * leader detail and Compare pages. We fall back to this derivation so every
 * meta — past or future — has usage numbers.
 *
 * inclusionRate: % of that leader's decks that include the card.
 * avgCount:      average copies across decks that include it.
 */
function computeCardAnalysisByLeader(meta: MetaData): Map<string, CardAnalysis[]> {
  const decksByLeader = new Map<string, Array<{ cards: { id: string; count: number }[] }>>();
  for (const event of meta.events ?? []) {
    for (const deck of event.decks ?? []) {
      const id = deck.leaderId || deck.leader || "";
      if (!id) continue;
      const list = decksByLeader.get(id) ?? [];
      list.push({ cards: deck.cards ?? [] });
      decksByLeader.set(id, list);
    }
  }

  const result = new Map<string, CardAnalysis[]>();
  for (const [leaderId, decks] of decksByLeader) {
    const total = decks.length;
    if (total === 0) {
      result.set(leaderId, []);
      continue;
    }

    const tally = new Map<string, { decks: number; copies: number }>();
    for (const { cards } of decks) {
      for (const c of cards) {
        if (!c?.id || c.id === leaderId) continue;
        const entry = tally.get(c.id) ?? { decks: 0, copies: 0 };
        entry.decks += 1;
        entry.copies += Number(c.count) || 0;
        tally.set(c.id, entry);
      }
    }

    const analysis: CardAnalysis[] = [];
    for (const [id, t] of tally) {
      const rate = Math.round((t.decks / total) * 1000) / 10;
      if (rate < 2) continue; // drop ultra-fringe inclusions for signal
      const avg = t.decks > 0 ? Math.round((t.copies / t.decks) * 10) / 10 : 0;
      analysis.push({ id, inclusionRate: rate, avgCount: avg });
    }
    analysis.sort((a, b) => b.inclusionRate - a.inclusionRate);
    result.set(leaderId, analysis);
  }
  return result;
}

export function computeLeaderStatsFromMeta(meta: MetaData): LeaderStats[] {
  const byLeader = new Map<
    string,
    LeaderStats & { _players: Set<string>; _events: Set<string> }
  >();
  let totalAppearances = 0;

  for (const event of meta.events) {
    for (const deck of event.decks || []) {
      const leaderId = deck.leaderId || deck.leader || "";
      if (!leaderId) continue;
      totalAppearances += 1;
      if (!byLeader.has(leaderId)) {
        byLeader.set(leaderId, {
          ...emptyStats(leaderId),
          _players: new Set<string>(),
          _events: new Set<string>(),
        });
      }
      const s = byLeader.get(leaderId)!;
      s.totalAppearances += 1;
      if (deck.player) s._players.add(deck.player);
      if (event.name) s._events.add(event.name);

      const bucket = classifyPlacing(deck.placing);
      if (bucket === "first") {
        s.wins += 1;
        s.top4 += 1;
      } else if (bucket === "second") {
        s.second = (s.second || 0) + 1;
        s.top4 += 1;
      } else if (bucket === "third") {
        s.third = (s.third || 0) + 1;
        s.top4 += 1;
      } else if (bucket === "fourth") {
        s.fourth = (s.fourth || 0) + 1;
        s.top4 += 1;
      } else if (bucket === "top8") {
        s.top8 += 1;
      } else if (bucket === "top16") {
        s.top16 += 1;
      } else if (bucket === "top32") {
        s.top32 += 1;
      }
    }
  }

  const priorByLeader = new Map(meta.leaderStats.map((s) => [s.leaderId, s]));

  // Lazily compute card analysis only if at least one leader needs the fallback.
  let dynamicAnalysis: Map<string, CardAnalysis[]> | null = null;
  const getDynamicAnalysis = () => {
    if (!dynamicAnalysis) dynamicAnalysis = computeCardAnalysisByLeader(meta);
    return dynamicAnalysis;
  };

  const out: LeaderStats[] = Array.from(byLeader.values()).map((s) => {
    const prior = priorByLeader.get(s.leaderId);
    const priorCore = prior?.coreCards ?? [];
    const priorFlex = prior?.flexCards ?? [];
    const hasPriorCardData = priorCore.length > 0 || priorFlex.length > 0;

    let coreCards: CardAnalysis[] | undefined = prior?.coreCards;
    let flexCards: CardAnalysis[] | undefined = prior?.flexCards;
    if (!hasPriorCardData) {
      const all = getDynamicAnalysis().get(s.leaderId) ?? [];
      // Split at 80% to mirror the convention baked into the legacy JSONs.
      // Render layers re-split at 70%, so the exact threshold here is not
      // visible to users; we just need both arrays populated.
      coreCards = all.filter((c) => c.inclusionRate >= 80);
      flexCards = all.filter((c) => c.inclusionRate < 80);
    }
    const points =
      s.wins * POINT_WEIGHTS.first +
      (s.second || 0) * POINT_WEIGHTS.second +
      (s.third || 0) * POINT_WEIGHTS.third +
      (s.fourth || 0) * POINT_WEIGHTS.fourth +
      s.top8 * POINT_WEIGHTS.top8 +
      s.top16 * POINT_WEIGHTS.top16 +
      s.top32 * POINT_WEIGHTS.top32;
    const topCount = s.wins + (s.second || 0) + (s.third || 0) + (s.fourth || 0) + s.top8;

    return {
      ...s,
      uniquePlayers: s._players.size,
      uniqueEvents: s._events.size,
      players: Array.from(s._players),
      events: Array.from(s._events),
      points,
      winRate: s.totalAppearances > 0 ? Math.round((s.wins / s.totalAppearances) * 100) : 0,
      conversionRate:
        s.totalAppearances > 0 ? Math.round((topCount / s.totalAppearances) * 100) : 0,
      metaShare:
        totalAppearances > 0 ? Math.round((s.totalAppearances / totalAppearances) * 100) : 0,
      coreCards,
      flexCards,
    };
  });

  out.sort((a, b) => {
    const pa = a.points || 0;
    const pb = b.points || 0;
    if (pb !== pa) return pb - pa;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.totalAppearances - a.totalAppearances;
  });
  return out;
}
