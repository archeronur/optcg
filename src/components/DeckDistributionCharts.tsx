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
const COUNTER_VALUES = [0, 1000, 2000] as const;

export default function DeckDistributionCharts({ cards }: Props) {
  const { t } = useI18n();

  const {
    costBuckets,
    overflow,
    counterBuckets,
    maxCost,
    maxCounter,
    characterCount,
    avgCost,
  } = useMemo(() => {
    const costs = new Array(11).fill(0) as number[];
    let over = 0;
    let weightedCostSum = 0;
    let costDenom = 0;
    const counters: Record<number, number> = { 0: 0, 1000: 0, 2000: 0 };
    let chars = 0;

    for (const c of cards) {
      const cn = c.count ?? 0;
      if (cn <= 0) continue;
      const costNum = parseInt(c.data.cost ?? "", 10);
      if (Number.isFinite(costNum) && costNum >= 0) {
        if (costNum > 10) over += cn;
        else costs[costNum] += cn;
        weightedCostSum += costNum * cn;
        costDenom += cn;
      }
      if (c.data.type === "Character") {
        chars += cn;
        const cv = parseInt((c.data.counter ?? "").trim(), 10);
        if (cv === 1000) counters[1000] += cn;
        else if (cv === 2000) counters[2000] += cn;
        else counters[0] += cn;
      }
    }

    const maxCostVal = Math.max(...costs, 1);
    const maxCounterVal = Math.max(
      counters[0] ?? 0,
      counters[1000] ?? 0,
      counters[2000] ?? 0,
      1,
    );
    const avg = costDenom > 0 ? weightedCostSum / costDenom : 0;
    return {
      costBuckets: costs,
      overflow: over,
      counterBuckets: counters,
      maxCost: maxCostVal,
      maxCounter: maxCounterVal,
      characterCount: chars,
      avgCost: avg,
    };
  }, [cards]);

  const anyCounterData =
    (counterBuckets[1000] ?? 0) > 0 || (counterBuckets[2000] ?? 0) > 0;

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[3fr_2fr]">
      {/* Mana curve */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <T section="tracker" k="manaCurve" />
          </h3>
          <span className="text-[10px] text-gray-500 tabular-nums">
            <T section="tracker" k="avgCost" /> {avgCost.toFixed(2)}
          </span>
        </div>
        <div className="flex h-24 items-end gap-1 sm:h-28">
          {COSTS.map((c) => {
            const n = costBuckets[c];
            const h = n > 0 ? Math.max(8, Math.round((n / maxCost) * 100)) : 2;
            return (
              <div
                key={c}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${t("tracker", "cost")} ${c}: ${n}`}
              >
                <span className="text-[10px] font-bold text-white tabular-nums leading-none">
                  {n > 0 ? n : ""}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t transition-all ${
                      n > 0 ? "bg-accent/80" : "bg-white/[0.04]"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 tabular-nums leading-none">
                  {c}
                </span>
              </div>
            );
          })}
        </div>
        {overflow > 0 && (
          <p className="mt-1 text-[10px] text-gray-500 tabular-nums">
            10+: {overflow}
          </p>
        )}
      </div>

      {/* Counter distribution */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <T section="tracker" k="counterDist" />
          </h3>
          <span className="text-[10px] text-gray-500 tabular-nums">
            <T section="tracker" k="charactersShort" values={{ count: characterCount }} />
          </span>
        </div>
        {characterCount === 0 ? (
          <p className="flex h-24 items-center justify-center text-center text-[11px] text-gray-500 sm:h-28">
            <T section="tracker" k="noCharactersInDeck" />
          </p>
        ) : (
          <div className="flex h-24 items-end gap-2 sm:h-28">
            {COUNTER_VALUES.map((v) => {
              const n = counterBuckets[v] ?? 0;
              const h = n > 0 ? Math.max(8, Math.round((n / maxCounter) * 100)) : 2;
              const barColor =
                v === 0
                  ? "bg-gray-500/70"
                  : v === 1000
                    ? "bg-sky-500/80"
                    : "bg-rose-500/80";
              const label =
                v === 0 ? t("tracker", "noCounter") : v.toString();
              return (
                <div
                  key={v}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${label}: ${n}`}
                >
                  <span className="text-[10px] font-bold text-white tabular-nums leading-none">
                    {n > 0 ? n : ""}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t transition-all ${
                        n > 0 ? barColor : "bg-white/[0.04]"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 tabular-nums leading-none">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {!anyCounterData && characterCount > 0 && (
          <p className="mt-1 text-[10px] text-gray-500">
            <T section="tracker" k="counterDataMissing" />
          </p>
        )}
      </div>
    </div>
  );
}
