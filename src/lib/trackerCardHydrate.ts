import type { Card } from "@/lib/types";
import { normalizeCardId } from "@/lib/cardId";
import { fetchOptcgCard } from "@/lib/optcgCardApi";
import { cardNameLooksLikeId } from "@/lib/cardDisplay";

function needsHydration(c: Card): boolean {
  return cardNameLooksLikeId(c);
}

/**
 * Fetches missing names/metadata from optcgapi for cards that still display as raw IDs.
 * Never throws — API outages / rate limits must not 500 tracker pages.
 */
export async function hydrateTrackerCards(
  map: Record<string, Card>,
): Promise<Record<string, Card>> {
  try {
    const normsToFetch = new Set<string>();
    for (const [key, c] of Object.entries(map)) {
      if (needsHydration(c)) {
        normsToFetch.add(normalizeCardId(key));
      }
    }
    if (normsToFetch.size === 0) return map;

    const fetched = new Map<string, Card>();
    const BATCH = 10;
    const ids = [...normsToFetch];
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const results = await Promise.all(
        chunk.map((id) =>
          fetchOptcgCard(id).catch(() => null),
        ),
      );
      chunk.forEach((id, j) => {
        const row = results[j];
        if (row && row.name && !cardNameLooksLikeId({ id, name: row.name })) {
          fetched.set(id, row);
        }
      });
    }

    if (fetched.size === 0) return map;

    const out: Record<string, Card> = { ...map };
    for (const [key, c] of Object.entries(out)) {
      if (!needsHydration(c)) continue;
      const norm = normalizeCardId(key);
      const patch = fetched.get(norm);
      if (patch) {
        const nameResolved =
          patch.name && !cardNameLooksLikeId({ id: key, name: patch.name })
            ? patch.name
            : c.name && !cardNameLooksLikeId(c)
              ? c.name
              : patch.name || c.name || key;
        const merged: Card = { ...c, ...patch, id: key, name: nameResolved };
        const img = String(merged.image ?? "").trim();
        if (!img) merged.image = c.image ?? "";
        const col = String(merged.color ?? "").trim();
        if (!col) merged.color = c.color ?? "";
        const typ = String(merged.type ?? "").trim();
        if (!typ) merged.type = c.type ?? "";
        const txt = String(merged.text ?? "").trim();
        if (!txt) merged.text = c.text ?? "";
        out[key] = merged;
      }
    }
    return out;
  } catch (err) {
    console.error("[hydrateTrackerCards]", err);
    return map;
  }
}
