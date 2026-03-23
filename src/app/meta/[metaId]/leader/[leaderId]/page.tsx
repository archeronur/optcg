import Link from "next/link";
import { notFound } from "next/navigation";
import { getMetaData, getAllMetaIds } from "@/lib/data";
import {
  getLeaderInfo,
  getCardsForDecks,
  enrichCardMapWithStats,
  addCanonicalCardIdAliases,
  lookupCardData,
} from "@/lib/cardHelpers";
import { hydrateTrackerCards } from "@/lib/trackerCardHydrate";
import { isLegacyMetaThroughOp05 } from "@/lib/metaEra";
import { parseColors, getColorInfo } from "@/lib/colors";
import { getCard } from "@/lib/cards";
import { computeLeaderStatsFromMeta } from "@/lib/leaderRanking";
import CardImage from "@/components/CardImage";
import CardGrid from "@/components/CardGrid";
import AllAppearancesSection from "@/components/AllAppearancesSection";
import T from "@/components/T";
import type { Deck, Card } from "@/lib/types";

export async function generateStaticParams() {
  const params: { metaId: string; leaderId: string }[] = [];
  for (const metaId of getAllMetaIds()) {
    const meta = await getMetaData(metaId);
    if (!meta) continue;
    for (const ls of meta.leaderStats) {
      params.push({ metaId, leaderId: ls.leaderId });
    }
  }
  return params;
}

function placingToNumber(placing: string): number {
  const n = parseInt(placing);
  return isNaN(n) ? 999 : n;
}

export default async function LeaderDetailPage({
  params,
}: {
  params: Promise<{ metaId: string; leaderId: string }>;
}) {
  const { metaId, leaderId } = await params;
  const meta = await getMetaData(metaId);
  if (!meta) notFound();

  const ranked = computeLeaderStatsFromMeta(meta);
  const stats = ranked.find((l) => l.leaderId === leaderId);
  if (!stats) notFound();

  const info = getLeaderInfo(leaderId);
  const colors = parseColors(info.color);
  const primaryColor = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");

  const leaderDecks: (Deck & {
    eventName: string;
    eventDate: string;
    eventUrl: string;
  })[] = [];
  for (const event of meta.events) {
    for (const deck of event.decks) {
      if (deck.leaderId === leaderId) {
        leaderDecks.push({
          ...deck,
          eventName: event.name,
          eventDate: event.date,
          eventUrl: event.url,
        });
      }
    }
  }
  leaderDecks.sort((a, b) => placingToNumber(a.placing) - placingToNumber(b.placing));

  const legacyMeta = isLegacyMetaThroughOp05(metaId);
  let cardsData: Record<string, Card> = {};
  if (!legacyMeta) {
    const cardMap = enrichCardMapWithStats(getCardsForDecks(leaderDecks), stats);
    addCanonicalCardIdAliases(cardMap);
    cardsData = await hydrateTrackerCards(cardMap);
  }

  type PlacingGroupKey = "1st" | "2nd" | "3rd" | "4th" | "top8" | "top16" | "top32";
  const placingGroups: Record<PlacingGroupKey, number> = {
    "1st": 0,
    "2nd": 0,
    "3rd": 0,
    "4th": 0,
    top8: 0,
    top16: 0,
    top32: 0,
  };

  for (const deck of leaderDecks) {
    const placingStr = String(deck.placing ?? "").trim();
    if (!placingStr) continue;

    const ord = placingStr.match(/\b(1st|2nd|3rd|4th)\b/i);
    if (ord?.[1]) {
      const key = ord[1].toLowerCase() as PlacingGroupKey;
      placingGroups[key] = (placingGroups[key] ?? 0) + 1;
      continue;
    }

    const top4 = placingStr.match(/top\s*4\b/i);
    if (top4) {
      placingGroups["4th"] = (placingGroups["4th"] ?? 0) + 1;
      continue;
    }

    const top = placingStr.match(/top\s*(4|8|16|32)\b/i);
    if (top?.[1]) {
      const key = (`top${top[1]}`.toLowerCase() as PlacingGroupKey);
      placingGroups[key] = (placingGroups[key] ?? 0) + 1;
    }
  }

  const placingCategories: Array<{
    key: PlacingGroupKey;
    label: string;
    prefixHash?: boolean;
    style: string;
  }> = [
    { key: "1st", label: "1st", prefixHash: true, style: "bg-gold/10 text-gold" },
    { key: "2nd", label: "2nd", prefixHash: true, style: "bg-silver/10 text-silver" },
    { key: "3rd", label: "3rd", prefixHash: true, style: "bg-bronze/10 text-bronze" },
    { key: "4th", label: "4th", prefixHash: true, style: "bg-silver/10 text-silver" },
    { key: "top8", label: "top8", style: "bg-bronze/10 text-bronze" },
    { key: "top16", label: "top16", style: "bg-bronze/10 text-bronze" },
    { key: "top32", label: "top32", style: "bg-accent/10 text-accent" },
  ];

  const placingTotal = placingCategories.reduce((sum, c) => sum + (placingGroups[c.key] ?? 0), 0);

  const coreCards = legacyMeta
    ? []
    : ((stats.coreCards ?? [])
        .filter((c) => c.inclusionRate >= 70)
        .map((c) => {
          const card = getCard(c.id) ?? lookupCardData(cardsData, c.id);
          return card
            ? { ...card, inclusionRate: c.inclusionRate, avgCount: c.avgCount }
            : null;
        })
        .filter(Boolean) as (Card & {
        inclusionRate: number;
        avgCount: number;
      })[]);

  const flexCards = legacyMeta
    ? []
    : ((stats.flexCards ?? [])
        .concat((stats.coreCards ?? []).filter((c) => c.inclusionRate < 70))
        .map((c) => {
          const card = getCard(c.id) ?? lookupCardData(cardsData, c.id);
          return card
            ? { ...card, inclusionRate: c.inclusionRate, avgCount: c.avgCount }
            : null;
        })
        .filter(Boolean) as (Card & {
        inclusionRate: number;
        avgCount: number;
      })[]);

  const topCount =
    stats.wins + (stats.second || 0) + (stats.third || 0) + (stats.fourth || 0) + stats.top8;
  const winRate = stats.winRate ?? (stats.totalAppearances > 0 ? Math.round((stats.wins / stats.totalAppearances) * 100) : 0);
  const convRate = stats.conversionRate ?? (stats.totalAppearances > 0 ? Math.round((topCount / stats.totalAppearances) * 100) : 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-accent transition-colors">
          <T section="tracker" k="home" />
        </Link>
        <span>/</span>
        <Link href="/tracker" className="hover:text-accent transition-colors">
          <T section="tracker" k="heroTitle" />
        </Link>
        <span>/</span>
        <Link href={`/meta/${metaId}`} className="hover:text-accent transition-colors">
          {metaId.toUpperCase()}
        </Link>
        <span>/</span>
        <span className="text-gray-400">{info.name}</span>
      </div>

      {/* Hero Section */}
      <div className={`relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br ${primaryColor.gradient} p-8 sm:p-10`}>
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <CardImage
            src={info.image}
            alt={info.name}
            cardId={leaderId}
            className="h-40 w-auto rounded-xl shadow-2xl ring-2 ring-white/20"
          />
          <div className="text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {info.name}
            </h1>
            <p className="mt-1 text-sm text-white/60">{leaderId}</p>
            <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
              {colors.map((c) => {
                const ci = getColorInfo(c);
                return (
                  <span key={c} className={`flex items-center gap-1.5 rounded-full ${ci.bg} px-3 py-1 text-xs font-medium ${ci.text}`}>
                    <span className={`h-2 w-2 rounded-full ${ci.dot}`} />
                    {c}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "totalApp", value: stats.totalAppearances },
          { label: "wins", value: stats.wins },
          { label: "winPct", value: `${winRate}%` },
          { label: "conversionPct", value: `${convRate}%` },
          { label: "uniquePlayers", value: stats.uniquePlayers },
          { label: "uniqueEvents", value: stats.uniqueEvents },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4 text-center">
            <div className="text-xl font-extrabold text-white">{stat.value}</div>
            <div className="mt-1 text-[11px] text-gray-500">
              <T section="tracker" k={stat.label} />
            </div>
          </div>
        ))}
      </div>

      {/* Placing Distribution */}
      {placingTotal > 0 && (
        <section className="mb-8 sm:mb-10">
          <h2 className="mb-3 text-lg sm:text-xl font-bold text-white">
            <T section="tracker" k="placingDist" />
          </h2>
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:gap-3">
            {placingCategories
              .filter((c) => (placingGroups[c.key] ?? 0) > 0)
              .map((c) => (
                <div
                  key={c.key}
                  className="glass-card rounded-xl px-3 py-2 text-center min-w-[3.2rem] sm:px-4 sm:py-3 sm:min-w-[4.5rem]"
                >
                  <div
                    className={`text-base sm:text-lg font-extrabold ${
                      c.style
                        .split(" ")
                        .filter((s) => s.startsWith("text-"))
                        .join(" ") || "text-accent"
                    }`}
                  >
                    {placingGroups[c.key] ?? 0}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-gray-500">
                    {c.prefixHash ? `#${c.label}` : c.label}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Core Cards */}
      {coreCards.length > 0 && (
        <section className="mb-8 sm:mb-10">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            <T section="tracker" k="coreCards" />
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            <T section="tracker" k="coreCardsDesc" values={{ count: coreCards.length }} />
          </p>
          <CardGrid cards={coreCards} variant="core" mobileMaxRows={4} />
        </section>
      )}

      {/* Flex Cards */}
      {flexCards.length > 0 && (
        <section className="mb-8 sm:mb-10">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            <T section="tracker" k="flexCards" />
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            <T section="tracker" k="flexCardsDesc" values={{ count: flexCards.length }} />
          </p>
          <CardGrid cards={flexCards} variant="flex" mobileMaxRows={4} />
        </section>
      )}

      {/* All Appearances */}
      {leaderDecks.length > 0 && (
        <>
          <h2 className="mb-4 text-xl font-bold text-white">
            <T section="tracker" k="allAppearances" values={{ count: leaderDecks.length }} />
          </h2>
          <AllAppearancesSection
            leaderDecks={leaderDecks}
            cardsData={cardsData}
            legacyMeta={legacyMeta}
          />
        </>
      )}
    </div>
  );
}
