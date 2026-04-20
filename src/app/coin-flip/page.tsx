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
        className="text-[14px] font-black uppercase tracking-[0.55em] text-[#5a3405]"
        style={{ textShadow: "0 1px 0 rgba(255,235,180,0.55)" }}
      >
        One
      </span>
      <span
        className="mt-1.5 text-[40px] font-black uppercase tracking-tight text-[#3a1f02] sm:text-[44px]"
        style={{
          textShadow:
            "0 1px 0 rgba(255,235,180,0.6), 0 2px 6px rgba(0,0,0,0.25)",
          letterSpacing: "-0.02em",
        }}
      >
        PIECE
      </span>
      <div
        aria-hidden="true"
        className="mt-2.5 flex items-center gap-1.5 text-[#6b3d09]/70"
      >
        <span className="h-px w-5 bg-current" />
        <span className="text-[10px]">★</span>
        <span className="h-px w-5 bg-current" />
      </div>
    </div>
  );
}

function MugiwaraEmblem() {
  return (
    <svg
      viewBox="-60 -60 120 120"
      className="h-[86%] w-[86%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffdd92" />
          <stop offset="55%" stopColor="#df9a38" />
          <stop offset="100%" stopColor="#8b5410" />
        </linearGradient>
        <linearGradient id="brim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2be6a" />
          <stop offset="100%" stopColor="#a06a18" />
        </linearGradient>
        <linearGradient id="bone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6d5" />
          <stop offset="100%" stopColor="#d8c37a" />
        </linearGradient>
        <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d94757" />
          <stop offset="100%" stopColor="#8f1a2a" />
        </linearGradient>
      </defs>

      {/* ── Crossed bones behind skull ─────────────────────── */}
      <g stroke="#2a1602" strokeWidth="1.3" strokeLinejoin="round">
        <g transform="rotate(38)">
          <rect x="-46" y="-4.5" width="92" height="9" rx="4.5" fill="url(#bone)" />
          <circle cx="-46" cy="-4.5" r="5.5" fill="url(#bone)" />
          <circle cx="-46" cy="4.5" r="5.5" fill="url(#bone)" />
          <circle cx="46" cy="-4.5" r="5.5" fill="url(#bone)" />
          <circle cx="46" cy="4.5" r="5.5" fill="url(#bone)" />
        </g>
        <g transform="rotate(-38)">
          <rect x="-46" y="-4.5" width="92" height="9" rx="4.5" fill="url(#bone)" />
          <circle cx="-46" cy="-4.5" r="5.5" fill="url(#bone)" />
          <circle cx="-46" cy="4.5" r="5.5" fill="url(#bone)" />
          <circle cx="46" cy="-4.5" r="5.5" fill="url(#bone)" />
          <circle cx="46" cy="4.5" r="5.5" fill="url(#bone)" />
        </g>
      </g>

      {/* ── Skull (cranium + jaw as one shape) ─────────────── */}
      <g stroke="#2a1602" strokeWidth="1.4" strokeLinejoin="round">
        <path
          d="M -22 -2 Q -22 -20 0 -20 Q 22 -20 22 -2 L 22 10 Q 20 14 15 14 L 13 20 Q 0 26 -13 20 L -15 14 Q -20 14 -22 10 Z"
          fill="url(#bone)"
        />
        {/* Eye sockets */}
        <ellipse cx="-9" cy="-2" rx="6" ry="7" fill="#1a0a00" stroke="none" />
        <ellipse cx="9" cy="-2" rx="6" ry="7" fill="#1a0a00" stroke="none" />
        {/* Tiny eye-shine */}
        <circle cx="-7" cy="-4.5" r="1.3" fill="#fff6d5" stroke="none" opacity="0.9" />
        <circle cx="11" cy="-4.5" r="1.3" fill="#fff6d5" stroke="none" opacity="0.9" />
        {/* Nose */}
        <path d="M -2.6 7 L 2.6 7 L 0 12 Z" fill="#1a0a00" stroke="none" />
        {/* Teeth row */}
        <path
          d="M -11 17 L 11 17"
          stroke="#1a0a00"
          strokeWidth="1.4"
          fill="none"
        />
        <path
          d="M -7 17 L -7 22.5 M -3 17 L -3 23.5 M 1 17 L 1 23.5 M 5 17 L 5 22.5"
          stroke="#1a0a00"
          strokeWidth="1.4"
          fill="none"
        />
      </g>

      {/* ── Straw hat (dome → band → brim, drawn over skull) ─ */}
      {/* Dome crown — flattened, wider than before */}
      <path
        d="M -22 -18 Q -24 -36 0 -38 Q 24 -36 22 -18 Z"
        fill="url(#hat)"
        stroke="#2a1602"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Crown highlight */}
      <path
        d="M -16 -30 Q 0 -36 16 -30"
        fill="none"
        stroke="rgba(255,240,200,0.55)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Red band */}
      <path
        d="M -22 -18 Q 0 -24 22 -18 L 22 -13 Q 0 -19 -22 -13 Z"
        fill="url(#band)"
        stroke="#2a1602"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* Band highlight */}
      <path
        d="M -18 -19.5 Q 0 -23 18 -19.5"
        fill="none"
        stroke="rgba(255,220,220,0.45)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Brim — wide ellipse sitting on band */}
      <ellipse
        cx="0"
        cy="-14"
        rx="46"
        ry="8"
        fill="url(#brim)"
        stroke="#2a1602"
        strokeWidth="1.4"
      />
      {/* Brim top sheen */}
      <path
        d="M -40 -17.5 Q 0 -21 40 -17.5"
        fill="none"
        stroke="rgba(255,240,200,0.5)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Straw stitches along brim */}
      <g stroke="#5c3908" strokeWidth="0.8" strokeLinecap="round" opacity="0.55">
        <line x1="-38" y1="-14.5" x2="-39" y2="-8.5" />
        <line x1="-28" y1="-11" x2="-28.5" y2="-6" />
        <line x1="-18" y1="-9" x2="-18" y2="-4.5" />
        <line x1="-8" y1="-8" x2="-8" y2="-3.5" />
        <line x1="8" y1="-8" x2="8" y2="-3.5" />
        <line x1="18" y1="-9" x2="18" y2="-4.5" />
        <line x1="28" y1="-11" x2="28.5" y2="-6" />
        <line x1="38" y1="-14.5" x2="39" y2="-8.5" />
      </g>
    </svg>
  );
}
