import type { DeckCard } from "@/lib/types";

export interface DeckDiffEntry {
  id: string;
  countA: number;
  countB: number;
}

export interface DeckDiffResult {
  /** Cards with count > 0 in both decks, sorted by |Δcount| desc then id asc. */
  shared: DeckDiffEntry[];
  /** Subset of `shared` with differing counts. */
  differentCounts: DeckDiffEntry[];
  /** Subset of `shared` with identical counts. */
  identicalCounts: DeckDiffEntry[];
  /** Cards only present in deck A. */
  onlyA: DeckDiffEntry[];
  /** Cards only present in deck B. */
  onlyB: DeckDiffEntry[];
  /** Set-level Jaccard similarity (ignores copy counts): |A∩B| / |A∪B|. */
  jaccard: number;
  /** Count-weighted overlap: Σ min(a,b) / Σ max(a,b). Reflects exact copy agreement. */
  countOverlap: number;
  /** Number of unique card IDs in each deck and their intersection. */
  uniqueA: number;
  uniqueB: number;
  sharedUnique: number;
  /** Total copies (sum of counts) in each deck. */
  totalA: number;
  totalB: number;
  /** Raw |A∩B| and |A∪B| for display/debug. */
  intersectionSize: number;
  unionSize: number;
}

function toCountMap(cards: DeckCard[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cards) {
    if (!c?.id) continue;
    const n = Number.isFinite(c.count) ? c.count : 0;
    if (n <= 0) continue;
    m.set(c.id, (m.get(c.id) ?? 0) + n);
  }
  return m;
}

function sum(iter: Iterable<number>): number {
  let s = 0;
  for (const n of iter) s += n;
  return s;
}

/**
 * Pure deck comparison.
 *
 * - Jaccard uses the set of distinct card IDs (copy-count agnostic).
 * - `countOverlap` is a Bray-Curtis-style similarity that rewards exact copy counts.
 * - Leader cards should be excluded by the caller before calling, because the
 *   typical tracker deck object stores the leader separately from `cards`.
 */
export function computeDeckDiff(a: DeckCard[], b: DeckCard[]): DeckDiffResult {
  const mapA = toCountMap(a);
  const mapB = toCountMap(b);
  const ids = new Set<string>([...mapA.keys(), ...mapB.keys()]);

  const shared: DeckDiffEntry[] = [];
  const differentCounts: DeckDiffEntry[] = [];
  const identicalCounts: DeckDiffEntry[] = [];
  const onlyA: DeckDiffEntry[] = [];
  const onlyB: DeckDiffEntry[] = [];

  let countMin = 0;
  let countMax = 0;

  for (const id of ids) {
    const ca = mapA.get(id) ?? 0;
    const cb = mapB.get(id) ?? 0;
    const entry: DeckDiffEntry = { id, countA: ca, countB: cb };

    if (ca > 0 && cb > 0) {
      shared.push(entry);
      countMin += Math.min(ca, cb);
      countMax += Math.max(ca, cb);
      if (ca === cb) identicalCounts.push(entry);
      else differentCounts.push(entry);
    } else if (ca > 0) {
      onlyA.push(entry);
      countMax += ca;
    } else if (cb > 0) {
      onlyB.push(entry);
      countMax += cb;
    }
  }

  shared.sort((x, y) => {
    const dx = Math.abs(x.countA - x.countB);
    const dy = Math.abs(y.countA - y.countB);
    if (dx !== dy) return dy - dx;
    return x.id.localeCompare(y.id);
  });
  differentCounts.sort((x, y) => {
    const dx = Math.abs(x.countA - x.countB);
    const dy = Math.abs(y.countA - y.countB);
    if (dx !== dy) return dy - dx;
    return x.id.localeCompare(y.id);
  });
  identicalCounts.sort((x, y) => y.countA - x.countA || x.id.localeCompare(y.id));
  onlyA.sort((x, y) => y.countA - x.countA || x.id.localeCompare(y.id));
  onlyB.sort((x, y) => y.countB - x.countB || x.id.localeCompare(y.id));

  const intersectionSize = shared.length;
  const unionSize = ids.size;
  const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0;
  const countOverlap = countMax > 0 ? countMin / countMax : 0;

  return {
    shared,
    differentCounts,
    identicalCounts,
    onlyA,
    onlyB,
    jaccard,
    countOverlap,
    uniqueA: mapA.size,
    uniqueB: mapB.size,
    sharedUnique: intersectionSize,
    totalA: sum(mapA.values()),
    totalB: sum(mapB.values()),
    intersectionSize,
    unionSize,
  };
}

/**
 * Stable, share-friendly deck identifier (no DB ids available in the source data).
 * Combines event slug, placing and player so two decks by the same player at the
 * same event can still be distinguished if they ever appear.
 */
export function deckSlug(params: {
  eventSlug: string;
  placing: string;
  player: string;
  index: number;
}): string {
  const safe = (s: string) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  const parts = [safe(params.eventSlug), safe(params.placing) || "na", safe(params.player) || "na"];
  // index disambiguates if every other part collides (shouldn't happen, but cheap).
  return `${parts.join(".")}.${params.index}`;
}
