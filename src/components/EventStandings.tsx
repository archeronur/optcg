import CardImage from "@/components/CardImage";
import T from "@/components/T";
import { getLeaderInfo, lookupCardData } from "@/lib/cardHelpers";
import type { Card, Deck } from "@/lib/types";

function placingRank(placing: string): number {
  const m = placing.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}

export default function EventStandings({
  decks,
  cardsData,
}: {
  decks: Deck[];
  cardsData: Record<string, Card>;
}) {
  const sorted = [...decks].sort(
    (a, b) => placingRank(a.placing) - placingRank(b.placing),
  );

  return (
    <section className="mb-12">
      <h2 className="mb-1 text-xl font-bold text-white">
        <T section="tracker" k="eventStandings" />
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        <T section="tracker" k="legacyStandingsNote" />
      </p>
      <div className="space-y-2">
        {sorted.map((deck, i) => {
          const info = getLeaderInfo(deck.leaderId);
          const leaderCard = lookupCardData(cardsData, deck.leaderId);
          const img = leaderCard?.image || info.image;
          return (
            <div
              key={`${deck.leaderId}-${deck.placing}-${deck.player}-${i}`}
              className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <span className="flex h-9 min-w-[2.75rem] items-center justify-center rounded-lg bg-accent/15 text-sm font-black tabular-nums text-accent">
                #{deck.placing}
              </span>
              <CardImage
                src={img}
                alt={info.name}
                cardId={deck.leaderId}
                className="h-14 w-10 flex-shrink-0 rounded-md object-cover ring-1 ring-white/10"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{info.name}</p>
                <p className="truncate text-[11px] text-gray-500 font-mono">{deck.leaderId}</p>
                {deck.player ? (
                  <p className="mt-0.5 truncate text-[11px] text-gray-600">{deck.player}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
