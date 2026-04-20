"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import T from "@/components/T";
import { useI18n } from "@/lib/i18n";

type Side = "onePiece" | "mugiwara";

const MOBILE_BREAKPOINT = 820;
const FLIP_DURATION_MS = 1800;

function pickOutcome(): Side {
  return Math.random() < 0.5 ? "onePiece" : "mugiwara";
}

/** Compute the next absolute rotation so that the coin settles showing `target`.
 *  Always adds at least `minSpins` full rotations for a visible spin, even when
 *  the current face matches the target. */
function computeNextRotation(current: number, target: Side, minSpins: number): number {
  const endMod = target === "onePiece" ? 0 : 180;
  const base = current + minSpins * 360;
  const adjustment = ((endMod - (base % 360)) + 360) % 360;
  return base + adjustment;
}

export default function CoinFlipPage() {
  const { t } = useI18n();

  // Default to `true` so the server-rendered markup matches a typical mobile
  // visit. We only flip to `false` after hydration on wide screens.
  const [isMobile, setIsMobile] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const [rotation, setRotation] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState<Side | null>(null);
  const [flipCount, setFlipCount] = useState(0);

  useEffect(() => {
    const check = () =>
      setIsMobile(window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches);
    check();
    setHydrated(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    document.title = `${t("coinFlip", "pageTitle")} · One Piece TCG`;
  }, [t]);

  const flip = useCallback(() => {
    if (isFlipping) return;
    const outcome = pickOutcome();
    const spins = 4 + Math.floor(Math.random() * 3);
    setRotation((prev) => computeNextRotation(prev, outcome, spins));
    setIsFlipping(true);
    setResult(null);
    setFlipCount((n) => n + 1);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        /* ignore */
      }
    }

    window.setTimeout(() => {
      setIsFlipping(false);
      setResult(outcome);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([12, 40, 12]);
        } catch {
          /* ignore */
        }
      }
    }, FLIP_DURATION_MS);
  }, [isFlipping]);

  if (hydrated && !isMobile) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4">
        <div className="glass-card w-full rounded-2xl p-8 text-center">
          <div className="mb-4 text-5xl">📱</div>
          <h1 className="gradient-text text-2xl font-extrabold tracking-tight">
            <T section="coinFlip" k="mobileOnlyTitle" />
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            <T section="coinFlip" k="mobileOnlyBody" />
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/[0.08]"
          >
            <span aria-hidden="true">←</span>
            <T section="coinFlip" k="backHome" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="coin-stage relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col items-center px-4 pb-10 pt-6">
      {/* Background glow (subtle, matches site theme) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-120px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(230,57,70,0.25),rgba(244,162,97,0.08)_55%,transparent_70%)] blur-3xl" />
      </div>

      {/* Header */}
      <header className="w-full text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-accent"
        >
          <span aria-hidden="true">←</span>
          <T section="coinFlip" k="backHome" />
        </Link>
        <h1 className="gradient-text mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          <T section="coinFlip" k="pageTitle" />
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-gray-400">
          <T section="coinFlip" k="tagline" />
        </p>
      </header>

      {/* Coin */}
      <div className="flex flex-1 items-center justify-center py-6">
        <button
          type="button"
          onClick={flip}
          disabled={isFlipping}
          aria-label={t("coinFlip", "tapToFlip")}
          className={`relative h-64 w-64 cursor-pointer select-none rounded-full outline-none transition-transform sm:h-72 sm:w-72 ${
            isFlipping ? "pointer-events-none" : "hover:scale-[1.02] active:scale-[0.98]"
          }`}
          style={{ perspective: "1400px", WebkitTapHighlightColor: "transparent" }}
        >
          {/* Soft drop-shadow beneath the coin that squishes on flip */}
          <div
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-[92%] h-5 w-44 -translate-x-1/2 rounded-full bg-black/60 blur-lg transition-all duration-[1800ms] ease-out ${
              isFlipping ? "scale-x-50 opacity-40" : "opacity-70"
            }`}
          />

          <div
            className="relative h-full w-full"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateY(${rotation}deg)`,
              transition: `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.25, 0.8, 0.3, 1)`,
            }}
          >
            <CoinFace variant="onePiece" />
            <CoinFace variant="mugiwara" rotated />
          </div>
        </button>
      </div>

      {/* Result + tap hint */}
      <div className="flex h-24 w-full flex-col items-center justify-start">
        {result && !isFlipping ? (
          <div className="coin-result text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-500">
              <T section="coinFlip" k="resultLabel" />
            </p>
            <p
              className={`mt-1 text-3xl font-extrabold tracking-tight ${
                result === "onePiece" ? "gradient-text" : "text-amber-200"
              }`}
            >
              {result === "onePiece" ? (
                <T section="coinFlip" k="announceOnePiece" />
              ) : (
                <T section="coinFlip" k="announceMugiwara" />
              )}
            </p>
          </div>
        ) : (
          <p className="animate-pulse pt-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
            {isFlipping ? (
              <T section="coinFlip" k="flipping" />
            ) : flipCount === 0 ? (
              <T section="coinFlip" k="tapToFlip" />
            ) : (
              <T section="coinFlip" k="tapAgain" />
            )}
          </p>
        )}
      </div>

      {flipCount > 0 && (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600 tabular-nums">
          <T section="coinFlip" k="flipN" values={{ n: flipCount }} />
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Coin faces                                                                */
/* -------------------------------------------------------------------------- */

function CoinFace({ variant, rotated }: { variant: Side; rotated?: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-full"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: rotated ? "rotateY(180deg)" : undefined,
        background:
          variant === "onePiece"
            ? "radial-gradient(circle at 30% 30%, #fde68a 0%, #f5c14a 40%, #b9801f 85%, #754c0e 100%)"
            : "radial-gradient(circle at 30% 30%, #fcd98a 0%, #e5a93c 45%, #a36c14 88%, #5e3c0a 100%)",
        boxShadow:
          "inset 0 0 0 3px rgba(255,230,150,0.35), inset 0 0 0 9px rgba(90,55,10,0.55), inset 0 0 0 11px rgba(255,215,120,0.25), 0 18px 40px -12px rgba(0,0,0,0.6), 0 2px 0 rgba(255,255,255,0.08)",
      }}
    >
      {/* Rim notch pattern for a minted-coin feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[6px] rounded-full"
        style={{
          background:
            "repeating-conic-gradient(from 0deg, rgba(0,0,0,0.22) 0deg 2deg, transparent 2deg 6deg)",
          maskImage:
            "radial-gradient(circle, transparent calc(50% - 11px), black calc(50% - 11px), black calc(50% - 3px), transparent calc(50% - 3px))",
          WebkitMaskImage:
            "radial-gradient(circle, transparent calc(50% - 11px), black calc(50% - 11px), black calc(50% - 3px), transparent calc(50% - 3px))",
        }}
      />
      {/* Inner plate */}
      <div className="absolute inset-[14px] rounded-full bg-gradient-to-br from-[#f5c14a] via-[#caa03f] to-[#8a5b14]" />
      <div className="relative z-10 flex h-full w-full items-center justify-center">
        {variant === "onePiece" ? <OnePieceEmblem /> : <MugiwaraEmblem />}
      </div>
      {/* Top highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[8px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse 60% 20% at 50% 10%, rgba(255,255,255,0.35), transparent 70%)",
        }}
      />
    </div>
  );
}

function OnePieceEmblem() {
  return (
    <div className="flex flex-col items-center justify-center leading-none">
      <span
        className="text-[13px] font-black uppercase tracking-[0.6em] text-[#5a3405]"
        style={{ textShadow: "0 1px 0 rgba(255,235,180,0.55)" }}
      >
        One
      </span>
      <span
        className="mt-1 text-[40px] font-black uppercase tracking-tight text-[#3a1f02] sm:text-[44px]"
        style={{
          textShadow:
            "0 1px 0 rgba(255,235,180,0.6), 0 2px 6px rgba(0,0,0,0.25)",
          letterSpacing: "-0.02em",
        }}
      >
        PIECE
      </span>
      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.35em] text-[#6b3d09]">
        <span>★</span>
        <span>TCG</span>
        <span>★</span>
      </div>
    </div>
  );
}

function MugiwaraEmblem() {
  return (
    <svg
      viewBox="-60 -60 120 120"
      className="h-[78%] w-[78%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe19a" />
          <stop offset="60%" stopColor="#e6a84c" />
          <stop offset="100%" stopColor="#a96b18" />
        </linearGradient>
        <linearGradient id="bone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff7df" />
          <stop offset="100%" stopColor="#d8c582" />
        </linearGradient>
      </defs>

      {/* Crossed bones behind skull */}
      <g strokeLinecap="round" stroke="#3a1f02" strokeWidth="1.2">
        <g transform="rotate(45)">
          <rect x="-42" y="-5" width="84" height="10" rx="5" fill="url(#bone)" />
          <circle cx="-42" cy="-5" r="6.5" fill="url(#bone)" />
          <circle cx="-42" cy="5" r="6.5" fill="url(#bone)" />
          <circle cx="42" cy="-5" r="6.5" fill="url(#bone)" />
          <circle cx="42" cy="5" r="6.5" fill="url(#bone)" />
        </g>
        <g transform="rotate(-45)">
          <rect x="-42" y="-5" width="84" height="10" rx="5" fill="url(#bone)" />
          <circle cx="-42" cy="-5" r="6.5" fill="url(#bone)" />
          <circle cx="-42" cy="5" r="6.5" fill="url(#bone)" />
          <circle cx="42" cy="-5" r="6.5" fill="url(#bone)" />
          <circle cx="42" cy="5" r="6.5" fill="url(#bone)" />
        </g>
      </g>

      {/* Skull */}
      <g stroke="#3a1f02" strokeWidth="1.2">
        <ellipse cx="0" cy="0" rx="22" ry="20" fill="url(#bone)" />
        {/* Jaw */}
        <path d="M -12 14 Q 0 25 12 14 L 10 22 Q 0 28 -10 22 Z" fill="url(#bone)" />
        {/* Eyes */}
        <ellipse cx="-9" cy="-3" rx="5.5" ry="6" fill="#1a0a00" />
        <ellipse cx="9" cy="-3" rx="5.5" ry="6" fill="#1a0a00" />
        {/* Nose */}
        <path d="M -2.5 6 L 2.5 6 L 0 11 Z" fill="#1a0a00" stroke="none" />
        {/* Teeth */}
        <path
          d="M -7 17 L -7 22 M -3 17 L -3 23 M 0 17 L 0 23.5 M 3 17 L 3 23 M 7 17 L 7 22"
          stroke="#1a0a00"
          strokeWidth="1.4"
        />
      </g>

      {/* Straw hat brim */}
      <ellipse
        cx="0"
        cy="-22"
        rx="38"
        ry="7"
        fill="url(#hat)"
        stroke="#3a1f02"
        strokeWidth="1.2"
      />
      {/* Hat cap */}
      <path
        d="M -15 -22 Q 0 -44 15 -22 Z"
        fill="url(#hat)"
        stroke="#3a1f02"
        strokeWidth="1.2"
      />
      {/* Red band */}
      <path
        d="M -15 -22 Q 0 -26 15 -22 L 15 -19 Q 0 -23 -15 -19 Z"
        fill="#c2384a"
        stroke="#3a1f02"
        strokeWidth="1"
      />
      {/* Straw texture lines on brim */}
      <g stroke="#8a5b14" strokeWidth="0.6" strokeLinecap="round" opacity="0.6">
        <line x1="-30" y1="-22" x2="-32" y2="-18" />
        <line x1="-18" y1="-22" x2="-19" y2="-17" />
        <line x1="-6" y1="-22" x2="-6" y2="-17" />
        <line x1="6" y1="-22" x2="6" y2="-17" />
        <line x1="18" y1="-22" x2="19" y2="-17" />
        <line x1="30" y1="-22" x2="32" y2="-18" />
      </g>
    </svg>
  );
}
