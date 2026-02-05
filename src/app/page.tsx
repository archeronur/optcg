'use client';

/**
 * MAIN PAGE COMPONENT - One Piece Proxy Print
 * 
 * CRITICAL ARCHITECTURE NOTE: PDF Generation Isolation
 * 
 * Why PDF generation must be isolated from static prerender lifecycle:
 * 
 * 1. Cloudflare Pages Static Prerendering:
 *    - The main route `/` is STATIC prerendered at build time
 *    - The HTML is generated server-side and served as static files
 *    - Client-side hydration happens AFTER the static HTML is served
 * 
 * 2. The Problem with PDF Generation on Static Pages:
 *    - PDF generation requires async image loading (fetch → base64 conversion)
 *    - Static prerender timing is unpredictable for async-heavy flows
 *    - Images may not be loaded when PDF generation code runs
 *    - This causes "Görsel yüklenemedi" (Image failed to load) errors in PDFs
 * 
 * 3. Why Client-Only Isolation Solves This:
 *    - PdfGeneratorClient component uses dynamic import with { ssr: false }
 *    - This ensures PDF code NEVER runs during prerender or SSR
 *    - PDF generation only runs after full client hydration
 *    - State machine enforces strict ordering: images must be base64 before PDF capture
 * 
 * 4. The Solution Architecture:
 *    a) PdfGeneratorClient: Fully client-only component with state machine
 *    b) PdfRenderRoot: Isolated rendering container (only mounts during PDF generation)
 *    c) Runtime Guard: Verifies all images are base64 before PDF capture
 *    d) Data-Driven: Uses card data URLs → proxy → base64 (no DOM dependency)
 * 
 * 5. Lifecycle Flow:
 *    - User clicks "Download PDF"
 *    - PdfGeneratorClient.generate() is called
 *    - State: IDLE → LOADING_IMAGES (preload all images as base64)
 *    - State: LOADING_IMAGES → READY (all images are base64)
 *    - PdfRenderRoot mounts (receives cards with base64 image URLs)
 *    - Runtime guard verifies all images in PdfRenderRoot are base64
 *    - State: READY → GENERATING (PDF generation with pdf-lib)
 *    - State: GENERATING → DONE (PDF downloaded)
 *    - PdfRenderRoot unmounts (cleanup)
 * 
 * This architecture guarantees:
 * - PDF generation never runs during static prerender
 * - All images are base64 before PDF capture
 * - Works identically on localhost and Cloudflare Pages
 * - No "Görsel yüklenemedi" errors in PDFs
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { DeckCard, ParsedDeckEntry, PrintSettings, Card } from '@/types';
import { DeckParser } from '@/utils/deckParser';
import { optcgAPI } from '@/services/api';
import { translationService } from '@/utils/translations';
import { debounce, throttle, createCleanup } from '@/utils/performance';
import { downloadPDF } from '@/utils/downloadHelper';
import CardSearchPanel from '@/components/CardSearchPanel';

export default function Home() {
  // State
  const [inputText, setInputText] = useState('');
  const [parsedDeck, setParsedDeck] = useState<ParsedDeckEntry[]>([]);
  const [resolvedCards, setResolvedCards] = useState<DeckCard[]>([]);
  const [missingCards, setMissingCards] = useState<ParsedDeckEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [language, setLanguage] = useState<'tr' | 'en'>('en');
  const [currentPreviewPage, setCurrentPreviewPage] = useState(1);
  const [imagesReady, setImagesReady] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  
  // Card detail popup state
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Art variant selection state
  const [cardVariants, setCardVariants] = useState<Card[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Card | null>(null);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [sameCardCount, setSameCardCount] = useState(0);
  
  // Remove card confirmation state (from quantity controls in modal or deck list)
  const [showRemoveCardConfirm, setShowRemoveCardConfirm] = useState(false);
  const [cardToRemove, setCardToRemove] = useState<DeckCard | null>(null);
  
  // Mobile detection - SSR-safe with initial check
  // Initialize with false to prevent hydration mismatch, will be set correctly on client
  const [isMobile, setIsMobile] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Animation states
  const [showCelebration, setShowCelebration] = useState(false);
  const [cardsLoading, setCardsLoading] = useState(false);
  
  // Enhanced mobile detection - SSR-safe for Cloudflare Pages
  useEffect(() => {
    // Mark as hydrated
    setIsHydrated(true);
    
    // Check if we're in browser environment
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      const width = window.innerWidth;
      const height = window.screen.height;
      
      // Multiple checks for better mobile detection
      const isMobileWidth = width <= 768;
      const isTouchDevice =
        'ontouchstart' in window || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0);
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
      
      // Consider mobile if width is small OR (touch device AND mobile user agent)
      const isMobileDevice = isMobileWidth || (isTouchDevice && isMobileUserAgent && width <= 1024);
      
      setIsMobile(isMobileDevice);
      
      // Add mobile class to body and html for CSS targeting
      if (typeof document !== 'undefined') {
        if (isMobileDevice) {
          document.body.classList.add('is-mobile');
          document.documentElement.classList.add('is-mobile');
        } else {
          document.body.classList.remove('is-mobile');
          document.documentElement.classList.remove('is-mobile');
        }
      }
    };
    
    // Initial check - immediate for better UX
    checkMobile();
    
    // Also check after a short delay to catch any late initialization (Cloudflare Pages specific)
    const delayedCheck = setTimeout(() => {
      checkMobile();
    }, 50);
    
    // Listen for resize events with debounce
    let resizeTimeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(checkMobile, 150);
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Handle orientation change
    const handleOrientationChange = () => {
      setTimeout(checkMobile, 200);
    };
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true });
    
    // Also check on touch events (for better detection)
    const handleTouch = () => {
      checkMobile();
    };
    
    window.addEventListener('touchstart', handleTouch, { once: true, passive: true });
    
    // Visual viewport API for better mobile detection (if available)
    if (window.visualViewport) {
      const handleViewportChange = () => {
        checkMobile();
      };
      window.visualViewport.addEventListener('resize', handleViewportChange);
      
      return () => {
        clearTimeout(delayedCheck);
        if (resizeTimeout) clearTimeout(resizeTimeout);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleOrientationChange);
        window.removeEventListener('touchstart', handleTouch);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleViewportChange);
        }
      };
    }
    
    return () => {
      clearTimeout(delayedCheck);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, []);
  
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    grid: '3x3', // Default grid, kullanıcı değiştirebilir
    includeBleed: false,
    includeCropMarks: true,
    includeBackPages: false,
    backMirrorHorizontally: true,
    safeMargin: 5,
    bleedSize: 3,
    cropMarkLengthMm: 2,
    cropMarkOffsetMm: 0.25,
    cropMarkThicknessPt: 0.25
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Performance optimizations
  const cleanup = useMemo(() => createCleanup(), []);
  
  // Input changes (instant state update)

  // Reset preview page when settings change
  useEffect(() => {
    setCurrentPreviewPage(1);
  }, [resolvedCards]);
  
  // Reset images ready state when resolved cards change
  useEffect(() => {
    setImagesReady(false);
    // Automatically set images ready when cards are loaded
    if (resolvedCards.length > 0) {
      // Set images ready with a short delay
      const timer = setTimeout(() => {
        setImagesReady(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resolvedCards]);

  // Generate deck list text from resolved cards
  const generateDeckListText = useCallback((cards: DeckCard[]): string => {
    if (cards.length === 0) return '';
    
    return cards.map(dc => {
      // Format: "4x Card Name (OP01-001)" or "4x Card Name (OP01-001_p1)" for variants
      const cardId = dc.card.id || `${dc.card.set_code}-${dc.card.number}`;
      return `${dc.count}x ${dc.card.name} (${cardId})`;
    }).join('\n');
  }, []);

  // Update input text when resolved cards change (art change, card add/remove)
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip initial mount to avoid overwriting user's initial input
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Update textarea with current deck list (also clear when all cards removed)
    const newDeckText = generateDeckListText(resolvedCards);
    setInputText(newDeckText);
  }, [resolvedCards, generateDeckListText]);
  
  // Register Service Worker
  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Initialize stability tools (dynamic import)
  useEffect(() => {
    let mounted = true;
    let imported: any = null;
    (async () => {
      try {
        imported = await import('@/utils/stability');
        if (!mounted) return;
        imported.memoryMonitor.startMonitoring(10000);
        imported.networkMonitor.addNetworkChangeListener(() => {
          const networkInfo = imported.networkMonitor.getNetworkInfo();
          if (!networkInfo.isOnline) {
            console.warn('Internet connection lost');
            setError('Internet connection lost. Please check your connection.');
          }
        });
        imported.resourceManager.registerResource('memoryMonitor', () => imported.memoryMonitor.stopMonitoring());
        imported.resourceManager.registerResource('networkMonitor', () => imported.networkMonitor.removeNetworkChangeListener(() => {}));
      } catch (error) {
        console.error('Stability tools initialization error:', error);
      }
    })();
    return () => {
      mounted = false;
      try {
        if (imported) {
          imported.memoryMonitor.stopMonitoring();
          imported.resourceManager.cleanupAll();
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    };
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup.cleanup();
      optcgAPI.cleanup();
      // Clear abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cleanup]);

  // Set language to English only
  useEffect(() => {
    translationService.setLanguage('en');
  }, []);

  // Helper functions

  const showError = useCallback((message: string) => {
    console.log('=== showError ===');
    console.log('Error message:', message);
    // Error tracking (dinamik import)
    import('@/utils/stability').then(m => m.errorTracker.trackError(new Error(message), 'user-interface')).catch(() => {});
    
    setError(message);
    setTimeout(() => setError(''), 5000);
  }, []);

  const showSuccess = useCallback((message: string) => {
    console.log('=== showSuccess ===');
    console.log('Success message:', message);
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  // Resolve cards (get info from API) - Batch processing
  const resolveCards = useCallback(async (entries: ParsedDeckEntry[]) => {
    console.log('=== resolveCards START ===');
    console.log('Entries received:', entries);
    console.log('Entries length:', entries.length);
    
    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setCardsLoading(true);
    try {
      console.log('Calling optcgAPI.findCardsBatch...');
      // Optimize batch processing - process in parallel
      const batchResults = await optcgAPI.findCardsBatch(entries, abortControllerRef.current.signal);
      console.log('Batch results received:', batchResults);
      console.log('Batch results size:', batchResults.size);
      
      const resolvedMap = new Map<string, DeckCard>(); // Use Map to merge same cards
      const missing: ParsedDeckEntry[] = [];

      // Process results - merge same cards by ID
      entries.forEach(entry => {
        const cacheKey = `${entry.name}_${entry.set_code || ''}_${entry.number || ''}`;
        console.log(`Processing entry: ${entry.name}, cache key: ${cacheKey}`);
        const card = batchResults.get(cacheKey);
        console.log(`Card found for ${entry.name}:`, card);
        
        if (card && card !== null) {
          // Check if this card ID already exists (merge same cards, keep different arts separate)
          const cardId = card.id;
          if (resolvedMap.has(cardId)) {
            // Merge count with existing card
            const existing = resolvedMap.get(cardId)!;
            resolvedMap.set(cardId, { ...existing, count: existing.count + entry.count });
            console.log(`Merged card ${cardId}: new count = ${existing.count + entry.count}`);
          } else {
            // Add new card
            resolvedMap.set(cardId, { card, count: entry.count });
          }
        } else {
          missing.push(entry);
        }
      });
      
      // Convert Map to array
      const resolved = Array.from(resolvedMap.values());
      
      console.log('Resolved cards:', resolved);
      console.log('Missing cards:', missing);
      
      console.log('Setting resolved cards...');
      setResolvedCards(resolved);
      console.log('Setting missing cards...');
      setMissingCards(missing);

      // Only show error if there are truly missing cards (not found even with fallback)
      if (missing.length > 0) {
        console.log(`Showing warning for ${missing.length} missing cards`);
        // Show warning instead of error - cards may still work with fallback images
        console.warn(`${missing.length} cards could not be found in API, but may still display correctly`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Card resolution was aborted');
        return;
      }
      console.error('Batch card resolution failed:', error);
      showError('Card resolution error');
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
      setCardsLoading(false);
    }
  }, [showError]);

  // Deck parsing
  const handleParseDeck = useCallback(async () => {
    console.log('=== handleParseDeck START ===');
    console.log('Input text:', inputText);
    console.log('Input text length:', inputText.length);
    console.log('Input text trimmed:', inputText.trim());
    
    if (!inputText.trim()) {
      console.log('No input text, showing error');
      showError('Please enter a deck first');
      return;
    }

    const { PerformanceMonitor } = await import('@/utils/performanceTest');
    const monitor = new PerformanceMonitor();
    monitor.start();

    setIsLoading(true);
    setError('');
    console.log('Set loading to true, cleared error');

    try {
      console.log('Calling DeckParser.parseText...');
      const parsed = DeckParser.parseText(inputText);
      console.log('Parse result:', parsed);
      console.log('Parse result length:', parsed.length);
      monitor.markParseComplete();
      
      if (parsed.length === 0) {
        console.log('No cards parsed, showing warning');
        showError('Deck appears to be empty');
        return;
      }

      console.log('Setting parsed deck...');
      setParsedDeck(parsed);
      console.log('Calling resolveCards...');
      await resolveCards(parsed);
      monitor.markResolveComplete();
      
      console.log('Showing success message...');
      showSuccess('Deck parsed successfully');
      monitor.logMetrics('Deck Parsing');
    } catch (err) {
      console.error('Parse error:', err);
      showError(`Parse error: ${err}`);
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  }, [inputText, resolveCards, showError, showSuccess]);


  // Generate PDF
  const handleGeneratePDF = useCallback(async () => {
    if (resolvedCards.length === 0) {
      showError('Please enter a deck first');
      return;
    }

    // Check PDF generation status
    if (pdfGenerating) {
      console.log('PDF generation already in progress');
      return;
    }

    setPdfGenerating(true);
    setIsLoading(true);
    setLoadingProgress({ current: 0, total: resolvedCards.length, message: 'Preparing PDF...' });
    
    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      console.log('Starting PDF generation...');
      
      // Start performance tracking
      const { performanceTracker } = await import('@/utils/stability');
      performanceTracker.mark('pdf-generation-start');
      
      const { PDFGenerator } = await import('@/utils/pdfGenerator');
      const generator = new PDFGenerator(printSettings, abortControllerRef.current.signal);
      
      // Add progress callback
      const updateProgress = (current: number, total: number, message: string) => {
        console.log(`Progress: ${current}/${total} - ${message}`);
        setLoadingProgress({ current, total, message });
      };
      
      const pdfBytes = await generator.generatePDF(resolvedCards, updateProgress);
      
      // Complete performance tracking
      performanceTracker.measure('pdf-generation-total', 'pdf-generation-start');
      const generationTime = performanceTracker.getMeasure('pdf-generation-total');
      console.log(`PDF generation completed in ${generationTime?.toFixed(2)}ms`);
      
      console.log('PDF generated, size:', pdfBytes.length, 'bytes');
      
      // Download PDF using improved download helper
      const filename = `onepiece-deck-${Date.now()}.pdf`;
      const downloadResult = await downloadPDF(pdfBytes, filename);
      
      if (downloadResult.success) {
        console.log(`PDF downloaded successfully using ${downloadResult.method}`);
        showSuccess('PDF generated and downloaded successfully');
        
        // Show celebration animation
        setShowCelebration(true);
      } else {
        console.error('PDF download failed:', downloadResult.error);
        showError(
          downloadResult.error || 
          'PDF could not be downloaded. Please check your browser settings or try a different browser.'
        );
      }
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('PDF generation was aborted');
        return;
      }
      
      console.error('PDF generation error:', err);
      
      // More detailed error messages
      let errorMessage = 'PDF could not be generated';
      
      if (err.message) {
        if (err.message.includes('fetch')) {
          errorMessage = 'Images could not be loaded. Please check your internet connection.';
        } else if (err.message.includes('embed')) {
          errorMessage = 'PDF image embedding error. Image format may not be supported.';
        } else if (err.message.includes('memory')) {
          errorMessage = 'Insufficient memory. Try with fewer cards.';
        } else {
          errorMessage = `PDF error: ${err.message}`;
        }
      }
      
      showError(errorMessage);
    } finally {
      setPdfGenerating(false);
      setIsLoading(false);
      setLoadingProgress(null);
    }
  }, [resolvedCards, printSettings, pdfGenerating, showError, showSuccess]);

  // Clear deck
  const handleClearDeck = useCallback(() => {
    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setInputText('');
    setParsedDeck([]);
    setResolvedCards([]);
    setMissingCards([]);
    setError('');
    setSuccess('');
    setImagesReady(false);
    setPdfGenerating(false);
    setLoadingProgress(null);
    setShowCelebration(false);
    setCardsLoading(false);
  }, []);

  // Add card from search panel
  const handleAddCardFromSearch = useCallback((card: Card, count: number) => {
    setResolvedCards(prev => {
      // Check if card already exists
      const existingIndex = prev.findIndex(dc => dc.card.id === card.id);
      
      if (existingIndex >= 0) {
        // Update count for existing card
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          count: updated[existingIndex].count + count
        };
        return updated;
      } else {
        // Add new card
        return [...prev, { card, count }];
      }
    });
    
    // inputText is automatically updated via useEffect when resolvedCards changes
    
    showSuccess(`Added ${count}x ${card.name} to deck`);
  }, [showSuccess]);

  // Remove card from deck
  const handleRemoveCard = useCallback((cardId: string) => {
    setResolvedCards(prev => prev.filter(dc => dc.card.id !== cardId));
    showSuccess('Card removed from deck');
  }, [showSuccess]);

  // Update card count in deck
  const handleUpdateCardCount = useCallback((cardId: string, newCount: number) => {
    if (newCount <= 0) {
      handleRemoveCard(cardId);
      return;
    }
    
    setResolvedCards(prev => prev.map(dc => 
      dc.card.id === cardId ? { ...dc, count: newCount } : dc
    ));
  }, [handleRemoveCard]);

  // Card detail popup handlers
  const handleCardClick = useCallback((card: DeckCard) => {
    setSelectedCard(card);
    setIsModalOpen(true);
    setSelectedVariant(null);
    setCardVariants([]);
    
    // Load card variants
    setIsLoadingVariants(true);
    optcgAPI.getCardVariants(card.card.id).then(async (variants) => {
      // Remove duplicate variants by ID
      const uniqueVariants = variants.filter((variant, index, self) => 
        index === self.findIndex(v => v.id === variant.id)
      );
      
      // Copy card info from the original card to variants that only have generic names
      const enrichedVariants = uniqueVariants.map(variant => {
        // If variant has a generic name like "Card OP13-002", use the original card's name
        if (variant.name.startsWith('Card ') || variant.name === 'Unknown') {
          return {
            ...variant,
            name: card.card.name,
            type: variant.type === 'Unknown' ? card.card.type : variant.type,
            colors: variant.colors && variant.colors.length > 0 ? variant.colors : card.card.colors,
            cost: variant.cost ?? card.card.cost,
            rarity: variant.rarity === 'Unknown' ? card.card.rarity : variant.rarity,
            text: variant.text || card.card.text,
            subtypes: variant.subtypes && variant.subtypes.length > 0 ? variant.subtypes : card.card.subtypes,
          };
        }
        return variant;
      });
      
      // Helper function to check if image URL is valid
      const getImageUrl = (variant: Card): string | null => {
        if (!variant.image_uris) return null;
        const url =
          variant.image_uris.small ||
          variant.image_uris.large ||
          variant.image_uris.full;
        // Check if URL is valid (not null, undefined, empty, or string 'null'/'undefined')
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
        // Check if it's a valid URL format
        try {
          new URL(trimmed);
          return trimmed;
        } catch {
          return null;
        }
      };
      
      // Filter out variants without valid image URLs (but show them if URL exists, even if it might fail to load)
      // We'll let the onError handler in the img tag hide failed images instead of pre-filtering
      const variantsWithImageUrls = enrichedVariants.filter(variant => {
        const imageUrl = getImageUrl(variant);
        return !!imageUrl;
      });
      
      console.log(`[Variant Filter] Found ${variantsWithImageUrls.length}/${enrichedVariants.length} variants with image URLs`);
      
      // Show all variants with valid URLs - let browser handle image loading errors
      // The onError handler in the img tag will hide cards that fail to load
      setCardVariants(variantsWithImageUrls);
      setIsLoadingVariants(false);
    }).catch(err => {
      console.error('Error loading variants:', err);
      setIsLoadingVariants(false);
      setCardVariants([]);
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCard(null);
    setCardVariants([]);
    setSelectedVariant(null);
    setShowConfirmDialog(false);
  }, []);

  // Handle variant selection
  const handleSelectVariant = useCallback((variant: Card) => {
    setSelectedVariant(variant);
  }, []);

  // Get base card ID (without variant suffix)
  const getBaseCardId = useCallback((cardId: string): string => {
    return cardId.replace(/_p\d+$|_aa$|_sp$|_manga$/i, '');
  }, []);

  // Count cards with the EXACT same ID in deck (not base ID)
  // This counts only cards with the same art variant
  const countSameExactCards = useCallback((cardId: string): number => {
    const cardIdClean = cardId.toUpperCase().replace(/-/g, '');
    return resolvedCards.filter(dc => {
      const dcCardId = dc.card.id.toUpperCase().replace(/-/g, '');
      return dcCardId === cardIdClean;
    }).reduce((sum, dc) => sum + dc.count, 0);
  }, [resolvedCards]);

  // Handle change art button click
  const handleChangeArtClick = useCallback(() => {
    if (!selectedCard || !selectedVariant) return;
    
    // Check if the selected variant is the same as current
    if (selectedVariant.id === selectedCard.card.id) {
      showError('This art is already applied');
      return;
    }
    
    // Count only cards with the exact same ID (same art variant)
    const sameCards = countSameExactCards(selectedCard.card.id);
    
    if (sameCards > 1) {
      // There are 2 or more cards with the same ID - ask user
      setSameCardCount(sameCards);
      setShowConfirmDialog(true);
    } else {
      // Only 1 card, change directly
      applyArtChange(false);
    }
  }, [selectedCard, selectedVariant, countSameExactCards]);

  // Apply art change
  const applyArtChange = useCallback((changeAll: boolean) => {
    if (!selectedCard || !selectedVariant) return;
    
    // Use exact card ID for matching (not base ID)
    const exactCardId = selectedCard.card.id.toUpperCase().replace(/-/g, '');
    
    setResolvedCards(prev => {
      if (changeAll) {
        // Change ALL cards with the EXACT same ID (same art variant only)
        // OP12-030 will change, but OP12-030_p2 will NOT change
        return prev.map(dc => {
          const dcCardId = dc.card.id.toUpperCase().replace(/-/g, '');
          if (dcCardId === exactCardId) {
            return { ...dc, card: selectedVariant };
          }
          return dc;
        });
      } else {
        // Only change 1 card - need to split the entry if count > 1
        const result: DeckCard[] = [];
        let changed = false;
        
        for (const dc of prev) {
          if (!changed && dc.card.id === selectedCard.card.id) {
            changed = true;
            
            if (dc.count > 1) {
              // Split: keep (count - 1) of original, add 1 of new variant
              result.push({ ...dc, count: dc.count - 1 });
              
              // Check if new variant already exists in deck
              const existingVariantIndex = result.findIndex(
                item => item.card.id === selectedVariant.id
              );
              if (existingVariantIndex >= 0) {
                result[existingVariantIndex] = {
                  ...result[existingVariantIndex],
                  count: result[existingVariantIndex].count + 1
                };
              } else {
                result.push({ card: selectedVariant, count: 1 });
              }
            } else {
              // count is 1, just replace the card
              // Check if new variant already exists
              const existingVariantIndex = result.findIndex(
                item => item.card.id === selectedVariant.id
              );
              if (existingVariantIndex >= 0) {
                result[existingVariantIndex] = {
                  ...result[existingVariantIndex],
                  count: result[existingVariantIndex].count + 1
                };
              } else {
                result.push({ card: selectedVariant, count: 1 });
              }
            }
          } else {
            // Check if this is the new variant we might need to merge with
            const existingNewVariant = result.find(item => item.card.id === dc.card.id);
            if (existingNewVariant) {
              existingNewVariant.count += dc.count;
            } else {
              result.push(dc);
            }
          }
        }
        
        return result;
      }
    });
    
    setShowConfirmDialog(false);
    showSuccess(changeAll 
      ? `All ${selectedCard.card.id} cards changed to ${selectedVariant.variantLabel || 'Standard'} art` 
      : `1x card changed to ${selectedVariant.variantLabel || 'Standard'} art`
    );
    
    // Update the selected card in modal to the new variant
    setSelectedCard(prev => prev ? { ...prev, card: selectedVariant, count: 1 } : null);
    setSelectedVariant(null);
  }, [selectedCard, selectedVariant, showSuccess]);

  // Calculate total quantity for selected card (same card ID, variants are separate)
  const selectedCardTotalQuantity = useMemo(() => {
    if (!selectedCard || !resolvedCards.length) return 0;
    
    // Count all cards with the same ID (variant'lar farklı ID'ye sahip olduğu için ayrı sayılır)
    return resolvedCards
      .filter(dc => dc.card.id === selectedCard.card.id)
      .reduce((sum, dc) => sum + dc.count, 0);
  }, [selectedCard, resolvedCards]);

  // Quantity control handlers for modal
  const handleQuantityIncrease = useCallback(() => {
    if (!selectedCard) return;
    handleUpdateCardCount(selectedCard.card.id, selectedCardTotalQuantity + 1);
    setSelectedCard(prev => prev ? { ...prev, count: prev.count + 1 } : null);
  }, [selectedCard, selectedCardTotalQuantity, handleUpdateCardCount]);

  const handleQuantityDecrease = useCallback(() => {
    if (!selectedCard) return;
    if (selectedCardTotalQuantity <= 1) {
      setCardToRemove(selectedCard);
      setShowRemoveCardConfirm(true);
    } else {
      handleUpdateCardCount(selectedCard.card.id, selectedCardTotalQuantity - 1);
      setSelectedCard(prev => prev ? { ...prev, count: prev.count - 1 } : null);
    }
  }, [selectedCard, selectedCardTotalQuantity, handleUpdateCardCount]);

  // Deck list quantity handlers (used from the deck list panel)
  const handleDeckListIncrease = useCallback((deckCard: DeckCard) => {
    handleUpdateCardCount(deckCard.card.id, deckCard.count + 1);
  }, [handleUpdateCardCount]);

  const handleDeckListDecrease = useCallback((deckCard: DeckCard) => {
    if (deckCard.count <= 1) {
      setCardToRemove(deckCard);
      setShowRemoveCardConfirm(true);
    } else {
      handleUpdateCardCount(deckCard.card.id, deckCard.count - 1);
    }
  }, [handleUpdateCardCount]);

  const handleConfirmRemoveCard = useCallback(() => {
    const card = cardToRemove || selectedCard;
    if (!card) return;
    handleRemoveCard(card.card.id);
    setShowRemoveCardConfirm(false);
    setCardToRemove(null);
    // Close modal if the removed card was the selected one in modal
    if (selectedCard && card.card.id === selectedCard.card.id) {
      setIsModalOpen(false);
      setSelectedCard(null);
    }
  }, [cardToRemove, selectedCard, handleRemoveCard]);

  // Page navigation handlers (optimized)
  const handlePrevPage = useCallback(() => {
    setCurrentPreviewPage(prev => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback((maxPages: number) => {
    setCurrentPreviewPage(prev => Math.min(maxPages, prev + 1));
  }, []);

  const handlePageSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentPreviewPage(parseInt(e.target.value));
  }, []);

  // Statistics calculation (memoized)
  const stats = useMemo(() => {
    if (resolvedCards.length === 0) {
      return null;
    }
    
    const totalCards = resolvedCards.reduce((sum, card) => sum + card.count, 0);
    
    // Her zaman 3x3
    let cardsPerPage = 9;
    
    const totalPages = Math.ceil(totalCards / cardsPerPage);
    const lastPageCards = totalCards % cardsPerPage || cardsPerPage;
    const lastPageUtilization = lastPageCards / cardsPerPage;
    
    return {
      totalCards,
      uniqueCards: resolvedCards.length,
      totalPages,
      cardsPerPage,
      lastPageUtilization,
      estimatedPrintTime: `${Math.ceil(totalPages * 0.5)} minutes`,
      paperEfficiency: totalCards / (totalPages * cardsPerPage)
    };
  }, [resolvedCards]);

  // Expanded cards (memoized separately for performance)
  const expandedCards = useMemo(() => {
    if (!resolvedCards.length) return [];
    
    const cards: DeckCard[] = [];
    for (const deckCard of resolvedCards) {
      for (let i = 0; i < deckCard.count; i++) {
        cards.push(deckCard);
      }
    }
    return cards;
  }, [resolvedCards]);

  // Preview cards for current page (fast lookup)
  const previewCards = useMemo(() => {
    if (!stats || !expandedCards.length) return [];
    
    const startIndex = (currentPreviewPage - 1) * stats.cardsPerPage;
    const pageCards = expandedCards.slice(startIndex, startIndex + stats.cardsPerPage);
    
    return Array.from({ length: stats.cardsPerPage }).map((_, index) => pageCards[index] || null);
  }, [expandedCards, stats, currentPreviewPage]);

  return (
    <div className="container">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏴‍☠️</div>
            <h1>One Piece Proxy Print</h1>
            <p>Professional proxy printing tool for One Piece Trading Card Game cards</p>
          </div>
        </div>
      </header>

      <div className="main-layout">
        {/* Left panel - Input */}
        <div className="input-section">
          <h2>Deck Input</h2>
          
          {/* Card Search Panel */}
          <CardSearchPanel 
            onAddCard={handleAddCardFromSearch}
            existingCards={resolvedCards}
          />
          
          <div className="section-divider">
            <span>or paste deck list</span>
          </div>
          
          <div>
            <textarea
              className="textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Paste your deck list here:

4x Monkey D. Luffy (OP01-001)
3x Roronoa Zoro (OP01-002)
2x Nami (OP01-003)

Or use the new format:
1xOP11-040
4xOP05-067_p1
4xST18-001

Variant/Alt Art formats:
1x Portgas.D.Ace (OP13-002_p1)
1xOP13-002_p1

Supported formats:
• "Count x Card Name (SetCode-Number)"
• "Count x Card Name (SetCode-Number_variant)"
• "Count x SetCode-Number" or "SetCode-Number_p1"
• Just "Card Name" (count defaults to 1)

Variants: _p1, _p2 (Parallel), _aa (Alt Art), _sp (Special)`}
              disabled={isLoading}
              style={{ minHeight: '160px' }}
            />
            <button 
              className="button" 
              onClick={handleParseDeck}
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? 'Processing...' : 'Parse Deck'}
            </button>
          </div>

          {/* Clear button */}
          {(parsedDeck.length > 0 || resolvedCards.length > 0) && (
            <button 
              className="button secondary clear-button" 
              onClick={handleClearDeck}
            >
              Clear
            </button>
          )}

          {/* Deck Card List */}
          {resolvedCards.length > 0 && (
            <div className="deck-list-panel">
              <div className="deck-list-header">
                <h3>🃏 Deck List</h3>
                <span className="deck-list-count">
                  {resolvedCards.reduce((sum, dc) => sum + dc.count, 0)} cards ({resolvedCards.length} unique)
                </span>
              </div>
              <div className="deck-list-items">
                {resolvedCards.map((dc) => (
                  <div key={dc.card.id} className="deck-list-item">
                    <div className="deck-list-item-image">
                      <img 
                        src={dc.card.image_uris.small || dc.card.image_uris.large} 
                        alt={dc.card.name}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="deck-list-item-info">
                      <span className="deck-list-item-name">{dc.card.name}</span>
                      <span className="deck-list-item-id">{dc.card.id}</span>
                    </div>
                    <div className="deck-list-item-controls">
                      <button 
                        className="deck-list-btn deck-list-btn-minus"
                        onClick={() => handleDeckListDecrease(dc)}
                        title="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="deck-list-item-count">{dc.count}</span>
                      <button 
                        className="deck-list-btn deck-list-btn-plus"
                        onClick={() => handleDeckListIncrease(dc)}
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {loadingProgress && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                />
              </div>
              <div className="progress-text">
                {loadingProgress.message} ({loadingProgress.current}/{loadingProgress.total})
              </div>
            </div>
          )}

          {/* Error and success messages */}
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          {/* Missing cards warning */}
          {missingCards.length > 0 && (
            <div className="warning">
              <h4>Some cards could not be found</h4>
              <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                {missingCards.slice(0, 5).map((card, index) => (
                  <li key={index} style={{ fontSize: '12px' }}>
                    {card.count}x {card.name} {card.set_code && `(${card.set_code})`}
                  </li>
                ))}
                {missingCards.length > 5 && (
                  <li style={{ fontSize: '12px', color: '#666' }}>
                    ...and {missingCards.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Right panel - Preview and settings */}
        <div className="preview-section">
          <h2>Preview & Settings</h2>

          {/* Print settings - Crop Marks */}
          <div className="print-settings-panel">
            <div className="print-settings-header">
              <h3>⚙️ Print Settings</h3>
              <span className="grid-badge">3×3 Grid</span>
            </div>
            <div className="print-settings-body">
              <div className="cropmark-settings-row">
                <div className="cropmark-field">
                  <label htmlFor="cropMarkLength">Length <span className="field-unit">(mm)</span></label>
                  <input
                    id="cropMarkLength"
                    type="number"
                    min={1}
                    max={10}
                    step={0.05}
                    value={printSettings.cropMarkLengthMm ?? 2}
                    onChange={(e) => setPrintSettings(prev => ({
                      ...prev,
                      cropMarkLengthMm: parseFloat(e.target.value)
                    }))}
                    className="cropmark-input"
                  />
                </div>
                <div className="cropmark-field">
                  <label htmlFor="cropMarkOffset">Offset <span className="field-unit">(mm)</span></label>
                  <input
                    id="cropMarkOffset"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={2}
                    step={0.05}
                    value={printSettings.cropMarkOffsetMm ?? 0.25}
                    onChange={(e) => setPrintSettings(prev => ({
                      ...prev,
                      cropMarkOffsetMm: parseFloat(e.target.value)
                    }))}
                    className="cropmark-input"
                  />
                </div>
                <div className="cropmark-field">
                  <label htmlFor="cropMarkThickness">Thickness <span className="field-unit">(pt)</span></label>
                  <input
                    id="cropMarkThickness"
                    type="number"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={printSettings.cropMarkThicknessPt ?? 0.25}
                    onChange={(e) => setPrintSettings(prev => ({
                      ...prev,
                      cropMarkThicknessPt: parseFloat(e.target.value)
                    }))}
                    className="cropmark-input"
                  />
                </div>
              </div>
            </div>
          </div>


          {/* Skeleton Loading while cards are being fetched */}
          {cardsLoading && (
            <div className="preview-section-container">
              <h3>Loading Cards...</h3>
              <div className="skeleton-grid">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="skeleton-card" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="skeleton-shimmer"></div>
                  </div>
                ))}
              </div>
              <div className="loading-indicator">
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p>Fetching card data from API...</p>
              </div>
            </div>
          )}

          {/* Preview grid - All pages */}
          {!cardsLoading && resolvedCards.length > 0 && stats && (
            <div className="preview-section-container">
              <h3>Preview ({stats.totalPages} pages)</h3>
              
              {/* Page selector */}
              <div className="page-selector">
                <label>Page: </label>
                <select 
                  className="select page-select"
                  value={currentPreviewPage}
                  onChange={handlePageSelect}
                >
                  {Array.from({ length: stats.totalPages }, (_, i) => (
                    <option key={i} value={i + 1}>
                      Page {i + 1} {i === stats.totalPages - 1 ? `(${stats.totalCards % stats.cardsPerPage || stats.cardsPerPage} cards)` : `(${stats.cardsPerPage} cards)`}
                    </option>
                  ))}
                </select>
                
                <button 
                  className="button secondary page-nav-button" 
                  onClick={handlePrevPage}
                  disabled={currentPreviewPage <= 1}
                >
                  ← Previous
                </button>
                <button 
                  className="button secondary page-nav-button" 
                  onClick={() => handleNextPage(stats.totalPages)}
                  disabled={currentPreviewPage >= stats.totalPages}
                >
                  Next →
                </button>
              </div>

              {/* Preview Grid */}
              <div className={`preview-grid-wrapper ${isMobile ? 'mobile-view' : ''}`}>
                <div 
                  className={`preview-grid preview-grid-3x3 ${isMobile ? 'mobile-grid' : ''}`}
                >
                  {previewCards.map((card, index) => (
                    <div 
                      key={index} 
                      className={`card-slot ${card ? 'clickable' : ''}`}
                      onClick={() => card && handleCardClick(card)}
                      title={card ? `Click to view ${card.card.name}` : undefined}
                    >
                      {card ? (
                        <div className="card-container">
                          <img 
                            src={card.card.image_uris.small || card.card.image_uris.large} 
                            alt={card.card.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          {card.card.variantLabel && card.card.variant !== 'standard' && (
                            <div className={`card-variant-badge variant-${card.card.variant}`}>
                              {card.card.variantLabel}
                            </div>
                          )}
                          {printSettings.includeBleed && (
                            <div className="bleed-indicator" />
                          )}
                          {printSettings.includeCropMarks && (
                            <div className="crop-marks-indicator" />
                          )}
                          <div className="card-id-badge">
                            {card.card.set_code?.replace('-', '')}-{card.card.number}
                          </div>
                          <div className="card-hover-overlay">
                            <span>🔍 View Details</span>
                          </div>
                        </div>
                      ) : (
                        <span>Empty</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Export buttons */}
          {resolvedCards.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <button 
                className="button" 
                onClick={handleGeneratePDF}
                disabled={isLoading || pdfGenerating}
                style={{ display: 'block', width: '100%', marginBottom: '10px' }}
              >
                {isLoading || pdfGenerating ? (
                  loadingProgress ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                        {loadingProgress.message}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.8 }}>
                        {Math.round((loadingProgress.current / loadingProgress.total) * 100)}% completed
                      </div>
                    </div>
                  ) : (
                    'Generating PDF...'
                  )
                ) : (
                  'Download PDF'
                )}
              </button>

              
              {/* PDF generation tips */}
              {!isLoading && (
                <div className="info-box">
                  <strong>💡 Tips:</strong>
                  <ul>
                    <li>Images are loaded when creating PDF for the first time (1-2 minutes)</li>
                    <li>May take longer for large decks</li>
                    <li>Make sure your internet connection is stable</li>
                    <li><strong>🎨 Change Art:</strong> Click on any card in preview to view details and switch between alternative arts (Parallel, Alt Art, etc.)</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Legal notice and proxy warning */}
      <div className="legal-notice">
        <h4>⚠️ Important Notice</h4>
        <p><strong>Proxy cards are prohibited in official One Piece Trading Card Game tournaments.</strong> This tool is for personal use and practice purposes only. All card images and trademarks belong to Eiichiro Oda, Bandai, Shonen Jump and Viz Media. Please respect community guidelines and copyright laws.</p>
        <p style={{ marginTop: '10px', fontSize: '11px' }}>
          Use "Actual size" or "100% scale" option in your printer. Disable "Fit to page" option.
        </p>
      </div>

      {/* Celebration Animation */}
      {showCelebration && (
        <div className="celebration-overlay">
          <div className="confetti-container">
            {Array.from({ length: 50 }).map((_, i) => (
              <div 
                key={i} 
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: ['#ff6b6b', '#ffd700', '#4ecdc4', '#45b7d1', '#ff8c00', '#667eea', '#f093fb'][Math.floor(Math.random() * 7)]
                }}
              />
            ))}
          </div>
          <div className="celebration-content">
            <button 
              className="celebration-close" 
              onClick={() => setShowCelebration(false)}
              title="Close"
            >
              ×
            </button>
            <div className="celebration-icon">🎉</div>
            <h2>PDF Ready!</h2>
            <p>Your deck has been successfully generated</p>
            <div className="celebration-cards">
              <span>🏴‍☠️</span>
              <span>🃏</span>
              <span>⚔️</span>
            </div>
            <button 
              className="celebration-dismiss-btn"
              onClick={() => setShowCelebration(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {isModalOpen && selectedCard && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseModal}>×</button>
            
            <div className="modal-body">
              <div className="modal-image-section">
                <img 
                  src={selectedCard.card.image_uris.large || selectedCard.card.image_uris.full} 
                  alt={selectedCard.card.name}
                  className="modal-card-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/card-back.jpg';
                  }}
                />
              </div>
              
              <div className="modal-info-section">
                <div className="modal-card-name-row">
                  <h2 className="modal-card-name">{selectedCard.card.name}</h2>
                  {selectedCard.card.variantLabel && selectedCard.card.variant !== 'standard' && (
                    <span className={`variant-badge variant-${selectedCard.card.variant} large`}>
                      {selectedCard.card.variantLabel}
                    </span>
                  )}
                </div>
                
                <div className="modal-card-details">
                  <div className="detail-row">
                    <span className="detail-label">Set:</span>
                    <span className="detail-value">{selectedCard.card.set_name || selectedCard.card.set_code}</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="detail-label">Number:</span>
                    <span className="detail-value">{selectedCard.card.id || selectedCard.card.number}</span>
                  </div>
                  
                  {selectedCard.card.variantLabel && selectedCard.card.variant !== 'standard' && (
                    <div className="detail-row">
                      <span className="detail-label">Version:</span>
                      <span className={`detail-value variant-badge variant-${selectedCard.card.variant}`}>
                        {selectedCard.card.variantLabel}
                      </span>
                    </div>
                  )}
                  
                  {selectedCard.card.rarity && (
                    <div className="detail-row">
                      <span className="detail-label">Rarity:</span>
                      <span className="detail-value rarity-badge">{selectedCard.card.rarity}</span>
                    </div>
                  )}
                  
                  {selectedCard.card.type && (
                    <div className="detail-row">
                      <span className="detail-label">Type:</span>
                      <span className="detail-value">{selectedCard.card.type}</span>
                    </div>
                  )}
                  
                  {selectedCard.card.colors && selectedCard.card.colors.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Color:</span>
                      <span className="detail-value color-badges">
                        {selectedCard.card.colors.map((color, idx) => (
                          <span key={idx} className={`color-badge color-${color.toLowerCase()}`}>
                            {color}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  
                  {selectedCard.card.cost !== undefined && (
                    <div className="detail-row">
                      <span className="detail-label">Cost:</span>
                      <span className="detail-value cost-value">{selectedCard.card.cost}</span>
                    </div>
                  )}
                  
                  {selectedCard.card.subtypes && selectedCard.card.subtypes.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Subtypes:</span>
                      <span className="detail-value">{selectedCard.card.subtypes.join(' / ')}</span>
                    </div>
                  )}
                  
                  <div className="detail-row">
                    <span className="detail-label">Quantity in Deck:</span>
                    <div className="detail-value quantity-controls">
                      <button 
                        className="quantity-ctrl-btn quantity-ctrl-minus"
                        onClick={handleQuantityDecrease}
                        title="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="quantity-badge">{selectedCardTotalQuantity}x</span>
                      <button 
                        className="quantity-ctrl-btn quantity-ctrl-plus"
                        onClick={handleQuantityIncrease}
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                
                {selectedCard.card.text && (
                  <div className="modal-card-text">
                    <h4>Card Effect:</h4>
                    <p>{selectedCard.card.text}</p>
                  </div>
                )}
                
                {selectedCard.card.flavor_text && (
                  <div className="modal-flavor-text">
                    <p>"{selectedCard.card.flavor_text}"</p>
                  </div>
                )}
                
                {selectedCard.card.artist && (
                  <div className="modal-artist">
                    <span>Illustrated by: {selectedCard.card.artist}</span>
                  </div>
                )}
                
                {/* Alternative Art Selection Section */}
                <div className="art-variants-section">
                  <h4>🎨 Alternative Arts</h4>
                  <p className="art-variants-hint">Click on an art below to select it, then press the change button to apply.</p>
                  
                  {isLoadingVariants ? (
                    <div className="variants-loading">
                      <div className="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <p>Loading art variants...</p>
                    </div>
                  ) : cardVariants.length > 1 ? (
                    <>
                      <div className="variants-grid">
                        {cardVariants.map((variant, index) => (
                          <div 
                            key={variant.id || index}
                            className={`variant-card ${selectedVariant?.id === variant.id ? 'selected' : ''} ${variant.id === selectedCard.card.id ? 'current' : ''}`}
                            onClick={() => handleSelectVariant(variant)}
                          >
                            <img 
                              src={variant.image_uris.small || variant.image_uris.large} 
                              alt={`${variant.name} - ${variant.variantLabel || 'Standard'}`}
                              loading="lazy"
                              onError={(e) => {
                                // Hide the variant card if image fails to load (backup safety)
                                const cardElement = (e.target as HTMLImageElement).closest('.variant-card');
                                if (cardElement) {
                                  (cardElement as HTMLElement).style.display = 'none';
                                }
                              }}
                              onLoad={(e) => {
                                // Verify image loaded successfully - hide if dimensions are invalid
                                const img = e.target as HTMLImageElement;
                                if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                                  const cardElement = img.closest('.variant-card');
                                  if (cardElement) {
                                    (cardElement as HTMLElement).style.display = 'none';
                                  }
                                }
                              }}
                            />
                            <div className="variant-info">
                              <span className={`variant-label ${variant.variant ? `variant-${variant.variant}` : ''}`}>
                                {variant.variantLabel || 'Standard'}
                              </span>
                              {variant.id === selectedCard.card.id && (
                                <span className="current-badge">Current</span>
                              )}
                            </div>
                            {selectedVariant?.id === variant.id && (
                              <div className="variant-selected-check">✓</div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {selectedVariant && selectedVariant.id !== selectedCard.card.id && (
                        <button 
                          className="change-art-btn"
                          onClick={handleChangeArtClick}
                        >
                          🔄 Change to {selectedVariant.variantLabel || 'Standard'} Art
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="no-variants-message">No alternative arts available for this card.</p>
                  )}
                </div>

                {/* Mobile-friendly close button at the bottom (in addition to the top-right X) */}
                <div className="modal-footer-mobile-close">
                  <button
                    type="button"
                    className="button modal-footer-close-button"
                    onClick={handleCloseModal}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog for removing card from deck */}
      {showRemoveCardConfirm && (cardToRemove || selectedCard) && (
        <div className="confirm-dialog-overlay" onClick={() => { setShowRemoveCardConfirm(false); setCardToRemove(null); }}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-dialog-icon">⚠️</div>
            <h3>Remove Card?</h3>
            <p>
              Are you sure you want to remove <strong>{(cardToRemove || selectedCard)!.card.name}</strong> from your deck entirely?
            </p>
            
            <div className="confirm-dialog-buttons">
              <button 
                className="confirm-btn-all"
                onClick={handleConfirmRemoveCard}
                style={{ background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)' }}
              >
                Yes, Remove Card
              </button>
              <button 
                className="confirm-btn-cancel"
                onClick={() => { setShowRemoveCardConfirm(false); setCardToRemove(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog for changing all same cards */}
      {showConfirmDialog && selectedCard && selectedVariant && (
        <div className="confirm-dialog-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-dialog-icon">⚠️</div>
            <h3>Change All Cards?</h3>
            <p>
              You have <strong>{sameCardCount}x {selectedCard.card.id}</strong> cards in your deck.
            </p>
            <p>Do you want to change all of them to <strong>{selectedVariant.variantLabel || 'Standard'}</strong> art?</p>
            <p className="confirm-dialog-note">
              <em>Note: Only {selectedCard.card.id} cards will change. Other art variants (like _p1, _p2) will remain unchanged.</em>
            </p>
            
            <div className="confirm-dialog-preview">
              <div className="preview-from">
                <img src={selectedCard.card.image_uris.small} alt="Current" />
                <span>{selectedCard.card.variantLabel || 'Standard'}</span>
              </div>
              <div className="preview-arrow">→</div>
              <div className="preview-to">
                <img src={selectedVariant.image_uris.small} alt="New" />
                <span>{selectedVariant.variantLabel || 'Standard'}</span>
              </div>
            </div>
            
            <div className="confirm-dialog-buttons">
              <button 
                className="confirm-btn-all"
                onClick={() => applyArtChange(true)}
              >
                Yes, Change All ({sameCardCount}x)
              </button>
              <button 
                className="confirm-btn-single"
                onClick={() => applyArtChange(false)}
              >
                Only 1x Card
              </button>
              <button 
                className="confirm-btn-cancel"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
