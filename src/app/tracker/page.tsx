import Link from "next/link";
import { getSummary, getMetaData } from "@/lib/data";
import { getLeaderImage } from "@/lib/cardHelpers";
import { computeLeaderStatsFromMeta } from "@/lib/leaderRanking";
import CardImage from "@/components/CardImage";
import T from "@/components/T";

function extractLeaderId(topLeader: string): string {
  const match = topLeader.match(/^([A-Z0-9]+-\d+)/);
  return match ? match[1] : "";
}

export default async function TrackerHomePage() {
  const summary = getSummary();
  const topLeaderByMetaId = new Map<string, string>();
  for (const meta of summary.metas) {
    const metaData = await getMetaData(meta.id);
    if (!metaData) continue;
    const ranked = computeLeaderStatsFromMeta(metaData);
    if (ranked[0]?.leaderId) topLeaderByMetaId.set(meta.id, ranked[0].leaderId);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-accent transition-colors">
          <T section="tracker" k="home" />
        </Link>
        <span>/</span>
        <span className="text-gray-400">
          <T section="tracker" k="heroTitle" />
        </span>
      </div>

      <div className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-accent/10 via-background to-purple-900/10 p-8 sm:p-12 text-center">
        <div className="relative">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            <span className="gradient-text">
              <T section="tracker" k="heroTitle" />
            </span>
          </h1>
          <p className="mt-4 text-gray-400 text-base max-w-2xl mx-auto">
            <T section="tracker" k="heroDesc" />
          </p>
          <p className="mt-3 text-yellow-500/80 text-xs">
            <T section="tracker" k="heroWarning" />
          </p>
          <div className="mt-5 flex justify-center gap-4 text-sm">
            <div className="rounded-lg bg-accent/10 px-4 py-2 text-accent font-bold">
              <T section="tracker" k="totalEventsCount" values={{ count: summary.totalEvents ?? 0 }} />
            </div>
            <div className="rounded-lg bg-white/5 px-4 py-2 text-white font-bold">
              <T section="tracker" k="totalDecksCount" values={{ count: summary.totalDecks ?? 0 }} />
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mb-6">
        <T section="tracker" k="allSets" />
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...summary.metas].sort((a, b) => {
          const numA = parseInt(a.id.replace("op", ""));
          const numB = parseInt(b.id.replace("op", ""));
          return numB - numA;
        }).map((meta) => {
          const isEmpty = meta.eventCount === 0;
          const leaderId = topLeaderByMetaId.get(meta.id) || extractLeaderId(meta.topLeaders?.[0] || "");
          const firstLeader = leaderId;
          const topLeaderImage = leaderId ? getLeaderImage(leaderId) : "";

          const cardContent = (
            <div className="flex items-start gap-4">
              {topLeaderImage ? (
                <CardImage
                  src={topLeaderImage}
                  alt={firstLeader}
                  cardId={leaderId}
                  className="h-20 w-[3.75rem] rounded-lg object-cover shadow-lg ring-1 ring-white/10 flex-shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="h-20 w-[3.75rem] rounded-lg bg-card-border/50 flex-shrink-0 flex items-center justify-center text-2xl text-gray-600">
                  📦
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-extrabold transition-colors ${isEmpty ? "text-gray-500" : "text-white group-hover:text-accent"}`}>
                    {meta.id.toUpperCase()}
                  </h3>
                  <span className="text-xs text-gray-600">{meta.name}</span>
                </div>
                {isEmpty ? (
                  <div className="mt-3">
                    <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[11px] font-medium text-yellow-500/80">
                      <T section="tracker" k="comingSoon" />
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                        {meta.eventCount} <T section="tracker" k="events" />
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-gray-400">
                        {meta.totalDecks || 0} <T section="tracker" k="deck" />
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-accent group-hover:underline">
                      <T section="tracker" k="viewDetails" />
                    </div>
                  </>
                )}
              </div>
            </div>
          );

          if (isEmpty) {
            return (
              <div key={meta.id} className="glass-card rounded-xl p-5 opacity-60 cursor-not-allowed">
                {cardContent}
              </div>
            );
          }

          return (
            <Link key={meta.id} href={`/meta/${meta.id}`} className="glass-card hover-lift group rounded-xl p-5 transition-all block">
              {cardContent}
            </Link>
          );
        })}
      </div>

      <div className="mt-10 text-center text-xs text-gray-600">
        <T section="tracker" k="dataFrom" />{" "}
        <a href="https://egman.gg" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">egman.gg</a>
        <T section="tracker" k="dataFromSuffix" />
        {" · "}
        <T section="tracker" k="cardImages" />{" "}
        <a href="https://en.onepiece-cardgame.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">onepiece-cardgame.com</a>
      </div>
    </div>
  );
}
