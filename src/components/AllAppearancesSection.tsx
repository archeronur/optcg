"use client";

import { useMemo, useState } from "react";
import DeckListViewer from "@/components/DeckListViewer";
import { formatEventDate } from "@/lib/eventDate";
import type { Card, Deck } from "@/lib/types";

type LeaderDeckAppearance = Deck & {
  eventName: string;
  eventDate: string;
  eventUrl: string;
};

type FilterMode =
  | "all"
  | "winners"
  | "podium"
  | "top8"
  | "top16"
  | "top32";
type SortMode =
  | "placingBest"
  | "placingWorst"
  | "dateNewest"
  | "dateOldest"
  | "eventAZ";

function placingToNumber(placing: string): number {
  const n = parseInt(placing);
  return Number.isNaN(n) ? 999 : n;
}

function matchesFilter(placing: string, filterMode: FilterMode): boolean {
  const normalized = String(placing ?? "").trim().toLowerCase();
  const rank = placingToNumber(normalized);

  switch (filterMode) {
    case "winners":
      return normalized.includes("1st") || rank === 1;
    case "podium":
      return rank >= 1 && rank <= 3;
    case "top8":
      return normalized.includes("top 8") || (rank >= 1 && rank <= 8);
    case "top16":
      return normalized.includes("top 16") || (rank >= 1 && rank <= 16);
    case "top32":
      return normalized.includes("top 32") || (rank >= 1 && rank <= 32);
    case "all":
    default:
      return true;
  }
}

function toTimestamp(deck: LeaderDeckAppearance): number {
  const normalized = formatEventDate(deck.eventDate, {
    eventName: deck.eventName,
    eventUrl: deck.eventUrl,
  });
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? 0 : ts;
}

export default function AllAppearancesSection({
  leaderDecks,
  cardsData,
  legacyMeta,
}: {
  leaderDecks: LeaderDeckAppearance[];
  cardsData: Record<string, Card>;
  legacyMeta: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("placingBest");

  const filteredDecks = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = leaderDecks.filter((deck) => {
      if (!matchesFilter(deck.placing, filterMode)) return false;
      if (!q) return true;
      const haystack = `${deck.eventName} ${deck.player} ${deck.placing}`.toLowerCase();
      return haystack.includes(q);
    });

    list.sort((a, b) => {
      if (sortMode === "placingBest") return placingToNumber(a.placing) - placingToNumber(b.placing);
      if (sortMode === "placingWorst") return placingToNumber(b.placing) - placingToNumber(a.placing);
      if (sortMode === "dateNewest") return toTimestamp(b) - toTimestamp(a);
      if (sortMode === "dateOldest") return toTimestamp(a) - toTimestamp(b);
      return a.eventName.localeCompare(b.eventName);
    });

    return list;
  }, [leaderDecks, query, filterMode, sortMode]);

  return (
    <section className="mb-10">
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Event veya oyuncu ara"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-accent/60 focus:outline-none"
        />
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
        >
          <option value="all">Tum placing</option>
          <option value="winners">Sadece 1st</option>
          <option value="podium">Podium (1-3)</option>
          <option value="top8">Top 8</option>
          <option value="top16">Top 16</option>
          <option value="top32">Top 32</option>
        </select>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
        >
          <option value="placingBest">Best placing</option>
          <option value="placingWorst">Worst placing</option>
          <option value="dateNewest">Tarih (Yeni - Eski)</option>
          <option value="dateOldest">Tarih (Eski - Yeni)</option>
          <option value="eventAZ">Event A-Z</option>
        </select>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        {filteredDecks.length} / {leaderDecks.length} goruntuleniyor
      </p>

      <div className="glass-card rounded-xl overflow-hidden divide-y divide-white/[0.04]">
        {filteredDecks.map((deck, i) => {
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
            <div key={`${deck.eventName}-${deck.placing}-${deck.player}-${i}`} className="px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <span className={`rounded-md px-2.5 py-1 text-xs font-extrabold min-w-[2.5rem] text-center ${placingStyle}`}>
                  #{deck.placing}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{deck.eventName}</p>
                  {deck.eventDate && (
                    <p className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-gray-400">
                      <span aria-hidden="true">📅</span>
                      {formatEventDate(deck.eventDate, {
                        eventName: deck.eventName,
                        eventUrl: deck.eventUrl,
                      })}
                    </p>
                  )}
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

      {filteredDecks.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">Secilen filtrede sonuc bulunamadi.</p>
      )}
    </section>
  );
}
