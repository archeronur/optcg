/**
 * Fix for CoreTCG Pomona after egman scrape: Top 32 leaderDistribution,
 * official type, leader display names, players, recompute OP14 stats.
 */
import fs from "node:fs";
import path from "node:path";
import { computeLeaderStats } from "./import-egman-op14.mjs";

const LEADER_BY_ID = {
  "OP14-020": "OP14-020 Dracule Mihawk",
  "OP13-079": "OP13-079 Imu",
  "OP12-061": "OP12-061 Donquixote Rosinante",
  "OP13-002": "OP13-002 Portgas.D.Ace",
  "OP12-041": "OP12-041 Sanji",
  "OP11-040": "OP11-040 Monkey.D.Luffy",
  "OP13-001": "OP13-001 Monkey.D.Luffy",
};

const PLAYERS = [
  "Endpoint",
  "KuroTCG",
  "EmperorOng",
  "Matt",
  "Slizzy Rede",
  "Cyber Bueno",
  "Planetzaydar",
  "Tzuwy",
  "Saz",
  "SSL Mauzio",
  "SenPie",
  "Spence Gibson",
  "Ed",
  "CaptainSkeeze",
  "Domob06",
  "Marc",
  "Teacabo",
  "Art",
  "Picantejosey",
  "Pchan",
  "Adderall",
  "Ashmeer",
  "Lafinte",
  "Chris Sok",
  "jerry",
  "Monkey",
  "Dean",
  "Monkey",
  "Jayce",
  "freshnalgas",
  "Endevr",
  "Rolf",
];

const repoRoot = process.cwd();
const op14Path = path.join(repoRoot, "data", "metas", "op14.json");
const summaryPath = path.join(repoRoot, "data", "summary.json");

const op14Json = JSON.parse(fs.readFileSync(op14Path, "utf-8"));
const summaryJson = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));

const ev = op14Json.events.find((e) =>
  e.url.includes("coretcg-pomona-regionals"),
);
if (!ev) throw new Error("coretcg-pomona event not found");

ev.type = "Large Official Event";
ev.date = "Mar 29";

ev.leaderDistribution = {
  "OP14-020 Dracule Mihawk": 8,
  "OP13-079 Imu": 7,
  "OP13-002 Portgas.D.Ace": 6,
  "OP12-061 Donquixote Rosinante": 4,
  "OP12-041 Sanji": 3,
  "OP11-040 Monkey.D.Luffy": 3,
  "OP13-001 Monkey.D.Luffy": 1,
};

if (ev.decks.length !== PLAYERS.length) {
  throw new Error(`Expected ${PLAYERS.length} decks, got ${ev.decks.length}`);
}

ev.decks.forEach((d, i) => {
  const lid = d.leaderId || d.leader;
  d.leader = LEADER_BY_ID[lid] || d.leader;
  d.player = PLAYERS[i];
});

op14Json.leaderStats = computeLeaderStats(op14Json.events);

let totalDecks = 0;
for (const e of op14Json.events) {
  for (const deck of e.decks || []) totalDecks += 1;
}

const topLeaderIds = (op14Json.leaderStats || [])
  .slice()
  .sort((a, b) => (b.points || 0) - (a.points || 0))
  .slice(0, 5)
  .map((s) => s.leaderId);

const metaIdx = (summaryJson.metas || []).findIndex((m) => m.id === "op14");
if (metaIdx >= 0) {
  summaryJson.metas[metaIdx].eventCount = op14Json.events.length;
  summaryJson.metas[metaIdx].totalDecks = totalDecks;
  summaryJson.metas[metaIdx].topLeaders = topLeaderIds;
}

fs.writeFileSync(op14Path, JSON.stringify(op14Json, null, 2) + "\n");
fs.writeFileSync(summaryPath, JSON.stringify(summaryJson, null, 2) + "\n");
console.log("Patched Pomona event + recomputed OP14 leaderStats.");
