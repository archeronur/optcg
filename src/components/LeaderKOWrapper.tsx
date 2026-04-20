"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useI18n } from "@/lib/i18n";

interface LeaderKOWrapperProps {
  /** Usually a `<Link>` or `<CardImage>` for a leader. */
  children: ReactNode;
  /** Extra classes merged with the required `relative` positioning. */
  className?: string;
  /** How many clicks within `windowMs` trigger the KO. Defaults to 10. */
  threshold?: number;
  /** Sliding window for counting rapid clicks, in ms. Defaults to 3000. */
  windowMs?: number;
  /** How long the card stays "knocked out" before reviving, in ms. Defaults to 5000. */
  recoveryMs?: number;
}

type Phase = "idle" | "knockout" | "revive";

/**
 * Easter egg wrapper: clicking the wrapped leader card 10 times within 3s
 * plays a "KO" animation, pops a retirement toast, and hides navigation for
 * ~5 seconds before the card revives. Click capture is used so the
 * qualifying click never reaches the inner `<Link>` and accidentally
 * navigates away mid-joke.
 */
export default function LeaderKOWrapper({
  children,
  className,
  threshold = 10,
  windowMs = 3000,
  recoveryMs = 5000,
}: LeaderKOWrapperProps) {
  const clicksRef = useRef<number[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [showToast, setShowToast] = useState(false);
  const { t } = useI18n();

  useEffect(
    () => () => {
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      timeoutsRef.current = [];
    },
    [],
  );

  const handleClickCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (phase !== "idle") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const now = Date.now();
      const recent = clicksRef.current.filter((ts) => now - ts < windowMs);
      recent.push(now);
      clicksRef.current = recent;

      if (recent.length < threshold) return;

      e.preventDefault();
      e.stopPropagation();
      clicksRef.current = [];

      setPhase("knockout");
      setShowToast(true);

      const hideToast = window.setTimeout(() => setShowToast(false), 3200);
      const revive = window.setTimeout(() => setPhase("revive"), recoveryMs);
      const settle = window.setTimeout(
        () => setPhase("idle"),
        recoveryMs + 600,
      );
      timeoutsRef.current.push(hideToast, revive, settle);
    },
    [phase, threshold, windowMs, recoveryMs],
  );

  const animClass =
    phase === "knockout" ? "ko-knockout" : phase === "revive" ? "ko-revive" : "";

  const wrapperClass = ["relative", className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass} onClickCapture={handleClickCapture}>
      <div className={animClass}>{children}</div>

      {phase === "knockout" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="ko-stars text-4xl sm:text-5xl drop-shadow-[0_2px_12px_rgba(255,215,0,0.6)]">
            💥
          </span>
        </div>
      )}

      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-fade-in rounded-full border border-accent/40 bg-black/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl"
        >
          💤 {t("easter", "leaderRetired")}
        </div>
      )}
    </div>
  );
}
