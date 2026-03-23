"use client";

import Link from "next/link";
import CardImage from "./CardImage";
import { parseColors, getColorInfo } from "@/lib/colors";

interface LeaderBadgeProps {
  name: string;
  image: string;
  count: number;
  color?: string;
  leaderId?: string;
  totalDecks?: number;
  metaId?: string;
}

export default function LeaderBadge({
  name,
  image,
  count,
  color,
  leaderId,
  totalDecks,
  metaId,
}: LeaderBadgeProps) {
  const pct = totalDecks ? Math.round((count / totalDecks) * 100) : 0;
  const colors = color ? parseColors(color) : [];
  const primaryColor = colors[0] ? getColorInfo(colors[0]) : getColorInfo("Black");

  const content = (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]">
      <CardImage
        src={image}
        alt={name}
        cardId={leaderId ?? ""}
        className="h-14 w-10 rounded-md object-cover flex-shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <div className="flex gap-1">
            {colors.map((c) => {
              const ci = getColorInfo(c);
              return (
                <span
                  key={c}
                  className={`h-2 w-2 rounded-full ${ci.dot}`}
                />
              );
            })}
          </div>
        </div>

        {totalDecks != null && totalDecks > 0 && (
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${primaryColor.gradient}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <span
        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${primaryColor.bg} ${primaryColor.text}`}
      >
        {count}
      </span>
    </div>
  );

  if (metaId && leaderId) {
    return (
      <Link href={`/meta/${metaId}/leader/${leaderId}`}>
        {content}
      </Link>
    );
  }

  return content;
}
