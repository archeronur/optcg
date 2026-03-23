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
import { formatEventDate } from "@/lib/eventDate";
import LeaderBadge from "@/components/LeaderBadge";
import DeckListViewer from "@/components/DeckListViewer";
import EventStandings from "@/components/EventStandings";
import T from "@/components/T";

export async function generateStaticParams() {
  const params: { metaId: string; eventSlug: string }[] = [];
  for (const metaId of getAllMetaIds()) {
    const meta = await getMetaData(metaId);
    if (!meta) continue;
    for (const event of meta.events) {
      params.push({ metaId, eventSlug: slugify(event.name) });
    }
  }
  return params;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ metaId: string; eventSlug: string }>;
}) {
  const { metaId, eventSlug } = await params;
  const meta = await getMetaData(metaId);
  if (!meta) notFound();

  const event = meta.events.find((e) => slugify(e.name) === eventSlug);
  if (!event) notFound();

  const legacyMeta = isLegacyMetaThroughOp05(metaId);
  const cardsData = await (async () => {
    if (event.decks.length === 0) return {};
    const m = getCardsForDecks(event.decks);
    addCanonicalCardIdAliases(m);
    return hydrateTrackerCards(m);
  })();

  const leaderEntries = Object.entries(event.leaderDistribution).sort(
    ([, a], [, b]) => b - a,
  );
  const totalLeaderDecks = leaderEntries.reduce((s, [, c]) => s + c, 0);
  const uniqueLeaderCount = leaderEntries.length;

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
        <span className="text-gray-400 truncate max-w-[200px]">{event.name}</span>
      </div>

      {/* Event Header */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          {event.name}
        </h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {event.date && (
            <span className="rounded-full bg-white/5 px-3 py-1 text-gray-400">
              📅 {formatEventDate(event.date, {
                eventName: event.name,
                eventUrl: event.url,
              })}
            </span>
          )}
          <span className="rounded-full bg-accent/10 px-3 py-1 text-accent font-medium">
            {event.players} <T section="tracker" k="players" />
          </span>
          {event.rounds && (
            <span className="rounded-full bg-white/5 px-3 py-1 text-gray-400">
              {event.rounds}
            </span>
          )}
          {event.type && (
            <span className="rounded-full bg-purple-500/10 px-3 py-1 text-purple-400 text-xs">
              {event.type}
            </span>
          )}
        </div>
      </div>

      {/* Leader Distribution */}
      {leaderEntries.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-1 text-xl font-bold text-white">
            <T section="tracker" k="leaderDist" />
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            <T section="tracker" k="differentLeadersShort" values={{ count: uniqueLeaderCount }} />
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {leaderEntries.map(([leaderStr, count]) => {
              const idMatch = leaderStr.match(/^([A-Z0-9]+-\d+)/);
              const lid = idMatch ? idMatch[1] : "";
              const info = lid ? getLeaderInfo(lid) : { name: leaderStr, image: "", color: "" };

              return (
                <LeaderBadge
                  key={leaderStr}
                  name={info.name}
                  image={info.image}
                  count={count}
                  color={info.color}
                  leaderId={lid}
                  totalDecks={totalLeaderDecks}
                  metaId={metaId}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Deck lists (OP-06+) or standings only (OP-05 and earlier) */}
      {event.decks.length > 0 &&
        (legacyMeta ? (
          <EventStandings
            decks={event.decks}
            cardsData={cardsData}
            eventDate={formatEventDate(event.date, {
              eventName: event.name,
              eventUrl: event.url,
            })}
          />
        ) : (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-white">
              <T section="tracker" k="deckLists" values={{ count: event.decks.length }} />
            </h2>
            <div className="space-y-3">
              {event.decks.map((deck, i) => (
                <DeckListViewer
                  key={`${deck.leaderId}-${deck.placing}-${i}`}
                  deck={deck}
                  cardsData={cardsData}
                  placing={deck.placing}
                  eventDate={formatEventDate(event.date, {
                    eventName: event.name,
                    eventUrl: event.url,
                  })}
                />
              ))}
            </div>
          </section>
        ))}

      {/* Footer */}
      <div className="text-center text-xs text-gray-600">
        <T section="tracker" k="dataFrom" />{" "}
        <a href="https://egman.gg" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          egman.gg
        </a>
        <T section="tracker" k="dataFromSuffix" />
      </div>
    </div>
  );
}
