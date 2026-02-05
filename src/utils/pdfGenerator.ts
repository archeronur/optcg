import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import { DeckCard, PrintSettings } from '@/types';
import { getImageAsDataUri } from '@/utils/imageDataUri';
import { toAbsoluteUrl } from '@/utils/url';
import { tryGetImageFromDOM } from '@/utils/imageFromDOM';

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

  // MANDATORY FIX: Preload ALL images and wait until they're fully loaded before PDF generation
  // This ensures images are converted to base64 data URLs (zero network dependency during PDF render)
  async preloadImages(cards: DeckCard[], progressCallback?: (current: number, total: number, message: string) => void): Promise<void> {
    // Abort signal kontrolü
    if (this.abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }
    
    const imageUrls = new Set<string>();
    for (const card of cards) {
      let imageUrl = card.card.image_uris.full || card.card.image_uris.large || card.card.image_uris.small;
      if (imageUrl) {
        // Normalize URL to absolute - critical for Cloudflare Pages
        try {
          imageUrl = toAbsoluteUrl(imageUrl);
        } catch (urlError) {
          console.warn(`[preloadImages] Failed to normalize URL:`, urlError);
          // Skip if normalization fails and URL is not absolute
          if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            console.warn(`[preloadImages] Skipping invalid URL: ${imageUrl}`);
            continue;
          }
        }
        
        // Only preload if not already cached or failed
        if (!this.imageCache.has(imageUrl) && !this.preloadQueue.has(imageUrl) && !this.failedImages.has(imageUrl)) {
          imageUrls.add(imageUrl);
        }
      }
    }
    
    if (imageUrls.size === 0) {
      console.log('[preloadImages] All images already loaded');
      progressCallback?.(0, 0, 'Tüm görseller zaten yüklü');
      return;
    }
    
    console.log(`[preloadImages] Starting preload of ${imageUrls.size} images`);
    
    // Batch yükleme - her seferinde 5 görsel paralel yükle (Cloudflare Pages rate limits)
    const imageUrlsArray = Array.from(imageUrls);
    const batchSize = 5; // Reduced for Cloudflare Pages stability
    let loadedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < imageUrlsArray.length; i += batchSize) {
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      const batch = imageUrlsArray.slice(i, i + batchSize);
      console.log(`[preloadImages] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imageUrlsArray.length / batchSize)}: ${batch.length} images`);
      
      // Batch içindeki görselleri paralel yükle
      const batchPromises = batch.map(async (imageUrl) => {
        try {
          if (this.abortSignal?.aborted) {
            throw new Error('Operation aborted');
          }
          
          this.preloadQueue.add(imageUrl);
          
          // MANDATORY: Fetch via proxy (same-origin) and convert to base64
          // This ensures zero network dependency during PDF rendering
          const imageData = await this.getCardImageBytes(imageUrl);
          
          if (imageData && imageData.length > 1000) {
            // Image successfully loaded and cached as bytes (will be base64 in getImageAsDataUri)
            this.imageCache.set(imageUrl, imageData);
            loadedCount++;
            const progressMsg = `Görsel yüklendi: ${loadedCount}/${imageUrls.size}`;
            console.log(`[preloadImages] ${progressMsg}: ${imageUrl.substring(0, 50)}...`);
            progressCallback?.(loadedCount, imageUrls.size, progressMsg);
            return true;
          } else {
            throw new Error(`Invalid image data: ${imageData?.length || 0} bytes`);
          }
        } catch (error: any) {
          if (error.message === 'Operation aborted') {
            throw error;
          }
          failedCount++;
          console.error(`[preloadImages] Failed to preload image:`, {
            imageUrl: imageUrl.substring(0, 50),
            error: error?.message || error,
            errorName: error?.name
          });
          this.failedImages.add(imageUrl);
          loadedCount++;
          const progressMsg = `Görsel yüklenemedi: ${loadedCount}/${imageUrls.size}`;
          progressCallback?.(loadedCount, imageUrls.size, progressMsg);
          return false;
        } finally {
          this.preloadQueue.delete(imageUrl);
        }
      });
      
      // Batch'i bekle - ALL images must complete before continuing
      const results = await Promise.allSettled(batchPromises);
      
      // Log batch results
      const batchSuccess = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const batchFailed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)).length;
      console.log(`[preloadImages] Batch completed: ${batchSuccess} success, ${batchFailed} failed`);
    }
    
    const finalSuccess = this.imageCache.size;
    const finalFailed = this.failedImages.size;
    console.log(`[preloadImages] Preloading completed. Success: ${finalSuccess}, Failed: ${finalFailed}, Total: ${imageUrls.size}`);
    
    if (finalFailed > 0) {
      console.warn(`[preloadImages] ${finalFailed} images failed to load. They will show placeholders in PDF.`);
    }
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
    // Public klasöründen kart arkası görselini al - CRITICAL: Use absolute URL for Cloudflare Pages
    try {
      // Ensure absolute URL for card back image
      const absoluteCardBackUrl = toAbsoluteUrl(PDFGenerator.CARD_BACK_URL);
      
      const response = await fetch(absoluteCardBackUrl, { 
        cache: 'no-store' as any,
        credentials: 'omit',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for card back image`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      if (bytes.length < 1000) {
        throw new Error('Card back image too small');
      }
      
      return bytes;
    } catch (e: any) {
      console.error('Failed to load card back image:', e);
      throw new Error(`Card back image load failed: ${e?.message || e}`);
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

      // URL'yi temizle ve normalize et - CRITICAL for Cloudflare Pages
      imageUrl = imageUrl.trim();
      
      // Ensure absolute URL - critical for prod environments
      const originalUrl = imageUrl;
      try {
        imageUrl = toAbsoluteUrl(imageUrl);
        console.log(`[drawCard] URL normalized: ${originalUrl} -> ${imageUrl} for ${card.card.name}`);
      } catch (urlError) {
        console.error(`[drawCard] Failed to normalize URL for ${card.card.name}:`, {
          originalUrl,
          error: urlError
        });
        // If toAbsoluteUrl fails, check if it's already absolute
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          console.error(`[drawCard] Invalid image URL format: ${imageUrl} for ${card.card.name}`);
          this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
          return;
        }
      }
      
      // Final validation - must be absolute
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        console.error(`[drawCard] Invalid image URL format after normalization: ${imageUrl} for ${card.card.name}`);
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
        console.log(`[drawCard] Loading image for ${card.card.name}:`, imageUrl);
        imageData = await this.getCardImageBytes(imageUrl);
        console.log(`[drawCard] Image loaded successfully for ${card.card.name}, bytes:`, imageData?.length);
      } catch (error: any) {
        lastError = error;
        console.error(`[drawCard] Image loading failed for ${card.card.name}:`, {
          imageUrl,
          error: error?.message || error,
          errorName: error?.name,
          stack: error?.stack
        });
        
        // Alternatif URL'leri dene - normalize edilmiş
        const alternativeUrls = [
          card.card.image_uris.full,
          card.card.image_uris.large,
          card.card.image_uris.small
        ]
          .filter(url => url && url !== imageUrl)
          .map(url => {
            try {
              return toAbsoluteUrl(url!);
            } catch {
              return url!;
            }
          })
          .filter(url => url && url.startsWith('http'));
        
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

  // Ana görsel yükleme metodu - CORS dayanıklı: önce DOM'dan al, sonra proxy/direct fetch
  private async getCardImageBytes(url: string): Promise<Uint8Array> {
    // Önce cache'den kontrol et
    if (this.imageCache.has(url)) {
      const cached = this.imageCache.get(url)!;
      if (cached && cached.length > 1000) {
        console.log(`[getCardImageBytes] Using cached image for: ${url.substring(0, 50)}...`);
        return cached;
      }
      // Cache'deki veri geçersiz, sil
      this.imageCache.delete(url);
    }

    const retryCount = this.retryCount.get(url) || 0;
    if (retryCount >= this.maxRetries) {
      console.error(`[getCardImageBytes] Max retries exceeded for: ${url}`);
      throw new Error(`Maximum retries exceeded for ${url}`);
    }

    try {
      console.log(`[getCardImageBytes] Fetching image (attempt ${retryCount + 1}/${this.maxRetries}):`, url);
      
      // CRITICAL FIX: Try to get image from DOM first (already loaded in preview)
      // This is much more reliable than re-fetching, especially in Cloudflare Pages
      if (typeof window !== 'undefined') {
        try {
          const domResult = await tryGetImageFromDOM(url);
          if (domResult?.success && domResult.bytes && domResult.bytes.length > 1000) {
            console.log(`[getCardImageBytes] Successfully extracted from DOM: ${url.substring(0, 50)}...`);
            this.imageCache.set(url, domResult.bytes);
            this.retryCount.delete(url);
            return domResult.bytes;
          } else if (domResult && !domResult.success) {
            console.log(`[getCardImageBytes] DOM extraction failed, will fetch: ${domResult.error}`);
          }
        } catch (domError: any) {
          console.log(`[getCardImageBytes] DOM extraction error, will fetch: ${domError?.message || domError}`);
        }
      }
      
      // Fallback: Fetch via proxy/direct (if not in DOM or DOM extraction failed)
      // MANDATORY: Always use proxy first (same-origin guarantee, avoids CORS)
      // Proxy fetches server-side, converts to base64 data URL
      const res = await getImageAsDataUri(url, {
        preferProxy: true, // Proxy first, direct as fallback
        timeoutMs: 40000, // Increased timeout for Cloudflare Pages
        cache: true,
      });

      console.log(`[getCardImageBytes] Image fetched successfully via ${res.via}:`, {
        url: url.substring(0, 50),
        bytes: res.bytes.length,
        contentType: res.contentType
      });

      if (!res.bytes || res.bytes.length < 1000) {
        throw new Error(`Image bytes too small: ${res.bytes?.length || 0} bytes`);
      }

      this.imageCache.set(url, res.bytes);
      this.retryCount.delete(url); // Reset retry count on success
      return res.bytes;
    } catch (e: any) {
      const newRetryCount = retryCount + 1;
      this.retryCount.set(url, newRetryCount);
      
      console.error(`[getCardImageBytes] Image fetch failed (attempt ${newRetryCount}/${this.maxRetries}):`, {
        url: url.substring(0, 50),
        error: e?.message || e,
        errorName: e?.name,
        retryCount: newRetryCount
      });
      
      if (newRetryCount >= this.maxRetries) {
        throw new Error(`Image fetch failed after ${this.maxRetries} attempts: ${e?.message || e}`);
      }
      
      // Retry with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, retryCount), 5000);
      console.log(`[getCardImageBytes] Retrying after ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      // Recursive retry
      return this.getCardImageBytes(url);
    }
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
