import Link from "next/link";
import { notFound } from "next/navigation";
import { getMetaData, getAllMetaIds } from "@/lib/data";
import { getLeaderInfo } from "@/lib/cardHelpers";
import { parseColors, getColorInfo } from "@/lib/colors";
import CardImage from "@/components/CardImage";
import LeaderKOWrapper from "@/components/LeaderKOWrapper";
import T from "@/components/T";
import { computeLeaderStatsFromMeta, POINT_WEIGHTS } from "@/lib/leaderRanking";

export function generateStaticParams() {
  return getAllMetaIds().map((id) => ({ metaId: id }));
}

export default async function LeaderRankingPage({
  params,
}: {
  params: Promise<{ metaId: string }>;
}) {
  const { metaId } = await params;
  const meta = await getMetaData(metaId);
  if (!meta) notFound();

  const ranked = computeLeaderStatsFromMeta(meta);
  const totalAppearances = ranked.reduce((s, l) => s + l.totalAppearances, 0);

  const top3 = ranked.slice(0, 3);
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const maxPoints = ranked[0]?.points || 1;

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
        <span className="text-gray-400">
          <T section="tracker" k="leaderRanking" />
        </span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          <T section="tracker" k="leaderRanking" />
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          <T section="tracker" k="differentLeaders" values={{ count: ranked.length }} />
          {" · "}
          <T section="tracker" k="totalAppearances" values={{ count: totalAppearances }} />
        </p>
      </div>

      {/* Point System */}
      <div className="mb-8 glass-card rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-2">
          <T section="tracker" k="pointSystem" />
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-gray-400">
            <span className="font-bold text-white">{POINT_WEIGHTS.first}pt</span> <T section="tracker" k="first" />
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-gray-400">
            <span className="font-bold text-white">{POINT_WEIGHTS.second}pt</span> <T section="tracker" k="second" />
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-gray-400">
            <span className="font-bold text-white">{POINT_WEIGHTS.third}pt</span> <T section="tracker" k="third" />
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-gray-400">
            <span className="font-bold text-white">{POINT_WEIGHTS.fourth}pt</span> <T section="tracker" k="fourth" />
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-gray-400">
            <span className="font-bold text-white">{POINT_WEIGHTS.top8}pt</span> <T section="tracker" k="top8" />
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-gray-400">
            <span className="font-bold text-white">{POINT_WEIGHTS.top16}pt</span> <T section="tracker" k="top16" />
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-gray-400">
            <span className="font-bold text-white">{POINT_WEIGHTS.top32}pt</span> <T section="tracker" k="top32" />
          </span>
        </div>
      </div>

      {/* Podium — Desktop */}
      {top3.length >= 3 && (
        <div className="mb-12 hidden sm:flex items-end justify-center gap-4">
          {podiumOrder.map((leader, idx) => {
            const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
            const info = getLeaderInfo(leader.leaderId);
            const colors = parseColors(info.color);
            const primaryColor = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");
            const height = rank === 1 ? "h-52" : rank === 2 ? "h-40" : "h-32";

            return (
              <LeaderKOWrapper
                key={leader.leaderId}
                className="flex flex-col items-center"
              >
              <Link
                href={`/meta/${metaId}/leader/${leader.leaderId}`}
                className="group flex flex-col items-center"
              >
                <CardImage
                  src={info.image}
                  alt={info.name}
                  cardId={leader.leaderId}
                  className="mb-3 w-20 rounded-xl object-cover shadow-lg ring-2 ring-white/10 group-hover:ring-accent/50 transition-all"
                />
                <div
                  className={`${height} w-32 rounded-t-2xl bg-gradient-to-t ${primaryColor.gradient} flex flex-col items-center justify-start pt-4 transition-all group-hover:brightness-110`}
                >
                  <span className="text-2xl font-black text-white/90">#{rank}</span>
                  <p className="mt-1 text-center text-xs font-bold text-white/80 px-2 truncate w-full">
                    {info.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/60">
                    {leader.points ?? 0} <T section="tracker" k="pointsShort" />
                  </p>
                </div>
              </Link>
              </LeaderKOWrapper>
            );
          })}
        </div>
      )}

      {/* Podium — Mobile */}
      {top3.length > 0 && (
        <div className="mb-8 sm:hidden space-y-3">
          {top3.map((leader, i) => {
            const info = getLeaderInfo(leader.leaderId);
            const colors = parseColors(info.color);
            const primaryColor = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");

            return (
              <LeaderKOWrapper key={leader.leaderId} className="block">
              <Link
                href={`/meta/${metaId}/leader/${leader.leaderId}`}
                className="glass-card hover-lift flex items-center gap-4 rounded-xl p-4 transition-all"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${primaryColor.gradient} text-sm font-black text-white`}>
                  {i + 1}
                </span>
                <CardImage
                  src={info.image}
                  alt={info.name}
                  cardId={leader.leaderId}
                  className="h-14 w-10 rounded-lg object-cover shadow ring-1 ring-white/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{info.name}</p>
                  <p className="text-xs text-gray-500">{leader.leaderId}</p>
                </div>
                <span className="text-sm font-extrabold text-accent">
                  {leader.points ?? 0} <T section="tracker" k="pointsShort" />
                </span>
              </Link>
              </LeaderKOWrapper>
            );
          })}
        </div>
      )}

      {/* Full Table — Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs text-gray-500">
              <th className="pb-3 pr-4 font-medium">#</th>
              <th className="pb-3 pr-4 font-medium"><T section="tracker" k="leader" /></th>
              <th className="pb-3 pr-4 font-medium text-right"><T section="tracker" k="points" /></th>
              <th className="pb-3 pr-4 font-medium text-right"><T section="tracker" k="wins" /></th>
              <th className="pb-3 pr-4 font-medium text-right"><T section="tracker" k="top8" /></th>
              <th className="pb-3 pr-4 font-medium text-right"><T section="tracker" k="games" /></th>
              <th className="pb-3 pr-4 font-medium text-right"><T section="tracker" k="winPct" /></th>
              <th className="pb-3 pr-4 font-medium text-right"><T section="tracker" k="topPct" /></th>
              <th className="pb-3 font-medium text-right"><T section="tracker" k="sharePct" /></th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((leader, i) => {
              const info = getLeaderInfo(leader.leaderId);
              const colors = parseColors(info.color);
              const topCount =
                leader.wins + (leader.second || 0) + (leader.third || 0) + (leader.fourth || 0) + leader.top8;
              const points = leader.points ?? 0;
              const barW = maxPoints > 0 ? (points / maxPoints) * 100 : 0;

              return (
                <tr
                  key={leader.leaderId}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 pr-4 text-gray-500 font-medium">{i + 1}</td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/meta/${metaId}/leader/${leader.leaderId}`}
                      className="flex items-center gap-3 group"
                    >
                      <CardImage
                        src={info.image}
                        alt={info.name}
                        cardId={leader.leaderId}
                        className="h-10 w-7 rounded-md object-cover ring-1 ring-white/10"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white group-hover:text-accent transition-colors">
                          {info.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-gray-600">{leader.leaderId}</span>
                          {colors.map((c) => {
                            const ci = getColorInfo(c);
                            return <span key={c} className={`h-2 w-2 rounded-full ${ci.dot}`} />;
                          })}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden lg:block w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${barW}%` }} />
                      </div>
                      <span className="font-bold text-accent">{points}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right text-white">{leader.wins}</td>
                  <td className="py-3 pr-4 text-right text-gray-400">{topCount}</td>
                  <td className="py-3 pr-4 text-right text-gray-400">{leader.totalAppearances}</td>
                  <td className="py-3 pr-4 text-right text-gray-400">{leader.winRate ?? 0}%</td>
                  <td className="py-3 pr-4 text-right text-gray-400">{leader.conversionRate ?? 0}%</td>
                  <td className="py-3 text-right text-gray-400">{leader.metaShare ?? 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="sm:hidden space-y-3">
        {ranked.map((leader, i) => {
          const info = getLeaderInfo(leader.leaderId);
          const colors = parseColors(info.color);
          const topCount =
            leader.wins + (leader.second || 0) + (leader.third || 0) + (leader.fourth || 0) + leader.top8;

          return (
            <Link
              key={leader.leaderId}
              href={`/meta/${metaId}/leader/${leader.leaderId}`}
              className="glass-card rounded-xl p-4 block transition-all hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold text-gray-500 w-6 text-center">{i + 1}</span>
                <CardImage
                  src={info.image}
                  alt={info.name}
                  cardId={leader.leaderId}
                  className="h-12 w-9 rounded-md object-cover ring-1 ring-white/10"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{info.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-gray-600">{leader.leaderId}</span>
                    {colors.map((c) => {
                      const ci = getColorInfo(c);
                      return <span key={c} className={`h-2 w-2 rounded-full ${ci.dot}`} />;
                    })}
                  </div>
                </div>
                <span className="text-lg font-extrabold text-accent">{leader.points ?? 0}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/[0.03] py-1.5">
                  <div className="text-xs font-bold text-white">{leader.wins}W</div>
                  <div className="text-[10px] text-gray-600"><T section="tracker" k="wins" /></div>
                </div>
                <div className="rounded-lg bg-white/[0.03] py-1.5">
                  <div className="text-xs font-bold text-white">{topCount}</div>
                  <div className="text-[10px] text-gray-600"><T section="tracker" k="top8" /></div>
                </div>
                <div className="rounded-lg bg-white/[0.03] py-1.5">
                  <div className="text-xs font-bold text-white">{leader.totalAppearances}</div>
                  <div className="text-[10px] text-gray-600"><T section="tracker" k="games" /></div>
                </div>
              </div>

              <div className="mt-2 flex justify-between text-[10px] text-gray-500 px-1">
                <span><T section="tracker" k="winPct" /> {leader.winRate ?? 0}%</span>
                <span><T section="tracker" k="topPct" /> {leader.conversionRate ?? 0}%</span>
                <span><T section="tracker" k="sharePct" /> {leader.metaShare ?? 0}%</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
