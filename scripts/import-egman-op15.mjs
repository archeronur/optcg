import fs from "node:fs";
import path from "node:path";

import { computeLeaderStats } from "./import-egman-op14.mjs";

function decodeHtmlEntities(s) {
  return s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
}

function parseDeckCardsFromDeckParam(deckParamValue) {
  const decoded = decodeURIComponent(deckParamValue);
  const parts = decoded.split(",").map((p) => p.trim()).filter(Boolean);
  const cards = [];
  for (const part of parts) {
    const [idRaw, countRaw] = part.split(":");
    if (!idRaw || !countRaw) continue;
    const id = idRaw.trim();
    const count = parseInt(countRaw.trim(), 10);
    if (!id || Number.isNaN(count)) continue;
    cards.push({ id, count });
  }
  return cards;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": "op2-importer/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`);
  return res.text();
}

function extractEventUrlsFromOp15Page(html) {
  const hrefRe = /href="(\/one-piece-op15-tournaments\/(?!category)[^"?#/]+)"/g;
  const urls = new Set();
  let m;
  while ((m = hrefRe.exec(html))) {
    const relPath = m[1];
    if (relPath.includes("/category/")) continue;
    urls.add(`https://egmanevents.com${relPath}`);
  }
  return Array.from(urls);
}

function extractDeckUrlAndLeaderFromDeckListsTable(html, deckListsHeading) {
  const start = html.indexOf(deckListsHeading);
  if (start === -1) return [];

  // OP15 pages use "Back to OP15 Events" (no dash).
  let end = html.indexOf("Back to OP15 Events", start);
  if (end === -1) end = html.indexOf("Back to OP-15 Events", start);
  const slice = end === -1 ? html.slice(start) : html.slice(start, end);

  const rowRe = /<tr[^>]*class="table-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  const leaderIdRe = /\b([A-Z]{2,4}\d{2}-\d{3}|P-\d{3}|PRB\d{2}-\d{3})\b/;
  const anchorRe =
    /<a[^>]+href="(https:\/\/deckbuilder\.egmanevents\.com\/\?deck=[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  const decks = [];
  let rowMatch;
  while ((rowMatch = rowRe.exec(slice))) {
    const rowHtml = rowMatch[1];
    anchorRe.lastIndex = 0;

    const placingMatch =
      rowHtml.match(/first-cell[^>]*>([^<]+)</) ||
      rowHtml.match(/table-cell[^>]*first-cell[^>]*>([^<]+)</) ||
      rowHtml.match(/<td[^>]*[^>]*>([^<]+)<\/td>/);
    const placing = placingMatch ? stripTags(decodeHtmlEntities(placingMatch[1])) : "";
    if (!placing) continue;

    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
    const cells = [...rowHtml.matchAll(cellRe)]
      .map((m) => stripTags(decodeHtmlEntities(m[1] || "")))
      .map((s) => s.trim())
      .filter(Boolean);
    const player = cells.length ? cells[cells.length - 1] : "";

    let chosen = null;
    let am;
    while ((am = anchorRe.exec(rowHtml))) {
      const hrefDecoded = decodeHtmlEntities(am[1]);
      const anchorText = stripTags(decodeHtmlEntities(am[2]));
      const leaderIdMatch = anchorText.match(leaderIdRe);
      if (!leaderIdMatch) continue;
      chosen = { deckUrl: hrefDecoded, leaderId: leaderIdMatch[1] };
      break;
    }
    if (!chosen?.deckUrl) continue;

    const deckParamMatch = chosen.deckUrl.match(/deck=([^&]+)/);
    const deckParam = deckParamMatch ? decodeHtmlEntities(deckParamMatch[1]) : "";
    const cards = deckParam ? parseDeckCardsFromDeckParam(deckParam) : [];

    decks.push({
      placing,
      leader: chosen.leaderId,
      leaderId: chosen.leaderId,
      player,
      deckUrl: chosen.deckUrl,
      cards,
    });
  }

  const uniq = new Map();
  for (const d of decks) {
    const key = `${d.placing}|${d.deckUrl}`;
    if (!uniq.has(key)) uniq.set(key, d);
  }
  return Array.from(uniq.values());
}

function extractTopNLeaders(html, topN) {
  const heading = `Top ${topN} Leaders`;
  const start = html.indexOf(heading);
  if (start === -1) return {};
  let end = html.indexOf("Total Leaders", start);
  if (end === -1) end = html.indexOf("Event Details", start);
  const slice = end === -1 ? html.slice(start) : html.slice(start, end);

  const leaderRe =
    /(\d+)\s*-\s*([A-Z]{2,4}\d{2}-\d{3}|P-\d{3}|PRB\d{2}-\d{3})/g;
  const out = {};
  let m;
  while ((m = leaderRe.exec(slice))) {
    const count = parseInt(m[1], 10);
    const leaderId = m[2];
    if (Number.isNaN(count)) continue;
    out[leaderId] = count;
  }
  return out;
}

function extractEventBasics(html) {
  // Prefer category link label if present; otherwise infer from visible text.
  const typeRe = /\/category\/[^"]+">([^<]+Event[^<]*)</;
  const typeMatch = html.match(typeRe);
  let type = typeMatch ? stripTags(decodeHtmlEntities(typeMatch[1])) : "";
  if (!type) {
    if (html.includes("Large Official Event")) type = "Large Official Event";
    else if (html.includes("Unofficial Event")) type = "Unofficial Event";
  }

  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  const name = h1Match ? stripTags(decodeHtmlEntities(h1Match[1])) : "";

  const eventDetailsDateMatch = html.match(
    /(?:March|April|May|June|July|August|September|October|November|December|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?)\s+\d{1,2}(?:st|nd|rd|th)?-\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}/,
  );
  const eventDetailsDate = eventDetailsDateMatch ? eventDetailsDateMatch[0] : "";
  const slashDate = html.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  const monthDay = html.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/);
  // Prefer the short "Mar 31" label over ambiguous numeric dates found in HTML.
  const dateBase = eventDetailsDate || (monthDay ? monthDay[0] : slashDate ? slashDate[0] : "");

  const playersMatch = html.match(/(\d+)\s+players/i);
  const players = playersMatch ? parseInt(playersMatch[1], 10) : 0;

  const roundsMatch = html.match(/(\d+)\s*Rounds of Swiss[^<]*(Cut|Into Top|Top\s*16)?[^<]*/i);
  const rounds = roundsMatch ? stripTags(roundsMatch[0]) : "";

  return { name, type, date: dateBase, players, rounds };
}

async function main() {
  const repoRoot = process.cwd();
  const op15Path = path.join(repoRoot, "data", "metas", "op15.json");
  const summaryPath = path.join(repoRoot, "data", "summary.json");

  const op15Json = JSON.parse(fs.readFileSync(op15Path, "utf-8"));
  const summaryJson = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
  const existingUrls = new Set((op15Json.events || []).map((e) => e.url));

  const tournamentsUrl = "https://egmanevents.com/one-piece-op15-tournaments";
  const tournamentsHtml = await fetchText(tournamentsUrl);
  const eventUrls = extractEventUrlsFromOp15Page(tournamentsHtml);
  const cliUrls = process.argv.slice(2).filter((s) => /^https?:\/\//.test(s));
  const targetUrls = cliUrls.length ? cliUrls : eventUrls;
  const newEventUrls = targetUrls.filter((u) => !existingUrls.has(u));
  console.log(
    `OP15: existing=${existingUrls.size}, found=${eventUrls.length}, target=${targetUrls.length}, new=${newEventUrls.length}`,
  );

  const newEvents = [];
  for (const eventUrl of targetUrls) {
    console.log(`Scraping ${eventUrl}`);
    const html = await fetchText(eventUrl);

    const basics = extractEventBasics(html);
    const topN =
      html.includes("Top 32 Deck Lists") ? 32 : html.includes("Top 16 Deck Lists") ? 16 : 8;
    const topLeaders = extractTopNLeaders(html, topN);
    const deckListsHeading = `Top ${topN} Deck Lists`;
    const decks = extractDeckUrlAndLeaderFromDeckListsTable(html, deckListsHeading);

    if (!basics.name || decks.length === 0) {
      console.warn(`Skipping ${eventUrl}: missing name/decks`);
      continue;
    }

    newEvents.push({
      name: basics.name,
      url: eventUrl,
      type: basics.type || "Unofficial Event",
      date: basics.date || "",
      players: basics.players || 0,
      rounds: basics.rounds || "",
      leaderDistribution: topLeaders,
      decks,
    });
  }

  if (!newEvents.length) {
    console.log("No events to update.");
    return;
  }

  const refreshedUrls = new Set(newEvents.map((e) => e.url));
  const preservedEvents = (op15Json.events || []).filter((e) => !refreshedUrls.has(e.url));
  op15Json.events = [...newEvents, ...preservedEvents];
  op15Json.leaderStats = computeLeaderStats(op15Json.events);

  // Recompute meta summary fields for OP15
  let totalDecks = 0;
  for (const ev of op15Json.events) {
    for (const deck of ev.decks || []) totalDecks += 1;
  }
  const topLeaderIds = (op15Json.leaderStats || [])
    .slice()
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 5)
    .map((s) => s.leaderId);

  const metaIdx = (summaryJson.metas || []).findIndex((m) => m.id === "op15");
  if (metaIdx >= 0) {
    summaryJson.metas[metaIdx].eventCount = op15Json.events.length;
    summaryJson.metas[metaIdx].totalDecks = totalDecks;
    summaryJson.metas[metaIdx].topLeaders = topLeaderIds;
  } else {
    summaryJson.metas = summaryJson.metas || [];
    summaryJson.metas.push({
      id: "op15",
      name: op15Json.name,
      url: op15Json.url,
      eventCount: op15Json.events.length,
      totalDecks,
      topLeaders: topLeaderIds,
    });
  }

  fs.writeFileSync(op15Path, JSON.stringify(op15Json, null, 2) + "\n");
  fs.writeFileSync(summaryPath, JSON.stringify(summaryJson, null, 2) + "\n");

  console.log(`Added ${newEvents.length} new OP15 events. Updated op15.json + summary.json.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

