"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import T from "@/components/T";
import { useI18n } from "@/lib/i18n";

type Side = "onePiece" | "mugiwara";

const MOBILE_BREAKPOINT = 820;
const FLIP_DURATION_MS = 1800;
/** Window of recent flips inspected for the anti-streak correction. */
const HISTORY_WINDOW = 6;

/** Cryptographically strong uniform float in [0, 1). Falls back to
 *  `Math.random()` when `crypto.getRandomValues` is unavailable. */
function secureRandom(): number {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x1_0000_0000;
  }
  return Math.random();
}

/** Pick the next coin face using a balanced RNG with a gentle anti-streak
 *  correction: when the last `HISTORY_WINDOW` results lean heavily toward
 *  one side, the other side becomes (slightly) more likely. Over long runs
 *  this converges to ~50/50 while eliminating the feeling of unfair streaks
 *  that pure `Math.random()` can produce. */
function pickOutcome(history: Side[]): Side {
  const recent = history.slice(-HISTORY_WINDOW);
  const onePieceCount = recent.filter((s) => s === "onePiece").length;
  const mugiwaraCount = recent.length - onePieceCount;
  const diff = onePieceCount - mugiwaraCount; // + ⇒ onePiece-heavy

  // Map the imbalance to a probability nudge. Capped at 65/35 so results
  // still feel surprising, not deterministic.
  let onePieceProb = 0.5;
  if (diff >= 3) onePieceProb = 0.35;
  else if (diff <= -3) onePieceProb = 0.65;
  else if (diff >= 2) onePieceProb = 0.42;
  else if (diff <= -2) onePieceProb = 0.58;

  return secureRandom() < onePieceProb ? "onePiece" : "mugiwara";
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
  /** Rolling window of recent outcomes — only used by `pickOutcome`'s
   *  anti-streak correction, so a ref avoids unnecessary re-renders. */
  const historyRef = useRef<Side[]>([]);

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
    const outcome = pickOutcome(historyRef.current);
    historyRef.current = [...historyRef.current, outcome].slice(-HISTORY_WINDOW);
    const spins = 4 + Math.floor(secureRandom() * 3);
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
  // Luffy's iconic straw hat: wide brim, domed crown, red band. No skull,
  // no bones, no text — just the hat so it cleanly contrasts with the
  // "ONE PIECE" lettering on the other face.
  return (
    <svg
      viewBox="-60 -45 120 90"
      className="h-[86%] w-[86%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hat-crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe6a0" />
          <stop offset="55%" stopColor="#df9a38" />
          <stop offset="100%" stopColor="#7f4a0c" />
        </linearGradient>
        <linearGradient id="hat-brim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5c572" />
          <stop offset="100%" stopColor="#955f14" />
        </linearGradient>
        <linearGradient id="hat-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e54b5c" />
          <stop offset="100%" stopColor="#881926" />
        </linearGradient>
      </defs>

      {/* Crown (dome) — drawn first so the brim overlaps on top */}
      <path
        d="M -26 5 Q -30 -34 0 -38 Q 30 -34 26 5 Z"
        fill="url(#hat-crown)"
        stroke="#2a1602"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Crown highlight */}
      <path
        d="M -18 -28 Q 0 -36 18 -28"
        fill="none"
        stroke="rgba(255,240,200,0.55)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Vertical straw fibres on the crown */}
      <g stroke="#5c3908" strokeWidth="0.7" strokeLinecap="round" opacity="0.38">
        <line x1="-16" y1="-22" x2="-17" y2="3" />
        <line x1="-8"  y1="-30" x2="-8"  y2="2" />
        <line x1="0"   y1="-34" x2="0"   y2="1" />
        <line x1="8"   y1="-30" x2="8"   y2="2" />
        <line x1="16"  y1="-22" x2="17"  y2="3" />
      </g>

      {/* Red band */}
      <path
        d="M -26 3 Q 0 -3 26 3 L 24 10 Q 0 4 -24 10 Z"
        fill="url(#hat-band)"
        stroke="#2a1602"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M -22 1.5 Q 0 -4 22 1.5"
        fill="none"
        stroke="rgba(255,220,220,0.55)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      {/* Brim — wide ellipse sitting on the band */}
      <ellipse
        cx="0"
        cy="10"
        rx="50"
        ry="9"
        fill="url(#hat-brim)"
        stroke="#2a1602"
        strokeWidth="1.6"
      />
      {/* Brim top sheen */}
      <path
        d="M -44 6 Q 0 1 44 6"
        fill="none"
        stroke="rgba(255,240,200,0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Straw stitches along the brim */}
      <g stroke="#5c3908" strokeWidth="0.9" strokeLinecap="round" opacity="0.55">
        <line x1="-42" y1="10"   x2="-43" y2="17" />
        <line x1="-32" y1="13"   x2="-32.5" y2="18.5" />
        <line x1="-20" y1="14"   x2="-20" y2="19" />
        <line x1="-8"  y1="14.5" x2="-8"  y2="19.5" />
        <line x1="8"   y1="14.5" x2="8"   y2="19.5" />
        <line x1="20"  y1="14"   x2="20"  y2="19" />
        <line x1="32"  y1="13"   x2="32.5" y2="18.5" />
        <line x1="42"  y1="10"   x2="43"  y2="17" />
      </g>
    </svg>
  );
}
