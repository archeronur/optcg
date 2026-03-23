import { NextResponse } from "next/server";
import cardsSource from "../../../../data/cards.json";
import { cardsJsonToSearchCards } from "@/proxy-print/utils/localCardIndex";

/**
 * Single JSON payload for proxy-print Card Search — avoids dozens of OPTCG calls
 * from one server IP (429). Client: GET once, Fuse runs in-browser.
 * Uses a static JSON import so Cloudflare Workers (no filesystem) can serve this route.
 */
export async function GET() {
  try {
    const parsed: unknown = cardsSource;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid cards file" }, { status: 500 });
    }
    const cards = cardsJsonToSearchCards(parsed as Record<string, unknown>);
    return NextResponse.json(cards, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    console.error("[proxy-print-card-index]", e);
    return NextResponse.json(
      { error: "Failed to load local card index" },
      { status: 500 },
    );
  }
}
