"use client";

import { useState, useEffect } from "react";
import { normalizeCardId } from "@/lib/cardId";

interface CardImageProps {
  src: string;
  alt: string;
  cardId: string;
  className?: string;
  loading?: "lazy" | "eager";
  onClick?: () => void;
}

/**
 * Official card gallery sends `Cross-Origin-Resource-Policy: same-site`, so browsers
 * block embedding those URLs from localhost / other origins. Proxy through our API.
 */
function viaProxyWhenNeeded(remoteUrl: string): string {
  try {
    const host = new URL(remoteUrl).hostname.toLowerCase();
    if (
      host === "en.onepiece-cardgame.com" ||
      host === "onepiece-cardgame.com" ||
      host.endsWith(".onepiece-cardgame.com")
    ) {
      return `/api/image-proxy?url=${encodeURIComponent(remoteUrl)}`;
    }
  } catch {
    /* invalid url */
  }
  return remoteUrl;
}

function buildFallbackChain(src: string, cardId: string): string[] {
  const id = normalizeCardId(cardId);
  const urls: string[] = [];
  const add = (u?: string) => {
    if (u) urls.push(u);
  };

  const setPrefix = id.split("-")[0]?.toLowerCase() || "";

  // Official gallery first — limitless/spaces CDN often returns 403 to hotlinked <img>.
  add(`https://en.onepiece-cardgame.com/images/cardlist/card/${id}.png`);
  if (!id.match(/_p\d+$/i)) {
    add(`https://en.onepiece-cardgame.com/images/cardlist/card/${id}_p1.png`);
  }

  // OPTCG static mirrors
  add(`https://optcgapi.com/media/static/Card_Images/${id}.jpg`);
  add(`https://optcgapi.com/media/static/Card_Images/${id}.png`);
  for (const sfx of ["_p1", "_p2", "_p3"] as const) {
    add(`https://optcgapi.com/media/static/Card_Images/${id}${sfx}.jpg`);
    add(`https://en.onepiece-cardgame.com/images/cardlist/card/${id}${sfx}.png`);
  }

  // DB / scraped primary (frequently limitless — try after working hosts)
  if (src?.startsWith("http")) add(src);

  // Limitless (last resort; many paths 403 when embedded)
  if (setPrefix) {
    add(
      `https://limitlesstcg.nyc3.digitaloceanspaces.com/one-piece/${setPrefix}/${id}_${id}.webp`,
    );
  }

  if (id.startsWith("P-") || /^P\d/i.test(id)) {
    const promoMatch = id.match(/^P-?(\d+)/i);
    if (promoMatch) {
      const fullId = `P-${promoMatch[1].padStart(3, "0")}`;
      add(
        `https://limitlesstcg.nyc3.digitaloceanspaces.com/one-piece/p/${fullId}_${fullId}.webp`,
      );
      add(
        `https://limitlesstcg.nyc3.digitaloceanspaces.com/one-piece/prb/${fullId}_${fullId}.webp`,
      );
    }
  }

  if (setPrefix.startsWith("st")) {
    add(
      `https://limitlesstcg.nyc3.digitaloceanspaces.com/one-piece/${setPrefix}/${id}_${id}.webp`,
    );
    add(`https://optcgapi.com/media/static/Card_Images/${id}_st.jpg`);
  }

  if (setPrefix.startsWith("eb")) {
    add(`https://optcgapi.com/media/static/Card_Images/${id}_eb.jpg`);
  }

  return [...new Set(urls.filter(Boolean))].map(viaProxyWhenNeeded);
}

export default function CardImage({
  src,
  alt,
  cardId,
  className = "",
  loading = "lazy",
  onClick,
}: CardImageProps) {
  const urls = buildFallbackChain(src, cardId);
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    setStageIdx(0);
  }, [src, cardId]);

  if (stageIdx >= urls.length) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.04] rounded-lg text-[9px] text-gray-500 ${className}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        {normalizeCardId(cardId)}
      </div>
    );
  }

  return (
    <img
      src={urls[stageIdx]}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setStageIdx((prev) => prev + 1)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    />
  );
}
