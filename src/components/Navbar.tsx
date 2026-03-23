"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

const META_LIST = [
  "op15", "op14", "op13", "op12", "op11", "op10",
  "op09", "op08", "op07", "op06", "op05", "op04", "op03", "op02", "op01",
];

function TurkeyFlag() {
  return (
    <svg className="h-4 w-6 rounded-sm" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#E30A17"/>
      <circle cx="425" cy="400" r="200" fill="#fff"/>
      <circle cx="475" cy="400" r="160" fill="#E30A17"/>
      <polygon fill="#fff" points="583,400 530,356 560,410 530,444 583,400" transform="rotate(18,560,400)"/>
    </svg>
  );
}

function USFlag() {
  return (
    <svg className="h-4 w-6 rounded-sm" viewBox="0 0 1235 650">
      <rect width="1235" height="650" fill="#B22234"/>
      <g fill="#fff">
        {[1,3,5,7,9,11].map(i => <rect key={i} y={i*50} width="1235" height="50"/>)}
      </g>
      <rect width="494" height="350" fill="#3C3B6E"/>
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { t, lang, setLang } = useI18n();
  const metaMatch = pathname.match(/\/meta\/(op\d+)/);
  const currentMeta = metaMatch ? metaMatch[1] : null;
  const isProxyPrint = pathname.startsWith("/proxy-print");
  const isTracker = pathname === "/tracker" || pathname.startsWith("/meta/");

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-white hover:text-accent transition-colors">
            OPTCG
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <Link
              href="/tracker"
              className={`rounded-lg px-3 py-1.5 transition-colors ${isTracker ? "bg-accent/10 text-accent font-bold" : "text-gray-400 hover:text-white"}`}
            >
              {t("nav", "tracker")}
            </Link>
            <Link
              href="/proxy-print"
              className={`rounded-lg px-3 py-1.5 transition-colors ${isProxyPrint ? "bg-accent/10 text-accent font-bold" : "text-gray-400 hover:text-white"}`}
            >
              {t("nav", "proxyPrint")}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isTracker && currentMeta && (
            <select
              value={currentMeta}
              onChange={(e) => { window.location.href = `/meta/${e.target.value}`; }}
              className="rounded-lg bg-card-bg border border-card-border px-2 py-1 text-xs text-white"
            >
              {META_LIST.map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setLang(lang === "en" ? "tr" : "en")}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/[0.1] hover:text-white transition-colors"
          >
            {lang === "tr" ? (
              <>
                <TurkeyFlag />
                <span>TR</span>
              </>
            ) : (
              <>
                <USFlag />
                <span>EN</span>
              </>
            )}
          </button>
        </div>
      </div>
      {/* Mobile nav */}
      <div className="sm:hidden flex border-t border-white/[0.04] px-4">
        <Link
          href="/tracker"
          className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${isTracker ? "text-accent border-b-2 border-accent" : "text-gray-500"}`}
        >
          {t("nav", "tracker")}
        </Link>
        <Link
          href="/proxy-print"
          className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${isProxyPrint ? "text-accent border-b-2 border-accent" : "text-gray-500"}`}
        >
          {t("nav", "proxyPrint")}
        </Link>
      </div>
    </nav>
  );
}
