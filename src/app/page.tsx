import Link from "next/link";
import { getSummary } from "@/lib/data";
import { getLeaderInfo } from "@/lib/cardHelpers";
import { parseColors, getColorInfo } from "@/lib/colors";
import CardImage from "@/components/CardImage";
import T from "@/components/T";
import type { MetaSummary } from "@/lib/types";

function parseLeaderId(raw: string): { id: string; rest: string } {
  const match = raw.match(/^([A-Z0-9]+-\d+)\s*(.*)$/);
  if (!match) return { id: "", rest: raw };
  return { id: match[1], rest: match[2].trim() };
}

function pickLatestMeta(metas: MetaSummary[]): MetaSummary | null {
  if (metas.length === 0) return null;
  const withNum = metas
    .map((m) => ({ m, n: Number.parseInt(m.id.replace(/\D/g, ""), 10) || 0 }))
    .sort((a, b) => b.n - a.n);
  return withNum[0].m;
}

function splitMetaName(name: string): { prefix: string; subtitle: string } {
  const parts = name.split(" - ");
  if (parts.length >= 2) return { prefix: parts[0], subtitle: parts.slice(1).join(" - ") };
  return { prefix: name, subtitle: "" };
}

export default function LandingPage() {
  const summary = getSummary();
  const metas = [...summary.metas];

  const totalEvents = metas.reduce((sum, m) => sum + m.eventCount, 0);
  const totalDecks = metas.reduce(
    (sum, m) => sum + (m.totalDecks ?? m.deckCount ?? 0),
    0,
  );
  const totalSets = metas.length;

  const uniqueLeaderIds = new Set<string>();
  for (const m of metas) {
    for (const lead of m.topLeaders ?? []) {
      const { id } = parseLeaderId(lead);
      if (id) uniqueLeaderIds.add(id);
    }
  }
  const totalLeaders = uniqueLeaderIds.size;

  const latestMeta = pickLatestMeta(metas);
  const latestTopLeaders = (latestMeta?.topLeaders ?? [])
    .slice(0, 3)
    .map((raw) => {
      const { id, rest } = parseLeaderId(raw);
      if (!id) return null;
      const info = getLeaderInfo(id);
      return {
        id,
        name: info.name && info.name !== id ? info.name : rest || id,
        image: info.image,
        color: info.color,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const orderedMetas = metas.slice().sort((a, b) => {
    const na = Number.parseInt(a.id.replace(/\D/g, ""), 10) || 0;
    const nb = Number.parseInt(b.id.replace(/\D/g, ""), 10) || 0;
    return nb - na;
  });

  return (
    <div className="relative">
      {/* Decorative hero glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-280px] h-[640px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(230,57,70,0.22),rgba(244,162,97,0.08)_55%,transparent_70%)] blur-3xl" />
        <div className="absolute left-[10%] top-[80px] h-[260px] w-[260px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute right-[12%] top-[200px] h-[240px] w-[240px] rounded-full bg-accent-secondary/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pt-20">
        {/* HERO */}
        <section className="text-center animate-fade-in">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent"></span>
            </span>
            <T section="landing" k="eyebrow" />
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="gradient-text">
              <T section="landing" k="title" />
            </span>
          </h1>

          {/* Stat strip */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
            {[
              { value: totalEvents, key: "events", color: "text-accent" },
              { value: totalDecks, key: "decks", color: "text-white" },
              { value: totalLeaders, key: "leaders", color: "text-accent-secondary" },
              { value: totalSets, key: "sets", color: "text-white" },
            ].map((stat) => (
              <div
                key={stat.key}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 backdrop-blur-sm transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${stat.color}`}>
                  {stat.value.toLocaleString()}
                </div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                  <T section="landing" k={stat.key} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TOOL CARDS */}
        <section className="mt-20 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 animate-slide-up">
          <Link
            href="/tracker"
            className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-7 transition-all hover:border-accent/30 hover:from-accent/[0.06] sm:p-9"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-2xl ring-1 ring-accent/20 sm:h-16 sm:w-16 sm:text-3xl">
                📊
              </div>
              <h2 className="text-2xl font-bold text-white group-hover:text-accent transition-colors sm:text-3xl">
                <T section="landing" k="trackerTitle" />
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-400 sm:text-base">
                <T section="landing" k="trackerDesc" />
              </p>
              <ul className="mt-6 space-y-2 text-sm text-gray-300">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <span>
                      {i === 1 ? (
                        <T section="landing" k="trackerFeature1" values={{ sets: totalSets }} />
                      ) : i === 2 ? (
                        <T section="landing" k="trackerFeature2" />
                      ) : (
                        <T section="landing" k="trackerFeature3" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-accent transition-transform group-hover:translate-x-1">
                <T section="landing" k="goToTracker" />
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </Link>

          <Link
            href="/proxy-print"
            className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-7 transition-all hover:border-accent-secondary/30 hover:from-accent-secondary/[0.06] sm:p-9"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-secondary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-secondary/15 text-2xl ring-1 ring-accent-secondary/20 sm:h-16 sm:w-16 sm:text-3xl">
                🖨️
              </div>
              <h2 className="text-2xl font-bold text-white group-hover:text-accent-secondary transition-colors sm:text-3xl">
                <T section="landing" k="proxyTitle" />
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-400 sm:text-base">
                <T section="landing" k="proxyDesc" />
              </p>
              <ul className="mt-6 space-y-2 text-sm text-gray-300">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-secondary" aria-hidden="true" />
                    <span>
                      {i === 1 ? (
                        <T section="landing" k="proxyFeature1" />
                      ) : i === 2 ? (
                        <T section="landing" k="proxyFeature2" />
                      ) : (
                        <T section="landing" k="proxyFeature3" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-accent-secondary transition-transform group-hover:translate-x-1">
                <T section="landing" k="goToProxy" />
                <span aria-hidden="true">→</span>
              </div>
            </div>
          </Link>
        </section>

        {/* LATEST META SPOTLIGHT */}
        {latestMeta && latestTopLeaders.length > 0 && (
          <section className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  <T section="landing" k="latestMeta" />
                </p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {splitMetaName(latestMeta.name).prefix}
                  {splitMetaName(latestMeta.name).subtitle && (
                    <span className="ml-2 text-gray-500 font-medium">
                      · {splitMetaName(latestMeta.name).subtitle}
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  <T section="landing" k="latestMetaDesc" />
                </p>
              </div>
              <Link
                href={`/meta/${latestMeta.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
              >
                <T section="landing" k="openMeta" />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {latestTopLeaders.map((l, idx) => {
                const colors = parseColors(l.color);
                const primary = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");
                return (
                  <Link
                    key={l.id}
                    href={`/meta/${latestMeta.id}/leader/${l.id}`}
                    className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br ${primary.gradient} p-5 transition-all hover:border-white/20`}
                  >
                    <div className="absolute inset-0 bg-black/70" />
                    <div className="relative flex items-center gap-4">
                      <div className="relative shrink-0">
                        <CardImage
                          src={l.image}
                          alt={l.name}
                          cardId={l.id}
                          className="h-28 w-auto rounded-xl object-cover shadow-2xl ring-2 ring-white/15"
                          loading="lazy"
                        />
                        <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-black shadow-lg">
                          {idx + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                          <T section="tracker" k="leader" />
                        </p>
                        <p className="mt-1 truncate text-lg font-extrabold text-white group-hover:text-accent transition-colors">
                          {l.name}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-white/50">{l.id}</p>
                        <div className="mt-2 flex gap-1.5">
                          {colors.map((c) => {
                            const ci = getColorInfo(c);
                            return (
                              <span key={c} className={`h-2 w-2 rounded-full ${ci.dot}`} />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ALL SETS */}
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-secondary">
                {totalSets} <T section="landing" k="sets" />
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                <T section="landing" k="allSets" />
              </h2>
            </div>
            <Link
              href="/tracker"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
            >
              <T section="landing" k="viewAll" />
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {orderedMetas.map((m, idx) => {
              const { prefix, subtitle } = splitMetaName(m.name);
              const decks = m.totalDecks ?? m.deckCount ?? 0;
              const isLatest = idx === 0;
              return (
                <Link
                  key={m.id}
                  href={`/meta/${m.id}`}
                  className={`group relative rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
                    isLatest
                      ? "border-accent/30 bg-accent/[0.05] hover:border-accent/60"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  {isLatest && (
                    <span className="absolute -top-2 right-3 rounded-full bg-accent px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-black shadow-lg">
                      New
                    </span>
                  )}
                  <p className={`text-base font-extrabold tracking-tight ${isLatest ? "text-accent" : "text-white"} group-hover:text-accent transition-colors`}>
                    {prefix}
                  </p>
                  {subtitle && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500">{subtitle}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                    <span className="tabular-nums">
                      <span className="font-bold text-gray-300">{m.eventCount}</span>{" "}
                      <T section="landing" k="events" />
                    </span>
                    <span className="tabular-nums">
                      <span className="font-bold text-gray-300">{decks}</span>{" "}
                      <T section="landing" k="decks" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-24 border-t border-white/[0.05] pt-8 text-center text-xs text-gray-500">
          <p>
            <T section="landing" k="footerTagline" />
          </p>
          <p className="mt-2">
            <T section="tracker" k="dataFrom" />{" "}
            <a
              href="https://egman.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-accent transition-colors"
            >
              egman.gg
            </a>
            <T section="tracker" k="dataFromSuffix" />
          </p>
        </footer>
      </div>
    </div>
  );
}
