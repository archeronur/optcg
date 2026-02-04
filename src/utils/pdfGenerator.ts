import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import { DeckCard, PrintSettings } from '@/types';

export class PDFGenerator {
  private pdfDoc: PDFDocument;
  private settings: PrintSettings;
  private imageCache: Map<string, Uint8Array> = new Map();
  private preloadQueue: Set<string> = new Set();
  private failedImages: Set<string> = new Set();
  private retryCount: Map<string, number> = new Map();
  private maxRetries = 3;
  private abortSignal?: AbortSignal;
  private cardBackBytes: Uint8Array | null = null;

  private static readonly CARD_WIDTH_MM = 63.5;
  private static readonly CARD_HEIGHT_MM = 88.9;
  private static readonly A4_WIDTH_MM = 210;
  private static readonly A4_HEIGHT_MM = 297;
  private static readonly MM_TO_POINTS = 2.834645669291339;
  private static readonly CARD_BACK_URL = '/images/card-back.jpg';

  private static getGridDimensions(grid: string) {
    switch (grid) {
      case '3x4': return { cols: 3, rows: 4, cardsPerPage: 12 };
      case '4x3': return { cols: 4, rows: 3, cardsPerPage: 12 };
      default: return { cols: 3, rows: 3, cardsPerPage: 9 };
    }
  }

  constructor(settings: PrintSettings, abortSignal?: AbortSignal) {
    this.settings = settings;
    this.pdfDoc = null as any;
    this.abortSignal = abortSignal;
    this.failedImages.clear();
    this.imageCache.clear();
    this.preloadQueue.clear();
    this.retryCount.clear();
  }

  async preloadImages(cards: DeckCard[], progressCallback?: (current: number, total: number, message: string) => void): Promise<void> {
    // Abort signal kontrolü
    if (this.abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }
    
    const imageUrls = new Set<string>();
    for (const card of cards) {
      const imageUrl = card.card.image_uris.full || card.card.image_uris.large || card.card.image_uris.small;
      if (imageUrl && !this.imageCache.has(imageUrl) && !this.preloadQueue.has(imageUrl) && !this.failedImages.has(imageUrl)) {
        imageUrls.add(imageUrl);
      }
    }
    
    if (imageUrls.size === 0) {
      progressCallback?.(0, 0, 'Tüm görseller zaten yüklü');
      return;
    }
    
    // Batch yükleme - her seferinde 10 görsel paralel yükle (daha hızlı)
    const imageUrlsArray = Array.from(imageUrls);
    const batchSize = 10;
    let loadedCount = 0;
    
    for (let i = 0; i < imageUrlsArray.length; i += batchSize) {
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      const batch = imageUrlsArray.slice(i, i + batchSize);
      
      // Batch içindeki görselleri paralel yükle
      const batchPromises = batch.map(async (imageUrl) => {
        try {
          if (this.abortSignal?.aborted) {
            throw new Error('Operation aborted');
          }
          
          this.preloadQueue.add(imageUrl);
          
          const imageData = await this.getCardImageBytes(imageUrl);
          
          if (imageData && imageData.length > 1000) {
            this.imageCache.set(imageUrl, imageData);
            loadedCount++;
            progressCallback?.(loadedCount, imageUrls.size, `Görsel yüklendi: ${loadedCount}/${imageUrls.size}`);
            return true;
          } else {
            throw new Error('Invalid image data');
          }
        } catch (error: any) {
          if (error.message === 'Operation aborted') {
            throw error;
          }
          console.error(`Failed to preload image:`, imageUrl, error);
          this.failedImages.add(imageUrl);
          loadedCount++;
          progressCallback?.(loadedCount, imageUrls.size, `Görsel yüklenemedi: ${loadedCount}/${imageUrls.size}`);
          return false;
        } finally {
          this.preloadQueue.delete(imageUrl);
        }
      });
      
      // Batch'i bekle
      await Promise.allSettled(batchPromises);
    }
    
    console.log(`Preloading completed. Success: ${this.imageCache.size}, Failed: ${this.failedImages.size}`);
  }

  async generatePDF(cards: DeckCard[], progressCallback?: (current: number, total: number, message: string) => void): Promise<Uint8Array> {
    try {
      console.log('=== PDFGenerator.generatePDF() STARTED ===');
      console.log('Cards received:', cards);
      console.log('Settings:', this.settings);
      console.log('Generating PDF for', cards.length, 'card types');
      
      // Abort signal kontrolü
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      // Cache'leri temizle (sadece failed images ve queue, imageCache'i koru - daha hızlı)
      this.failedImages.clear();
      this.preloadQueue.clear();
      // imageCache'i temizleme - önceki yüklemelerden kalan görselleri kullanabiliriz

      // Görselleri önceden yükle
      console.log('Starting image preloading...');
      progressCallback?.(0, cards.length, 'Görseller yükleniyor - Loading images...');
      await this.preloadImages(cards, (current, total, msg) => {
        progressCallback?.(current, total, `Görsel yükleniyor ${current}/${total} - Loading image`);
      });
      console.log('Image preloading completed');
      
      // Abort signal kontrolü
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      // Başarısız görsel sayısını logla
      const failedCount = this.failedImages.size;
      const totalImages = cards.length;
      if (failedCount > 0) {
        console.warn(`${failedCount}/${totalImages} görsel yüklenemedi, placeholder kullanılacak`);
        progressCallback?.(totalImages, totalImages, `${failedCount} görsel yüklenemedi, placeholder kullanılıyor...`);
      }

      // PDF dokümanı oluştur
      console.log('Creating PDFDocument...');
      progressCallback?.(cards.length, cards.length, 'PDF oluşturuluyor - Creating PDF...');
      this.pdfDoc = await PDFDocument.create();
      console.log('PDFDocument created successfully');

      const gridDims = { cols: 3, rows: 3, cardsPerPage: 9 };
      console.log('Grid settings (forced 3x3):', gridDims);

      // Kartları adetleriyle çoğalt
      const expandedCards: DeckCard[] = [];
      for (const deckCard of cards) {
        for (let i = 0; i < deckCard.count; i++) {
          expandedCards.push({ ...deckCard, count: 1 });
        }
      }

      console.log('Total cards to print:', expandedCards.length);

      // Kartları sayfalara böl
      const pages: DeckCard[][] = [];
      for (let i = 0; i < expandedCards.length; i += gridDims.cardsPerPage) {
        const pageCards = expandedCards.slice(i, i + gridDims.cardsPerPage);
        pages.push(pageCards);
      }

      console.log('Total pages needed:', pages.length);

      // Her sayfa için PDF sayfası oluştur (ön yüz)
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        // Her sayfa başlangıcında abort signal kontrolü
        if (this.abortSignal?.aborted) {
          throw new Error('Operation aborted');
        }
        
        const pageCards = pages[pageIndex];
        console.log(`Creating page ${pageIndex + 1} with ${pageCards.length} cards`);
        
        // Her sayfa başlangıcında progress güncelle
        const totalSteps = cards.length + pages.length;
        progressCallback?.(
          cards.length + pageIndex, 
          totalSteps, 
          `Sayfa ${pageIndex + 1}/${pages.length} oluşturuluyor - Creating page ${pageIndex + 1}`
        );
        
        try {
          await this.createPage(pageCards, pageIndex, progressCallback, totalSteps);
          
          // Sayfa tamamlandığında progress güncelle
          progressCallback?.(
            cards.length + pageIndex + 1, 
            totalSteps, 
            `Sayfa ${pageIndex + 1} tamamlandı - Page ${pageIndex + 1} completed`
          );
          
        } catch (pageError: any) {
          if (pageError.message === 'Operation aborted') {
            throw pageError;
          }
          
          console.error(`Error creating page ${pageIndex + 1}:`, pageError);
          
          // Hata detaylarını logla
          if (pageError instanceof Error) {
            console.error('Page error details:', pageError.message, pageError.stack);
          }
          
          try {
            // Sayfa oluşturulamazsa placeholder sayfa ekle
            await this.createPlaceholderPage(pageIndex, pageCards.length);
            console.log(`Placeholder page ${pageIndex + 1} created successfully`);
          } catch (placeholderError) {
            console.error(`Failed to create placeholder page ${pageIndex + 1}:`, placeholderError);
            // Placeholder da başarısız olursa boş sayfa ekle
            const pageWidthPt = PDFGenerator.A4_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
            const pageHeightPt = PDFGenerator.A4_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;
            this.pdfDoc.addPage([pageWidthPt, pageHeightPt]);
          }
        }
      }

      // Arka sayfaları ekle (istenirse)
      if (this.settings.includeBackPages) {
        console.log('Including back pages...');
        // Kart arkası görselini bir kez yükle
        try {
          this.cardBackBytes = await this.getCardBackImageBytes();
        } catch (backErr) {
          console.error('Failed to load card back image, skipping back pages:', backErr);
          this.cardBackBytes = null;
        }

        if (this.cardBackBytes) {
          for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            if (this.abortSignal?.aborted) {
              throw new Error('Operation aborted');
            }

            const pageCards = pages[pageIndex];
            try {
              await this.createBackPage(pageCards.length, pageIndex, progressCallback, cards.length + pages.length);
            } catch (backPageErr) {
              console.error(`Error creating back page for page ${pageIndex + 1}:`, backPageErr);
              // Arka sayfa başarısız olursa yine de boş bir sayfa ekleyelim ki sayfa sayısı eşleşsin
              const pageWidthPt = PDFGenerator.A4_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
              const pageHeightPt = PDFGenerator.A4_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;
              this.pdfDoc.addPage([pageWidthPt, pageHeightPt]);
            }
          }
        }
      }

      console.log('PDF generation complete, saving...');
      progressCallback?.(cards.length + pages.length, cards.length + pages.length, 'PDF kaydediliyor - Finalizing PDF...');
      
      // Final abort signal kontrolü
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      try {
        const pdfBytes = await this.pdfDoc.save();
        console.log('PDF saved successfully, byte length:', pdfBytes.length);
        
        if (pdfBytes.length < 1000) {
          throw new Error('Generated PDF is too small, likely corrupted');
        }
        
        return pdfBytes;
      } catch (saveError: any) {
        console.error('PDF save error:', saveError);
        throw new Error(`PDF kaydedilemedi: ${saveError.message || 'Bilinmeyen hata'}`);
      }
      
    } catch (error: any) {
      console.error('Error in PDFGenerator.generatePDF():', error);
      
      // Abort error'ı özel olarak işle
      if (error.message === 'Operation aborted') {
        throw error;
      }
      
      // Daha açıklayıcı hata mesajları
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new Error('Görseller yüklenemedi. İnternet bağlantınızı kontrol edin.');
      } else if (error.message.includes('memory') || error.message.includes('allocation')) {
        throw new Error('Bellek yetersiz. Daha az kart ile deneyin.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Görsel yükleme zaman aşımı. Lütfen tekrar deneyin.');
      } else {
        throw new Error(`PDF oluşturulamadı: ${error.message}`);
      }
    }
  }

  private async createPage(
    cards: DeckCard[], 
    pageIndex: number, 
    progressCallback?: (current: number, total: number, message: string) => void,
    totalProgress?: number
  ): Promise<void> {
    // Grid'i her zaman 3x3'e sabitle
    const gridDims = { cols: 3, rows: 3, cardsPerPage: 9 };
    
    // A4 sayfa oluştur
    const pageWidthPt = PDFGenerator.A4_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
    const pageHeightPt = PDFGenerator.A4_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;
    
    const page = this.pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    
    // Kart boyutları (points cinsinden)
    const cardWidthPt = PDFGenerator.CARD_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
    const cardHeightPt = PDFGenerator.CARD_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;
    
    // Bleed ve margin hesaplama
    const bleedPt = this.settings.includeBleed ? this.settings.bleedSize * PDFGenerator.MM_TO_POINTS : 0;
    const safeMarginPt = this.settings.safeMargin * PDFGenerator.MM_TO_POINTS;
    const cropMarkLengthPt = (this.settings.cropMarkLengthMm ?? 5) * PDFGenerator.MM_TO_POINTS;
    const cropMarkOffsetPt = (this.settings.cropMarkOffsetMm ?? 1.5) * PDFGenerator.MM_TO_POINTS;
    const internalGapPt = this.settings.includeCropMarks ? (cropMarkOffsetPt * 2) : 0;
    
    const cardWithBleedWidth = cardWidthPt + (bleedPt * 2);
    const cardWithBleedHeight = cardHeightPt + (bleedPt * 2);
    
    // Boşlukları hesapla (kartlar arası minimal pay)
    const totalCardsWidth = (cardWithBleedWidth * gridDims.cols) + (internalGapPt * (gridDims.cols - 1));
    const totalCardsHeight = (cardWithBleedHeight * gridDims.rows) + (internalGapPt * (gridDims.rows - 1));
    
    const availableWidth = pageWidthPt - (safeMarginPt * 2);
    const availableHeight = pageHeightPt - (safeMarginPt * 2);
    
    let marginX = safeMarginPt;
    let marginY = safeMarginPt;
    
    // Eğer kartlar sayfaya sığıyorsa ortala
    if (totalCardsWidth <= availableWidth) {
      marginX = (pageWidthPt - totalCardsWidth) / 2;
    }
    if (totalCardsHeight <= availableHeight) {
      marginY = (pageHeightPt - totalCardsHeight) / 2;
    }
    // Güvenlik payı altına düşmeyi önle
    marginX = Math.max(marginX, safeMarginPt);
    marginY = Math.max(marginY, safeMarginPt);

    // Her kart için görsel ekle
    for (let i = 0; i < cards.length && i < gridDims.cardsPerPage; i++) {
      const card = cards[i];
      
      // Grid pozisyonu
      const col = i % gridDims.cols;
      const row = Math.floor(i / gridDims.cols);
      
      // Kart pozisyonu (sol alt köşeden başlayarak)
      const x = marginX + (col * (cardWithBleedWidth + internalGapPt)) + bleedPt;
      const y = pageHeightPt - marginY - ((row + 1) * cardWithBleedHeight) - (row * internalGapPt) + bleedPt;
      
      await this.drawCard(page, card, x, y, cardWidthPt, cardHeightPt);
      
      // Bleed alanı çiz (eğer aktifse)
      if (this.settings.includeBleed) {
        this.drawBleedArea(page, x - bleedPt, y - bleedPt, cardWithBleedWidth, cardWithBleedHeight);
      }
      
      // Crop marks çiz (eğer aktifse)
      if (this.settings.includeCropMarks) {
        this.drawCropMarks(page, x, y, cardWidthPt, cardHeightPt);
      }
      
      // Her 5 kartta bir progress güncelle
      if (totalProgress && progressCallback && (i + 1) % 5 === 0) {
        const currentProgress = totalProgress - (cards.length - i - 1);
        progressCallback?.(
          currentProgress, 
          totalProgress, 
          `Sayfa ${pageIndex + 1}: ${i + 1}/${cards.length} kart işlendi`
        );
      }
    }

    // Sayfa numarası ekle
    this.drawPageNumber(page, pageIndex + 1, pageWidthPt, pageHeightPt);
  }

  // Arka sayfa oluştur (kart arkası görselleri)
  private async createBackPage(
    cardCount: number,
    pageIndex: number,
    progressCallback?: (current: number, total: number, message: string) => void,
    totalProgress?: number
  ): Promise<void> {
    // 3x3 sabit grid
    const gridDims = { cols: 3, rows: 3, cardsPerPage: 9 };

    const pageWidthPt = PDFGenerator.A4_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
    const pageHeightPt = PDFGenerator.A4_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;

    const page = this.pdfDoc.addPage([pageWidthPt, pageHeightPt]);

    const cardWidthPt = PDFGenerator.CARD_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
    const cardHeightPt = PDFGenerator.CARD_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;

    const bleedPt = this.settings.includeBleed ? this.settings.bleedSize * PDFGenerator.MM_TO_POINTS : 0;
    const safeMarginPt = this.settings.safeMargin * PDFGenerator.MM_TO_POINTS;
    const cropMarkLengthPt = (this.settings.cropMarkLengthMm ?? 5) * PDFGenerator.MM_TO_POINTS;
    const cropMarkOffsetPt = (this.settings.cropMarkOffsetMm ?? 1.5) * PDFGenerator.MM_TO_POINTS;
    const internalGapPt = this.settings.includeCropMarks ? (cropMarkOffsetPt * 2) : 0;

    const cardWithBleedWidth = cardWidthPt + (bleedPt * 2);
    const cardWithBleedHeight = cardHeightPt + (bleedPt * 2);

    const totalCardsWidth = (cardWithBleedWidth * gridDims.cols) + (internalGapPt * (gridDims.cols - 1));
    const totalCardsHeight = (cardWithBleedHeight * gridDims.rows) + (internalGapPt * (gridDims.rows - 1));

    const availableWidth = pageWidthPt - (safeMarginPt * 2);
    const availableHeight = pageHeightPt - (safeMarginPt * 2);

    let marginX = safeMarginPt;
    let marginY = safeMarginPt;

    if (totalCardsWidth <= availableWidth) {
      marginX = (pageWidthPt - totalCardsWidth) / 2;
    }
    if (totalCardsHeight <= availableHeight) {
      marginY = (pageHeightPt - totalCardsHeight) / 2;
    }
    // Güvenlik payı altına düşmeyi önle
    marginX = Math.max(marginX, safeMarginPt);
    marginY = Math.max(marginY, safeMarginPt);

    // Kart arkası görselini embed et
    if (!this.cardBackBytes) return;
    const backImg = await this.pdfDoc.embedJpg(this.cardBackBytes);

    // Çift taraflı baskıda doğru hizalama için yatay ayna gerekebilir; burada düz yerleştiriyoruz
    for (let i = 0; i < cardCount && i < gridDims.cardsPerPage; i++) {
      const col = i % gridDims.cols;
      const row = Math.floor(i / gridDims.cols);

      const x = marginX + (col * (cardWithBleedWidth + internalGapPt)) + bleedPt;
      const y = pageHeightPt - marginY - ((row + 1) * cardWithBleedHeight) - (row * internalGapPt) + bleedPt;

      // Aynalama (gerekiyorsa) - yatay ayna için ölçek -1 ve offset uygula
      if (this.settings.backMirrorHorizontally) {
        page.drawImage(backImg, {
          x: pageWidthPt - x - cardWidthPt,
          y,
          width: cardWidthPt,
          height: cardHeightPt
        });
      } else {
        page.drawImage(backImg, { x, y, width: cardWidthPt, height: cardHeightPt });
      }

      if (this.settings.includeBleed) {
        this.drawBleedArea(page, x - bleedPt, y - bleedPt, cardWithBleedWidth, cardWithBleedHeight);
      }
      if (this.settings.includeCropMarks) {
        this.drawCropMarks(page, x, y, cardWidthPt, cardHeightPt);
      }
    }

    this.drawPageNumber(page, pageIndex + 1, pageWidthPt, pageHeightPt);
  }

  private async getCardBackImageBytes(): Promise<Uint8Array> {
    // Public klasöründen kart arkası görselini al
    try {
      const response = await fetch(PDFGenerator.CARD_BACK_URL, { cache: 'no-store' as any });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      if (bytes.length < 1000) throw new Error('Card back image too small');
      return bytes;
    } catch (e) {
      throw e as any;
    }
  }

  private async createPlaceholderPage(pageIndex: number, cardCount: number): Promise<void> {
    try {
      // Grid'i her zaman 3x3'e sabitle
      const gridDims = { cols: 3, rows: 3, cardsPerPage: 9 };
      const pageWidthPt = PDFGenerator.A4_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
      const pageHeightPt = PDFGenerator.A4_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;

      const page = this.pdfDoc.addPage([pageWidthPt, pageHeightPt]);

      const cardWidthPt = PDFGenerator.CARD_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
      const cardHeightPt = PDFGenerator.CARD_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;

      const bleedPt = this.settings.includeBleed ? this.settings.bleedSize * PDFGenerator.MM_TO_POINTS : 0;
      const safeMarginPt = this.settings.safeMargin * PDFGenerator.MM_TO_POINTS;
      const cropMarkLengthPt = (this.settings.cropMarkLengthMm ?? 5) * PDFGenerator.MM_TO_POINTS;
      const cropMarkOffsetPt = (this.settings.cropMarkOffsetMm ?? 1.5) * PDFGenerator.MM_TO_POINTS;
      const internalGapPt = this.settings.includeCropMarks ? ((cropMarkOffsetPt + cropMarkLengthPt) * 2) : 0;

      const cardWithBleedWidth = cardWidthPt + (bleedPt * 2);
      const cardWithBleedHeight = cardHeightPt + (bleedPt * 2);

      const totalCardsWidth = (cardWithBleedWidth * gridDims.cols) + (internalGapPt * (gridDims.cols - 1));
      const totalCardsHeight = (cardWithBleedHeight * gridDims.rows) + (internalGapPt * (gridDims.rows - 1));

      const availableWidth = pageWidthPt - (safeMarginPt * 2);
      const availableHeight = pageHeightPt - (safeMarginPt * 2);

      let marginX = safeMarginPt;
      let marginY = safeMarginPt;

      if (totalCardsWidth <= availableWidth) {
        marginX = (pageWidthPt - totalCardsWidth) / 2;
      }
      if (totalCardsHeight <= availableHeight) {
        marginY = (pageHeightPt - totalCardsHeight) / 2;
      }
      // Güvenlik payı altına düşmeyi önle
      marginX = Math.max(marginX, safeMarginPt);
      marginY = Math.max(marginY, safeMarginPt);

      // Sayfa başlığı ekle
      page.drawText(`Sayfa ${pageIndex + 1} - Görsel Yüklenemedi`, {
        x: pageWidthPt / 2 - 100,
        y: pageHeightPt - 30,
        size: 14,
        color: rgb(0.6, 0.3, 0.3)
      });

      for (let i = 0; i < cardCount; i++) {
        const col = i % gridDims.cols;
        const row = Math.floor(i / gridDims.cols);
        const x = marginX + (col * (cardWithBleedWidth + internalGapPt)) + bleedPt;
        const y = pageHeightPt - marginY - ((row + 1) * cardWithBleedHeight) - (row * internalGapPt) + bleedPt;
        this.drawCardPlaceholder(page, x, y, cardWidthPt, cardHeightPt, `Kart ${i + 1}`);
        
        // Crop marks ekle (eğer aktifse)
        if (this.settings.includeCropMarks) {
          this.drawCropMarks(page, x, y, cardWidthPt, cardHeightPt);
        }
      }
      
      this.drawPageNumber(page, pageIndex + 1, pageWidthPt, pageHeightPt);
      
    } catch (error) {
      console.error('Error in createPlaceholderPage:', error);
      throw error;
    }
  }

  private async drawCard(page: PDFPage, card: DeckCard, x: number, y: number, width: number, height: number): Promise<void> {
    try {
      // Kart görselini yükle - tüm URL seçeneklerini dene
      let imageUrl = card.card.image_uris.full || card.card.image_uris.large || card.card.image_uris.small;
      
      if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
        console.warn(`No image URL for card: ${card.card.name}`);
        this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
        return;
      }

      // URL'yi temizle ve doğrula
      imageUrl = imageUrl.trim();
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        console.warn(`Invalid image URL format: ${imageUrl}`);
        this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
        return;
      }

      // Cache'den kontrol et - öncelikle cache kullan
      if (this.imageCache.has(imageUrl)) {
        const cachedImageData = this.imageCache.get(imageUrl)!;
        
        // Cache'deki veriyi doğrula
        if (cachedImageData && cachedImageData.length > 1000) {
          try {
            await this.embedBinaryImage(page, cachedImageData, imageUrl, x, y, width, height);
            return; // Başarılı, çık
          } catch (embedError) {
            console.error(`Failed to embed cached image for ${card.card.name}:`, embedError);
            // Cache'deki veri hatalı, sil ve yeniden yükle
            this.imageCache.delete(imageUrl);
          }
        } else {
          // Cache'deki veri geçersiz, sil
          this.imageCache.delete(imageUrl);
        }
      }
      
      // Başarısız görselleri tekrar deneme (sadece bir kez)
      if (this.failedImages.has(imageUrl)) {
        console.warn(`Skipping previously failed image: ${imageUrl.substring(0, 50)}...`);
        this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
        return;
      }
      
      // Yeni görsel yükle - tüm yöntemleri dene
      let imageData: Uint8Array | null = null;
      let lastError: Error | null = null;
      
      try {
        imageData = await this.getCardImageBytes(imageUrl);
      } catch (error: any) {
        lastError = error;
        console.error(`Image loading failed for ${card.card.name} (${imageUrl.substring(0, 50)}...):`, error);
        
        // Alternatif URL'leri dene
        const alternativeUrls = [
          card.card.image_uris.full,
          card.card.image_uris.large,
          card.card.image_uris.small
        ].filter(url => url && url !== imageUrl);
        
        for (const altUrl of alternativeUrls) {
          if (!altUrl || altUrl === imageUrl) continue;
          
          try {
            console.log(`Trying alternative URL for ${card.card.name}: ${altUrl.substring(0, 50)}...`);
            imageData = await this.getCardImageBytes(altUrl);
            imageUrl = altUrl; // Başarılı URL'i kullan
            break;
          } catch (altError) {
            console.log(`Alternative URL also failed:`, altError);
            continue;
          }
        }
      }
      
      if (imageData && imageData.length > 1000) {
        // Cache'e kaydet
        this.imageCache.set(imageUrl, imageData);
        
        // PDF'e ekle
        try {
          await this.embedBinaryImage(page, imageData, imageUrl, x, y, width, height);
          console.log(`Successfully embedded image for ${card.card.name}`);
        } catch (embedError) {
          console.error(`Failed to embed image for ${card.card.name}:`, embedError);
          this.failedImages.add(imageUrl);
          this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
        }
      } else {
        console.error(`Invalid image data for ${card.card.name}:`, lastError);
        this.failedImages.add(imageUrl);
        this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
      }

    } catch (error) {
      console.error(`Kart çizim hatası (${card.card.name}):`, error);
      this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
    }
  }

  // Next.js API route üzerinden görsel yükleme (server-side proxy)
  private async loadImageViaAPI(url: string): Promise<Uint8Array> {
    try {
      // Use absolute URL for API route to ensure it works in Cloudflare Pages
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : '';
      const apiUrl = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(url)}`;
      
      console.log(`Loading image via API: ${apiUrl.substring(0, 100)}...`);
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
      
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'image/*',
            'Cache-Control': 'no-cache'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`API proxy failed: ${response.status} - ${errorText}`);
          throw new Error(`API proxy failed: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        if (uint8Array.length < 1000) {
          console.error(`Image data too small from API: ${uint8Array.length} bytes`);
          throw new Error('Image data too small from API');
        }

        console.log(`Successfully loaded image via API: ${uint8Array.length} bytes`);
        return uint8Array;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError' || controller.signal.aborted) {
          throw new Error('Request timeout');
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error(`API proxy error for ${url}:`, error);
      throw new Error(`API proxy error: ${error.message || error}`);
    }
  }

  // Canvas kullanarak görsel yükleme (CORS bypass - crossOrigin olmadan)
  private async loadImageViaCanvas(url: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // crossOrigin kullanmadan dene (tainted canvas ama çalışabilir)
      
      // Timeout ekle
      const timeout = setTimeout(() => {
        reject(new Error('Image load timeout'));
      }, 8000);
      
      img.onload = async () => {
        clearTimeout(timeout);
        try {
          // Canvas oluştur
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Görseli canvas'a çiz (tainted canvas olabilir)
          try {
            ctx.drawImage(img, 0, 0);
          } catch (drawError: any) {
            // Tainted canvas hatası - crossOrigin ile tekrar dene
            if (drawError.name === 'SecurityError' || drawError.message?.includes('tainted')) {
              reject(new Error('Canvas tainted - CORS required'));
              return;
            }
            throw drawError;
          }
          
          // Canvas'ı blob'a çevir
          canvas.toBlob(async (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob returned null'));
              return;
            }
            
            // Blob'u Uint8Array'e çevir
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            if (uint8Array.length > 1000) {
              resolve(uint8Array);
            } else {
              reject(new Error('Image data too small'));
            }
          }, 'image/png'); // PNG formatında al (daha güvenilir)
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`Image load error: ${error}`));
      };
      
      img.src = url;
    });
  }

  // Ana görsel yükleme metodu - CORS güvenli
  private async getCardImageBytes(url: string): Promise<Uint8Array> {
    // Önce cache'den kontrol et
    if (this.imageCache.has(url)) {
      const cached = this.imageCache.get(url)!;
      if (cached && cached.length > 1000) {
        return cached;
      }
      // Cache'deki veri geçersiz, sil
      this.imageCache.delete(url);
    }

    const retryCount = this.retryCount.get(url) || 0;
    
    if (retryCount >= this.maxRetries) {
      throw new Error(`Maximum retries exceeded for ${url}`);
    }

    // Önce Next.js API route yöntemini dene (server-side proxy - en güvenilir)
    // Cloudflare Pages'de bu yöntem edge runtime'da çalışır
    try {
      console.log(`[Image Load] Trying API proxy for: ${url.substring(0, 50)}...`);
      const imageData = await this.loadImageViaAPI(url);
      
      if (imageData && imageData.length > 1000) {
        console.log(`[Image Load] ✅ API proxy success: ${imageData.length} bytes`);
        this.imageCache.set(url, imageData);
        return imageData;
      } else {
        console.warn(`[Image Load] ⚠️ API proxy returned invalid data: ${imageData?.length || 0} bytes`);
      }
    } catch (apiError: any) {
      console.warn(`[Image Load] ❌ API proxy failed for ${url.substring(0, 50)}:`, apiError.message || apiError);
      // Continue to other methods
    }

    // Canvas yöntemini dene (CORS bypass)
    if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
      try {
        console.log(`Trying canvas method for: ${url.substring(0, 50)}...`);
        const imageData = await this.loadImageViaCanvas(url);
        
        if (imageData && imageData.length > 1000) {
          this.imageCache.set(url, imageData);
          return imageData;
        }
      } catch (canvasError) {
        console.log(`Canvas method failed for ${url}, trying fetch:`, canvasError);
      }
    }

    try {
      // Direct fetch ile dene
      const imageData = await this.fetchImageDirectly(url);
      
      // Veriyi doğrula
      if (imageData && imageData.length > 1000) {
        this.imageCache.set(url, imageData);
        return imageData;
      } else {
        throw new Error('Image data too small or invalid');
      }

    } catch (error) {
      console.log(`Direct fetch failed for ${url}, attempt ${retryCount + 1}/${this.maxRetries}:`, error);
      
      // Retry count'u artır
      this.retryCount.set(url, retryCount + 1);
      
      // Proxy ile dene
      if (retryCount < 2) {
        try {
          const imageData = await this.fetchImageViaProxy(url);
          
          // Veriyi doğrula
          if (imageData && imageData.length > 1000) {
            this.imageCache.set(url, imageData);
            return imageData;
          } else {
            throw new Error('Proxy image data too small or invalid');
          }
        } catch (proxyError) {
          console.error(`Proxy fetch also failed for ${url}:`, proxyError);
          throw new Error(`Failed to load image after ${retryCount + 1} attempts`);
        }
      } else {
        throw new Error(`Failed to load image after ${retryCount + 1} attempts`);
      }
    }
  }

  // Direct fetch - CORS güvenli
  private async fetchImageDirectly(url: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 saniye timeout

    try {
      // Önce no-cors modunu dene (CORS sorunlarını bypass eder)
      let response: Response;
      try {
        response = await fetch(url, {
          mode: 'no-cors',
          credentials: 'omit',
          signal: controller.signal,
          cache: 'no-cache'
        });
      } catch (noCorsError) {
        // no-cors başarısız olursa cors modunu dene
        response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal,
          headers: {
            'Accept': 'image/*,image/jpeg,image/png,image/webp',
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
      }

      clearTimeout(timeoutId);

      // no-cors modunda response.ok her zaman false olabilir, bu yüzden kontrol etme
      if (response.type === 'opaque') {
        // Opaque response - veriyi al ve kullan
        console.log('Received opaque response (no-cors mode)');
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // no-cors modunda content-type kontrol edilemez
      if (response.type !== 'opaque') {
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.startsWith('image/')) {
          console.warn(`Unexpected content type: ${contentType}, continuing anyway`);
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      if (uint8Array.length < 1000) {
        throw new Error('Image too small, likely corrupted');
      }

      return uint8Array;

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Proxy ile görsel yükleme (client-side fallback)
  private async fetchImageViaProxy(url: string): Promise<Uint8Array> {
    // Daha fazla proxy servisi ekle
    const proxyUrls = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://cors-anywhere.herokuapp.com/${url}`, // Not: Bu servis production'da çalışmayabilir
      url // Try direct URL as last resort
    ];

    for (const proxyUrl of proxyUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 saniye timeout

        const response = await fetch(proxyUrl, {
          signal: controller.signal,
          mode: 'cors',
          headers: {
            'Accept': 'image/*,image/jpeg,image/png,image/webp',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok || response.type === 'opaque') {
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          if (uint8Array.length > 1000) {
            console.log(`Successfully loaded via proxy: ${proxyUrl.substring(0, 50)}...`);
            return uint8Array;
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`Proxy timeout: ${proxyUrl.substring(0, 50)}...`);
        } else {
          console.log(`Proxy failed: ${proxyUrl.substring(0, 50)}...`, error.message);
        }
        continue;
      }
    }

    throw new Error('All proxy methods failed');
  }

  // Binary görseli PDF'e göm - CORS güvenli
  private async embedBinaryImage(page: PDFPage, imageData: Uint8Array, imageUrl: string, x: number, y: number, width: number, height: number): Promise<void> {
    try {
      // Önce binary format kontrolü yap (daha güvenilir)
      const isJPEGFormat = this.isJPEG(imageData);
      const isPNGFormat = this.isPNG(imageData);
      
      let pdfImage;
      
      // Format tespiti - önce binary kontrol, sonra URL kontrol
      if (isJPEGFormat) {
        try {
          pdfImage = await this.pdfDoc.embedJpg(imageData);
        } catch (jpegError) {
          console.warn('JPEG embedding failed, trying PNG:', jpegError);
          try {
            pdfImage = await this.pdfDoc.embedPng(imageData);
          } catch (pngError) {
            throw new Error(`Both JPEG and PNG embedding failed. JPEG error: ${jpegError}, PNG error: ${pngError}`);
          }
        }
      } else if (isPNGFormat) {
        try {
          pdfImage = await this.pdfDoc.embedPng(imageData);
        } catch (pngError) {
          console.warn('PNG embedding failed, trying JPEG:', pngError);
          try {
            pdfImage = await this.pdfDoc.embedJpg(imageData);
          } catch (jpegError) {
            throw new Error(`Both PNG and JPEG embedding failed. PNG error: ${pngError}, JPEG error: ${jpegError}`);
          }
        }
      } else {
        // Format belirlenemezse URL'den tahmin et, sonra her ikisini de dene
        const lowerUrl = imageUrl.toLowerCase();
        if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) {
          try {
            pdfImage = await this.pdfDoc.embedJpg(imageData);
          } catch {
            pdfImage = await this.pdfDoc.embedPng(imageData);
          }
        } else if (lowerUrl.includes('.png')) {
          try {
            pdfImage = await this.pdfDoc.embedPng(imageData);
          } catch {
            pdfImage = await this.pdfDoc.embedJpg(imageData);
          }
        } else {
          // Her ikisini de dene
          try {
            pdfImage = await this.pdfDoc.embedJpg(imageData);
          } catch {
            try {
              pdfImage = await this.pdfDoc.embedPng(imageData);
            } catch (error) {
              throw new Error(`Image format could not be determined and both JPEG and PNG embedding failed: ${error}`);
            }
          }
        }
      }

      // PDF sayfasına çiz - görselin başarıyla embed edildiğinden emin ol
      if (!pdfImage) {
        throw new Error('PDF image object is null after embedding');
      }
      
      page.drawImage(pdfImage, { x, y, width, height });
      
      // Debug log
      console.log(`Successfully embedded image: ${imageUrl.substring(0, 50)}...`);
      
    } catch (error) {
      console.error('Image embedding failed:', error);
      console.error('Image URL:', imageUrl);
      console.error('Image data length:', imageData.length);
      console.error('Image data first bytes:', Array.from(imageData.slice(0, 10)));
      throw error;
    }
  }

  // Görsel format tespiti için yardımcı metodlar
  private isJPEG(data: Uint8Array): boolean {
    return data.length >= 2 && data[0] === 0xFF && data[1] === 0xD8;
  }

  private isPNG(data: Uint8Array): boolean {
    return data.length >= 8 && 
           data[0] === 0x89 && data[1] === 0x50 && 
           data[2] === 0x4E && data[3] === 0x47;
  }

  private drawCardPlaceholder(page: PDFPage, x: number, y: number, width: number, height: number, cardName: string): void {
    console.log(`Drawing placeholder for ${cardName}`);
    
    // Placeholder dikdörtgen - daha belirgin
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 2,
      color: rgb(0.9, 0.9, 0.9)
    });

    // İç dikdörtgen
    page.drawRectangle({
      x: x + 2,
      y: y + 2,
      width: width - 4,
      height: height - 4,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
      color: rgb(0.95, 0.95, 0.95)
    });

    // Kart adı - daha okunabilir
    const maxNameLength = Math.floor((width - 10) / 8); // Yaklaşık karakter sayısı
    const displayName = cardName.length > maxNameLength ? 
      cardName.substring(0, maxNameLength - 3) + '...' : cardName;
    
    const fontSize = Math.min(14, Math.max(8, width / displayName.length * 1.2));
    page.drawText(displayName, {
      x: x + (width - (displayName.length * fontSize * 0.6)) / 2, // Ortala
      y: y + height - 25,
      size: fontSize,
      color: rgb(0.2, 0.2, 0.2)
    });

    // "Görsel yüklenemedi" uyarısı - daha belirgin
    page.drawText('Görsel yüklenemedi', {
      x: x + (width - 120) / 2, // Ortala
      y: y + height - 45,
      size: 10,
      color: rgb(0.8, 0.3, 0.3)
    });

    // Kart tipi bilgisi (varsa)
    if (cardName.includes('(') && cardName.includes(')')) {
      const typeMatch = cardName.match(/\(([^)]+)\)/);
      if (typeMatch) {
        page.drawText(typeMatch[1], {
          x: x + 5,
          y: y + 15,
          size: 8,
          color: rgb(0.4, 0.4, 0.4)
        });
      }
    }
  }

  private drawBleedArea(page: PDFPage, x: number, y: number, width: number, height: number): void {
    // Bleed alanını hafif gri çerçeve ile göster
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5
    });
  }

  private drawCropMarks(page: PDFPage, x: number, y: number, width: number, height: number): void {
    const markLength = (this.settings.cropMarkLengthMm ?? 5) * PDFGenerator.MM_TO_POINTS; // points
    const markOffset = (this.settings.cropMarkOffsetMm ?? 1.5) * PDFGenerator.MM_TO_POINTS; // points
    const markThickness = this.settings.cropMarkThicknessPt ?? 0.5; // points
    
    // Sol üst köşe
    page.drawLine({
      start: { x: x - markOffset - markLength, y: y + height },
      end: { x: x - markOffset, y: y + height },
      thickness: markThickness,
      color: rgb(0, 0, 0)
    });
    page.drawLine({
      start: { x: x, y: y + height + markOffset },
      end: { x: x, y: y + height + markOffset + markLength },
      thickness: markThickness,
      color: rgb(0, 0, 0)
    });
    
    // Sağ üst köşe
    page.drawLine({
      start: { x: x + width + markOffset, y: y + height },
      end: { x: x + width + markOffset + markLength, y: y + height },
      thickness: markThickness,
      color: rgb(0, 0, 0)
    });
    page.drawLine({
      start: { x: x + width, y: y + height + markOffset },
      end: { x: x + width, y: y + height + markOffset + markLength },
      thickness: markThickness,
      color: rgb(0, 0, 0)
    });
    
    // Sol alt köşe
    page.drawLine({
      start: { x: x - markOffset - markLength, y: y },
      end: { x: x - markOffset, y: y },
      thickness: markThickness,
      color: rgb(0, 0, 0)
    });
    page.drawLine({
      start: { x: x, y: y - markOffset },
      end: { x: x, y: y - markOffset - markLength },
      thickness: markThickness,
      color: rgb(0, 0, 0)
    });
    
    // Sağ alt köşe
    page.drawLine({
      start: { x: x + width + markOffset, y: y },
      end: { x: x + width + markOffset + markLength, y: y },
      thickness: markThickness,
      color: rgb(0, 0, 0)
    });
    page.drawLine({
      start: { x: x + width, y: y - markOffset },
      end: { x: x + width, y: y - markOffset - markLength },
      thickness: markThickness,
      color: rgb(0, 0, 0)
    });
  }

  private drawPageNumber(page: PDFPage, pageNum: number, pageWidth: number, pageHeight: number): void {
    page.drawText(`Sayfa ${pageNum}`, {
      x: pageWidth - 60,
      y: 15,
      size: 8,
      color: rgb(0.5, 0.5, 0.5)
    });
  }
}
