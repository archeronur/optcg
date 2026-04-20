"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import CardPopup from "@/components/CardPopup";
import T from "@/components/T";
import { cardDisplayName } from "@/lib/cardDisplay";
import { lookupCardData } from "@/lib/cardHelpers";
import { formatEventDate } from "@/lib/eventDate";
import { useI18n } from "@/lib/i18n";
import type { Card, DeckCard } from "@/lib/types";
import { computeDeckDiff, type DeckDiffEntry } from "@/lib/deckDiff";

export interface DeckOption {
  slug: string;
  placing: string;
  player: string;
  eventName: string;
  eventDate: string;
  eventUrl: string;
  totalCards: number;
}

interface DeckPayload extends DeckOption {
  cards: DeckCard[];
  leaderId: string;
}

interface Props {
  decks: DeckPayload[];
  cardsData: Record<string, Card>;
  initialA: string;
  initialB: string;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function describeDeck(d: DeckOption): string {
  const date = formatEventDate(d.eventDate, {
    eventName: d.eventName,
    eventUrl: d.eventUrl,
  });
  const suffix = [d.player, date].filter(Boolean).join(" · ");
  const placing = d.placing ? `#${d.placing}` : "";
  return [d.eventName, placing, suffix].filter(Boolean).join(" — ");
}

function DeckCardTile({
  entry,
  card,
  mode,
  onClick,
}: {
  entry: DeckDiffEntry;
  card: Card;
  mode: "shared-same" | "shared-diff" | "onlyA" | "onlyB";
  onClick: () => void;
}) {
  const ringClass =
    mode === "shared-same"
      ? "ring-emerald-400/40"
      : mode === "shared-diff"
        ? "ring-amber-400/50"
        : mode === "onlyA"
          ? "ring-accent/40"
          : "ring-purple-400/40";
  const showDiff = mode === "shared-diff" || mode === "onlyA" || mode === "onlyB";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-[5/7] w-full overflow-hidden rounded-lg ring-1 ${ringClass}`}
      title={cardDisplayName(card)}
    >
      <CardImage
        src={card.image}
        alt={cardDisplayName(card)}
        cardId={card.id}
        className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
      />
      {mode === "shared-same" && entry.countA > 0 && (
        <span className="absolute bottom-1 right-1 flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-md bg-black/90 px-1.5 py-0.5 text-xs font-black tabular-nums text-white shadow-lg ring-1 ring-black/50">
          {entry.countA}×
        </span>
      )}
      {showDiff && (
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums shadow ring-1 ring-black/40 ${
              entry.countA === 0
                ? "bg-gray-900/75 text-gray-600 line-through"
                : entry.countA > entry.countB
                  ? "bg-emerald-500/90 text-black"
                  : "bg-black/85 text-white"
            }`}
          >
            A {entry.countA}×
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums shadow ring-1 ring-black/40 ${
              entry.countB === 0
                ? "bg-gray-900/75 text-gray-600 line-through"
                : entry.countB > entry.countA
                  ? "bg-emerald-500/90 text-black"
                  : "bg-black/85 text-white"
            }`}
          >
            B {entry.countB}×
          </span>
        </div>
      )}
    </button>
  );
}

export default function DeckDiffClient({
  decks,
  cardsData,
  initialA,
  initialB,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const defaultA =
    initialA && decks.some((d) => d.slug === initialA)
      ? initialA
      : decks[0]?.slug ?? "";
  const defaultB =
    initialB && decks.some((d) => d.slug === initialB) && initialB !== defaultA
      ? initialB
      : decks.find((d) => d.slug !== defaultA)?.slug ?? "";

  const [aSlug, setASlug] = useState<string>(defaultA);
  const [bSlug, setBSlug] = useState<string>(defaultB);
  const [popupCard, setPopupCard] = useState<(Card & { count?: number }) | null>(null);

  const syncUrl = useCallback(
    (a: string, b: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (a) sp.set("a", a);
      else sp.delete("a");
      if (b) sp.set("b", b);
      else sp.delete("b");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onChangeA = useCallback(
    (value: string) => {
      setASlug(value);
      let nextB = bSlug;
      if (value && value === bSlug) {
        nextB = decks.find((d) => d.slug !== value)?.slug ?? "";
        setBSlug(nextB);
      }
      syncUrl(value, nextB);
    },
    [bSlug, decks, syncUrl],
  );

  const onChangeB = useCallback(
    (value: string) => {
      setBSlug(value);
      let nextA = aSlug;
      if (value && value === aSlug) {
        nextA = decks.find((d) => d.slug !== value)?.slug ?? "";
        setASlug(nextA);
      }
      syncUrl(nextA, value);
    },
    [aSlug, decks, syncUrl],
  );

  const swap = useCallback(() => {
    const nextA = bSlug;
    const nextB = aSlug;
    setASlug(nextA);
    setBSlug(nextB);
    syncUrl(nextA, nextB);
  }, [aSlug, bSlug, syncUrl]);

  const deckA = decks.find((d) => d.slug === aSlug) ?? null;
  const deckB = decks.find((d) => d.slug === bSlug) ?? null;

  const diff = useMemo(() => {
    if (!deckA || !deckB) return null;
    const stripLeader = (cards: DeckCard[], leaderId: string) =>
      cards.filter((c) => c.id !== leaderId);
    return computeDeckDiff(
      stripLeader(deckA.cards, deckA.leaderId),
      stripLeader(deckB.cards, deckB.leaderId),
    );
  }, [deckA, deckB]);

  const resolveCard = useCallback(
    (id: string): Card | undefined => lookupCardData(cardsData, id),
    [cardsData],
  );

  const renderTile = (
    entry: DeckDiffEntry,
    mode: "shared-same" | "shared-diff" | "onlyA" | "onlyB",
  ) => {
    const card = resolveCard(entry.id);
    if (!card) return null;
    return (
      <DeckCardTile
        key={entry.id}
        entry={entry}
        card={card}
        mode={mode}
        onClick={() => {
          const displayCount =
            mode === "onlyA"
              ? entry.countA
              : mode === "onlyB"
                ? entry.countB
                : entry.countA;
          setPopupCard({ ...card, name: cardDisplayName(card), count: displayCount });
        }}
      />
    );
  };

  const sameDeck = aSlug && bSlug && aSlug === bSlug;

  return (
    <div>
      {/* Picker bar */}
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
            <T section="tracker" k="deckA" />
          </label>
          <select
            value={aSlug}
            onChange={(e) => onChangeA(e.target.value)}
            aria-label={t("tracker", "deckA")}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
          >
            <option value="">{t("tracker", "selectDeck")}</option>
            {decks.map((d) => (
              <option key={d.slug} value={d.slug} disabled={d.slug === bSlug}>
                {describeDeck(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end justify-center">
          <button
            type="button"
            onClick={swap}
            disabled={!aSlug && !bSlug}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden="true">⇄</span>
            <T section="tracker" k="swap" />
          </button>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
            <T section="tracker" k="deckB" />
          </label>
          <select
            value={bSlug}
            onChange={(e) => onChangeB(e.target.value)}
            aria-label={t("tracker", "deckB")}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
          >
            <option value="">{t("tracker", "selectDeck")}</option>
            {decks.map((d) => (
              <option key={d.slug} value={d.slug} disabled={d.slug === aSlug}>
                {describeDeck(d)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sameDeck && (
        <div className="glass-card rounded-xl p-5 text-center text-sm text-amber-300">
          <T section="tracker" k="sameDeckRequired" />
        </div>
      )}
      {(!deckA || !deckB) && !sameDeck && (
        <div className="glass-card rounded-xl p-5 text-center text-sm text-gray-400">
          <T section="tracker" k="pickBothDecks" />
        </div>
      )}

      {deckA && deckB && !sameDeck && diff && (
        <>
          {/* Deck headers */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[deckA, deckB].map((d, i) => (
              <div
                key={d.slug}
                className="glass-card rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                    {i === 0 ? "A" : "B"} · #{d.placing || "?"}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {formatEventDate(d.eventDate, {
                      eventName: d.eventName,
                      eventUrl: d.eventUrl,
                    })}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-bold text-white" title={d.eventName}>
                  {d.eventName}
                </p>
                {d.player && <p className="text-[11px] text-gray-500">{d.player}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium text-gray-400">
                    {i === 0 ? diff.uniqueA : diff.uniqueB} <T section="tracker" k="uniqueCardsShort" />
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium text-gray-400">
                    {i === 0 ? diff.totalA : diff.totalB} <T section="tracker" k="totalCopiesShort" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Similarity banner */}
          <section className="mb-8">
            <div className="glass-card rounded-xl p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-2xl font-extrabold text-accent tabular-nums">
                    {pct(diff.jaccard)}
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    <T section="tracker" k="jaccardSimilarity" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-emerald-400 tabular-nums">
                    {pct(diff.countOverlap)}
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    <T section="tracker" k="countOverlap" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-white tabular-nums">
                    {diff.sharedUnique}
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    <T section="tracker" k="sharedCards" /> · <T section="tracker" k="uniqueCardsShort" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-white tabular-nums">
                    {diff.unionSize}
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    <T section="tracker" k="uniqueCardsShort" /> ∪
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Shared — differing counts */}
          {diff.differentCounts.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
                <T section="tracker" k="sharedCards" />
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                  <T section="tracker" k="different" /> · {diff.differentCounts.length}
                </span>
              </h2>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {diff.differentCounts.map((e) => renderTile(e, "shared-diff"))}
              </div>
            </section>
          )}

          {/* Shared — identical */}
          {diff.identicalCounts.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
                <T section="tracker" k="sharedCards" />
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                  <T section="tracker" k="identical" /> · {diff.identicalCounts.length}
                </span>
              </h2>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {diff.identicalCounts.map((e) => renderTile(e, "shared-same"))}
              </div>
            </section>
          )}

          {/* Only A + Only B */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
                <T section="tracker" k="onlyInA" />
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                  {diff.onlyA.length}
                </span>
              </h2>
              {diff.onlyA.length === 0 ? (
                <p className="text-sm text-gray-500">—</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {diff.onlyA.map((e) => renderTile(e, "onlyA"))}
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
                <T section="tracker" k="onlyInB" />
                <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold text-purple-300">
                  {diff.onlyB.length}
                </span>
              </h2>
              {diff.onlyB.length === 0 ? (
                <p className="text-sm text-gray-500">—</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {diff.onlyB.map((e) => renderTile(e, "onlyB"))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {popupCard && (
        <CardPopup
          card={popupCard}
          count={popupCard.count}
          onClose={() => setPopupCard(null)}
        />
      )}
    </div>
  );
}
