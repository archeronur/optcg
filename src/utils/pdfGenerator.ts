import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import { DeckCard, PrintSettings } from '@/types';
import { getImageAsDataUri } from '@/utils/imageDataUri';
import { toAbsoluteUrl } from '@/utils/url';

export class PDFGenerator {
  private pdfDoc: PDFDocument;
  private settings: PrintSettings;
  // CRITICAL: Store images as base64 data URIs for guaranteed embedding
  private imageDataUriCache: Map<string, string> = new Map(); // URL -> base64 data URI
  private imageBytesCache: Map<string, Uint8Array> = new Map(); // URL -> bytes (for pdf-lib)
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
    this.imageDataUriCache.clear();
    this.imageBytesCache.clear();
    this.preloadQueue.clear();
    this.retryCount.clear();
  }

  // MANDATORY: Preload ALL images via proxy and convert to base64 BEFORE PDF generation
  // This is the CRITICAL step that ensures images work in production
  async preloadImages(cards: DeckCard[], progressCallback?: (current: number, total: number, message: string) => void): Promise<void> {
    if (this.abortSignal?.aborted) {
      throw new Error('Operation aborted');
    }
    
    // Collect all unique image URLs and normalize them
    const imageUrls = new Set<string>();
    const urlMappings = new Map<string, string>(); // original -> absolute
    
    for (const card of cards) {
      const imageUrl = card.card.image_uris.full || 
                      card.card.image_uris.large || 
                      card.card.image_uris.small;
      if (imageUrl) {
        // CRITICAL: Normalize to absolute URL immediately
        const absoluteUrl = toAbsoluteUrl(imageUrl);
        imageUrls.add(absoluteUrl);
        urlMappings.set(imageUrl, absoluteUrl);
        // Also store reverse mapping
        urlMappings.set(absoluteUrl, absoluteUrl);
      }
    }
    
    if (imageUrls.size === 0) {
      progressCallback?.(0, 0, 'Tüm görseller zaten yüklü');
      return;
    }
    
    console.log(`[preloadImages] Preloading ${imageUrls.size} unique images...`);
    
    // DEBUG: Log first 5 URLs
    const first5Urls = Array.from(imageUrls).slice(0, 5);
    console.log('[preloadImages] DEBUG: First 5 URLs:', first5Urls.map(url => url.substring(0, 80)));
    
    // Batch loading with concurrency limit
    const batchSize = 8;
    const imageUrlsArray = Array.from(imageUrls);
    let loadedCount = 0;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < imageUrlsArray.length; i += batchSize) {
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      const batch = imageUrlsArray.slice(i, i + batchSize);
      console.log(`[preloadImages] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imageUrlsArray.length / batchSize)}: ${batch.length} images`);
      
      const batchPromises = batch.map(async (absoluteUrl) => {
        try {
          if (this.abortSignal?.aborted) {
            throw new Error('Operation aborted');
          }
          
          // Skip if already cached
          if (this.imageDataUriCache.has(absoluteUrl)) {
            loadedCount++;
            successCount++;
            console.log(`[preloadImages] ✓ Already cached: ${absoluteUrl.substring(0, 60)}...`);
            return true;
          }
          
          this.preloadQueue.add(absoluteUrl);
          
          console.log(`[preloadImages] Fetching: ${absoluteUrl.substring(0, 80)}...`);
          
          // CRITICAL: Fetch via proxy and get base64 data URI
          const result = await getImageAsDataUri(absoluteUrl, {
            preferProxy: true,
            timeoutMs: 30000,
            cache: true,
          });
          
          // CRITICAL ASSERTION: Must be base64 data URI
          if (!result.dataUri || !result.dataUri.startsWith('data:image/')) {
            throw new Error(`Invalid data URI: ${result.dataUri?.substring(0, 50)}`);
          }
          
          if (!result.bytes || result.bytes.length < 1000) {
            throw new Error(`Image bytes too small: ${result.bytes?.length || 0}`);
          }
          
          // Store in both caches
          this.imageDataUriCache.set(absoluteUrl, result.dataUri);
          this.imageBytesCache.set(absoluteUrl, result.bytes);
          
          // Also store with original URL if different
          const originalUrl = Array.from(urlMappings.entries()).find(([_, abs]) => abs === absoluteUrl)?.[0];
          if (originalUrl && originalUrl !== absoluteUrl) {
            this.imageDataUriCache.set(originalUrl, result.dataUri);
            this.imageBytesCache.set(originalUrl, result.bytes);
          }
          
          loadedCount++;
          successCount++;
          console.log(`[preloadImages] ✓ Success ${loadedCount}/${imageUrls.size}: ${absoluteUrl.substring(0, 60)}... (via ${result.via})`);
          progressCallback?.(loadedCount, imageUrls.size, `Görsel yüklendi: ${loadedCount}/${imageUrls.size}`);
          return true;
        } catch (error: any) {
          if (error.message === 'Operation aborted') {
            throw error;
          }
          failCount++;
          console.error(`[preloadImages] ✗ Failed: ${absoluteUrl.substring(0, 80)}...`, {
            error: error?.message || error,
            errorName: error?.name
          });
          this.failedImages.add(absoluteUrl);
          loadedCount++;
          progressCallback?.(loadedCount, imageUrls.size, `Görsel yüklenemedi: ${loadedCount}/${imageUrls.size}`);
          return false;
        } finally {
          this.preloadQueue.delete(absoluteUrl);
        }
      });
      
      await Promise.allSettled(batchPromises);
    }
    
    // DEBUG: Verify cache
    const first5After = first5Urls.map(url => {
      const dataUri = this.imageDataUriCache.get(url);
      const bytes = this.imageBytesCache.get(url);
      return {
        url: url.substring(0, 60),
        hasDataUri: !!dataUri,
        hasBytes: !!bytes,
        dataUriPreview: dataUri?.substring(0, 50) + '...' || 'NOT FOUND',
        bytesLength: bytes?.length || 0
      };
    });
    console.log('[preloadImages] DEBUG: First 5 URLs after preload:', first5After);
    
    console.log(`[preloadImages] Preloading completed. Success: ${successCount}, Failed: ${failCount}, Total: ${imageUrls.size}`);
  }

  async generatePDF(cards: DeckCard[], progressCallback?: (current: number, total: number, message: string) => void): Promise<Uint8Array> {
    try {
      console.log('=== PDFGenerator.generatePDF() STARTED ===');
      console.log('Cards received:', cards.length);
      
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      // Clear failed images and queue, but keep caches
      this.failedImages.clear();
      this.preloadQueue.clear();
      
      // CRITICAL STEP 1: Preload all images as base64 BEFORE PDF generation
      console.log('Starting image preloading...');
      progressCallback?.(0, cards.length, 'Görseller yükleniyor - Loading images...');
      await this.preloadImages(cards, (current, total, msg) => {
        progressCallback?.(current, total, `Görsel yükleniyor ${current}/${total} - Loading image`);
      });
      
      console.log('Image preloading completed');
      console.log(`Cache stats: ${this.imageDataUriCache.size} data URIs, ${this.imageBytesCache.size} bytes cached`);
      
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      const failedCount = this.failedImages.size;
      if (failedCount > 0) {
        console.warn(`${failedCount}/${cards.length} görsel yüklenemedi, placeholder kullanılacak`);
        progressCallback?.(cards.length, cards.length, `${failedCount} görsel yüklenemedi, placeholder kullanılıyor...`);
      }
      
      // CRITICAL STEP 2: Create PDF document
      console.log('Creating PDFDocument...');
      progressCallback?.(cards.length, cards.length, 'PDF oluşturuluyor - Creating PDF...');
      this.pdfDoc = await PDFDocument.create();
      console.log('PDFDocument created successfully');
      
      const gridDims = { cols: 3, rows: 3, cardsPerPage: 9 };
      
      // Expand cards by count
      const expandedCards: DeckCard[] = [];
      for (const deckCard of cards) {
        for (let i = 0; i < deckCard.count; i++) {
          expandedCards.push({ ...deckCard, count: 1 });
        }
      }
      
      console.log('Total cards to print:', expandedCards.length);
      
      // Split into pages
      const pages: DeckCard[][] = [];
      for (let i = 0; i < expandedCards.length; i += gridDims.cardsPerPage) {
        pages.push(expandedCards.slice(i, i + gridDims.cardsPerPage));
      }
      
      console.log('Total pages needed:', pages.length);
      
      // Create pages
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        if (this.abortSignal?.aborted) {
          throw new Error('Operation aborted');
        }
        
        const pageCards = pages[pageIndex];
        console.log(`Creating page ${pageIndex + 1} with ${pageCards.length} cards`);
        
        const totalSteps = cards.length + pages.length;
        progressCallback?.(
          cards.length + pageIndex,
          totalSteps,
          `Sayfa ${pageIndex + 1}/${pages.length} oluşturuluyor - Creating page ${pageIndex + 1}`
        );
        
        try {
          await this.createPage(pageCards, pageIndex, progressCallback, totalSteps);
          
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
          
          try {
            await this.createPlaceholderPage(pageIndex, pageCards.length);
            console.log(`Placeholder page ${pageIndex + 1} created successfully`);
          } catch (placeholderError) {
            console.error(`Failed to create placeholder page ${pageIndex + 1}:`, placeholderError);
            const pageWidthPt = PDFGenerator.A4_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
            const pageHeightPt = PDFGenerator.A4_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;
            this.pdfDoc.addPage([pageWidthPt, pageHeightPt]);
          }
        }
      }
      
      // Back pages (if requested)
      if (this.settings.includeBackPages) {
        console.log('Including back pages...');
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
            
            try {
              await this.createBackPage(pages[pageIndex].length, pageIndex, progressCallback, cards.length + pages.length);
            } catch (backPageErr) {
              console.error(`Error creating back page for page ${pageIndex + 1}:`, backPageErr);
              const pageWidthPt = PDFGenerator.A4_WIDTH_MM * PDFGenerator.MM_TO_POINTS;
              const pageHeightPt = PDFGenerator.A4_HEIGHT_MM * PDFGenerator.MM_TO_POINTS;
              this.pdfDoc.addPage([pageWidthPt, pageHeightPt]);
            }
          }
        }
      }
      
      console.log('PDF generation complete, saving...');
      progressCallback?.(cards.length + pages.length, cards.length + pages.length, 'PDF kaydediliyor - Finalizing PDF...');
      
      if (this.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      const pdfBytes = await this.pdfDoc.save();
      console.log('PDF saved successfully, byte length:', pdfBytes.length);
      
      if (pdfBytes.length < 1000) {
        throw new Error('Generated PDF is too small, likely corrupted');
      }
      
      return pdfBytes;
      
    } catch (error: any) {
      console.error('Error in PDFGenerator.generatePDF():', error);
      
      if (error.message === 'Operation aborted') {
        throw error;
      }
      
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
    marginX = Math.max(marginX, safeMarginPt);
    marginY = Math.max(marginY, safeMarginPt);
    
    // Draw cards
    for (let i = 0; i < cards.length && i < gridDims.cardsPerPage; i++) {
      const card = cards[i];
      
      const col = i % gridDims.cols;
      const row = Math.floor(i / gridDims.cols);
      
      const x = marginX + (col * (cardWithBleedWidth + internalGapPt)) + bleedPt;
      const y = pageHeightPt - marginY - ((row + 1) * cardWithBleedHeight) - (row * internalGapPt) + bleedPt;
      
      await this.drawCard(page, card, x, y, cardWidthPt, cardHeightPt);
      
      if (this.settings.includeBleed) {
        this.drawBleedArea(page, x - bleedPt, y - bleedPt, cardWithBleedWidth, cardWithBleedHeight);
      }
      
      if (this.settings.includeCropMarks) {
        this.drawCropMarks(page, x, y, cardWidthPt, cardHeightPt);
      }
      
      if (totalProgress && progressCallback && (i + 1) % 5 === 0) {
        const currentProgress = totalProgress - (cards.length - i - 1);
        progressCallback?.(currentProgress, totalProgress, `Sayfa ${pageIndex + 1}: ${i + 1}/${cards.length} kart işlendi`);
      }
    }
    
    this.drawPageNumber(page, pageIndex + 1, pageWidthPt, pageHeightPt);
  }

  private async createBackPage(
    cardCount: number,
    pageIndex: number,
    progressCallback?: (current: number, total: number, message: string) => void,
    totalProgress?: number
  ): Promise<void> {
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
    marginX = Math.max(marginX, safeMarginPt);
    marginY = Math.max(marginY, safeMarginPt);
    
    if (!this.cardBackBytes) return;
    const backImg = await this.pdfDoc.embedJpg(this.cardBackBytes);
    
    for (let i = 0; i < cardCount && i < gridDims.cardsPerPage; i++) {
      const col = i % gridDims.cols;
      const row = Math.floor(i / gridDims.cols);
      
      const x = marginX + (col * (cardWithBleedWidth + internalGapPt)) + bleedPt;
      const y = pageHeightPt - marginY - ((row + 1) * cardWithBleedHeight) - (row * internalGapPt) + bleedPt;
      
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
    marginX = Math.max(marginX, safeMarginPt);
    marginY = Math.max(marginY, safeMarginPt);
    
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
      
      if (this.settings.includeCropMarks) {
        this.drawCropMarks(page, x, y, cardWidthPt, cardHeightPt);
      }
    }
    
    this.drawPageNumber(page, pageIndex + 1, pageWidthPt, pageHeightPt);
  }

  // CRITICAL: This function now uses preloaded cache - no network calls during PDF generation
  private async drawCard(page: PDFPage, card: DeckCard, x: number, y: number, width: number, height: number): Promise<void> {
    try {
      // Get image URL
      let imageUrl = card.card.image_uris.full || 
                    card.card.image_uris.large || 
                    card.card.image_uris.small;
      
      if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
        console.warn(`[drawCard] No image URL for card: ${card.card.name}`);
        this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
        return;
      }
      
      // CRITICAL: Normalize URL to absolute
      const originalUrl = imageUrl.trim();
      const absoluteUrl = toAbsoluteUrl(originalUrl);
      
      // DEBUG: Log first 5 cards
      if (this.imageBytesCache.size < 5) {
        console.log(`[drawCard] DEBUG: Drawing card:`, {
          cardName: card.card.name,
          originalUrl: originalUrl.substring(0, 60),
          absoluteUrl: absoluteUrl.substring(0, 60)
        });
      }
      
      // CRITICAL: Look up in preloaded cache (both original and absolute URL)
      let imageBytes: Uint8Array | undefined;
      
      if (this.imageBytesCache.has(absoluteUrl)) {
        imageBytes = this.imageBytesCache.get(absoluteUrl);
      } else if (originalUrl !== absoluteUrl && this.imageBytesCache.has(originalUrl)) {
        imageBytes = this.imageBytesCache.get(originalUrl);
        // Also store under absolute URL for future lookups
        if (imageBytes) {
          this.imageBytesCache.set(absoluteUrl, imageBytes);
        }
      }
      
      // If not in cache, check failed images
      if (!imageBytes) {
        if (this.failedImages.has(absoluteUrl) || (originalUrl !== absoluteUrl && this.failedImages.has(originalUrl))) {
          console.warn(`[drawCard] Skipping previously failed image: ${absoluteUrl.substring(0, 50)}...`);
          this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
          return;
        }
        
        // CRITICAL: Image should have been preloaded! This is an error condition
        console.error(`[drawCard] ERROR: Image not in cache! This should not happen.`, {
          cardName: card.card.name,
          originalUrl: originalUrl.substring(0, 60),
          absoluteUrl: absoluteUrl.substring(0, 60),
          cacheSize: this.imageBytesCache.size,
          cacheKeys: Array.from(this.imageBytesCache.keys()).slice(0, 3).map(k => k.substring(0, 40))
        });
        
        // Try to load it now as fallback (should not happen in production)
        try {
          console.warn(`[drawCard] Attempting emergency load for: ${absoluteUrl.substring(0, 60)}...`);
          const result = await getImageAsDataUri(absoluteUrl, {
            preferProxy: true,
            timeoutMs: 10000,
            cache: false,
          });
          
          if (result.bytes && result.bytes.length > 1000) {
            imageBytes = result.bytes;
            // Cache it for future use
            this.imageBytesCache.set(absoluteUrl, imageBytes);
            if (originalUrl !== absoluteUrl) {
              this.imageBytesCache.set(originalUrl, imageBytes);
            }
          } else {
            throw new Error('Emergency load failed: bytes too small');
          }
        } catch (emergencyError: any) {
          console.error(`[drawCard] Emergency load failed:`, emergencyError);
          this.failedImages.add(absoluteUrl);
          if (originalUrl !== absoluteUrl) {
            this.failedImages.add(originalUrl);
          }
          this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
          return;
        }
      }
      
      // CRITICAL: Embed image using cached bytes
      if (imageBytes && imageBytes.length > 1000) {
        try {
          await this.embedBinaryImage(page, imageBytes, absoluteUrl, x, y, width, height);
          console.log(`[drawCard] ✓ Successfully embedded image for ${card.card.name}`);
        } catch (embedError) {
          console.error(`[drawCard] Failed to embed image for ${card.card.name}:`, embedError);
          this.failedImages.add(absoluteUrl);
          if (originalUrl !== absoluteUrl) {
            this.failedImages.add(originalUrl);
          }
          this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
        }
      } else {
        console.error(`[drawCard] Invalid image bytes for ${card.card.name}: ${imageBytes?.length || 0} bytes`);
        this.failedImages.add(absoluteUrl);
        if (originalUrl !== absoluteUrl) {
          this.failedImages.add(originalUrl);
        }
        this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
      }
      
    } catch (error) {
      console.error(`[drawCard] Error drawing card (${card.card.name}):`, error);
      this.drawCardPlaceholder(page, x, y, width, height, card.card.name);
    }
  }

  // Binary görseli PDF'e göm - CORS güvenli
  private async embedBinaryImage(page: PDFPage, imageData: Uint8Array, imageUrl: string, x: number, y: number, width: number, height: number): Promise<void> {
    try {
      // Format detection
      const isJPEGFormat = this.isJPEG(imageData);
      const isPNGFormat = this.isPNG(imageData);
      
      let pdfImage;
      
      if (isJPEGFormat) {
        try {
          pdfImage = await this.pdfDoc.embedJpg(imageData);
        } catch (jpegError) {
          console.warn('[embedBinaryImage] JPEG embedding failed, trying PNG:', jpegError);
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
          console.warn('[embedBinaryImage] PNG embedding failed, trying JPEG:', pngError);
          try {
            pdfImage = await this.pdfDoc.embedJpg(imageData);
          } catch (jpegError) {
            throw new Error(`Both PNG and JPEG embedding failed. PNG error: ${pngError}, JPEG error: ${jpegError}`);
          }
        }
      } else {
        // Try both formats
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
      
      if (!pdfImage) {
        throw new Error('PDF image object is null after embedding');
      }
      
      page.drawImage(pdfImage, { x, y, width, height });
      
      console.log(`[embedBinaryImage] Successfully embedded image: ${imageUrl.substring(0, 50)}...`);
      
    } catch (error) {
      console.error('[embedBinaryImage] Image embedding failed:', error);
      console.error('Image URL:', imageUrl);
      console.error('Image data length:', imageData.length);
      console.error('Image data first bytes:', Array.from(imageData.slice(0, 10)));
      throw error;
    }
  }

  private isJPEG(data: Uint8Array): boolean {
    return data.length >= 2 && data[0] === 0xFF && data[1] === 0xD8;
  }

  private isPNG(data: Uint8Array): boolean {
    return data.length >= 8 && 
           data[0] === 0x89 && data[1] === 0x50 && 
           data[2] === 0x4E && data[3] === 0x47;
  }

  private drawCardPlaceholder(page: PDFPage, x: number, y: number, width: number, height: number, cardName: string): void {
    console.log(`[drawCardPlaceholder] Drawing placeholder for ${cardName}`);
    
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 2,
      color: rgb(0.9, 0.9, 0.9)
    });
    
    page.drawRectangle({
      x: x + 2,
      y: y + 2,
      width: width - 4,
      height: height - 4,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
      color: rgb(0.95, 0.95, 0.95)
    });
    
    const maxNameLength = Math.floor((width - 10) / 8);
    const displayName = cardName.length > maxNameLength ? 
      cardName.substring(0, maxNameLength - 3) + '...' : cardName;
    
    const fontSize = Math.min(14, Math.max(8, width / displayName.length * 1.2));
    page.drawText(displayName, {
      x: x + (width - (displayName.length * fontSize * 0.6)) / 2,
      y: y + height - 25,
      size: fontSize,
      color: rgb(0.2, 0.2, 0.2)
    });
    
    page.drawText('Görsel yüklenemedi', {
      x: x + (width - 120) / 2,
      y: y + height - 45,
      size: 10,
      color: rgb(0.8, 0.3, 0.3)
    });
    
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
    const markLength = (this.settings.cropMarkLengthMm ?? 5) * PDFGenerator.MM_TO_POINTS;
    const markOffset = (this.settings.cropMarkOffsetMm ?? 1.5) * PDFGenerator.MM_TO_POINTS;
    const markThickness = this.settings.cropMarkThicknessPt ?? 0.5;
    
    // Top left
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
    
    // Top right
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
    
    // Bottom left
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
    
    // Bottom right
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
