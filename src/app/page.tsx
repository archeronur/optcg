import Link from "next/link";
import { getSummary } from "@/lib/data";
import T from "@/components/T";

export default function LandingPage() {
  const summary = getSummary();
  const totalEvents = summary.metas.reduce((sum, m) => sum + m.eventCount, 0);
  const totalDecks = summary.metas.reduce(
    (sum, m) => sum + (m.totalDecks ?? m.deckCount ?? 0),
    0,
  );
  const totalSets = summary.metas.length;

  return (
    <div className="h-[calc(100dvh-4rem)] md:min-h-[calc(100vh-4rem)] overflow-hidden flex flex-col items-center justify-center px-4 py-3 sm:py-16">
      <div className="text-center mb-4 sm:mb-14 animate-fade-in">
        <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold gradient-text mb-2 sm:mb-4">
          <T section="landing" k="title" />
        </h1>
        <p className="text-gray-400 text-sm sm:text-xl max-w-md sm:max-w-xl mx-auto leading-relaxed">
          <T section="landing" k="subtitle" />
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-5 md:gap-8 w-full max-w-3xl md:max-w-4xl animate-slide-up">
        {/* Event Tracker Card */}
        <Link
          href="/tracker"
          className="glass-card hover-lift p-3.5 sm:p-8 flex flex-col gap-2.5 sm:gap-4 group"
        >
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-accent/10 flex items-center justify-center text-lg sm:text-2xl">
            📊
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-white mb-1.5 sm:mb-2 group-hover:text-accent transition-colors">
              <T section="landing" k="trackerTitle" />
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
              <T section="landing" k="trackerDesc" />
            </p>
          </div>
          <div className="flex gap-2 sm:gap-4 mt-auto pt-2.5 sm:pt-4 border-t border-white/5">
            <div className="text-center flex-1">
              <div className="text-lg sm:text-xl font-bold text-white">{totalEvents}</div>
              <div className="text-[11px] sm:text-xs text-gray-500">
                <T section="landing" k="events" />
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-lg sm:text-xl font-bold text-white">{totalDecks}</div>
              <div className="text-[11px] sm:text-xs text-gray-500">
                <T section="landing" k="decks" />
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-lg sm:text-xl font-bold text-white">{totalSets}</div>
              <div className="text-[11px] sm:text-xs text-gray-500">
                <T section="landing" k="sets" />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <span className="text-xs sm:text-sm font-medium text-accent group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              <T section="landing" k="goToTracker" />
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>

        {/* Proxy Print Card */}
        <Link
          href="/proxy-print"
          className="glass-card hover-lift p-3.5 sm:p-8 flex flex-col gap-2.5 sm:gap-4 group"
        >
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-accent-secondary/10 flex items-center justify-center text-lg sm:text-2xl">
            🖨️
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-white mb-1.5 sm:mb-2 group-hover:text-accent-secondary transition-colors">
              <T section="landing" k="proxyTitle" />
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
              <T section="landing" k="proxyDesc" />
            </p>
          </div>
          <div className="flex gap-4 mt-auto pt-2.5 sm:pt-4 border-t border-white/5">
            <div className="text-[11px] sm:text-sm text-gray-500">
              PDF · A4 · 3×3
            </div>
          </div>
          <div className="flex justify-end">
            <span className="text-xs sm:text-sm font-medium text-accent-secondary group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              <T section="landing" k="goToProxy" />
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
