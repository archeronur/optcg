import { Language, Translations } from '@/types';

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
  }
};

export class TranslationService {
  private currentLanguage: Language = 'tr';

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
