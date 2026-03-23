"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Language = "en" | "tr";

const translations = {
  landing: {
    title: { en: "One Piece TCG Tools", tr: "One Piece TCG Araçları" },
    subtitle: { en: "Choose the tool you want to use", tr: "Kullanmak istediğiniz aracı seçin" },
    trackerTitle: { en: "Event Tracker", tr: "Event Tracker" },
    trackerDesc: { en: "Event results, deck lists, and leader analytics from Egman Events data.", tr: "Egman Events verilerinden event sonuçları, deck listleri ve lider analizleri." },
    proxyTitle: { en: "Proxy Print", tr: "Proxy Baskı" },
    proxyDesc: { en: "Professional proxy printing tool for One Piece TCG cards. Create printable PDF deck sheets.", tr: "One Piece TCG kartları için profesyonel proxy baskı aracı. Yazdırılabilir PDF deck sayfaları oluşturun." },
    events: { en: "Events", tr: "Eventler" },
    decks: { en: "Decks", tr: "Deckler" },
    sets: { en: "Sets", tr: "Setler" },
    goToTracker: { en: "Open Tracker", tr: "Tracker'ı Aç" },
    goToProxy: { en: "Open Proxy Print", tr: "Proxy Baskıyı Aç" },
  },
  tracker: {
    home: { en: "Home", tr: "Ana Sayfa" },
    events: { en: "Events", tr: "Eventler" },
    leaders: { en: "Leaders", tr: "Liderler" },
    sets: { en: "Sets", tr: "Setler" },
    event: { en: "Event", tr: "Event" },
    deck: { en: "Deck", tr: "Deck" },
    set: { en: "Set", tr: "Set" },
    leader: { en: "Leader", tr: "Lider" },
    topLeaders: { en: "Top Leaders", tr: "En İyi Liderler" },
    allLeaders: { en: "All leaders →", tr: "Tüm liderler →" },
    eventsCount: { en: "Events ({count})", tr: "Eventler ({count})" },
    otherEvents: { en: "Other Events ({count})", tr: "Diğer Eventler ({count})" },
    players: { en: "players", tr: "oyuncu" },
    heroTitle: { en: "Event Tracker", tr: "Event Tracker" },
    heroDesc: { en: "Event results, deck lists, and leader analytics across all OP sets.", tr: "Tüm OP setlerindeki event sonuçları, deck listleri ve lider analizleri." },
    heroWarning: { en: "⚠ This site is not meta, it contains analyses of events compiled from Egman Events data.", tr: "⚠ Bu site meta değil, Egman Events verilerinden derlenen event analizlerini içermektedir." },
    comingSoon: { en: "Coming Soon", tr: "Çok Yakında" },
    dataSource: { en: "Data source", tr: "Veri kaynağı" },
    cardImages: { en: "Card images", tr: "Kart görselleri" },
    dataFrom: { en: "Data from", tr: "Veriler" },
    dataFromSuffix: { en: "", tr: "'ten alınmıştır." },
    leaderRanking: { en: "Leader Ranking", tr: "Lider Sıralaması" },
    pointSystem: { en: "Scoring System", tr: "Puanlama Sistemi" },
    differentLeaders: { en: "{count} different leaders", tr: "{count} farklı lider" },
    totalAppearances: { en: "{count} total appearances", tr: "{count} toplam görünüm" },
    points: { en: "Points", tr: "Puan" },
    win: { en: "Win", tr: "Win" },
    top8: { en: "Top 8", tr: "Top 8" },
    games: { en: "Games", tr: "Oyun" },
    winPct: { en: "Win%", tr: "Win%" },
    topPct: { en: "Top%", tr: "Top%" },
    sharePct: { en: "Share%", tr: "Pay%" },
    metaShare: { en: "Meta Share", tr: "Meta Pay" },
    cardEffect: { en: "Card Effect", tr: "Kart Efekti" },
    wins: { en: "Wins", tr: "Kazanma" },
    placingDist: { en: "Placing Distribution", tr: "Sıralama Dağılımı" },
    details: { en: "Details", tr: "Detay" },
    totalApp: { en: "Total Appearances", tr: "Toplam Görünüm" },
    uniquePlayers: { en: "Unique Players", tr: "Farklı Oyuncu" },
    uniqueEvents: { en: "Unique Events", tr: "Farklı Event" },
    conversionPct: { en: "Conversion %", tr: "Conversion %" },
    coreCards: { en: "Core Cards", tr: "Core Kartlar" },
    coreCardsDesc: { en: "70%+ inclusion rate · {count} cards", tr: "%70+ dahil oranı · {count} kart" },
    flexCards: { en: "Flex Cards", tr: "Flex Kartlar" },
    flexCardsDesc: { en: "Below 70% inclusion rate · {count} cards", tr: "%70 altı dahil oranı · {count} kart" },
    showMoreCards: { en: "Show more", tr: "Daha fazla göster" },
    showLessCards: { en: "Show less", tr: "Daha az göster" },
    allAppearances: { en: "All Appearances ({count})", tr: "Tüm Görünümler ({count})" },
    leaderDist: { en: "Leader Distribution", tr: "Lider Dağılımı" },
    differentLeadersShort: { en: "{count} different leaders", tr: "{count} farklı lider" },
    deckLists: { en: "Deck Lists ({count})", tr: "Deck Listleri ({count})" },
    eventStandings: { en: "Standings", tr: "Sıralama" },
    legacyStandingsNote: {
      en: "Leaders and final placements only — full deck lists are not shown for OP-05 and earlier.",
      tr: "OP-05 ve öncesi setlerde yalnızca liderler ve sıralamalar gösterilir; tam deck listeleri yoktur.",
    },
    allSets: { en: "All Sets", tr: "Tüm Setler" },
    totalEventsCount: { en: "{count} Events", tr: "{count} Event" },
    totalDecksCount: { en: "{count} Decks", tr: "{count} Deck" },
    topLeader: { en: "Top Leader", tr: "Top Lider" },
    viewDetails: { en: "View Details →", tr: "Detaylar →" },
    inclusionRate: { en: "Inclusion Rate", tr: "Dahil Oranı" },
    avgCopies: { en: "Average Copies", tr: "Ortalama Kopya" },
    differentCards: { en: "different cards", tr: "farklı kart" },
    totalCards: { en: "total cards", tr: "toplam kart" },
  },
  nav: {
    backToHome: { en: "Home", tr: "Ana Sayfa" },
    tracker: { en: "Tracker", tr: "Tracker" },
    proxyPrint: { en: "Proxy Print", tr: "Proxy Baskı" },
    language: { en: "Language", tr: "Dil" },
  },
} as const;

export type TranslationSection = keyof typeof translations;

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (section: TranslationSection, key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: () => "",
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("lang") as Language | null;
    if (saved === "tr" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("lang", newLang);
  }, []);

  const t = useCallback((section: TranslationSection, key: string): string => {
    const sectionData = translations[section] as Record<string, Record<Language, string>>;
    const entry = sectionData?.[key];
    if (!entry) return key;
    return entry[lang] || entry["en"] || key;
  }, [lang]);

  if (!mounted) {
    return <I18nContext.Provider value={{ lang: "en", setLang, t }}>{children}</I18nContext.Provider>;
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
