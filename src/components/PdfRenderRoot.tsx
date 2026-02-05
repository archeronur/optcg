'use client';

import React, { useEffect, useRef } from 'react';
import { DeckCard } from '@/types';

/**
 * PdfRenderRoot - Isolated rendering container for PDF generation
 * 
 * CRITICAL: This component is ONLY mounted when PDF generation starts.
 * It is NOT part of the static prerendered page DOM.
 * 
 * Why this is necessary:
 * - On Cloudflare Pages, static prerendering means the page DOM is generated at build time
 * - PDF generation timing depends on async image loading, which conflicts with static hydration
 * - By isolating PDF rendering to a separate component that mounts only on-demand,
 *   we ensure PDF generation never runs during static lifecycle
 * 
 * This component:
 * - Receives card data as props (not from DOM)
 * - Renders ONLY base64-backed images (preloaded before mount)
 * - Is invisible (positioned off-screen)
 * - Is destroyed after PDF generation completes
 */
interface PdfRenderRootProps {
  cards: DeckCard[];
  printSettings: any;
  onImagesReady?: () => void;
  onRenderComplete?: () => void;
}

export function PdfRenderRoot({ cards, printSettings, onImagesReady, onRenderComplete }: PdfRenderRootProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesLoadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // CRITICAL RUNTIME GUARD: Verify all images are base64 before allowing PDF capture
    // This ensures we never attempt PDF generation with external URLs
    // 
    // Why this guard is necessary:
    // - On Cloudflare Pages, static prerender can cause timing issues
    // - Images must be fully loaded as base64 before PDF generation starts
    // - This guard throws an error if any image is not base64, preventing corrupted PDFs
    const verifyAllImagesAreBase64 = (): boolean => {
      if (!containerRef.current) {
        console.warn('[PdfRenderRoot] Container ref not available');
        return false;
      }

      const images = containerRef.current.querySelectorAll<HTMLImageElement>('img');
      
      if (images.length === 0) {
        console.warn('[PdfRenderRoot] No images found in container');
        return false;
      }

      let allBase64 = true;
      const nonBase64Images: string[] = [];

      images.forEach((img, index) => {
        const src = img.src;
        // CRITICAL: Check if src is base64 data URL
        if (!src || !src.startsWith('data:image/')) {
          allBase64 = false;
          nonBase64Images.push(`Image ${index + 1}: ${src ? src.substring(0, 50) : 'null'}...`);
          console.error(`[PdfRenderRoot] Image ${index + 1} is not base64:`, src?.substring(0, 100));
        }
      });

      if (!allBase64) {
        const errorMsg = `PDF capture attempted before images ready. ${nonBase64Images.length} images are not base64 data URLs: ${nonBase64Images.join(', ')}`;
        console.error('[PdfRenderRoot] RUNTIME GUARD FAILED:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(`[PdfRenderRoot] Runtime guard passed: All ${images.length} images are base64`);
      return true;
    };

    // Wait for all images to load and verify they're base64
    const checkImagesReady = () => {
      if (!containerRef.current) return;

      const images = containerRef.current.querySelectorAll<HTMLImageElement>('img');
      let loadedCount = 0;
      let totalImages = images.length;

      if (totalImages === 0) {
        console.warn('[PdfRenderRoot] No images found in container');
        return;
      }

      const checkImage = (img: HTMLImageElement) => {
        // CRITICAL: Verify image src is base64
        if (!img.src.startsWith('data:image/')) {
          console.error('[PdfRenderRoot] Image is not base64:', img.src.substring(0, 50));
          throw new Error(`Image src is not base64: ${img.src.substring(0, 50)}...`);
        }

        if (img.complete && img.naturalWidth > 0) {
          const imageId = img.src.substring(0, 100);
          if (!imagesLoadedRef.current.has(imageId)) {
            imagesLoadedRef.current.add(imageId);
            loadedCount++;
            
            if (loadedCount === totalImages) {
              // All images loaded and verified as base64
              if (verifyAllImagesAreBase64()) {
                console.log('[PdfRenderRoot] All images ready and verified as base64');
                onImagesReady?.();
              }
            }
          }
        } else {
          // Image not loaded yet, wait for load event
          img.onload = () => {
            checkImage(img);
          };
          img.onerror = () => {
            console.error('[PdfRenderRoot] Image failed to load:', img.src.substring(0, 50));
          };
        }
      };

      images.forEach(checkImage);
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      checkImagesReady();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [cards, onImagesReady]);

  // Expand cards by count
  const expandedCards: DeckCard[] = [];
  for (const deckCard of cards) {
    for (let i = 0; i < deckCard.count; i++) {
      expandedCards.push({ ...deckCard, count: 1 });
    }
  }

  // Grid dimensions (always 3x3)
  const gridDims = { cols: 3, rows: 3, cardsPerPage: 9 };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: '210mm', // A4 width
        height: '297mm', // A4 height
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
      className="pdf-render-root"
    >
      {/* Render cards in grid layout - ONLY base64 images */}
      {expandedCards.map((deckCard, index) => {
        const col = index % gridDims.cols;
        const row = Math.floor(index / gridDims.cols);
        
        // Get image URL - MUST be base64 (preloaded before mount)
        const imageUrl = deckCard.card.image_uris.full || 
                        deckCard.card.image_uris.large || 
                        deckCard.card.image_uris.small;

        // CRITICAL: Image URL should already be base64 at this point
        // If not, this is a programming error (preload failed)
        if (imageUrl && !imageUrl.startsWith('data:image/')) {
          console.error('[PdfRenderRoot] CRITICAL: Image URL is not base64:', {
            cardName: deckCard.card.name,
            imageUrl: imageUrl.substring(0, 50)
          });
          throw new Error(`Image for ${deckCard.card.name} is not base64. Preload must complete before mounting PdfRenderRoot.`);
        }

        return (
          <div
            key={`${deckCard.card.id}-${index}`}
            style={{
              position: 'absolute',
              left: `${(col * 63.5) + (col * 2)}mm`,
              top: `${(row * 88.9) + (row * 2)}mm`,
              width: '63.5mm',
              height: '88.9mm',
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={deckCard.card.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  console.error('[PdfRenderRoot] Image load error:', deckCard.card.name);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#ccc' }}>
                No image
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
