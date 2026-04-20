"use client";

import { useMemo } from "react";
import T from "./T";
import { useI18n } from "@/lib/i18n";
import type { Card } from "@/lib/types";

interface DeckCardEntry {
  count: number;
  data: Card;
}

interface Props {
  cards: DeckCardEntry[];
}

const COSTS: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const GRID_LINES = [25, 50, 75, 100] as const;

interface Buckets {
  costs: number[];
  counters: Record<0 | 1000 | 2000, number>;
  avgCost: number;
  totalCostCards: number;
  totalCharacters: number;
}

function computeBuckets(cards: DeckCardEntry[]): Buckets {
  const costs = new Array(11).fill(0) as number[];
  const counters: Record<0 | 1000 | 2000, number> = { 0: 0, 1000: 0, 2000: 0 };
  let totalCostCards = 0;
  let totalCostSum = 0;
  let totalCharacters = 0;

  for (const c of cards) {
    const cn = c.count ?? 0;
    if (cn <= 0) continue;

    const costNum = parseInt(c.data.cost ?? "", 10);
    if (Number.isFinite(costNum) && costNum >= 0) {
      const bucket = costNum > 10 ? 10 : costNum;
      costs[bucket] += cn;
      totalCostCards += cn;
      totalCostSum += costNum * cn;
    }

    if (c.data.type === "Character") {
      totalCharacters += cn;
      const cv = parseInt((c.data.counter ?? "").trim(), 10);
      if (cv === 1000) counters[1000] += cn;
      else if (cv === 2000) counters[2000] += cn;
      else counters[0] += cn;
    }
  }

  const avgCost = totalCostCards > 0 ? totalCostSum / totalCostCards : 0;
  return { costs, counters, avgCost, totalCostCards, totalCharacters };
}

interface CostBarProps {
  value: number;
  max: number;
  isPeak: boolean;
  label: string;
}

function CostBar({ value, max, isPeak, label }: CostBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const height = value > 0 ? Math.max(4, pct) : 0;
  const hasValue = value > 0;

  return (
    <div className="group relative flex min-w-0 flex-1 flex-col items-center">
      {/* value pill on top */}
      <div className="mb-1.5 flex h-5 items-center">
        <span
          className={`rounded px-1.5 text-[11px] font-bold leading-none tabular-nums transition-colors ${
            hasValue
              ? isPeak
                ? "bg-accent/20 text-accent"
                : "text-white group-hover:bg-white/5"
              : "text-transparent"
          }`}
        >
          {hasValue ? value : "0"}
        </span>
      </div>

      {/* bar column */}
      <div className="flex w-full flex-1 items-end">
        <div
          className={`w-full rounded-t-md transition-all duration-500 ease-out ${
            isPeak
              ? "bg-gradient-to-t from-accent via-accent to-accent/70 shadow-[0_-8px_24px_-4px] shadow-accent/40"
              : "bg-gradient-to-t from-accent/80 via-accent/60 to-accent/40 group-hover:from-accent group-hover:via-accent/80 group-hover:to-accent/60"
          }`}
          style={{ height: `${height}%` }}
        />
      </div>

      {/* axis label */}
      <div
        className={`mt-2 flex h-4 w-full items-center justify-center text-[10px] font-semibold leading-none tabular-nums transition-colors ${
          isPeak ? "text-accent" : hasValue ? "text-gray-400" : "text-gray-600"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

interface CounterCategory {
  key: 0 | 1000 | 2000;
  label: string;
  dotClass: string;
  stackClass: string;
  textClass: string;
}

function CounterLegendRow({
  category,
  count,
  pct,
}: {
  category: CounterCategory;
  count: number;
  pct: number;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${category.dotClass}`} />
        <span className={`truncate text-[11px] font-semibold ${category.textClass}`}>
          {category.label}
        </span>
      </span>
      <span className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-sm font-extrabold text-white">{count}</span>
        <span className="text-[10px] font-medium text-gray-500">{pct}%</span>
      </span>
    </li>
  );
}

export default function DeckDistributionCharts({ cards }: Props) {
  const { t } = useI18n();
  const { costs, counters, avgCost, totalCostCards, totalCharacters } = useMemo(
    () => computeBuckets(cards),
    [cards],
  );
  const maxCost = Math.max(...costs, 1);
  const peakCost = costs.indexOf(Math.max(...costs));
  const hasCostData = totalCostCards > 0;

  const counterCategories: CounterCategory[] = [
    {
      key: 2000,
      label: "2000",
      dotClass: "bg-rose-400",
      stackClass: "bg-gradient-to-r from-rose-500 to-rose-400",
      textClass: "text-rose-300",
    },
    {
      key: 1000,
      label: "1000",
      dotClass: "bg-sky-400",
      stackClass: "bg-gradient-to-r from-sky-500 to-sky-400",
      textClass: "text-sky-300",
    },
    {
      key: 0,
      label: t("tracker", "noCounter"),
      dotClass: "bg-gray-500",
      stackClass: "bg-gradient-to-r from-gray-500 to-gray-400",
      textClass: "text-gray-400",
    },
  ];

  const counterTotal = totalCharacters;
  const counterPct = (key: 0 | 1000 | 2000) =>
    counterTotal > 0 ? Math.round((counters[key] / counterTotal) * 100) : 0;

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,1.35fr)]">
      {/* ---------- Cost Curve ---------- */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 pt-3.5">
        {/* subtle accent glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/4 h-32 w-1/2 rounded-full bg-accent/10 blur-3xl"
        />

        <header className="relative mb-3 flex items-end justify-between gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            <T section="tracker" k="manaCurve" />
          </h3>
          {hasCostData && (
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              <span className="flex items-baseline gap-1 rounded-md bg-white/[0.04] px-2 py-1">
                <T section="tracker" k="avgCost" />
                <span className="text-[13px] font-extrabold normal-case tracking-normal tabular-nums text-white">
                  {avgCost.toFixed(1)}
                </span>
              </span>
              <span className="flex items-baseline gap-1 rounded-md bg-white/[0.04] px-2 py-1">
                <span className="text-[13px] font-extrabold normal-case tracking-normal tabular-nums text-white">
                  {totalCostCards}
                </span>
                <T section="tracker" k="totalShort" />
              </span>
            </div>
          )}
        </header>

        {/* chart area */}
        <div className="relative h-32 sm:h-36">
          {/* horizontal grid lines */}
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col-reverse justify-between pb-6"
          >
            {GRID_LINES.map((g) => (
              <div
                key={g}
                className="h-px w-full bg-white/[0.04]"
                style={{ opacity: g === 100 ? 0.35 : 0.18 }}
              />
            ))}
          </div>

          {/* bars */}
          <div className="relative flex h-full items-end gap-1.5 sm:gap-2">
            {COSTS.map((c) => (
              <CostBar
                key={c}
                value={costs[c]}
                max={maxCost}
                isPeak={hasCostData && c === peakCost && costs[c] > 0}
                label={c === 10 ? "10+" : String(c)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Counter Distribution ---------- */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 pt-3.5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 right-0 h-32 w-2/3 rounded-full bg-rose-500/10 blur-3xl"
        />

        <header className="relative mb-3 flex items-end justify-between gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            <T section="tracker" k="counterDist" />
          </h3>
          {counterTotal > 0 && (
            <div className="flex items-baseline gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              <span className="text-[13px] font-extrabold normal-case tracking-normal tabular-nums text-white">
                {counterTotal}
              </span>
              <T section="tracker" k="charactersShort" />
            </div>
          )}
        </header>

        {counterTotal > 0 ? (
          <div className="relative">
            {/* stacked proportional bar */}
            <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-white/[0.04] ring-1 ring-white/[0.03]">
              {counterCategories.map((cat) => {
                const value = counters[cat.key];
                if (value <= 0) return null;
                const pct = (value / counterTotal) * 100;
                return (
                  <div
                    key={cat.key}
                    className={`h-full transition-all duration-500 ease-out ${cat.stackClass}`}
                    style={{ width: `${pct}%` }}
                    title={`${cat.label}: ${value} (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>

            {/* legend */}
            <ul className="space-y-0.5">
              {counterCategories.map((cat) => (
                <CounterLegendRow
                  key={cat.key}
                  category={cat}
                  count={counters[cat.key]}
                  pct={counterPct(cat.key)}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-white/[0.06] text-[11px] font-medium text-gray-600">
            <T section="tracker" k="noCharactersInDeck" />
          </div>
        )}
      </section>
    </div>
  );
}
