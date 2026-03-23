"use client";

import { useEffect, useMemo, useState } from "react";
import CardImage from "./CardImage";
import CardPopup from "./CardPopup";
import { cardDisplayName } from "@/lib/cardDisplay";
import T from "@/components/T";

interface CardData {
  id: string;
  name: string;
  image: string;
  color: string;
  type: string;
  cost: string;
  power: string;
  rarity: string;
  text: string;
  attribute: string;
  subTypes: string;
  life: string;
  set: string;
  inclusionRate?: number;
  avgCount?: number;
}

interface CardGridProps {
  cards: CardData[];
  variant: "core" | "flex";
  /**
   * Mobile (< sm) görünüme özel: ilk N satırı gösterir, butonla açılır.
   * grid kolonu 2 olduğu için N satır = yaklaşık N*2 kart.
   */
  mobileMaxRows?: number;
}

export default function CardGrid({ cards, variant, mobileMaxRows }: CardGridProps) {
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const accentColor =
    variant === "core" ? "emerald" : "amber";

  useEffect(() => {
    if (mobileMaxRows == null) return;

    const mq = window.matchMedia("(max-width: 639px)"); // Tailwind `sm` breakpoint
    const update = () => setIsMobile(mq.matches);
    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    // Safari older fallback
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [mobileMaxRows]);

  useEffect(() => {
    setExpanded(false);
  }, [cards, variant, mobileMaxRows]);

  const mobileMaxItems = mobileMaxRows != null ? mobileMaxRows * 2 : null; // mobile grid-cols-2
  const visibleCards = useMemo(() => {
    if (mobileMaxItems == null) return cards;
    if (!isMobile) return cards;
    if (expanded) return cards;
    return cards.slice(0, mobileMaxItems);
  }, [cards, expanded, isMobile, mobileMaxItems]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1 sm:gap-2 lg:gap-3">
        {visibleCards.map((card) => {
          const rate = card.inclusionRate != null ? Math.round(card.inclusionRate) : null;
          const avg = card.avgCount != null ? card.avgCount.toFixed(1) : null;

          return (
            <button
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className="group text-left rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] transition-all overflow-hidden"
            >
              <div className="relative">
                <CardImage
                  src={card.image}
                  alt={cardDisplayName(card)}
                  cardId={card.id}
                  className="w-full aspect-[55/70] sm:aspect-[63/88] object-cover rounded-t-lg sm:rounded-t-xl transition-transform group-hover:scale-[1.02]"
                />
              </div>

              <div className="px-1.5 py-1 sm:px-2 sm:py-1.5">
                <p className="truncate text-[9px] sm:text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
                  {cardDisplayName(card)}
                </p>
                <p className="text-[7px] sm:text-[9px] text-gray-600 font-mono">{card.id}</p>

                {rate != null && (
                  <div className="mt-0.5 sm:mt-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[8px] sm:text-[10px] font-bold ${accentColor === "emerald" ? "text-emerald-400" : "text-amber-400"}`}>
                        {rate}%
                      </span>
                      {avg != null && (
                        <span className="text-[7px] sm:text-[9px] text-gray-500">
                          avg ×{avg}
                        </span>
                      )}
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${accentColor === "emerald" ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {mobileMaxItems != null && isMobile && cards.length > mobileMaxItems && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center justify-center w-full sm:w-auto max-w-[20rem] rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/[0.06] transition-colors"
          >
            <T section="tracker" k={expanded ? "showLessCards" : "showMoreCards"} />
          </button>
        </div>
      )}

      {selectedCard && (
        <CardPopup
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          inclusionRate={selectedCard.inclusionRate}
          avgCount={selectedCard.avgCount}
          variant={variant}
        />
      )}
    </>
  );
}
