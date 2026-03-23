import { Language, Translations } from '@/proxy-print/types';

export const translations: Translations = {
  // Başlık ve genel
  title: {
    tr: 'One Piece Proxy Baskı Sitesi',
    en: 'One Piece Proxy Print Site'
  },
  subtitle: {
    tr: 'One Piece Trading Card Game kartları için profesyonel proxy baskı aracı',
    en: 'Professional proxy printing tool for One Piece Trading Card Game cards'
  },
  
  // Tabs
  textInput: {
    tr: 'Metin Girişi',
    en: 'Text Input'
  },
  urlInput: {
    tr: 'URL Girişi',
    en: 'URL Input'
  },
  csvInput: {
    tr: 'CSV Yükleme',
    en: 'CSV Upload'
  },
  
  // Input bölümü
  inputSection: {
    tr: 'Deck Girişi',
    en: 'Deck Input'
  },
  textInputPlaceholder: {
    tr: `Deck listenizi buraya yapıştırın:

4x Monkey D. Luffy (OP01-001)
3x Roronoa Zoro (OP01-002)
2x Nami (OP01-003)
1x Usopp (OP01-004)

Desteklenen formatlar:
• "Adet x Kart Adı (Set Kodu/Numara)"
• "Adet Kart Adı"
• Sadece "Kart Adı" (adet 1 varsayılır)`,
    en: `Paste your deck list here:

4x Monkey D. Luffy (OP01-001)
3x Roronoa Zoro (OP01-002)
2x Nami (OP01-003)
1x Usopp (OP01-004)

Supported formats:
• "Count x Card Name (Set Code/Number)"
• "Count Card Name"
• Just "Card Name" (count defaults to 1)`
  },
  urlInputPlaceholder: {
    tr: 'One Piece deck URL\'sini buraya yapıştırın...',
    en: 'Paste One Piece deck URL here...'
  },
  csvInputHelp: {
    tr: 'CSV dosyanız "Name, Count, Set, Number" sütunlarını içermelidir',
    en: 'Your CSV file should contain "Name, Count, Set, Number" columns'
  },
  
  // Butonlar
  parseDeck: {
    tr: 'Deck\'i Analiz Et',
    en: 'Parse Deck'
  },
  loadFromUrl: {
    tr: 'URL\'den Yükle',
    en: 'Load from URL'
  },
  uploadCsv: {
    tr: 'CSV Yükle',
    en: 'Upload CSV'
  },
  generatePdf: {
    tr: 'PDF İndir',
    en: 'Download PDF'
  },
  generatePng: {
    tr: 'PNG Sayfaları İndir',
    en: 'Download PNG Pages'
  },
  clearDeck: {
    tr: 'Temizle',
    en: 'Clear'
  },
  
  // Önizleme bölümü
  previewSection: {
    tr: 'Önizleme ve Ayarlar',
    en: 'Preview & Settings'
  },
  printSettings: {
    tr: 'Baskı Ayarları',
    en: 'Print Settings'
  },
  gridLayout: {
    tr: 'Izgara Düzeni',
    en: 'Grid Layout'
  },
  advanced: {
    tr: 'Gelişmiş',
    en: 'Advanced'
  },
  
  // Ayarlar
  includeBleed: {
    tr: 'Bleed Ekle (3mm)',
    en: 'Include Bleed (3mm)'
  },
  includeCropMarks: {
    tr: 'Kesim İşaretleri',
    en: 'Crop Marks'
  },
  cropMarkLength: {
    tr: 'Kesim İşareti Uzunluğu (mm)',
    en: 'Crop Mark Length (mm)'
  },
  cropMarkOffset: {
    tr: 'Kesim İşareti Ofseti (mm)',
    en: 'Crop Mark Offset (mm)'
  },
  cropMarkThickness: {
    tr: 'Kesim İşareti Kalınlığı (pt)',
    en: 'Crop Mark Thickness (pt)'
  },
  includeBackPages: {
    tr: 'Kart Arkası Sayfaları',
    en: 'Back Pages'
  },
  safeMargin: {
    tr: 'Güvenlik Payı (mm)',
    en: 'Safe Margin (mm)'
  },
  
  // İstatistikler
  deckStats: {
    tr: 'Deck İstatistikleri',
    en: 'Deck Statistics'
  },
  totalCards: {
    tr: 'Toplam Kart',
    en: 'Total Cards'
  },
  uniqueCards: {
    tr: 'Benzersiz Kart',
    en: 'Unique Cards'
  },
  totalPages: {
    tr: 'Toplam Sayfa',
    en: 'Total Pages'
  },
  cardsPerPage: {
    tr: 'Sayfa Başına Kart',
    en: 'Cards per Page'
  },
  lastPageUtilization: {
    tr: 'Son Sayfa Doluluk',
    en: 'Last Page Utilization'
  },
  estimatedPrintTime: {
    tr: 'Tahmini Baskı Süresi',
    en: 'Estimated Print Time'
  },
  paperEfficiency: {
    tr: 'Kağıt Verimliliği',
    en: 'Paper Efficiency'
  },
  
  // Hatalar ve uyarılar
  errorCardNotFound: {
    tr: 'Kart bulunamadı',
    en: 'Card not found'
  },
  errorInvalidUrl: {
    tr: 'Geçersiz URL formatı',
    en: 'Invalid URL format'
  },
  errorCsvFormat: {
    tr: 'CSV formatı hatalı',
    en: 'Invalid CSV format'
  },
  errorNoDeck: {
    tr: 'Lütfen önce bir deck girin',
    en: 'Please enter a deck first'
  },
  
  // Uyarılar
  warningEmptyDeck: {
    tr: 'Deck boş görünüyor',
    en: 'Deck appears to be empty'
  },
  warningMissingCards: {
    tr: 'Bazı kartlar bulunamadı',
    en: 'Some cards could not be found'
  },
  warningLowEfficiency: {
    tr: 'Son sayfa verimliliği düşük',
    en: 'Low last page efficiency'
  },
  
  // Yasal uyarı
  legalNoticeTitle: {
    tr: 'Yasal Uyarı',
    en: 'Legal Notice'
  },
  legalNoticeText: {
    tr: `Bu araç yalnızca kişisel kullanım ve pratik amaçları içindir. Proxy kartlar resmi One Piece Trading Card Game turnuvalarında kullanılamaz. 
    Tüm kart görselleri ve markalar Eiichiro Oda, Bandai, Shonen Jump ve Viz Media'ya aittir. One Piece topluluğu kurallarına ve telif hakkı yasalarına saygı gösterin.`,
    en: `This tool is for personal use and practice purposes only. Proxy cards cannot be used in official One Piece Trading Card Game tournaments. 
    All card images and trademarks belong to Eiichiro Oda, Bandai, Shonen Jump and Viz Media. Please respect community guidelines and copyright laws.`
  },
  
  // Yardım metinleri
  helpPrintSettings: {
    tr: 'Yazıcınızda "Gerçek boyut" veya "100% ölçek" seçeneğini kullanın. "Sayfaya sığdır" seçeneğini kapatın.',
    en: 'Use "Actual size" or "100% scale" option in your printer. Disable "Fit to page" option.'
  },
  helpBleed: {
    tr: 'Bleed, kartın kesilecek alanın dışına taşan kısımdır. Profesyonel baskı için önerilir.',
    en: 'Bleed is the area that extends beyond the cut line. Recommended for professional printing.'
  },
  helpCropMarks: {
    tr: 'Kesim işaretleri kartların nerede kesileceğini gösterir.',
    en: 'Crop marks show where cards should be cut.'
  },
  
  // Durum mesajları
  loading: {
    tr: 'Yükleniyor...',
    en: 'Loading...'
  },
  processing: {
    tr: 'İşleniyor...',
    en: 'Processing...'
  },
  generating: {
    tr: 'PDF oluşturuluyor...',
    en: 'Generating PDF...'
  },
  complete: {
    tr: 'Tamamlandı',
    en: 'Complete'
  },
  
  // Başarı mesajları
  successDeckParsed: {
    tr: 'Deck başarıyla analiz edildi',
    en: 'Deck parsed successfully'
  },
  successPdfGenerated: {
    tr: 'PDF başarıyla oluşturuldu',
    en: 'PDF generated successfully'
  },
  successPngGenerated: {
    tr: 'PNG sayfaları başarıyla oluşturuldu',
    en: 'PNG pages generated successfully'
  },
  
  // Kartlar için
  cardSlotEmpty: {
    tr: 'Boş',
    en: 'Empty'
  },
  cardImageLoading: {
    tr: 'Yükleniyor...',
    en: 'Loading...'
  },
  cardImageError: {
    tr: 'Görsel yüklenemedi',
    en: 'Image failed to load'
  },
  
  // Yeni eklenen key'ler
  preview: {
    tr: 'Önizleme',
    en: 'Preview'
  },
  pages: {
    tr: 'sayfa',
    en: 'pages'
  },
  page: {
    tr: 'Sayfa',
    en: 'Page'
  },
  cards: {
    tr: 'kart',
    en: 'cards'
  },
  previous: {
    tr: 'Önceki',
    en: 'Previous'
  },
  next: {
    tr: 'Sonraki',
    en: 'Next'
  },
  minutes: {
    tr: 'dakika',
    en: 'minutes'
  },
  tips: {
    tr: 'İpuçları',
    en: 'Tips'
  },
  tip1: {
    tr: 'İlk kez PDF oluştururken görseller yüklenir (1-2 dakika)',
    en: 'Images are loaded when creating PDF for the first time (1-2 minutes)'
  },
  tip2: {
    tr: 'Büyük desteler için daha uzun sürebilir',
    en: 'May take longer for large decks'
  },
  tip3: {
    tr: 'İnternet bağlantınızın stabil olduğundan emin olun',
    en: 'Make sure your internet connection is stable'
  },
  imagesLoading: {
    tr: 'Görseller yükleniyor...',
    en: 'Images loading...'
  },

  deckTextareaPlaceholder: {
    en: `Paste your deck list here:

4x Monkey D. Luffy (OP01-001)
3x Roronoa Zoro (OP01-002)
2x Nami (OP01-003)

Or use the new format:
1xOP11-040
4xOP05-067_p1
4xST18-001

Variant / alt art:
1x Portgas.D.Ace (OP13-002_p1)
1xOP13-002_p1

Supported formats:
• "Count x Card Name (SetCode-Number)"
• "Count x Card Name (SetCode-Number_variant)"
• "Count x SetCode-Number" or "SetCode-Number_p1"
• Just "Card Name" (count defaults to 1)

Variants: _p1, _p2 (Parallel), _aa (Alt Art), _sp (Special)`,
    tr: `Deck listenizi buraya yapıştırın:

4x Monkey D. Luffy (OP01-001)
3x Roronoa Zoro (OP01-002)
2x Nami (OP01-003)

Yeni format:
1xOP11-040
4xOP05-067_p1
4xST18-001

Varyant / alternatif art:
1x Portgas.D.Ace (OP13-002_p1)
1xOP13-002_p1

Desteklenen formatlar:
• "Adet x Kart Adı (SetKodu-Numara)"
• "Adet x Kart Adı (SetKodu-Numara_varyant)"
• "Adet x SetKodu-Numara" veya "SetKodu-Numara_p1"
• Sadece "Kart Adı" (adet varsayılan 1)

Varyantlar: _p1, _p2 (Parallel), _aa (Alt Art), _sp (Special)`
  },
  orPasteDeck: {
    en: 'or paste deck list',
    tr: 'veya deck listesini yapıştırın'
  },
  deckListHeading: {
    en: 'Deck List',
    tr: 'Deck Listesi'
  },
  deckListCountSummary: {
    en: '{total} cards ({unique} unique)',
    tr: '{total} kart ({unique} benzersiz)'
  },
  decreaseQtyTitle: {
    en: 'Decrease quantity',
    tr: 'Adedi azalt'
  },
  increaseQtyTitle: {
    en: 'Increase quantity',
    tr: 'Adedi artır'
  },
  missingCardsMore: {
    en: '...and {count} more',
    tr: '… ve {count} tane daha'
  },
  gridBadge3x3: {
    en: '3×3 Grid',
    tr: '3×3 Izgara'
  },
  labelLengthShort: {
    en: 'Length',
    tr: 'Uzunluk'
  },
  labelOffsetShort: {
    en: 'Offset',
    tr: 'Ofset'
  },
  labelThicknessShort: {
    en: 'Thickness',
    tr: 'Kalınlık'
  },
  loadingCardsSection: {
    en: 'Loading Cards...',
    tr: 'Kartlar yükleniyor…'
  },
  fetchingApiCards: {
    en: 'Fetching card data from API...',
    tr: 'API’den kart verisi alınıyor…'
  },
  previewWithPages: {
    en: 'Preview ({pages} pages)',
    tr: 'Önizleme ({pages} sayfa)'
  },
  pageColon: {
    en: 'Page:',
    tr: 'Sayfa:'
  },
  pageOptionLine: {
    en: 'Page {num} ({count} cards)',
    tr: 'Sayfa {num} ({count} kart)'
  },
  clickToViewName: {
    en: 'Click to view {name}',
    tr: '{name} — detay için tıklayın'
  },
  viewDetailsShort: {
    en: 'View Details',
    tr: 'Detayı gör'
  },
  progressPercentDone: {
    en: '{percent}% completed',
    tr: '{percent}% tamamlandı'
  },
  tipChangeArt: {
    en: 'Click any card in the preview to view details and switch between alternative arts (Parallel, Alt Art, etc.).',
    tr: 'Önizlemede bir karta tıklayarak detayları açın ve alternatif illüstrasyonlar (Parallel, Alt Art vb.) arasında geçin.'
  },
  importantNoticeHeading: {
    en: 'Important Notice',
    tr: 'Önemli uyarı'
  },
  celebrationPdfReady: {
    en: 'PDF Ready!',
    tr: 'PDF hazır!'
  },
  celebrationDeckGenerated: {
    en: 'Your deck has been successfully generated',
    tr: 'Desteniz başarıyla oluşturuldu'
  },
  celebrationGotIt: {
    en: 'Got it!',
    tr: 'Tamam'
  },
  celebrationCloseTitle: {
    en: 'Close',
    tr: 'Kapat'
  },
  modalLabelSet: {
    en: 'Set:',
    tr: 'Set:'
  },
  modalLabelNumber: {
    en: 'Number:',
    tr: 'Numara:'
  },
  modalLabelVersion: {
    en: 'Version:',
    tr: 'Sürüm:'
  },
  modalLabelRarity: {
    en: 'Rarity:',
    tr: 'Nadirlik:'
  },
  modalLabelType: {
    en: 'Type:',
    tr: 'Tip:'
  },
  modalLabelColor: {
    en: 'Color:',
    tr: 'Renk:'
  },
  modalLabelCost: {
    en: 'Cost:',
    tr: 'Maliyet:'
  },
  modalLabelSubtypes: {
    en: 'Subtypes:',
    tr: 'Alt tipler:'
  },
  modalLabelQuantity: {
    en: 'Quantity in Deck:',
    tr: 'Deck’teki adet:'
  },
  modalCardEffectHeading: {
    en: 'Card Effect:',
    tr: 'Kart efekti:'
  },
  modalIllustratedBy: {
    en: 'Illustrated by:',
    tr: 'İllüstrasyon:'
  },
  alternativeArts: {
    en: 'Alternative Arts',
    tr: 'Alternatif illüstrasyonlar'
  },
  alternativeArtsHint: {
    en: 'Click an art below to select it, then press the change button to apply.',
    tr: 'Aşağıdan bir illüstrasyon seçin, ardından değiştir düğmesine basın.'
  },
  loadingArtVariants: {
    en: 'Loading art variants...',
    tr: 'Alternatif illüstrasyonlar yükleniyor…'
  },
  noAlternativeArts: {
    en: 'No alternative arts available for this card.',
    tr: 'Bu kart için alternatif illüstrasyon yok.'
  },
  changeToArtButton: {
    en: 'Change to {label} Art',
    tr: '{label} illüstrasyonuna geç'
  },
  modalClose: {
    en: 'Close',
    tr: 'Kapat'
  },
  removeCardTitle: {
    en: 'Remove Card?',
    tr: 'Kart kaldırılsın mı?'
  },
  removeCardConfirmBody: {
    en: 'Are you sure you want to remove {name} from your deck entirely?',
    tr: '{name} kartını deck’ten tamamen kaldırmak istediğinize emin misiniz?'
  },
  yesRemoveCard: {
    en: 'Yes, Remove Card',
    tr: 'Evet, kartı kaldır'
  },
  dialogCancel: {
    en: 'Cancel',
    tr: 'İptal'
  },
  changeAllTitle: {
    en: 'Change All Cards?',
    tr: 'Tümünü değiştir?'
  },
  changeAllIntro: {
    en: 'You have {count}x {id} cards in your deck.',
    tr: 'Deck’inizde {count} adet {id} var.'
  },
  changeAllQuestion: {
    en: 'Do you want to change all of them to {label} art?',
    tr: 'Hepsini {label} illüstrasyonuna çevirmek ister misiniz?'
  },
  changeAllNote: {
    en: 'Note: Only {id} cards will change. Other art variants (like _p1, _p2) will remain unchanged.',
    tr: 'Not: Yalnızca {id} kartları değişir. Diğer varyantlar (_p1, _p2 vb.) aynı kalır.'
  },
  yesChangeAll: {
    en: 'Yes, Change All ({count}x)',
    tr: 'Evet, tümünü değiştir ({count}x)'
  },
  onlyOneCard: {
    en: 'Only 1x Card',
    tr: 'Yalnızca 1 adet'
  },
  currentArtBadge: {
    en: 'Current',
    tr: 'Mevcut'
  },
  unknownLabel: {
    en: 'Unknown',
    tr: 'Bilinmiyor'
  },
  standardLabel: {
    en: 'Standard',
    tr: 'Standart'
  },
  errorNetworkLost: {
    en: 'Internet connection lost. Please check your connection.',
    tr: 'İnternet bağlantısı kesildi. Lütfen bağlantınızı kontrol edin.'
  },
  errorCardResolution: {
    en: 'Card resolution error',
    tr: 'Kart çözümleme hatası'
  },
  errorParseDetail: {
    en: 'Parse error: {detail}',
    tr: 'Ayrıştırma hatası: {detail}'
  },
  preparingPdf: {
    en: 'Preparing PDF...',
    tr: 'PDF hazırlanıyor…'
  },
  successPdfDownloaded: {
    en: 'PDF generated and downloaded successfully',
    tr: 'PDF oluşturuldu ve indirildi'
  },
  errorPdfDownloadBrowser: {
    en: 'PDF could not be downloaded. Please check your browser settings or try a different browser.',
    tr: 'PDF indirilemedi. Tarayıcı ayarlarınızı kontrol edin veya başka bir tarayıcı deneyin.'
  },
  errorPdfCouldNotGenerate: {
    en: 'PDF could not be generated',
    tr: 'PDF oluşturulamadı'
  },
  errorPdfImagesLoad: {
    en: 'Images could not be loaded. Please check your internet connection.',
    tr: 'Görseller yüklenemedi. İnternet bağlantınızı kontrol edin.'
  },
  errorPdfEmbed: {
    en: 'PDF image embedding error. Image format may not be supported.',
    tr: 'PDF görsel gömme hatası. Görsel biçimi desteklenmiyor olabilir.'
  },
  errorPdfMemory: {
    en: 'Insufficient memory. Try with fewer cards.',
    tr: 'Yetersiz bellek. Daha az kartla deneyin.'
  },
  errorPdfWithDetail: {
    en: 'PDF error: {detail}',
    tr: 'PDF hatası: {detail}'
  },
  successAddedToDeck: {
    en: 'Added {count}x {name} to deck',
    tr: 'Deck’e {count}x {name} eklendi'
  },
  successCardRemovedFromDeck: {
    en: 'Card removed from deck',
    tr: 'Kart deck’ten kaldırıldı'
  },
  errorArtAlreadyApplied: {
    en: 'This art is already applied',
    tr: 'Bu illüstrasyon zaten uygulanmış'
  },
  successArtChangeAll: {
    en: 'All {id} cards changed to {label} art',
    tr: 'Tüm {id} kartları {label} illüstrasyonuna geçirildi'
  },
  successArtChangeOne: {
    en: '1x card changed to {label} art',
    tr: '1 adet kart {label} illüstrasyonuna geçirildi'
  },
  cardSearchTitle: {
    en: 'Card Search',
    tr: 'Kart arama'
  },
  preloadSearchLoading: {
    en: 'Loading cards...',
    tr: 'Kartlar yükleniyor…'
  },
  searchPlaceholder: {
    en: 'Search by name or card ID (e.g. OP13-046)...',
    tr: 'İsim veya kart ID ile arayın (ör. OP13-046)...'
  },
  clearSearchTitle: {
    en: 'Clear search',
    tr: 'Aramayı temizle'
  },
  inDeckShort: {
    en: '{count}x in deck',
    tr: 'Deck’te {count}x'
  },
  quickAddTitle: {
    en: 'Quick add 1x',
    tr: 'Hızlı 1x ekle'
  },
  addToDeckBtn: {
    en: 'Add to Deck',
    tr: 'Deck’e ekle'
  },
  alreadyInDeckNote: {
    en: 'Already {count}x in deck',
    tr: 'Deck’te zaten {count}x var'
  },
  resultsFound: {
    en: '{count} cards found',
    tr: '{count} kart bulundu'
  },
  costInline: {
    en: 'Cost',
    tr: 'Maliyet'
  }
};

export function proxyText(lang: Language, key: string): string {
  const entry = translations[key];
  if (!entry) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn(`Translation missing for key: ${key}`);
    }
    return key;
  }
  return entry[lang] || entry.en || key;
}

export function proxyTextParams(
  lang: Language,
  key: string,
  params: Record<string, string | number>
): string {
  let text = proxyText(lang, key);
  for (const [paramKey, paramValue] of Object.entries(params)) {
    const re = new RegExp(`\\{${paramKey}\\}`, 'g');
    text = text.replace(re, String(paramValue));
  }
  return text;
}

export class TranslationService {
  private currentLanguage: Language = 'en';

  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
  }

  getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  t(key: string): string {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    
    return translation[this.currentLanguage] || translation['en'] || key;
  }

  // Parametreli çeviri
  tParams(key: string, params: Record<string, string | number>): string {
    let text = this.t(key);
    
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(`{${paramKey}}`, String(paramValue));
    }
    
    return text;
  }

  // Çoğul forma çeviri
  tPlural(key: string, count: number): string {
    const singularKey = key;
    const pluralKey = `${key}_plural`;
    
    if (count === 1) {
      return this.t(singularKey);
    } else {
      const pluralTranslation = translations[pluralKey];
      if (pluralTranslation) {
        return pluralTranslation[this.currentLanguage] || pluralTranslation['en'] || this.t(singularKey);
      }
      return this.t(singularKey);
    }
  }

  // Mevcut tüm çevirileri döndür
  getAllTranslations(): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, translation] of Object.entries(translations)) {
      result[key] = translation[this.currentLanguage] || translation['en'] || key;
    }
    
    return result;
  }
}

// Singleton instance
export const translationService = new TranslationService();
