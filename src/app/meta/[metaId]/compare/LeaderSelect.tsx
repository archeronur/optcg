"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export interface LeaderOption {
  leaderId: string;
  name: string;
  points: number;
  wins: number;
}

interface Props {
  side: "a" | "b";
  value: string;
  options: LeaderOption[];
  disabledId?: string;
  placeholder: string;
}

export default function LeaderSelect({
  side,
  value,
  options,
  disabledId,
  placeholder,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = useCallback(
    (next: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (next) sp.set(side, next);
      else sp.delete(side);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, side],
  );

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option
          key={o.leaderId}
          value={o.leaderId}
          disabled={o.leaderId === disabledId}
        >
          {o.name} · {o.points} pts · {o.wins}W
        </option>
      ))}
    </select>
  );
}
