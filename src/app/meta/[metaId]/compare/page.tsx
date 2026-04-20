import Link from "next/link";
import { notFound } from "next/navigation";
import { getMetaData, getAllMetaIds } from "@/lib/data";
import {
  getLeaderInfo,
  enrichCardMapWithStats,
  addCanonicalCardIdAliases,
  lookupCardData,
} from "@/lib/cardHelpers";
import { hydrateTrackerCards } from "@/lib/trackerCardHydrate";
import { parseColors, getColorInfo } from "@/lib/colors";
import { getCard } from "@/lib/cards";
import { computeLeaderStatsFromMeta } from "@/lib/leaderRanking";
import { isLegacyMetaThroughOp05 } from "@/lib/metaEra";
import CardImage from "@/components/CardImage";
import CardGrid from "@/components/CardGrid";
import T from "@/components/T";
import LeaderSelect from "./LeaderSelect";
import SwapButton from "./SwapButton";
import type { Card, LeaderStats, CardAnalysis } from "@/lib/types";

export function generateStaticParams() {
  return getAllMetaIds().map((id) => ({ metaId: id }));
}

type CardWithUsage = Card & { inclusionRate: number; avgCount: number };

type SideKey = "a" | "b";

function pickStats(ranked: LeaderStats[], id: string | undefined): LeaderStats | null {
  if (!id) return null;
  return ranked.find((l) => l.leaderId === id) ?? null;
}

function winnerClass(cmp: number, side: SideKey): string {
  // cmp > 0 → A bigger (better), cmp < 0 → B bigger (better), 0 → tie
  if (cmp === 0) return "text-white";
  const aWins = (cmp > 0 && side === "a") || (cmp < 0 && side === "b");
  return aWins ? "text-emerald-400" : "text-gray-400";
}

interface StatRow {
  label: string;
  key: string;
  a: number | string;
  b: number | string;
  cmp: number;
  suffix?: string;
}

function buildStatRows(a: LeaderStats | null, b: LeaderStats | null): StatRow[] {
  const num = (v: number | undefined) => v ?? 0;
  const as = a ?? ({} as LeaderStats);
  const bs = b ?? ({} as LeaderStats);
  const rows: StatRow[] = [
    { key: "points", label: "points", a: num(as.points), b: num(bs.points), cmp: num(as.points) - num(bs.points) },
    { key: "wins", label: "wins", a: num(as.wins), b: num(bs.wins), cmp: num(as.wins) - num(bs.wins) },
    {
      key: "totalApp",
      label: "totalApp",
      a: num(as.totalAppearances),
      b: num(bs.totalAppearances),
      cmp: num(as.totalAppearances) - num(bs.totalAppearances),
    },
    {
      key: "winPct",
      label: "winPct",
      a: num(as.winRate),
      b: num(bs.winRate),
      cmp: num(as.winRate) - num(bs.winRate),
      suffix: "%",
    },
    {
      key: "conversionPct",
      label: "conversionPct",
      a: num(as.conversionRate),
      b: num(bs.conversionRate),
      cmp: num(as.conversionRate) - num(bs.conversionRate),
      suffix: "%",
    },
    {
      key: "sharePct",
      label: "sharePct",
      a: num(as.metaShare),
      b: num(bs.metaShare),
      cmp: num(as.metaShare) - num(bs.metaShare),
      suffix: "%",
    },
    {
      key: "uniquePlayers",
      label: "uniquePlayers",
      a: num(as.uniquePlayers),
      b: num(bs.uniquePlayers),
      cmp: num(as.uniquePlayers) - num(bs.uniquePlayers),
    },
    {
      key: "uniqueEvents",
      label: "uniqueEvents",
      a: num(as.uniqueEvents),
      b: num(bs.uniqueEvents),
      cmp: num(as.uniqueEvents) - num(bs.uniqueEvents),
    },
  ];
  return rows;
}

const PLACING_KEYS: Array<{
  key: "wins" | "second" | "third" | "fourth" | "top8" | "top16" | "top32";
  label: string;
  prefixHash?: boolean;
}> = [
  { key: "wins", label: "1st", prefixHash: true },
  { key: "second", label: "2nd", prefixHash: true },
  { key: "third", label: "3rd", prefixHash: true },
  { key: "fourth", label: "4th", prefixHash: true },
  { key: "top8", label: "top8" },
  { key: "top16", label: "top16" },
  { key: "top32", label: "top32" },
];

function buildCardList(
  stats: LeaderStats | null,
  cardsData: Record<string, Card>,
  filterFn: (c: CardAnalysis) => boolean,
): CardWithUsage[] {
  if (!stats) return [];
  const src = [...(stats.coreCards ?? []), ...(stats.flexCards ?? [])].filter(filterFn);
  return src
    .map((c) => {
      const base = getCard(c.id) ?? lookupCardData(cardsData, c.id);
      if (!base) return null;
      return { ...base, inclusionRate: c.inclusionRate, avgCount: c.avgCount } satisfies CardWithUsage;
    })
    .filter((x): x is CardWithUsage => x !== null)
    .sort((x, y) => y.inclusionRate - x.inclusionRate);
}

function intersectCoreCards(
  a: LeaderStats | null,
  b: LeaderStats | null,
  cardsData: Record<string, Card>,
): CardWithUsage[] {
  if (!a || !b) return [];
  const aCore = new Map<string, CardAnalysis>();
  for (const c of a.coreCards ?? []) if (c.inclusionRate >= 70) aCore.set(c.id, c);
  const shared: CardWithUsage[] = [];
  for (const c of b.coreCards ?? []) {
    if (c.inclusionRate < 70) continue;
    const ca = aCore.get(c.id);
    if (!ca) continue;
    const base = getCard(c.id) ?? lookupCardData(cardsData, c.id);
    if (!base) continue;
    const avg = (ca.avgCount + c.avgCount) / 2;
    const rate = Math.min(ca.inclusionRate, c.inclusionRate); // conservative
    shared.push({ ...base, inclusionRate: rate, avgCount: avg });
  }
  shared.sort((x, y) => y.inclusionRate - x.inclusionRate);
  return shared;
}

export default async function CompareLeadersPage({
  params,
  searchParams,
}: {
  params: Promise<{ metaId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { metaId } = await params;
  const sp = await searchParams;
  const aId = typeof sp.a === "string" ? sp.a : Array.isArray(sp.a) ? sp.a[0] : "";
  const bId = typeof sp.b === "string" ? sp.b : Array.isArray(sp.b) ? sp.b[0] : "";

  const meta = await getMetaData(metaId);
  if (!meta) notFound();

  const ranked = computeLeaderStatsFromMeta(meta);
  const options = ranked.map((r) => ({
    leaderId: r.leaderId,
    name: getLeaderInfo(r.leaderId).name,
    points: r.points ?? 0,
    wins: r.wins ?? 0,
  }));

  const statsA = pickStats(ranked, aId);
  const statsB = pickStats(ranked, bId);
  const bothSelected = !!statsA && !!statsB;
  const sameLeader = bothSelected && statsA!.leaderId === statsB!.leaderId;

  const legacyMeta = isLegacyMetaThroughOp05(metaId);

  let cardsData: Record<string, Card> = {};
  if (!legacyMeta && (statsA || statsB)) {
    let cardMap: Record<string, Card> = {};
    if (statsA) cardMap = enrichCardMapWithStats(cardMap, statsA);
    if (statsB) cardMap = enrichCardMapWithStats(cardMap, statsB);
    addCanonicalCardIdAliases(cardMap);
    cardsData = await hydrateTrackerCards(cardMap);
  }

  const coreA = !legacyMeta
    ? buildCardList(statsA, cardsData, (c) => c.inclusionRate >= 70)
    : [];
  const coreB = !legacyMeta
    ? buildCardList(statsB, cardsData, (c) => c.inclusionRate >= 70)
    : [];
  const flexA = !legacyMeta
    ? buildCardList(statsA, cardsData, (c) => c.inclusionRate < 70)
    : [];
  const flexB = !legacyMeta
    ? buildCardList(statsB, cardsData, (c) => c.inclusionRate < 70)
    : [];
  const sharedCore = !legacyMeta ? intersectCoreCards(statsA, statsB, cardsData) : [];

  const infoA = statsA ? getLeaderInfo(statsA.leaderId) : null;
  const infoB = statsB ? getLeaderInfo(statsB.leaderId) : null;
  const colorsA = infoA ? parseColors(infoA.color) : [];
  const colorsB = infoB ? parseColors(infoB.color) : [];
  const primaryA = colorsA[0] ? getColorInfo(colorsA[0]) : getColorInfo("Black");
  const primaryB = colorsB[0] ? getColorInfo(colorsB[0]) : getColorInfo("Black");

  const statRows = buildStatRows(statsA, statsB);

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
          <T section="tracker" k="compareLeaders" />
        </span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          <T section="tracker" k="compareLeaders" />
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          <T section="tracker" k="compareLeadersDesc" />
        </p>
      </div>

      {/* Picker bar */}
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <LeaderSelect
          side="a"
          value={aId}
          options={options}
          disabledId={bId}
          placeholder="Leader A"
        />
        <div className="flex items-center justify-center">
          <SwapButton a={aId} b={bId} />
        </div>
        <LeaderSelect
          side="b"
          value={bId}
          options={options}
          disabledId={aId}
          placeholder="Leader B"
        />
      </div>

      {/* Empty / duplicate states */}
      {(!statsA || !statsB) && (
        <div className="glass-card rounded-xl p-6 text-center text-sm text-gray-400">
          <T section="tracker" k="pickBothLeaders" />
        </div>
      )}
      {sameLeader && (
        <div className="glass-card rounded-xl p-6 text-center text-sm text-amber-300">
          <T section="tracker" k="sameLeaderRequired" />
        </div>
      )}

      {bothSelected && !sameLeader && (
        <>
          {/* Hero: A vs B */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            {/* A */}
            <Link
              href={`/meta/${metaId}/leader/${statsA!.leaderId}`}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${primaryA.gradient} p-5 transition-all hover:brightness-110`}
            >
              <div className="absolute inset-0 bg-black/55" />
              <div className="relative flex items-center gap-4">
                <CardImage
                  src={infoA!.image}
                  alt={infoA!.name}
                  cardId={statsA!.leaderId}
                  className="h-28 w-auto rounded-xl shadow-2xl ring-2 ring-white/20"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                    <T section="tracker" k="leaderA" />
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-white">{infoA!.name}</h2>
                  <p className="mt-0.5 text-xs text-white/60">{statsA!.leaderId}</p>
                  <div className="mt-2 flex gap-1.5">
                    {colorsA.map((c) => (
                      <span key={c} className={`h-2 w-2 rounded-full ${getColorInfo(c).dot}`} />
                    ))}
                  </div>
                </div>
              </div>
            </Link>

            {/* VS badge */}
            <div className="flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-black tracking-widest text-white">
                VS
              </span>
            </div>

            {/* B */}
            <Link
              href={`/meta/${metaId}/leader/${statsB!.leaderId}`}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${primaryB.gradient} p-5 transition-all hover:brightness-110`}
            >
              <div className="absolute inset-0 bg-black/55" />
              <div className="relative flex items-center gap-4 md:flex-row-reverse md:text-right">
                <CardImage
                  src={infoB!.image}
                  alt={infoB!.name}
                  cardId={statsB!.leaderId}
                  className="h-28 w-auto rounded-xl shadow-2xl ring-2 ring-white/20"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                    <T section="tracker" k="leaderB" />
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-white">{infoB!.name}</h2>
                  <p className="mt-0.5 text-xs text-white/60">{statsB!.leaderId}</p>
                  <div className="mt-2 flex gap-1.5 md:justify-end">
                    {colorsB.map((c) => (
                      <span key={c} className={`h-2 w-2 rounded-full ${getColorInfo(c).dot}`} />
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Stats table: A | metric | B */}
          <section className="mb-10">
            <div className="glass-card overflow-hidden rounded-xl">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <div className="text-right">A</div>
                <div className="text-center">
                  <T section="tracker" k="metric" />
                </div>
                <div>B</div>
              </div>
              {statRows.map((row) => {
                const suffix = row.suffix ?? "";
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/[0.04] px-4 py-3 last:border-b-0"
                  >
                    <div
                      className={`text-right text-lg font-extrabold tabular-nums ${winnerClass(row.cmp, "a")}`}
                    >
                      {row.a}
                      {suffix}
                    </div>
                    <div className="text-center text-[11px] font-medium uppercase tracking-wider text-gray-500">
                      <T section="tracker" k={row.label} />
                    </div>
                    <div
                      className={`text-left text-lg font-extrabold tabular-nums ${winnerClass(row.cmp, "b")}`}
                    >
                      {row.b}
                      {suffix}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Placing distribution side-by-side */}
          <section className="mb-10">
            <h2 className="mb-3 text-lg font-bold text-white sm:text-xl">
              <T section="tracker" k="placingDist" />
            </h2>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
              <div className="space-y-2">
                {PLACING_KEYS.map((p) => {
                  const av = Number((statsA as unknown as Record<string, number>)[p.key] ?? 0);
                  const bv = Number((statsB as unknown as Record<string, number>)[p.key] ?? 0);
                  const cmp = av - bv;
                  return (
                    <div
                      key={`a-${p.key}`}
                      className="flex items-center justify-end rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <span className={`font-extrabold tabular-nums ${winnerClass(cmp, "a")}`}>
                        {av}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                {PLACING_KEYS.map((p) => (
                  <div
                    key={`label-${p.key}`}
                    className="flex min-w-[4rem] items-center justify-center rounded-lg bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400"
                  >
                    {p.prefixHash ? `#${p.label}` : <T section="tracker" k={p.label} />}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {PLACING_KEYS.map((p) => {
                  const av = Number((statsA as unknown as Record<string, number>)[p.key] ?? 0);
                  const bv = Number((statsB as unknown as Record<string, number>)[p.key] ?? 0);
                  const cmp = av - bv;
                  return (
                    <div
                      key={`b-${p.key}`}
                      className="flex items-center justify-start rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <span className={`font-extrabold tabular-nums ${winnerClass(cmp, "b")}`}>
                        {bv}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Shared core */}
          {sharedCore.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-white sm:text-xl">
                <T section="tracker" k="bothCore" />
              </h2>
              <p className="mb-4 text-xs text-gray-500">
                {sharedCore.length}{" "}
                <T section="tracker" k="coreCards" />
              </p>
              <CardGrid cards={sharedCore} variant="core" mobileMaxRows={3} />
            </section>
          )}

          {/* Side-by-side core cards */}
          {(coreA.length > 0 || coreB.length > 0) && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-bold text-white sm:text-xl">
                <T section="tracker" k="coreCards" />
              </h2>
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    A — {infoA!.name} · {coreA.length}
                  </p>
                  <CardGrid cards={coreA} variant="core" mobileMaxRows={3} />
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    B — {infoB!.name} · {coreB.length}
                  </p>
                  <CardGrid cards={coreB} variant="core" mobileMaxRows={3} />
                </div>
              </div>
            </section>
          )}

          {/* Side-by-side flex cards */}
          {(flexA.length > 0 || flexB.length > 0) && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-bold text-white sm:text-xl">
                <T section="tracker" k="flexCards" />
              </h2>
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    A — {infoA!.name} · {flexA.length}
                  </p>
                  <CardGrid cards={flexA} variant="flex" mobileMaxRows={3} />
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    B — {infoB!.name} · {flexB.length}
                  </p>
                  <CardGrid cards={flexB} variant="flex" mobileMaxRows={3} />
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
