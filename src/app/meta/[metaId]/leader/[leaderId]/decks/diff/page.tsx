import Link from "next/link";
import { notFound } from "next/navigation";
import { getMetaData, getAllMetaIds, slugify } from "@/lib/data";
import {
  getLeaderInfo,
  getCardsForDecks,
  addCanonicalCardIdAliases,
} from "@/lib/cardHelpers";
import { hydrateTrackerCards } from "@/lib/trackerCardHydrate";
import { isLegacyMetaThroughOp05 } from "@/lib/metaEra";
import { parseColors, getColorInfo } from "@/lib/colors";
import { formatEventDate } from "@/lib/eventDate";
import CardImage from "@/components/CardImage";
import T from "@/components/T";
import { deckSlug } from "@/lib/deckDiff";
import DeckDiffClient from "./DeckDiffClient";
import type { Deck } from "@/lib/types";

export async function generateStaticParams() {
  const params: { metaId: string; leaderId: string }[] = [];
  for (const metaId of getAllMetaIds()) {
    if (isLegacyMetaThroughOp05(metaId)) continue;
    const meta = await getMetaData(metaId);
    if (!meta) continue;
    const counts = new Map<string, number>();
    for (const ev of meta.events) {
      for (const d of ev.decks) {
        counts.set(d.leaderId, (counts.get(d.leaderId) ?? 0) + 1);
      }
    }
    for (const [leaderId, n] of counts) {
      if (n >= 2) params.push({ metaId, leaderId });
    }
  }
  return params;
}

function placingToNumber(placing: string): number {
  const normalized = String(placing ?? "").trim().toLowerCase();
  if (!normalized) return 999;
  const topMatch = normalized.match(/top\s*(\d+)/i);
  if (topMatch?.[1]) {
    const topN = Number.parseInt(topMatch[1], 10);
    if (!Number.isNaN(topN)) return topN;
  }
  const ordinalMatch = normalized.match(/^(\d+)(st|nd|rd|th)?$/i);
  if (ordinalMatch?.[1]) {
    const ordinal = Number.parseInt(ordinalMatch[1], 10);
    if (!Number.isNaN(ordinal)) return ordinal;
  }
  const n = Number.parseInt(normalized, 10);
  return Number.isNaN(n) ? 999 : n;
}

export default async function DeckDiffPage({
  params,
  searchParams,
}: {
  params: Promise<{ metaId: string; leaderId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { metaId, leaderId } = await params;
  const sp = await searchParams;
  const aParam = typeof sp.a === "string" ? sp.a : Array.isArray(sp.a) ? sp.a[0] : "";
  const bParam = typeof sp.b === "string" ? sp.b : Array.isArray(sp.b) ? sp.b[0] : "";

  const meta = await getMetaData(metaId);
  if (!meta) notFound();

  if (isLegacyMetaThroughOp05(metaId)) {
    // Render a short informational page instead of notFound, so the URL is still valid.
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-white">
          <T section="tracker" k="compareDecks" />
        </h1>
        <p className="mt-4 text-sm text-gray-400">
          <T section="tracker" k="deckDiffLegacyNote" />
        </p>
        <Link
          href={`/meta/${metaId}/leader/${leaderId}`}
          className="mt-6 inline-block rounded-lg bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20"
        >
          <T section="tracker" k="backToLeader" />
        </Link>
      </div>
    );
  }

  type DeckWithEvent = Deck & {
    eventName: string;
    eventDate: string;
    eventUrl: string;
  };
  const allDecks: DeckWithEvent[] = [];
  for (const ev of meta.events) {
    for (const d of ev.decks) {
      if (d.leaderId === leaderId) {
        allDecks.push({
          ...d,
          eventName: ev.name,
          eventDate: ev.date,
          eventUrl: ev.url,
        });
      }
    }
  }

  if (allDecks.length === 0) notFound();

  allDecks.sort((x, y) => {
    const byRank = placingToNumber(x.placing) - placingToNumber(y.placing);
    if (byRank !== 0) return byRank;
    return x.eventName.localeCompare(y.eventName);
  });

  const deckPayload = allDecks.map((d, i) => ({
    slug: deckSlug({
      eventSlug: slugify(d.eventName),
      placing: d.placing,
      player: d.player,
      index: i,
    }),
    placing: d.placing,
    player: d.player,
    eventName: d.eventName,
    eventDate: d.eventDate,
    eventUrl: d.eventUrl,
    totalCards: d.cards.reduce((s, c) => s + c.count, 0),
    cards: d.cards,
    leaderId: d.leaderId,
  }));

  const info = getLeaderInfo(leaderId);
  const colors = parseColors(info.color);
  const primary = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");

  const notEnough = deckPayload.length < 2;

  let cardsData = {};
  if (!notEnough) {
    const cardMap = getCardsForDecks(allDecks);
    addCanonicalCardIdAliases(cardMap);
    cardsData = await hydrateTrackerCards(cardMap);
  }

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
        <Link
          href={`/meta/${metaId}/leader/${leaderId}`}
          className="hover:text-accent transition-colors"
        >
          {info.name}
        </Link>
        <span>/</span>
        <span className="text-gray-400">
          <T section="tracker" k="compareDecks" />
        </span>
      </div>

      {/* Hero */}
      <div className={`relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br ${primary.gradient} p-5 sm:p-8`}>
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative flex items-center gap-4">
          <CardImage
            src={info.image}
            alt={info.name}
            cardId={leaderId}
            className="h-24 w-auto rounded-xl shadow-2xl ring-2 ring-white/20"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              <T section="tracker" k="compareDecks" />
            </h1>
            <p className="mt-0.5 text-sm text-white/80">{info.name}</p>
            <p className="mt-1 text-xs text-white/50">
              <T section="tracker" k="compareDecksDesc" />
            </p>
            <p className="mt-2 text-xs text-white/60">
              {deckPayload.length} {" "}
              <T section="tracker" k="deck" />
              {" · "}
              <T
                section="tracker"
                k="showingCount"
                values={{ shown: deckPayload.length, total: deckPayload.length }}
              />
            </p>
          </div>
        </div>
      </div>

      {notEnough ? (
        <div className="glass-card rounded-xl p-6 text-center text-sm text-amber-300">
          <T section="tracker" k="needTwoDecksForDiff" />
          <div className="mt-4">
            <Link
              href={`/meta/${metaId}/leader/${leaderId}`}
              className="inline-block rounded-lg bg-accent/10 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/20"
            >
              <T section="tracker" k="backToLeader" />
            </Link>
          </div>
        </div>
      ) : (
        <DeckDiffClient
          decks={deckPayload}
          cardsData={cardsData}
          initialA={aParam}
          initialB={bParam}
        />
      )}

      {/* Footer */}
      <div className="mt-12 text-center text-xs text-gray-600">
        <T section="tracker" k="dataFrom" />{" "}
        <a
          href="https://egman.gg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          egman.gg
        </a>
        <T section="tracker" k="dataFromSuffix" />
      </div>
    </div>
  );
}
