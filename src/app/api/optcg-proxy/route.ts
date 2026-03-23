import { NextRequest, NextResponse } from "next/server";

const OPTCG_BASE = "https://optcgapi.com/api";

/** Whitelist: allSets list or one set's cards JSON (same paths proxy-print api.ts uses). */
function buildOptcgTarget(pathParam: string): string | null {
  const raw = pathParam.trim().replace(/^\/+/, "");
  if (!raw || raw.includes("..") || raw.includes("//")) return null;
  const noTrail = raw.replace(/\/+$/, "");
  if (noTrail === "allSets") return `${OPTCG_BASE}/allSets/`;
  const m = noTrail.match(/^sets\/([A-Za-z0-9_.-]+)$/);
  if (m) return `${OPTCG_BASE}/sets/${m[1]}/`;
  return null;
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }
  const target = buildOptcgTarget(path);
  if (!target) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }
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
    console.error("[optcg-proxy]", e);
    return NextResponse.json(
      { error: "Upstream fetch failed" },
      { status: 502 },
    );
  }
}
