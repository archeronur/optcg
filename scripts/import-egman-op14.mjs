import fs from "node:fs";
import path from "node:path";

function decodeHtmlEntities(s) {
  return s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
}

function extractFirstMatch(text, re) {
  const m = text.match(re);
  return m ? m[1] : "";
}

function extractAllMatches(text, re) {
  return [...text.matchAll(re)].map((m) => (m[1] ? m[1] : m[0]));
}

function parseDeckCardsFromDeckParam(deckParamValue) {
  // deckParamValue example:
  // OP13-043:4,OP12-041:1,OP07-064:4,...&type=optcg
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

function ordinalPlacing(i) {
  const map = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
  return map[i] ?? `${i + 1}th`;
}

function extractDeckUrlAndLeaderFromDeckListsTable(html, deckListsHeading) {
  // We parse each <tr class="table-row ..."> inside the "Top N Deck Lists" table.
  // For each row, we extract:
  // - placing label from the first cell
  // - the leader cell anchor text (contains leader id+name) + its href (contains full deck URL)
  const start = html.indexOf(deckListsHeading);
  if (start === -1) return [];

  // Best-effort end marker: tags section / back link.
  const end = html.indexOf("Back to OP-14 Events", start);
  const slice = end === -1 ? html.slice(start) : html.slice(start, end);

  const rowRe = /<tr[^>]*class="table-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  const leaderIdRe = /\b([A-Z]{2,4}\d{2}-\d{3}|P-\d{3}|PRB\d{2}-\d{3})\b/;

  // Anchor capturing inside a row.
  const leaderAnchorRe =
    /<a[^>]+href="(https:\/\/deckbuilder\.egmanevents\.com\/\?deck=[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  const decks = [];
  let rowMatch;
  while ((rowMatch = rowRe.exec(slice))) {
    const rowHtml = rowMatch[1];
    leaderAnchorRe.lastIndex = 0;

    const placingMatch =
      rowHtml.match(/first-cell[^>]*>([^<]+)</) ||
      rowHtml.match(/table-cell[^>]*first-cell[^>]*>([^<]+)</) ||
      rowHtml.match(/<td[^>]*[^>]*>([^<]+)<\/td>/);
    const placing = placingMatch ? stripTags(decodeHtmlEntities(placingMatch[1])) : "";
    if (!placing) continue;

    let leaderAnchorMatch;
    let chosen = null;
    while ((leaderAnchorMatch = leaderAnchorRe.exec(rowHtml))) {
      const hrefDecoded = decodeHtmlEntities(leaderAnchorMatch[1]);
      const inner = leaderAnchorMatch[2];
      const anchorText = stripTags(decodeHtmlEntities(inner));
      const leaderIdMatch = anchorText.match(leaderIdRe);
      if (!leaderIdMatch) continue;

      chosen = {
        placing,
        deckUrl: hrefDecoded,
        leaderId: leaderIdMatch[1],
        leaderText: anchorText,
      };
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
      player: "",
      deckUrl: chosen.deckUrl,
      cards,
    });
  }

  // Some tables can include duplicate href rows; de-duplicate by (placing+deckUrl).
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
  const end = html.indexOf("Event Details", start);
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
  const typeRe = /\/category\/[^"]+">([^<]+Event[^<]*)</;
  const typeMatch = html.match(typeRe);
  const type = typeMatch ? stripTags(decodeHtmlEntities(typeMatch[1])) : "";

  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  const name = h1Match ? stripTags(decodeHtmlEntities(h1Match[1])) : "";

  const eventDetailsDateMatch = html.match(
    /(?:March|April|May|June|July|August|September|October|November|December|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?)\s+\d{1,2}(?:st|nd|rd|th)?-\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}/,
  );
  const eventDetailsDate = eventDetailsDateMatch ? eventDetailsDateMatch[0] : "";
  const slashDate = html.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  const monthDay = html.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/,
  );
  const dateBase = eventDetailsDate || (slashDate ? slashDate[0] : monthDay ? monthDay[0] : "");

  const writtenByMatch = html.match(/Written By\s*([^<\n\r]+)</);
  const writer = writtenByMatch ? stripTags(decodeHtmlEntities(writtenByMatch[1])) : "";

  const playersMatch = html.match(/(\d+)\s+players/i);
  const players = playersMatch ? parseInt(playersMatch[1], 10) : 0;

  const roundsMatch = html.match(/(\d+)\s*Rounds of Swiss[^<]*(Cut|Into Top|Top\s*16)?[^<]*/i);
  const rounds = roundsMatch ? stripTags(roundsMatch[0]) : "";

  return { name, type, date: dateBase, players, rounds };
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": "op2-importer/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`);
  return res.text();
}

function extractEventUrlsFromOp14Page(html) {
  // Extract all event detail URLs:
  // - https://egmanevents.com/one-piece-op14-tournaments/<slug>
  // - exclude category pages and deck-list/power-rankings pages.
  const hrefRe =
    /href="(\/one-piece-op14-tournaments\/(?!category)[^"?#/]+)"/g;
  const urls = new Set();
  let m;
  while ((m = hrefRe.exec(html))) {
    const relPath = m[1];
    // Keep only top-level event slugs (exclude things like `/category/...`).
    if (relPath.includes("/category/")) continue;
    urls.add(`https://egmanevents.com${relPath}`);
  }
  return Array.from(urls);
}

async function main() {
  const repoRoot = process.cwd();
  const op14Path = path.join(repoRoot, "data", "metas", "op14.json");
  const summaryPath = path.join(repoRoot, "data", "summary.json");

  const op14Json = JSON.parse(fs.readFileSync(op14Path, "utf-8"));
  const summaryJson = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
  const existingUrls = new Set((op14Json.events || []).map((e) => e.url));

  const tournamentsUrl = "https://egmanevents.com/one-piece-op14-tournaments";
  const tournamentsHtml = await fetchText(tournamentsUrl);
  const eventUrls = extractEventUrlsFromOp14Page(tournamentsHtml);
  const cliUrls = process.argv.slice(2).filter((s) => /^https?:\/\//.test(s));
  const targetUrls = cliUrls.length ? cliUrls : eventUrls;
  const newEventUrls = targetUrls.filter((u) => !existingUrls.has(u));
  console.log(
    `OP14: existing=${existingUrls.size}, found=${eventUrls.length}, target=${targetUrls.length}, new=${newEventUrls.length}`,
  );

  const newEvents = [];

  for (const eventUrl of targetUrls) {
    console.log(`Scraping ${eventUrl}`);
    const html = await fetchText(eventUrl);

    const basics = extractEventBasics(html);
    const topN =
      html.includes("Top 32 Deck Lists") ? 32 : html.includes("Top 16 Deck Lists") ? 16 : 8;

    const topLeaders = extractTopNLeaders(html, topN); // leaderId -> count
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
  const preservedEvents = (op14Json.events || []).filter((e) => !refreshedUrls.has(e.url));
  op14Json.events = [...newEvents, ...preservedEvents];

  // Recompute meta summary fields for OP14
  let totalDecks = 0;
  const leaderCounts = new Map();
  for (const ev of op14Json.events) {
    for (const deck of ev.decks || []) {
      totalDecks += 1;
      if (deck.leaderId) {
        leaderCounts.set(deck.leaderId, (leaderCounts.get(deck.leaderId) || 0) + 1);
      }
    }
  }

  const topLeaderIds = Array.from(leaderCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([leaderId]) => leaderId);

  const metaIdx = (summaryJson.metas || []).findIndex((m) => m.id === "op14");
  if (metaIdx >= 0) {
    summaryJson.metas[metaIdx].eventCount = op14Json.events.length;
    summaryJson.metas[metaIdx].totalDecks = totalDecks;
    summaryJson.metas[metaIdx].topLeaders = topLeaderIds;
  } else {
    summaryJson.metas = summaryJson.metas || [];
    summaryJson.metas.push({
      id: "op14",
      name: op14Json.name,
      url: op14Json.url,
      eventCount: op14Json.events.length,
      totalDecks,
      topLeaders: topLeaderIds,
    });
  }

  fs.writeFileSync(op14Path, JSON.stringify(op14Json, null, 2) + "\n");
  fs.writeFileSync(summaryPath, JSON.stringify(summaryJson, null, 2) + "\n");

  console.log(`Added ${newEvents.length} new OP14 events. Updated op14.json + summary.json.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

