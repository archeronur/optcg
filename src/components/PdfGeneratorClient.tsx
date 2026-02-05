'use client';

import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { DeckCard, PrintSettings } from '@/types';
import { usePdfGenerationState, PdfGenerationState } from '@/hooks/usePdfGenerationState';
import { PdfRenderRoot } from './PdfRenderRoot';
import { downloadPDF } from '@/utils/downloadHelper';

/**
 * PdfGeneratorClient - Fully client-only PDF generation component
 * 
 * CRITICAL: This component uses dynamic import with { ssr: false } to ensure
 * PDF generation code NEVER runs during static prerender or SSR.
 * 
 * Why client-only isolation is required:
 * - Cloudflare Pages statically prerenders the main route `/`
 * - Static hydration timing is unreliable for async-heavy flows like PDF rendering
 * - PDF generation depends on async image loading, which conflicts with static lifecycle
 * - By isolating PDF logic to a client-only component with explicit state machine,
 *   we guarantee PDF generation only runs after full client hydration
 * 
 * Architecture:
 * 1. State machine enforces strict ordering: IDLE → LOADING_IMAGES → READY → GENERATING → DONE
 * 2. Images are preloaded as base64 BEFORE PdfRenderRoot mounts
 * 3. PdfRenderRoot is mounted ONLY when state is READY
 * 4. Runtime guard verifies all images are base64 before PDF capture
 * 5. PdfRenderRoot is destroyed after PDF generation completes
 */

interface PdfGeneratorClientProps {
  cards: DeckCard[];
  printSettings: PrintSettings;
  onProgress?: (current: number, total: number, message: string) => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  abortSignal?: AbortSignal;
}

export interface PdfGeneratorClientRef {
  generate: () => Promise<void>;
  state: PdfGenerationState;
  reset: () => void;
}

export const PdfGeneratorClient = forwardRef<PdfGeneratorClientRef, PdfGeneratorClientProps>(
  ({ cards, printSettings, onProgress, onSuccess, onError, abortSignal }, ref) => {
    const stateMachine = usePdfGenerationState();
    const [preloadedImageData, setPreloadedImageData] = useState<Map<string, string>>(new Map());
    const [shouldMountRenderRoot, setShouldMountRenderRoot] = useState(false);

    // Preload images and convert to base64
    const preloadPdfImages = useCallback(async (cardData: DeckCard[]): Promise<Map<string, string>> => {
      console.log('[PdfGeneratorClient] Starting image preload...');
      stateMachine.transitionTo('LOADING_IMAGES');

      const imageDataMap = new Map<string, string>();
      const imageUrls = new Set<string>();

      // Collect all unique image URLs
      for (const card of cardData) {
        const imageUrl = card.card.image_uris.full || 
                        card.card.image_uris.large || 
                        card.card.image_uris.small;
        if (imageUrl) {
          imageUrls.add(imageUrl);
        }
      }

      console.log(`[PdfGeneratorClient] Preloading ${imageUrls.size} unique images...`);

      // Preload images via proxy and convert to base64
      // CRITICAL: Use dynamic import to ensure this code never runs during SSR
      const { getImageAsDataUri } = await import('@/utils/imageDataUri');
      const { toAbsoluteUrl } = await import('@/utils/url');

      let loadedCount = 0;
      const totalCount = imageUrls.size;

      // DEBUG: Log first 5 image URLs before preload
      const imageUrlsArray = Array.from(imageUrls);
      console.log('[PdfGeneratorClient] DEBUG: First 5 image URLs before preload:', 
        imageUrlsArray.slice(0, 5).map(url => url.substring(0, 80))
      );

      // Process images with concurrency limit (8 parallel requests)
      const concurrencyLimit = 8;
      const imageUrlsArray2 = Array.from(imageUrls);
      
      for (let i = 0; i < imageUrlsArray2.length; i += concurrencyLimit) {
        const batch = imageUrlsArray2.slice(i, i + concurrencyLimit);
        
        await Promise.allSettled(
          batch.map(async (imageUrl) => {
            if (abortSignal?.aborted) {
              throw new Error('Operation aborted');
            }

            try {
              // CRITICAL: Normalize URL to absolute before preloading
              const absoluteUrl = toAbsoluteUrl(imageUrl);
              
              console.log(`[PdfGeneratorClient] Preloading image ${loadedCount + 1}/${totalCount}:`, {
                original: imageUrl.substring(0, 60),
                absolute: absoluteUrl.substring(0, 60)
              });

              const result = await getImageAsDataUri(absoluteUrl, {
                preferProxy: true,
                timeoutMs: 40000,
                cache: true,
              });

              // CRITICAL ASSERTION: Result must be base64 data URL
              if (!result.dataUri || !result.dataUri.startsWith('data:image/')) {
                throw new Error(`Image preload failed: result is not base64 data URL. Got: ${result.dataUri?.substring(0, 50)}`);
              }

              // Store both original URL and absolute URL mappings
              imageDataMap.set(imageUrl, result.dataUri);
              imageDataMap.set(absoluteUrl, result.dataUri);
              
              loadedCount++;

              onProgress?.(loadedCount, totalCount, `Loading image ${loadedCount}/${totalCount}...`);
              console.log(`[PdfGeneratorClient] ✓ Preloaded ${loadedCount}/${totalCount}: ${imageUrl.substring(0, 50)}... (via ${result.via})`);
            } catch (error: any) {
              console.error(`[PdfGeneratorClient] ✗ Failed to preload image:`, {
                imageUrl: imageUrl.substring(0, 60),
                error: error?.message || error,
                errorName: error?.name
              });
              // Continue with other images - failed images will show placeholder
              loadedCount++;
              onProgress?.(loadedCount, totalCount, `Failed to load image ${loadedCount}/${totalCount}...`);
            }
          })
        );
      }

      // DEBUG: Log first 5 image URLs after preload (should be base64)
      const sampleUrls = imageUrlsArray.slice(0, 5);
      console.log('[PdfGeneratorClient] DEBUG: First 5 image URLs after preload:', 
        sampleUrls.map(url => {
          const dataUri = imageDataMap.get(url);
          return {
            original: url.substring(0, 60),
            isBase64: dataUri?.startsWith('data:image/') || false,
            preview: dataUri?.substring(0, 50) + '...' || 'NOT FOUND'
          };
        })
      );

      console.log(`[PdfGeneratorClient] Preload complete: ${imageDataMap.size}/${totalCount} images ready`);
      return imageDataMap;
    }, [stateMachine, onProgress, abortSignal]);

    // Generate PDF using pdf-lib (data-driven, no DOM dependency)
    const generatePdfWithPdfLib = useCallback(async (
      cardData: DeckCard[],
      imageDataMap: Map<string, string>
    ): Promise<Uint8Array> => {
      console.log('[PdfGeneratorClient] Starting PDF generation with pdf-lib...');
      stateMachine.transitionTo('GENERATING');

      // CRITICAL: Use dynamic import to ensure PDFGenerator never runs during SSR
      const { PDFGenerator } = await import('@/utils/pdfGenerator');
      const generator = new PDFGenerator(printSettings, abortSignal);

      // Replace image URLs in card data with base64 data URIs
      // CRITICAL: Try both original URL and absolute URL to ensure we find the preloaded image
      const { toAbsoluteUrl } = await import('@/utils/url');
      
      const cardsWithBase64Images: DeckCard[] = cardData.map(deckCard => {
        const originalUrl = deckCard.card.image_uris.full || 
                           deckCard.card.image_uris.large || 
                           deckCard.card.image_uris.small;
        
        if (!originalUrl) {
          console.warn(`[PdfGeneratorClient] No image URL for card: ${deckCard.card.name}`);
          return deckCard;
        }

        // Try to find base64 data URI - check both original and absolute URL
        let base64DataUri = imageDataMap.get(originalUrl);
        
        if (!base64DataUri) {
          // Try absolute URL
          try {
            const absoluteUrl = toAbsoluteUrl(originalUrl);
            base64DataUri = imageDataMap.get(absoluteUrl);
          } catch (urlError) {
            console.warn(`[PdfGeneratorClient] Failed to normalize URL for lookup:`, originalUrl);
          }
        }

        if (base64DataUri && base64DataUri.startsWith('data:image/')) {
          // Create new card object with base64 image
          console.log(`[PdfGeneratorClient] Replaced image URL with base64 for: ${deckCard.card.name}`);
          return {
            ...deckCard,
            card: {
              ...deckCard.card,
              image_uris: {
                full: base64DataUri,
                large: base64DataUri,
                small: base64DataUri,
              },
            },
          };
        } else {
          console.warn(`[PdfGeneratorClient] No base64 data URI found for card: ${deckCard.card.name}, URL: ${originalUrl.substring(0, 50)}`);
          // Return card with original URL - PDFGenerator will try to load it
          return deckCard;
        }
      });

      // Generate PDF using pdf-lib (data-driven, no DOM)
      const pdfBytes = await generator.generatePDF(cardsWithBase64Images, onProgress);

      console.log('[PdfGeneratorClient] PDF generation complete, size:', pdfBytes.length, 'bytes');
      return pdfBytes;
    }, [printSettings, stateMachine, onProgress, abortSignal]);

    // Main PDF generation handler
    const handleGeneratePDF = useCallback(async () => {
      if (cards.length === 0) {
        onError?.('No cards to generate PDF for');
        return;
      }

      if (!stateMachine.isIdle && !stateMachine.isDone) {
        console.warn('[PdfGeneratorClient] PDF generation already in progress');
        return;
      }

      try {
        // Step 1: Preload all images as base64
        console.log('[PdfGeneratorClient] Step 1: Preloading images...');
        const imageDataMap = await preloadPdfImages(cards);
        setPreloadedImageData(imageDataMap);

        // CRITICAL ASSERTION: Verify all images are base64
        const allBase64 = Array.from(imageDataMap.values()).every(uri => uri.startsWith('data:image/'));
        if (!allBase64) {
          throw new Error('Some images are not base64 after preload');
        }

        // Step 2: Transition to READY state (PdfRenderRoot will mount)
        console.log('[PdfGeneratorClient] Step 2: All images ready, transitioning to READY...');
        stateMachine.transitionTo('READY');
        setShouldMountRenderRoot(true);

        // Step 3: Wait a moment for PdfRenderRoot to mount and verify images
        await new Promise(resolve => setTimeout(resolve, 100));

        // Step 4: Generate PDF using pdf-lib (data-driven, no DOM capture needed)
        console.log('[PdfGeneratorClient] Step 3: Generating PDF with pdf-lib...');
        const pdfBytes = await generatePdfWithPdfLib(cards, imageDataMap);

        // Step 5: Download PDF
        console.log('[PdfGeneratorClient] Step 4: Downloading PDF...');
        const filename = `onepiece-deck-${Date.now()}.pdf`;
        const downloadResult = await downloadPDF(pdfBytes, filename);

        if (downloadResult.success) {
          console.log('[PdfGeneratorClient] PDF downloaded successfully');
          stateMachine.transitionTo('DONE');
          onSuccess?.();
        } else {
          throw new Error(downloadResult.error || 'PDF download failed');
        }

        // Cleanup: Unmount PdfRenderRoot after a delay
        setTimeout(() => {
          setShouldMountRenderRoot(false);
          setPreloadedImageData(new Map());
        }, 1000);

      } catch (error: any) {
        console.error('[PdfGeneratorClient] PDF generation failed:', error);
        stateMachine.reset();
        setShouldMountRenderRoot(false);
        setPreloadedImageData(new Map());
        onError?.(error.message || 'PDF generation failed');
      }
    }, [cards, stateMachine, preloadPdfImages, generatePdfWithPdfLib, onSuccess, onError]);

    // Handle images ready callback from PdfRenderRoot
    const handleImagesReady = useCallback(() => {
      console.log('[PdfGeneratorClient] PdfRenderRoot reports all images ready');
      // Images are already verified as base64 in PdfRenderRoot
      // PDF generation can proceed
    }, []);

    // Expose generate function and state via ref
    useImperativeHandle(ref, () => ({
      generate: handleGeneratePDF,
      state: stateMachine.state,
      reset: stateMachine.reset,
    }), [handleGeneratePDF, stateMachine.state, stateMachine.reset]);

    return (
      <>
        {/* PdfRenderRoot - Only mounted when state is READY */}
        {shouldMountRenderRoot && stateMachine.isReady && (
          <PdfRenderRoot
            cards={cards.map(deckCard => {
              // Replace image URLs with base64 data URIs
              const originalUrl = deckCard.card.image_uris.full || 
                                deckCard.card.image_uris.large || 
                                deckCard.card.image_uris.small;
              const base64DataUri = originalUrl ? preloadedImageData.get(originalUrl) : null;

              if (base64DataUri) {
                return {
                  ...deckCard,
                  card: {
                    ...deckCard.card,
                    image_uris: {
                      full: base64DataUri,
                      large: base64DataUri,
                      small: base64DataUri,
                    },
                  },
                };
              }

              return deckCard;
            })}
            printSettings={printSettings}
            onImagesReady={handleImagesReady}
          />
        )}
      </>
    );
  }
);

PdfGeneratorClient.displayName = 'PdfGeneratorClient';
