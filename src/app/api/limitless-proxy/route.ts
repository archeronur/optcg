import { NextRequest, NextResponse } from "next/server";

const LIMITLESS_BASE = "https://onepiece.limitlesstcg.com/api";

const CARD_ID_RE = /^[A-Za-z0-9_.-]+$/;

export async function GET(request: NextRequest) {
  const cardId = request.nextUrl.searchParams.get("cardId")?.trim() ?? "";
  if (!cardId || !CARD_ID_RE.test(cardId)) {
    return NextResponse.json({ error: "Invalid cardId" }, { status: 400 });
  }
  const target = `${LIMITLESS_BASE}/cards/${encodeURIComponent(cardId)}`;
  try {
    const res = await fetch(target, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type":
          res.headers.get("content-type") ?? "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("[limitless-proxy]", e);
    return NextResponse.json(
      { error: "Upstream fetch failed" },
      { status: 502 },
    );
  }
}
