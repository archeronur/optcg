"use client";

import { useState } from "react";
import CardImage from "./CardImage";
import CardPopup from "./CardPopup";
import { cardDisplayName } from "@/lib/cardDisplay";

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
}

export default function CardGrid({ cards, variant }: CardGridProps) {
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

  const accentColor =
    variant === "core" ? "emerald" : "amber";

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
        {cards.map((card) => {
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
                  className="w-full aspect-[55/77] sm:aspect-[63/88] object-cover rounded-t-lg sm:rounded-t-xl transition-transform group-hover:scale-[1.02]"
                />
              </div>

              <div className="px-2 py-1.5 sm:px-2.5 sm:py-2">
                <p className="truncate text-[10px] sm:text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
                  {cardDisplayName(card)}
                </p>
                <p className="text-[8px] sm:text-[9px] text-gray-600 font-mono">{card.id}</p>

                {rate != null && (
                  <div className="mt-1 sm:mt-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[9px] sm:text-[10px] font-bold ${accentColor === "emerald" ? "text-emerald-400" : "text-amber-400"}`}>
                        {rate}%
                      </span>
                      {avg != null && (
                        <span className="text-[8px] sm:text-[9px] text-gray-500">
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
