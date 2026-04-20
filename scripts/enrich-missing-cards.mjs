#!/usr/bin/env node
// Scan all decklists referenced by data/metas/*.json, find any card IDs that
// are not yet present in data/cards.json, and fetch them from Limitless +
// optcgapi so leader/card names resolve correctly across the UI.
//
// Idempotent — safe to re-run whenever new events are imported.
//
// Usage:
//   node scripts/enrich-missing-cards.mjs
//   node scripts/enrich-missing-cards.mjs --concurrency 6
//   node scripts/enrich-missing-cards.mjs --dry-run

import fs from "node:fs";
import path from "node:path";

const CARDS_JSON = path.join(process.cwd(), "data", "cards.json");
const METAS_DIR = path.join(process.cwd(), "data", "metas");
const LIMITLESS_BASE = "https://onepiece.limitlesstcg.com/api/cards";
const OPTCGAPI_BASE = "https://optcgapi.com/api";
const VALID_ID = /^[A-Z]+[0-9]*-[0-9]+$/;

function parseArgs(argv) {
  const out = { concurrency: 5, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10) || 5;
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function str(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function titleCase(s) {
  return String(s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normalizeColor(raw) {
  if (!raw) return "";
  return String(raw)
    .split(/[\s/]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function parseDisplayName(fullName, cardId) {
  if (!fullName) return cardId;
  const first = fullName.split(" - ")[0] ?? fullName;
  return first.split(" (")[0]?.trim() || cardId;
}

function imageUrl(cardId) {
  return `https://optcgapi.com/media/static/Card_Images/${cardId}.jpg`;
}

async function fetchJson(url, timeoutMs = 6000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildFromLimitless(cardId, data) {
  if (!data || typeof data !== "object") return null;
  const name = data.name ?? data.card_name;
  if (!name || name === cardId) return null;
  const counterRaw = data.counter;
  let counter = null;
  if (counterRaw !== null && counterRaw !== undefined && counterRaw !== "") {
    const n = Number(counterRaw);
    if (Number.isFinite(n)) counter = String(Math.trunc(n));
  }
  const lifeRaw = data.life;
  const life =
    lifeRaw === null || lifeRaw === undefined || lifeRaw === ""
      ? null
      : String(lifeRaw);
  const costRaw = data.cost;
  const cost =
    costRaw === null || costRaw === undefined || costRaw === ""
      ? null
      : String(costRaw);
  const power =
    data.power === null || data.power === undefined ? "" : String(data.power);
  return {
    id: cardId,
    name: parseDisplayName(name, cardId),
    fullName: name,
    image: imageUrl(cardId),
    imageId: cardId,
    color: normalizeColor(data.color ?? data.card_color ?? ""),
    type: titleCase(data.category ?? data.type ?? ""),
    cost,
    power,
    counter,
    rarity: str(data.rarity).toUpperCase(),
    text: str(data.effect ?? data.text ?? ""),
    attribute: titleCase(data.attribute ?? ""),
    subTypes: str(data.type ?? data.types ?? data.sub_types ?? ""),
    life,
    set: str(data.set_name ?? data.set ?? ""),
  };
}

function buildFromOptcgapi(cardId, row) {
  if (!row || typeof row !== "object") return null;
  const full = row.card_name ?? "";
  if (!full) return null;
  return {
    id: cardId,
    name: parseDisplayName(full, cardId),
    fullName: full,
    image: imageUrl(cardId),
    imageId: cardId,
    color: normalizeColor(row.card_color ?? ""),
    type: titleCase(row.card_type ?? ""),
    cost:
      row.card_cost === null || row.card_cost === undefined
        ? null
        : String(row.card_cost),
    power:
      row.card_power === null || row.card_power === undefined
        ? ""
        : String(row.card_power),
    counter: null,
    rarity: str(row.rarity).toUpperCase(),
    text: str(row.card_text ?? ""),
    attribute: titleCase(row.attribute ?? ""),
    subTypes: str(row.sub_types ?? ""),
    life:
      row.life === null || row.life === undefined || row.life === ""
        ? null
        : String(row.life),
    set: str(row.set_name ?? ""),
  };
}

async function fetchCard(cardId) {
  const limitless = await fetchJson(
    `${LIMITLESS_BASE}/${encodeURIComponent(cardId)}`,
  );
  const fromLimitless = buildFromLimitless(cardId, limitless);
  if (fromLimitless) return fromLimitless;

  const prefix = cardId.split("-")[0]?.toUpperCase() ?? "";
  const urls = [`${OPTCGAPI_BASE}/sets/card/${encodeURIComponent(cardId)}/?format=json`];
  if (prefix.startsWith("ST") || prefix.startsWith("EB") || prefix.startsWith("PRB") || prefix === "P") {
    urls.push(`${OPTCGAPI_BASE}/decks/card/${encodeURIComponent(cardId)}/?format=json`);
  }
  for (const url of urls) {
    const data = await fetchJson(url);
    const row = Array.isArray(data) ? data[0] : null;
    const built = buildFromOptcgapi(cardId, row);
    if (built) return built;
  }
  return null;
}

function collectReferencedCardIds() {
  const ids = new Set();
  for (const file of fs.readdirSync(METAS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(METAS_DIR, file), "utf8"));
    for (const ev of meta.events ?? []) {
      for (const deck of ev.decks ?? []) {
        const leaderId = deck.leaderId || deck.leader;
        if (leaderId) ids.add(leaderId);
        for (const card of deck.cards ?? []) {
          if (card?.id) ids.add(card.id);
        }
      }
    }
  }
  return ids;
}

async function runPool(items, concurrency, worker) {
  let nextIdx = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const i = nextIdx++;
        if (i >= items.length) return;
        await worker(items[i], i);
        done++;
        if (done % 10 === 0 || done === items.length) {
          process.stdout.write(`  ${done}/${items.length}\n`);
        }
      }
    }),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cards = JSON.parse(fs.readFileSync(CARDS_JSON, "utf8"));

  const referenced = collectReferencedCardIds();
  const missing = [];
  for (const id of referenced) {
    if (!VALID_ID.test(id)) continue;
    if (cards[id]) continue;
    missing.push(id);
  }
  missing.sort();

  console.log(
    `Referenced=${referenced.size}, missing=${missing.length}, concurrency=${args.concurrency}${args.dryRun ? " (dry-run)" : ""}`,
  );
  if (missing.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let added = 0;
  let failed = [];

  await runPool(missing, args.concurrency, async (id) => {
    const built = await fetchCard(id);
    if (!built) {
      failed.push(id);
      return;
    }
    if (!args.dryRun) cards[id] = built;
    added++;
  });

  if (!args.dryRun) {
    fs.writeFileSync(CARDS_JSON, JSON.stringify(cards, null, 2) + "\n");
  }
  console.log(`Done. added=${added}, failed=${failed.length}`);
  if (failed.length > 0) console.log("  failed:", failed.slice(0, 20));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
