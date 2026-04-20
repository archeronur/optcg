"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import T from "@/components/T";

interface Props {
  a: string;
  b: string;
}

export default function SwapButton({ a, b }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const swap = () => {
    if (!a && !b) return;
    const sp = new URLSearchParams(searchParams.toString());
    if (b) sp.set("a", b);
    else sp.delete("a");
    if (a) sp.set("b", a);
    else sp.delete("b");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <button
      type="button"
      onClick={swap}
      disabled={!a && !b}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span aria-hidden="true">⇄</span>
      <T section="tracker" k="swap" />
    </button>
  );
}
