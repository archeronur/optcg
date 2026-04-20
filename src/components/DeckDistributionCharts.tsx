"use client";

import { useMemo } from "react";
import T from "./T";
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

function computeBuckets(cards: DeckCardEntry[]) {
  const costs = new Array(11).fill(0) as number[];
  const counters: Record<number, number> = { 0: 0, 1000: 0, 2000: 0 };

  for (const c of cards) {
    const cn = c.count ?? 0;
    if (cn <= 0) continue;

    const costNum = parseInt(c.data.cost ?? "", 10);
    if (Number.isFinite(costNum) && costNum >= 0) {
      const bucket = costNum > 10 ? 10 : costNum;
      costs[bucket] += cn;
    }

    if (c.data.type === "Character") {
      const cv = parseInt((c.data.counter ?? "").trim(), 10);
      if (cv === 1000) counters[1000] += cn;
      else if (cv === 2000) counters[2000] += cn;
      else counters[0] += cn;
    }
  }

  return { costs, counters };
}

interface BarProps {
  value: number;
  max: number;
  barClass: string;
  label: string;
}

function Bar({ value, max, barClass, label }: BarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const height = value > 0 ? Math.max(6, pct) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className="mb-1.5 h-3.5 text-[11px] font-bold leading-none tabular-nums text-white">
        {value > 0 ? value : ""}
      </div>
      <div className="flex w-full flex-1 items-end overflow-hidden rounded-t-md bg-white/[0.03]">
        <div
          className={`w-full rounded-t-md transition-[height] duration-700 ease-out ${barClass}`}
          style={{ height: `${height}%` }}
        />
      </div>
      <div className="mt-2 h-3 text-[10px] font-medium leading-none tabular-nums text-gray-500">
        {label}
      </div>
    </div>
  );
}

export default function DeckDistributionCharts({ cards }: Props) {
  const { costs, counters } = useMemo(() => computeBuckets(cards), [cards]);
  const maxCost = Math.max(...costs, 1);
  const maxCounter = Math.max(
    counters[0] ?? 0,
    counters[1000] ?? 0,
    counters[2000] ?? 0,
    1,
  );

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,1.3fr)]">
      <section className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
          <T section="tracker" k="manaCurve" />
        </h3>
        <div className="flex h-28 items-end gap-1.5 sm:h-32">
          {COSTS.map((c) => (
            <Bar
              key={c}
              value={costs[c]}
              max={maxCost}
              barClass="bg-gradient-to-t from-accent to-accent/60 shadow-[0_-4px_16px_-8px] shadow-accent/50"
              label={String(c)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
          <T section="tracker" k="counterDist" />
        </h3>
        <div className="flex h-28 items-end gap-3 sm:h-32">
          <Bar
            value={counters[0] ?? 0}
            max={maxCounter}
            barClass="bg-gradient-to-t from-gray-500 to-gray-400/60"
            label="—"
          />
          <Bar
            value={counters[1000] ?? 0}
            max={maxCounter}
            barClass="bg-gradient-to-t from-sky-500 to-sky-400/60 shadow-[0_-4px_16px_-8px] shadow-sky-500/50"
            label="1000"
          />
          <Bar
            value={counters[2000] ?? 0}
            max={maxCounter}
            barClass="bg-gradient-to-t from-rose-500 to-rose-400/60 shadow-[0_-4px_16px_-8px] shadow-rose-500/50"
            label="2000"
          />
        </div>
      </section>
    </div>
  );
}
