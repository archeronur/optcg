"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import CardImage from "./CardImage";
import { parseColors, getColorInfo } from "@/lib/colors";
import { cardDisplayName } from "@/lib/cardDisplay";

interface CardPopupProps {
  card: {
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
  };
  count?: number;
  onClose: () => void;
  inclusionRate?: number;
  avgCount?: number;
  variant?: "core" | "flex";
}

export default function CardPopup({
  card,
  count,
  onClose,
  inclusionRate,
  avgCount,
  variant,
}: CardPopupProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const colors = parseColors(card.color);
  const primaryColor = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");

  const rateColor = variant === "core" ? "text-emerald-400" : "text-amber-400";
  const rateBg = variant === "core" ? "stroke-emerald-500" : "stroke-amber-500";
  const rateTrack = variant === "core" ? "stroke-emerald-500/20" : "stroke-amber-500/20";

  const circumference = 2 * Math.PI * 36;
  const rateOffset = inclusionRate != null ? circumference - (inclusionRate / 100) * circumference : circumference;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-[min(100vw-1.5rem,42rem)] sm:max-w-2xl rounded-2xl bg-[#0d0d12] border border-white/[0.1] shadow-2xl max-h-[min(92vh,900px)] overflow-y-auto overflow-x-hidden"
      >
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${primaryColor.gradient}`} />

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full bg-white/[0.08] p-2 text-gray-300 hover:text-white hover:bg-white/[0.15] transition-colors"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
            <div className="mx-auto flex shrink-0 justify-center sm:mx-0">
              <CardImage
                src={card.image}
                alt={cardDisplayName(card)}
                cardId={card.id}
                className="h-[min(52vh,320px)] w-auto max-w-[min(100%,240px)] rounded-xl object-contain shadow-2xl ring-1 ring-white/10 sm:h-[min(60vh,380px)] sm:max-w-[min(100%,280px)]"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <h3 className="text-xl font-bold text-white leading-tight sm:text-2xl">{cardDisplayName(card)}</h3>

              <span className="inline-flex w-fit rounded-lg bg-white/[0.08] px-2.5 py-1 text-sm font-mono text-gray-300">
                {card.id}
              </span>

              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const ci = getColorInfo(c);
                  return (
                    <span key={c} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${ci.bg} ${ci.text}`}>
                      <span className={`h-2 w-2 rounded-full ${ci.dot}`} />
                      {c}
                    </span>
                  );
                })}
              </div>

              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-400">
                {card.cost && card.cost !== "?" && (
                  <span>Cost <strong className="text-white">{card.cost}</strong></span>
                )}
                {card.power && card.power !== "?" && (
                  <span>Power <strong className="text-white">{card.power}</strong></span>
                )}
                {card.life && card.life !== "?" && (
                  <span>Life <strong className="text-white">{card.life}</strong></span>
                )}
                {card.attribute && card.attribute !== "?" && (
                  <span>Attr <strong className="text-white">{card.attribute}</strong></span>
                )}
              </div>

              {count != null && (
                <span
                  className="inline-flex w-fit rounded-lg border border-accent/30 bg-accent/15 px-3 py-1.5 text-base font-black tabular-nums text-accent"
                  title="Copies in this deck"
                >
                  {count}×
                </span>
              )}
            </div>
          </div>

          {card.text && (
            <div className="mt-5 rounded-xl bg-white/[0.04] p-4 sm:p-5">
              <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap sm:text-base">{card.text}</p>
            </div>
          )}

          {inclusionRate != null && (
            <div className="mt-4 flex items-center gap-4 rounded-lg bg-white/[0.03] p-3">
              <div className="relative h-20 w-20 flex-shrink-0">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6" className={rateTrack} />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={rateOffset}
                    className={rateBg}
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${rateColor}`}>
                  {Math.round(inclusionRate)}%
                </span>
              </div>
              <div className="text-sm text-gray-400">
                <p>Inclusion rate</p>
                {avgCount != null && (
                  <p className="mt-1">
                    Avg count: <strong className="text-white">{avgCount.toFixed(1)}</strong>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
