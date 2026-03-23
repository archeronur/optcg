import type { LeaderStats, MetaData } from "@/lib/types";

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

function classifyPlacing(placing: string): Bucket | null {
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

  const out: LeaderStats[] = Array.from(byLeader.values()).map((s) => {
    const prior = priorByLeader.get(s.leaderId);
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
      coreCards: prior?.coreCards,
      flexCards: prior?.flexCards,
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
