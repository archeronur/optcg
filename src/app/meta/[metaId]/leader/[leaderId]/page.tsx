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
import CardImage from "@/components/CardImage";
import CardGrid from "@/components/CardGrid";
import DeckListViewer from "@/components/DeckListViewer";
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

  const stats = meta.leaderStats.find((l) => l.leaderId === leaderId);
  if (!stats) notFound();

  const info = getLeaderInfo(leaderId);
  const colors = parseColors(info.color);
  const primaryColor = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");

  const leaderDecks: (Deck & { eventName: string })[] = [];
  for (const event of meta.events) {
    for (const deck of event.decks) {
      if (deck.leaderId === leaderId) {
        leaderDecks.push({ ...deck, eventName: event.name });
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

  const placingDistribution: Record<string, number> = {};
  for (const deck of leaderDecks) {
    const bucket = String(deck.placing ?? "").replace(/[^0-9a-zA-Z]/g, "");
    placingDistribution[bucket] = (placingDistribution[bucket] || 0) + 1;
  }

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

  const topCount = stats.top4 + stats.top8;
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
      {Object.keys(placingDistribution).length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-white">
            <T section="tracker" k="placingDist" />
          </h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(placingDistribution)
              .sort(([a], [b]) => placingToNumber(a) - placingToNumber(b))
              .map(([placing, count]) => (
                <div
                  key={placing}
                  className="glass-card rounded-xl px-4 py-3 text-center min-w-[4.5rem]"
                >
                  <div className="text-lg font-extrabold text-accent">
                    {count}
                  </div>
                  <div className="text-[10px] text-gray-500">#{placing}</div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Core Cards */}
      {coreCards.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white">
            <T section="tracker" k="coreCards" />
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            <T section="tracker" k="coreCardsDesc" values={{ count: coreCards.length }} />
          </p>
          <CardGrid cards={coreCards} variant="core" />
        </section>
      )}

      {/* Flex Cards */}
      {flexCards.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white">
            <T section="tracker" k="flexCards" />
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            <T section="tracker" k="flexCardsDesc" values={{ count: flexCards.length }} />
          </p>
          <CardGrid cards={flexCards} variant="flex" />
        </section>
      )}

      {/* All Appearances */}
      {leaderDecks.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-white">
            <T section="tracker" k="allAppearances" values={{ count: leaderDecks.length }} />
          </h2>
          <div className="glass-card rounded-xl overflow-hidden divide-y divide-white/[0.04]">
            {leaderDecks.map((deck, i) => {
              const placingNum = parseInt(deck.placing) || 999;
              const placingStyle =
                placingNum === 1
                  ? "bg-gold/10 text-gold"
                  : placingNum <= 4
                  ? "bg-silver/10 text-silver"
                  : placingNum <= 8
                  ? "bg-bronze/10 text-bronze"
                  : "bg-accent/10 text-accent";

              return (
                <div key={`${deck.eventName}-${deck.placing}-${i}`} className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`rounded-md px-2.5 py-1 text-xs font-extrabold min-w-[2.5rem] text-center ${placingStyle}`}>
                      #{deck.placing}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{deck.eventName}</p>
                      {deck.player && (
                        <p className="text-[10px] text-gray-500 mt-0.5">{deck.player}</p>
                      )}
                    </div>
                  </div>
                  {!legacyMeta && deck.cards.length > 0 && (
                    <DeckListViewer
                      deck={deck}
                      cardsData={cardsData}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
