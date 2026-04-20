#!/usr/bin/env node
// One-off utility: backfill the `counter` field on data/cards.json using
// the Limitless OP TCG API. Only touches Character cards missing a counter
// value. Idempotent — safe to re-run.
//
// Usage:
//   node scripts/enrich-card-counters.mjs           # all missing characters
//   node scripts/enrich-card-counters.mjs --force   # re-fetch every character
//   node scripts/enrich-card-counters.mjs --limit 50 --concurrency 6

import fs from "node:fs";
import path from "node:path";

const CARDS_JSON = path.join(process.cwd(), "data", "cards.json");
const LIMITLESS_BASE = "https://onepiece.limitlesstcg.com/api/cards";

function parseArgs(argv) {
  const out = { force: false, limit: Infinity, concurrency: 5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") out.force = true;
    else if (a === "--limit") out.limit = parseInt(argv[++i], 10) || Infinity;
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10) || 5;
  }
  return out;
}

async function fetchCounter(cardId) {
  const url = `${LIMITLESS_BASE}/${encodeURIComponent(cardId)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    const raw = data?.counter;
    if (raw === null || raw === undefined || raw === "") return { ok: true, counter: null };
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: true, counter: null };
    return { ok: true, counter: String(Math.trunc(n)) };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  let finished = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const i = nextIdx++;
        if (i >= items.length) return;
        results[i] = await worker(items[i], i);
        finished++;
        if (finished % 25 === 0 || finished === items.length) {
          process.stdout.write(`  ${finished}/${items.length}\n`);
        }
      }
    }),
  );
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = fs.readFileSync(CARDS_JSON, "utf8");
  const cards = JSON.parse(raw);

  const targets = [];
  for (const card of Object.values(cards)) {
    if (card?.type !== "Character") continue;
    const existing = card.counter;
    const hasValue = existing !== null && existing !== undefined && String(existing).trim() !== "";
    if (!args.force && hasValue) continue;
    targets.push(card.id);
  }
  if (targets.length > args.limit) targets.length = args.limit;

  console.log(
    `Backfilling counter for ${targets.length} character card(s) (force=${args.force}, concurrency=${args.concurrency})`,
  );
  if (targets.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  await runPool(targets, args.concurrency, async (cardId) => {
    const result = await fetchCounter(cardId);
    if (!result.ok) {
      failed++;
      return;
    }
    const current = cards[cardId];
    if (!current) return;
    const newVal = result.counter; // string like "1000" or null
    const prev = current.counter ?? null;
    const prevNorm = prev === "" ? null : prev;
    if (newVal === prevNorm) {
      unchanged++;
      return;
    }
    current.counter = newVal;
    updated++;
  });

  fs.writeFileSync(CARDS_JSON, JSON.stringify(cards, null, 2) + "\n");
  console.log(`Done. updated=${updated}, unchanged=${unchanged}, failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
