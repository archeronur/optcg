'use client';

import { useState, useCallback } from 'react';

/**
 * PDF Generation State Machine
 * 
 * States:
 * - IDLE: Initial state, PDF generation not started
 * - LOADING_IMAGES: Images are being preloaded and converted to base64
 * - READY: All images are base64, PdfRenderRoot is mounted and ready
 * - GENERATING: PDF is being captured and generated
 * - DONE: PDF generation complete
 * 
 * Why a state machine is necessary:
 * - Ensures strict ordering: images must be base64 before PDF capture
 * - Prevents race conditions on Cloudflare Pages static prerender
 * - Makes PDF generation lifecycle explicit and debuggable
 */
export type PdfGenerationState = 
  | 'IDLE'
  | 'LOADING_IMAGES'
  | 'READY'
  | 'GENERATING'
  | 'DONE';

export interface UsePdfGenerationStateReturn {
  state: PdfGenerationState;
  transitionTo: (newState: PdfGenerationState) => void;
  isIdle: boolean;
  isLoadingImages: boolean;
  isReady: boolean;
  isGenerating: boolean;
  isDone: boolean;
  reset: () => void;
}

export function usePdfGenerationState(): UsePdfGenerationStateReturn {
  const [state, setState] = useState<PdfGenerationState>('IDLE');

  const transitionTo = useCallback((newState: PdfGenerationState) => {
    console.log(`[PDF State Machine] Transition: ${state} → ${newState}`);
    
    // Validate state transitions
    const validTransitions: Record<PdfGenerationState, PdfGenerationState[]> = {
      IDLE: ['LOADING_IMAGES'],
      LOADING_IMAGES: ['READY', 'IDLE'], // Can reset if failed
      READY: ['GENERATING', 'IDLE'], // Can reset if failed
      GENERATING: ['DONE', 'IDLE'], // Can reset if failed
      DONE: ['IDLE'],
    };

    const allowed = validTransitions[state] || [];
    if (!allowed.includes(newState)) {
      console.warn(`[PDF State Machine] Invalid transition: ${state} → ${newState}`);
      // Allow reset transitions from any state
      if (newState === 'IDLE') {
        setState('IDLE');
        return;
      }
      return;
    }

    setState(newState);
  }, [state]);

  const reset = useCallback(() => {
    console.log('[PDF State Machine] Reset to IDLE');
    setState('IDLE');
  }, []);

  return {
    state,
    transitionTo,
    isIdle: state === 'IDLE',
    isLoadingImages: state === 'LOADING_IMAGES',
    isReady: state === 'READY',
    isGenerating: state === 'GENERATING',
    isDone: state === 'DONE',
    reset,
  };
}
