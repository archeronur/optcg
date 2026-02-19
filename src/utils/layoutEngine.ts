import { PrintSettings, LayoutDimensions, DeckCard } from '@/types';

export class LayoutEngine {
  // A4 boyutları (mm)
  private static readonly A4_WIDTH = 210;
  private static readonly A4_HEIGHT = 297;
  
  // Standard TCG kart boyutları (mm) - Lorcana MTG ile aynı standart
  private static readonly CARD_WIDTH = 63;
  private static readonly CARD_HEIGHT = 88;

  // Grid seçenekleri
  private static readonly GRID_OPTIONS = {
    '3x3': { cols: 3, rows: 3 },
    '3x4': { cols: 3, rows: 4 },
    '4x3': { cols: 4, rows: 3 }
  };

  static calculateLayout(settings: PrintSettings): LayoutDimensions {
    const { grid, safeMargin, bleedSize } = settings;
    const gridConfig = this.GRID_OPTIONS[grid];
    
    // Güvenlik payı ve bleed hesaplaması
    const effectiveWidth = this.A4_WIDTH - (safeMargin * 2);
    const effectiveHeight = this.A4_HEIGHT - (safeMargin * 2);
    
    // Kart boyutları (bleed dahil)
    const cardWidthWithBleed = this.CARD_WIDTH + (settings.includeBleed ? bleedSize * 2 : 0);
    const cardHeightWithBleed = this.CARD_HEIGHT + (settings.includeBleed ? bleedSize * 2 : 0);
    
    // Toplam kart alanı
    const totalCardWidth = cardWidthWithBleed * gridConfig.cols;
    const totalCardHeight = cardHeightWithBleed * gridConfig.rows;
    
    // Gutter (kartlar arası boşluk) hesaplama
    const availableGutterX = effectiveWidth - totalCardWidth;
    const availableGutterY = effectiveHeight - totalCardHeight;
    
    const gutterX = Math.max(0, availableGutterX / (gridConfig.cols + 1));
    const gutterY = Math.max(0, availableGutterY / (gridConfig.rows + 1));
    
    // Marj hesaplama (ortalama için)
    const marginX = safeMargin + gutterX;
    const marginY = safeMargin + gutterY;

    return {
      pageWidth: this.A4_WIDTH,
      pageHeight: this.A4_HEIGHT,
      cardWidth: this.CARD_WIDTH,
      cardHeight: this.CARD_HEIGHT,
      cols: gridConfig.cols,
      rows: gridConfig.rows,
      gutterX,
      gutterY,
      marginX,
      marginY
    };
  }

  // Kartları sayfalara böl
  static distributeCards(cards: DeckCard[], settings: PrintSettings): DeckCard[][] {
    const layout = this.calculateLayout(settings);
    const cardsPerPage = layout.cols * layout.rows;
    const pages: DeckCard[][] = [];
    
    // Kartları adetlerine göre çoğalt
    const expandedCards: DeckCard[] = [];
    for (const deckCard of cards) {
      for (let i = 0; i < deckCard.count; i++) {
        expandedCards.push({ ...deckCard, count: 1 });
      }
    }

    // Sayfalara böl
    for (let i = 0; i < expandedCards.length; i += cardsPerPage) {
      const pageCards = expandedCards.slice(i, i + cardsPerPage);
      pages.push(pageCards);
    }

    return pages;
  }

  // Kart pozisyonlarını hesapla
  static calculateCardPositions(layout: LayoutDimensions, settings: PrintSettings): Array<{x: number, y: number, width: number, height: number}> {
    const positions = [];
    const { cols, rows, marginX, marginY, gutterX, gutterY, cardWidth, cardHeight } = layout;
    
    const cardWidthWithBleed = cardWidth + (settings.includeBleed ? settings.bleedSize * 2 : 0);
    const cardHeightWithBleed = cardHeight + (settings.includeBleed ? settings.bleedSize * 2 : 0);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = marginX + (col * (cardWidthWithBleed + gutterX));
        const y = marginY + (row * (cardHeightWithBleed + gutterY));
        
        positions.push({
          x,
          y,
          width: cardWidth,
          height: cardHeight
        });
      }
    }

    return positions;
  }

  // MM'yi pixel'e çevir (300 DPI için)
  static mmToPixels(mm: number, dpi: number = 300): number {
    return Math.round((mm * dpi) / 25.4);
  }

  // Pixel'i MM'ye çevir
  static pixelsToMm(pixels: number, dpi: number = 300): number {
    return (pixels * 25.4) / dpi;
  }

  // Layout validasyonu
  static validateLayout(layout: LayoutDimensions, settings: PrintSettings): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Kart boyutları kontrolü
    const totalCardWidth = (layout.cardWidth * layout.cols) + (layout.gutterX * (layout.cols - 1));
    const totalCardHeight = (layout.cardHeight * layout.rows) + (layout.gutterY * (layout.rows - 1));
    
    const availableWidth = layout.pageWidth - (settings.safeMargin * 2);
    const availableHeight = layout.pageHeight - (settings.safeMargin * 2);

    if (totalCardWidth > availableWidth) {
      errors.push(`Kartlar sayfa genişliğine sığmıyor: ${totalCardWidth.toFixed(1)}mm > ${availableWidth.toFixed(1)}mm`);
    }

    if (totalCardHeight > availableHeight) {
      errors.push(`Kartlar sayfa yüksekliğine sığmıyor: ${totalCardHeight.toFixed(1)}mm > ${availableHeight.toFixed(1)}mm`);
    }

    // Gutter kontrolleri
    if (layout.gutterX < 1) {
      warnings.push('Yatay boşluk çok az, kartlar birbirine yakın olabilir');
    }

    if (layout.gutterY < 1) {
      warnings.push('Dikey boşluk çok az, kartlar birbirine yakın olabilir');
    }

    // Bleed kontrolleri
    if (settings.includeBleed && settings.bleedSize < 2) {
      warnings.push('Bleed boyutu çok küçük, baskı için minimum 3mm önerilir');
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  // Kesim işaretleri pozisyonları
  static getCropMarks(layout: LayoutDimensions, settings: PrintSettings): Array<{
    type: 'horizontal' | 'vertical';
    x1: number; y1: number;
    x2: number; y2: number;
  }> {
    if (!settings.includeCropMarks) return [];

    const marks = [];
    const positions = this.calculateCardPositions(layout, settings);
    const markLength = 5; // mm
    const markOffset = 2; // mm

    for (const pos of positions) {
      // Sol üst
      marks.push({
        type: 'horizontal' as const,
        x1: pos.x - markOffset - markLength,
        y1: pos.y,
        x2: pos.x - markOffset,
        y2: pos.y
      });
      marks.push({
        type: 'vertical' as const,
        x1: pos.x,
        y1: pos.y - markOffset - markLength,
        x2: pos.x,
        y2: pos.y - markOffset
      });

      // Sağ üst
      marks.push({
        type: 'horizontal' as const,
        x1: pos.x + pos.width + markOffset,
        y1: pos.y,
        x2: pos.x + pos.width + markOffset + markLength,
        y2: pos.y
      });
      marks.push({
        type: 'vertical' as const,
        x1: pos.x + pos.width,
        y1: pos.y - markOffset - markLength,
        x2: pos.x + pos.width,
        y2: pos.y - markOffset
      });

      // Sol alt
      marks.push({
        type: 'horizontal' as const,
        x1: pos.x - markOffset - markLength,
        y1: pos.y + pos.height,
        x2: pos.x - markOffset,
        y2: pos.y + pos.height
      });
      marks.push({
        type: 'vertical' as const,
        x1: pos.x,
        y1: pos.y + pos.height + markOffset,
        x2: pos.x,
        y2: pos.y + pos.height + markOffset + markLength
      });

      // Sağ alt
      marks.push({
        type: 'horizontal' as const,
        x1: pos.x + pos.width + markOffset,
        y1: pos.y + pos.height,
        x2: pos.x + pos.width + markOffset + markLength,
        y2: pos.y + pos.height
      });
      marks.push({
        type: 'vertical' as const,
        x1: pos.x + pos.width,
        y1: pos.y + pos.height + markOffset,
        x2: pos.x + pos.width,
        y2: pos.y + pos.height + markOffset + markLength
      });
    }

    return marks;
  }

  // Baskı optimizasyonu önerileri
  static getOptimizationSuggestions(cards: DeckCard[], settings: PrintSettings): string[] {
    const suggestions: string[] = [];
    const layout = this.calculateLayout(settings);
    const pages = this.distributeCards(cards, settings);
    
    const totalCards = cards.reduce((sum, card) => sum + card.count, 0);
    const cardsPerPage = layout.cols * layout.rows;
    const efficiency = (totalCards % cardsPerPage) / cardsPerPage;

    // Sayfa verimliliği
    if (efficiency < 0.5 && pages.length > 1) {
      suggestions.push('Son sayfa yarıdan az dolu. Daha verimli grid düzeni düşünün.');
    }

    // Grid önerileri
    if (settings.grid === '3x3' && totalCards > 27) {
      suggestions.push('Çok sayıda kart için 3x4 veya 4x3 grid daha verimli olabilir.');
    }

    // Bleed önerileri
    if (!settings.includeBleed) {
      suggestions.push('Profesyonel baskı için 3mm bleed eklemeyi düşünün.');
    }

    // Kart arkası önerileri
    if (!settings.includeBackPages && totalCards > 9) {
      suggestions.push('Kart arkası sayfaları ekleyerek çift taraflı baskı yapabilirsiniz.');
    }

    return suggestions;
  }

  // Layout istatistikleri
  static getLayoutStats(cards: DeckCard[], settings: PrintSettings): {
    totalCards: number;
    totalPages: number;
    cardsPerPage: number;
    lastPageUtilization: number;
    estimatedPrintTime: string;
    paperEfficiency: number;
  } {
    const layout = this.calculateLayout(settings);
    const pages = this.distributeCards(cards, settings);
    
    const totalCards = cards.reduce((sum, card) => sum + card.count, 0);
    const cardsPerPage = layout.cols * layout.rows;
    const lastPageCards = pages[pages.length - 1]?.length || 0;
    const lastPageUtilization = lastPageCards / cardsPerPage;
    
    // Tahmini baskı süresi (sayfa başına 30 saniye)
    const estimatedMinutes = Math.ceil((pages.length * 30) / 60);
    const estimatedPrintTime = estimatedMinutes < 60 
      ? `${estimatedMinutes} dakika` 
      : `${Math.floor(estimatedMinutes / 60)} saat ${estimatedMinutes % 60} dakika`;

    // Kağıt verimliliği
    const paperEfficiency = totalCards / (pages.length * cardsPerPage);

    return {
      totalCards,
      totalPages: pages.length,
      cardsPerPage,
      lastPageUtilization,
      estimatedPrintTime,
      paperEfficiency
    };
  }
}
