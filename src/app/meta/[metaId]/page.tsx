import Link from "next/link";
import { notFound } from "next/navigation";
import { getMetaData, getAllMetaIds, slugify } from "@/lib/data";
import { getLeaderImage, getLeaderColor, getLeaderInfo } from "@/lib/cardHelpers";
import { parseColors, getColorInfo } from "@/lib/colors";
import { formatEventDate } from "@/lib/eventDate";
import { classifyPlacing, computeLeaderStatsFromMeta } from "@/lib/leaderRanking";
import CardImage from "@/components/CardImage";
import T from "@/components/T";

export function generateStaticParams() {
  return getAllMetaIds().map((id) => ({ metaId: id }));
}

export default async function MetaOverviewPage({
  params,
}: {
  params: Promise<{ metaId: string }>;
}) {
  const { metaId } = await params;
  const meta = await getMetaData(metaId);
  if (!meta) notFound();

  const eventsWithDecks = meta.events.filter((e) => e.decks.length > 0);
  const eventsWithoutDecks = meta.events.filter((e) => e.decks.length === 0);
  const totalDecks = meta.events.reduce((sum, e) => sum + e.decks.length, 0);
  const rankedLeaders = computeLeaderStatsFromMeta(meta);
  const uniqueLeaders = new Set(rankedLeaders.map((l) => l.leaderId));
  const topLeaders = rankedLeaders.slice(0, 6);

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
        <span className="text-gray-400">{metaId.toUpperCase()}</span>
      </div>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          {meta.name || metaId.toUpperCase()}
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          <T section="tracker" k="heroDesc" />
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-10 grid grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-5 text-center">
          <div className="text-2xl font-extrabold text-accent">{meta.events.length}</div>
          <div className="mt-1 text-xs text-gray-500">
            <T section="tracker" k="events" />
          </div>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <div className="text-2xl font-extrabold text-white">{totalDecks}</div>
          <div className="mt-1 text-xs text-gray-500">
            <T section="tracker" k="deck" />
          </div>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <div className="text-2xl font-extrabold text-purple-400">{uniqueLeaders.size}</div>
          <div className="mt-1 text-xs text-gray-500">
            <T section="tracker" k="leaders" />
          </div>
        </div>
      </div>

      {/* Top Leaders */}
      {topLeaders.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-white">
              <T section="tracker" k="topLeaders" />
            </h2>
            <div className="flex items-center gap-3 text-sm">
              <Link
                href={`/meta/${metaId}/compare`}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ⇄ <T section="tracker" k="compareLeaders" />
              </Link>
              <Link
                href={`/meta/${metaId}/leaders`}
                className="text-accent hover:underline"
              >
                <T section="tracker" k="allLeaders" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {topLeaders.map((leader, i) => {
              const lid = leader.leaderId;
              const info = getLeaderInfo(lid);
              const leaderImage = info.image || getLeaderImage(lid);
              const leaderName = info.name && info.name !== lid ? info.name : lid;
              const leaderColor = info.color || getLeaderColor(lid);
              const colors = parseColors(leaderColor);
              const primaryColor = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");

              return (
                <Link
                  key={lid}
                  href={`/meta/${metaId}/leader/${lid}`}
                  className="glass-card hover-lift group rounded-xl p-4 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <CardImage
                        src={leaderImage}
                        alt={leaderName}
                        cardId={lid}
                        className="h-20 w-[3.75rem] rounded-lg object-cover shadow-lg ring-1 ring-white/10"
                        loading="lazy"
                      />
                      <span className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-black">
                        {i + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white group-hover:text-accent transition-colors">
                        {leaderName}
                      </p>
                      <p className="text-xs text-gray-600">{lid}</p>
                      <div className="mt-1.5 flex gap-1">
                        {colors.map((c) => {
                          const ci = getColorInfo(c);
                          return (
                            <span
                              key={c}
                              className={`h-2.5 w-2.5 rounded-full ${ci.dot}`}
                            />
                          );
                        })}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <div className={`rounded-full px-2 py-0.5 text-center text-[10px] font-bold ${primaryColor.bg} ${primaryColor.text}`}>
                          {leader.wins} <T section="tracker" k="wins" />
                        </div>
                        <div className="rounded-full bg-white/5 px-2 py-0.5 text-center text-[10px] font-medium text-gray-400">
                          {leader.totalAppearances} <T section="tracker" k="deck" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Events with Decks */}
      {eventsWithDecks.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-white">
            <T section="tracker" k="eventsCount" values={{ count: eventsWithDecks.length }} />
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {eventsWithDecks.map((event) => {
              const eventSlug = slugify(event.name);
              const winner = event.decks.find((d) => classifyPlacing(d.placing) === "first");
              const winnerLid = winner?.leaderId ?? "";
              const winnerInfo = winnerLid ? getLeaderInfo(winnerLid) : null;
              const winnerImage = winnerInfo?.image ?? "";
              const winnerName = winnerInfo?.name && winnerInfo.name !== winnerLid ? winnerInfo.name : winnerLid;

              return (
                <Link
                  key={event.name}
                  href={`/meta/${metaId}/event/${eventSlug}`}
                  className="glass-card hover-lift group rounded-xl p-5 transition-all block"
                >
                  <div className="flex items-start gap-4">
                    {winnerImage ? (
                      <CardImage
                        src={winnerImage}
                        alt={winnerName}
                        cardId={winnerLid}
                        className="h-16 w-12 rounded-lg object-cover shadow ring-1 ring-white/10 flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-16 w-12 rounded-lg bg-white/[0.04] flex-shrink-0 flex items-center justify-center text-lg text-gray-600">
                        🏆
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-white group-hover:text-accent transition-colors">
                        {event.name}
                      </h3>
                      <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-gray-400">
                        <span aria-hidden="true">📅</span>
                        {formatEventDate(event.date, {
                          eventName: event.name,
                          eventUrl: event.url,
                        })}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-gray-400">
                          {event.players} <T section="tracker" k="players" />
                        </span>
                        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                          {event.decks.length} <T section="tracker" k="deck" />
                        </span>
                      </div>
                      {winner && (
                        <p className="mt-2 text-xs text-gray-600">
                          🏆 {winnerName || winner.leaderId}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Events without Decks */}
      {eventsWithoutDecks.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold text-white">
            <T section="tracker" k="otherEvents" values={{ count: eventsWithoutDecks.length }} />
          </h2>
          <div className="space-y-2">
            {eventsWithoutDecks.map((event) => (
              <div
                key={event.name}
                className="glass-card rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-300">
                    {event.name}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-gray-400">
                    <span aria-hidden="true">📅</span>
                    {formatEventDate(event.date, {
                      eventName: event.name,
                      eventUrl: event.url,
                    })}
                  </p>
                </div>
                <span className="ml-4 flex-shrink-0 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
                  {event.players} <T section="tracker" k="players" />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

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
