"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CardImage from "./CardImage";
import CardPopup from "./CardPopup";
import DeckDistributionCharts from "./DeckDistributionCharts";
import T from "./T";
import { parseColors, getColorInfo } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import type { Deck, Card } from "@/lib/types";
import { cardDisplayName } from "@/lib/cardDisplay";
import { lookupCardData } from "@/lib/cardHelpers";

interface DeckListViewerProps {
  deck: Deck;
  cardsData: Record<string, Card>;
  placing?: string;
  eventDate?: string;
}

export default function DeckListViewer({
  deck,
  cardsData,
  placing,
  eventDate,
}: DeckListViewerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const [popupCard, setPopupCard] = useState<
    (Card & { count?: number }) | null
  >(null);

  const leaderCard = lookupCardData(cardsData, deck.leaderId);
  const leaderColors = leaderCard ? parseColors(leaderCard.color) : [];

  const enrichedCards = (deck.cards ?? [])
    .filter((dc) => dc.id !== deck.leaderId)
    .map((dc) => ({
      ...dc,
      data: lookupCardData(cardsData, dc.id),
    }))
    .filter((dc): dc is typeof dc & { data: Card } => dc.data !== undefined)
    .sort((a, b) => {
      const costDiff =
        (parseInt(a.data.cost) || 0) - (parseInt(b.data.cost) || 0);
      if (costDiff !== 0) return costDiff;
      return b.count - a.count;
    });

  const totalCards = (deck.cards ?? []).reduce((sum, c) => sum + c.count, 0);
  const proxyPrintHref = useMemo(() => {
    const deckCards = [...(deck.cards ?? [])];
    const hasLeader = deckCards.some((card) => card.id === deck.leaderId);

    if (!hasLeader && deck.leaderId) {
      deckCards.unshift({ id: deck.leaderId, count: 1 });
    }

    const deckInputText = deckCards
      .map((card) => `${card.count}x${card.id}`)
      .join("\n");

    return `https://hastekparcacilar.com/proxy-print?decklist=${encodeURIComponent(deckInputText)}`;
  }, [deck.cards, deck.leaderId]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          {placing && (
            <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
              #{placing}
            </span>
          )}
          <span className="text-sm font-semibold text-white">
            <T section="tracker" k="deckCardsCount" values={{ count: totalCards }} />
          </span>
          {eventDate && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-gray-400">
              <span aria-hidden="true">📅</span>
              {eventDate}
            </span>
          )}
          <div className="flex gap-1">
            {leaderColors.map((c) => {
              const ci = getColorInfo(c);
              return (
                <span
                  key={c}
                  className={`h-2 w-2 rounded-full ${ci.dot}`}
                />
              );
            })}
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/[0.04] px-4 py-4">
          <div className="mb-4 flex justify-end">
            <Link
              href={proxyPrintHref}
              className="inline-flex items-center rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
            >
              <T section="tracker" k="printProxyButton" />
            </Link>
          </div>

          {leaderCard && (
            <button
              onClick={() => setPopupCard(leaderCard)}
              className="mb-4 flex w-full items-center gap-4 rounded-xl bg-white/[0.03] p-4 text-left hover:bg-white/[0.06] transition-colors group sm:gap-5 sm:p-5"
            >
              <CardImage
                src={leaderCard.image}
                alt={cardDisplayName(leaderCard)}
                cardId={deck.leaderId}
                className="h-36 w-auto shrink-0 rounded-xl ring-2 ring-white/15 object-contain shadow-xl group-hover:ring-accent/40 transition-all sm:h-44 md:h-52"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <T section="tracker" k="leader" />
                </p>
                <p className="mt-1 text-base font-bold text-white group-hover:text-accent transition-colors sm:text-lg">
                  {cardDisplayName(leaderCard)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono sm:text-sm">{deck.leaderId}</span>
                  {leaderColors.map((c) => {
                    const ci = getColorInfo(c);
                    return (
                      <span key={c} className={`h-1.5 w-1.5 rounded-full ${ci.dot}`} />
                    );
                  })}
                </div>
              </div>
            </button>
          )}

          <DeckDistributionCharts cards={enrichedCards} />

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-2.5">
            {enrichedCards.map((ec) => (
              <button
                key={ec.id}
                onClick={() =>
                  setPopupCard({
                    ...ec.data,
                    name: cardDisplayName(ec.data),
                    count: ec.count,
                  })
                }
                className="group relative aspect-[5/7] w-full"
              >
                <CardImage
                  src={ec.data.image}
                  alt={cardDisplayName(ec.data)}
                  cardId={ec.id}
                  className="h-full w-full rounded-lg object-cover transition-transform group-hover:scale-[1.02] ring-1 ring-white/10"
                />
                <span
                  className="absolute bottom-1 right-1 flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-md border border-white/20 bg-black/90 px-1.5 py-0.5 text-xs font-black tabular-nums text-white shadow-lg ring-1 ring-black/50 sm:bottom-1.5 sm:right-1.5 sm:min-h-[1.75rem] sm:min-w-[1.75rem] sm:px-2 sm:py-1 sm:text-sm"
                  title={`${ec.count} ${t("tracker", "copies")}`}
                >
                  {ec.count}×
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 text-center text-xs text-gray-500 sm:text-sm">
            {enrichedCards.length} <T section="tracker" k="differentCards" /> ·{" "}
            {totalCards} <T section="tracker" k="totalCards" />
          </div>
        </div>
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
