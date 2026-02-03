import { Card, APIResponse } from '@/types';
import Fuse from 'fuse.js';

// Filter options interface
export interface CardFilterOptions {
  colors?: string[];
  minCost?: number;
  maxCost?: number;
  sets?: string[];
  rarities?: string[];
  types?: string[];
  searchQuery?: string;
}

// Available filter values
export interface AvailableFilters {
  colors: string[];
  sets: { code: string; name: string }[];
  rarities: string[];
  types: string[];
  costRange: { min: number; max: number };
}

class OPTCGAPI {
  private baseURL = 'https://optcgapi.com/api';
  private limitlessBaseURL = 'https://onepiece.limitlesstcg.com/api';
  private cache = new Map<string, Card[]>();
  private allCardsCache: any[] | null = null;
  private allCardsCacheTime = 0;
  private cacheExpiry = 60 * 60 * 1000; // 1 saat
  private batchCache = new Map<string, Card[]>(); // Batch arama için cache
  private fullCardListCache: Card[] = []; // Full card list for search/filter
  private fullCardListCacheTime = 0;
  private fuseInstance: Fuse<Card> | null = null;

  private getCacheKey(query: string): string {
    return `search_${query.toLowerCase().trim()}`;
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheExpiry;
  }

  // Check if a set is an ST (Starter Deck) set
  private isSTSet(setCode: string): boolean {
    return setCode?.toUpperCase().startsWith('ST');
  }

  // Check if set should use Limitless API (ST sets, PRB sets, and newer OP sets like OP13+)
  private shouldUseLimitlessAPI(setCode: string): boolean {
    if (!setCode) return false;
    const upperCode = setCode.toUpperCase().replace('-', '');
    
    // ST sets always use Limitless
    if (upperCode.startsWith('ST')) return true;
    
    // PRB (Promo) sets always use Limitless
    if (upperCode.startsWith('PRB')) return true;
    
    // OP13 and newer sets use Limitless (OPTCG API may not have them yet)
    const opMatch = upperCode.match(/^OP(\d+)$/);
    if (opMatch) {
      const opNumber = parseInt(opMatch[1]);
      if (opNumber >= 13) return true;
    }
    
    // EB03 and newer
    const ebMatch = upperCode.match(/^EB(\d+)$/);
    if (ebMatch) {
      const ebNumber = parseInt(ebMatch[1]);
      if (ebNumber >= 3) return true;
    }
    
    return false;
  }

  // Fetch card from Limitless TCG API for ST sets
  private async getCardFromLimitless(cardId: string): Promise<any | null> {
    try {
      console.log(`Fetching card ${cardId} from Limitless TCG API...`);
      const response = await fetch(`${this.limitlessBaseURL}/cards/${cardId}`);
      
      if (!response.ok) {
        console.log(`Card ${cardId} not found in Limitless API: ${response.status}, using fallback...`);
        return this.createFallbackCard(cardId);
      }

      // Check Content-Type to ensure it's JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log(`Card ${cardId} returned non-JSON response: ${contentType}, using fallback...`);
        return this.createFallbackCard(cardId);
      }

      // Get response text first to check if it's valid
      const responseText = await response.text();
      
      // Check if response is empty or not JSON-like
      if (!responseText || responseText.trim() === '' || 
          (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('['))) {
        console.log(`Card ${cardId} returned empty or invalid response, using fallback...`);
        return this.createFallbackCard(cardId);
      }

      // Try to parse JSON safely
      try {
        const cardData = JSON.parse(responseText);
        console.log(`Found card ${cardId} in Limitless API:`, cardData);
        return cardData;
      } catch (parseError) {
        console.log(`Card ${cardId} JSON parse failed, using fallback...`);
        return this.createFallbackCard(cardId);
      }
    } catch (error) {
      console.error(`Error fetching card ${cardId} from Limitless API:`, error);
      return this.createFallbackCard(cardId);
    }
  }

  // Create a fallback card when API fails - uses official One Piece Card Game images
  private createFallbackCard(cardId: string): any {
    console.log(`Creating fallback card for ${cardId}`);
    
    // Parse card ID: OP13-002, ST21-001, OP13-002_p1, etc.
    const match = cardId.match(/^([A-Z]{2,3})(\d{2})-(\d{3})(_.+)?$/i);
    if (!match) {
      console.log(`Invalid card ID format: ${cardId}`);
      return null;
    }

    const setPrefix = match[1].toUpperCase();
    const setNum = match[2];
    const cardNum = match[3];
    const variantSuffix = match[4] || '';

    const setCode = `${setPrefix}${setNum}`;
    const fullCardId = `${setCode}-${cardNum}${variantSuffix}`;

    // Generate image URL from official One Piece Card Game website
    const imageUrl = `https://en.onepiece-cardgame.com/images/cardlist/card/${fullCardId}.png`;

    return {
      card_id: fullCardId,
      name: `Card ${fullCardId}`,
      set: setCode,
      number: cardNum,
      rarity: 'Unknown',
      category: 'Unknown',
      color: null,
      cost: null,
      effect: '',
      trigger: '',
      illustrator: '',
      // Mark as fallback card
      _isFallback: true,
      _imageUrl: imageUrl
    };
  }

  // Optimized card fetching - only fetch specific sets when needed
  private async getCardsFromSet(setId: string): Promise<any[]> {
    const cacheKey = `set_${setId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      console.log(`Using cached cards for set ${setId}`);
      return cached;
    }

    try {
      console.log(`Fetching cards from set ${setId}...`);
      const response = await fetch(`${this.baseURL}/sets/${setId}/`);
      
      if (!response.ok) {
        console.error(`API error for set ${setId}: ${response.status}`);
        return [];
      }

      // Get response text first to safely parse
      const responseText = await response.text();
      
      // Check if response is valid JSON
      if (!responseText || responseText.trim() === '' || 
          (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('['))) {
        console.log(`Set ${setId} returned empty or invalid response`);
        return [];
      }

      try {
        const setData = JSON.parse(responseText);
        
        if (Array.isArray(setData)) {
          this.cache.set(cacheKey, setData);
          console.log(`Fetched ${setData.length} cards from set ${setId}`);
          return setData;
        }
        
        return [];
      } catch (parseError) {
        console.error(`JSON parse error for set ${setId}:`, parseError);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching set ${setId}:`, error);
      return [];
    }
  }

  // Get all available sets
  private async getAllSets(): Promise<any[]> {
    if (this.allCardsCache && this.isValidCache(this.allCardsCacheTime)) {
      return this.allCardsCache;
    }

    try {
      console.log('Fetching all sets from OPTCG API...');
      const response = await fetch(`${this.baseURL}/allSets/`);
      
      if (!response.ok) {
        console.error(`API error: ${response.status}`);
        return [];
      }

      // Get response text first to safely parse
      const responseText = await response.text();
      
      // Check if response is valid JSON
      if (!responseText || responseText.trim() === '' || 
          (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('['))) {
        console.log('All sets API returned empty or invalid response');
        return [];
      }

      try {
        const allSets = JSON.parse(responseText);
        
        if (!Array.isArray(allSets)) {
          console.log('All sets API did not return an array');
          return [];
        }
        
        this.allCardsCache = allSets;
        this.allCardsCacheTime = Date.now();
        
        console.log(`Fetched ${allSets.length} sets`);
        return allSets;
      } catch (parseError) {
        console.error('JSON parse error for all sets:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error fetching all sets:', error);
      return [];
    }
  }

  // Optimized search - only fetch specific set when needed
  async searchCard(name: string, setCode?: string, cardNumber?: string): Promise<Card[]> {
    console.log(`=== searchCard START ===`);
    console.log(`Searching for: "${name}"${setCode ? ` in set: ${setCode}` : ''}${cardNumber ? ` number: ${cardNumber}` : ''}`);
    
    // Extract variant suffix from cardNumber if present (e.g., "002_p1" -> base: "002", variant: "_p1")
    let baseNumber = cardNumber;
    let variantSuffix = '';
    if (cardNumber && cardNumber.includes('_')) {
      const underscoreIndex = cardNumber.indexOf('_');
      baseNumber = cardNumber.substring(0, underscoreIndex);
      variantSuffix = cardNumber.substring(underscoreIndex);
      console.log(`Parsed variant: baseNumber=${baseNumber}, variantSuffix=${variantSuffix}`);
    }
    
    const cacheKey = this.getCacheKey(`${name}_${setCode || ''}_${cardNumber || ''}`);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      console.log('Using cached search results');
      return cached;
    }

    try {
      let searchResults: any[] = [];
      const searchTerm = name.toLowerCase().trim();
      console.log(`Search term: "${searchTerm}"`);
      
      // If setCode is provided, search only in that set
      if (setCode) {
        console.log(`Searching in specific set: ${setCode}`);
        
        // Check if should use Limitless API (ST sets and newer OP sets)
        if (this.shouldUseLimitlessAPI(setCode)) {
          console.log(`Using Limitless API for ${setCode}`);
          // Convert OP-14 to OP14 for Limitless API
          const limitlessSetCode = setCode.replace('-', '');
          // Build card ID with variant suffix if present
          const paddedNumber = baseNumber?.padStart(3, '0') || '001';
          const cardId = variantSuffix 
            ? `${limitlessSetCode}-${paddedNumber}${variantSuffix}` 
            : `${limitlessSetCode}-${paddedNumber}`;
          console.log(`Converted set code: ${setCode} -> ${limitlessSetCode}`);
          console.log(`Card ID for Limitless API: ${cardId}`);
          
          // First try with variant suffix
          let limitlessCard = await this.getCardFromLimitless(cardId);
          let usedVariantFallback = false;
          
          // If we got a fallback card and have a variant suffix, try the base card from API first
          if (limitlessCard && limitlessCard._isFallback && variantSuffix) {
            console.log(`Got fallback for variant, trying base card: ${limitlessSetCode}-${paddedNumber}`);
            const baseCard = await this.getCardFromLimitless(`${limitlessSetCode}-${paddedNumber}`);
            // Only use base card if it's a real API result (not fallback)
            if (baseCard && !baseCard._isFallback) {
              limitlessCard = baseCard;
              usedVariantFallback = true;
            }
          }
          
          if (limitlessCard) {
            // If we used fallback from base card, apply the requested variant
            if (usedVariantFallback && variantSuffix) {
              limitlessCard._requestedVariantSuffix = variantSuffix;
              console.log(`Applied requested variant suffix: ${variantSuffix}`);
            }
            
            // For new format (Card OP13-002), just return the card
            if (name.startsWith('Card ')) {
              searchResults = [limitlessCard];
              console.log(`Found card by ID: ${limitlessCard.name} (fallback: ${limitlessCard._isFallback || false})`);
            } else {
              // Check if the card name matches (skip for fallback cards)
              const cardName = limitlessCard.name?.toLowerCase() || '';
              if (limitlessCard._isFallback || cardName.includes(searchTerm) || searchTerm.includes(cardName)) {
                searchResults = [limitlessCard];
                console.log(`Found matching card: ${limitlessCard.name}`);
              } else {
                console.log(`Card found but name doesn't match: ${limitlessCard.name} vs ${searchTerm}`);
                // Still use the card if it's the only option
                searchResults = [limitlessCard];
              }
            }
          } else {
            console.log(`No card found for ${cardId}`);
          }
        } else {
          // Use regular OPTCG API for non-ST sets
          const setCards = await this.getCardsFromSet(setCode);
        
          // Apply card number filter if provided (with variant support)
          let filteredCards = setCards;
          if (baseNumber) {
            filteredCards = setCards.filter((card: any) => {
              const cardSetId = (card.card_set_id || '').toLowerCase();
              const searchNumber = baseNumber.toLowerCase();
              
              // If we have a variant suffix, search for exact match including variant
              if (variantSuffix) {
                const fullSearch = (baseNumber + variantSuffix).toLowerCase();
                return cardSetId.includes(fullSearch) || cardSetId.includes(baseNumber);
              }
              
              // Otherwise just match the base number
              return cardSetId.includes(searchNumber);
            });
            
            // If variant suffix provided, sort to prioritize exact variant match
            if (variantSuffix && filteredCards.length > 1) {
              filteredCards.sort((a: any, b: any) => {
                const aId = (a.card_set_id || '').toLowerCase();
                const bId = (b.card_set_id || '').toLowerCase();
                const variantLower = variantSuffix.toLowerCase();
                const aHasVariant = aId.includes(variantLower) ? 0 : 1;
                const bHasVariant = bId.includes(variantLower) ? 0 : 1;
                return aHasVariant - bHasVariant;
              });
            }
          }
          
          // For new format (Card OP11-040), just return the first card with matching number
          if (name.startsWith('Card ')) {
            console.log('New format detected, searching by card number only');
            // Apply variant suffix if requested but not found in card
            if (variantSuffix && filteredCards.length > 0) {
              const topCard = filteredCards[0];
              const cardSetId = (topCard.card_set_id || '').toLowerCase();
              if (!cardSetId.includes(variantSuffix.toLowerCase())) {
                // Card doesn't have the variant, add it manually
                topCard._requestedVariantSuffix = variantSuffix;
                console.log(`Applied variant suffix ${variantSuffix} to OPTCG card`);
              }
            }
            searchResults = filteredCards.slice(0, 1); // Take first matching card
            console.log(`Found ${searchResults.length} cards by number`);
          } else {
            // Apply variant suffix to name-based searches too
            if (variantSuffix && filteredCards.length > 0) {
              filteredCards.forEach((card: any) => {
                const cardSetId = (card.card_set_id || '').toLowerCase();
                if (!cardSetId.includes(variantSuffix.toLowerCase())) {
                  card._requestedVariantSuffix = variantSuffix;
                }
              });
              console.log(`Applied variant suffix ${variantSuffix} to ${filteredCards.length} OPTCG cards for name search`);
            }
            // Use Fuse.js for fuzzy search
            const fuse = new Fuse(filteredCards, {
              keys: [
                {
                  name: 'card_name',
                  getFn: (obj: any) => {
                    const originalName = obj.card_name || '';
                    const cleanName = originalName.replace(/\s*\([^)]*\)\s*$/, '').trim();
                    return `${originalName} ${cleanName}`;
                  }
                }
              ],
              threshold: 0.4,
              includeScore: true
            });
            
            searchResults = fuse.search(searchTerm).map(result => result.item);
            
            // If no results in specific set, try more flexible search
            if (searchResults.length === 0) {
              console.log('No results in specific set, trying more flexible search...');
              const flexibleFuse = new Fuse(filteredCards, {
                keys: [
                  {
                    name: 'card_name',
                    getFn: (obj: any) => {
                      const originalName = obj.card_name || '';
                      const cleanName = originalName.replace(/\s*\([^)]*\)\s*$/, '').trim();
                      return `${originalName} ${cleanName}`;
                    }
                  }
                ],
                threshold: 0.6,
                includeScore: true
              });
              
              searchResults = flexibleFuse.search(searchTerm).map(result => result.item);
            }
          }
        }
      } else {
        // If no setCode provided, search across all sets
        console.log('Searching across all sets...');
        const allSets = await this.getAllSets();
        
        // Search in each set
        for (const set of allSets) {
          const setCards = await this.getCardsFromSet(set.set_id);
          
          // Apply card number filter if provided (with variant support)
          let filteredCards = setCards;
          if (baseNumber) {
            filteredCards = setCards.filter((card: any) => {
              const cardSetId = (card.card_set_id || '').toLowerCase();
              
              // If we have a variant suffix, search for exact match including variant
              if (variantSuffix) {
                const fullSearch = (baseNumber + variantSuffix).toLowerCase();
                return cardSetId.includes(fullSearch) || cardSetId.includes(baseNumber);
              }
              
              // Otherwise just match the base number
              return cardSetId.includes(baseNumber.toLowerCase());
            });
            
            // If variant suffix provided, sort to prioritize exact variant match
            if (variantSuffix && filteredCards.length > 1) {
              filteredCards.sort((a: any, b: any) => {
                const aId = (a.card_set_id || '').toLowerCase();
                const bId = (b.card_set_id || '').toLowerCase();
                const variantLower = variantSuffix.toLowerCase();
                const aHasVariant = aId.includes(variantLower) ? 0 : 1;
                const bHasVariant = bId.includes(variantLower) ? 0 : 1;
                return aHasVariant - bHasVariant;
              });
            }
          }
          
          // Use Fuse.js for fuzzy search
          const fuse = new Fuse(filteredCards, {
            keys: [
              {
                name: 'card_name',
                getFn: (obj: any) => {
                  const originalName = obj.card_name || '';
                  const cleanName = originalName.replace(/\s*\([^)]*\)\s*$/, '').trim();
                  return `${originalName} ${cleanName}`;
                }
              }
            ],
            threshold: 0.4,
            includeScore: true
          });
          
          const setResults = fuse.search(searchTerm).map(result => result.item);
          searchResults.push(...setResults);
          
          // If we found results, we can stop searching
          if (searchResults.length > 0) {
            break;
          }
        }
      }
      
      console.log(`Search results before filtering: ${searchResults.length} cards`);
      
      // Filter and normalize
      const filteredResults = searchResults
        .map((card: any) => this.normalizeCard(card))
        .slice(0, 10); // First 10 results
      
      console.log(`Final filtered results: ${filteredResults.length} cards`);
      
      // Cache the results
      this.cache.set(cacheKey, filteredResults);
      console.log('=== searchCard END ===');
      return filteredResults;

    } catch (error) {
      console.error('Search error:', error);
      console.log('=== searchCard END (ERROR) ===');
      return [];
    }
  }

  // Detect card variant from ID, rarity, or image URL
  private detectCardVariant(cardId: string, rarity?: string, imageUrl?: string): { variant: Card['variant']; variantLabel?: string } {
    const id = (cardId || '').toLowerCase();
    const rarityLower = (rarity || '').toLowerCase();
    const image = (imageUrl || '').toLowerCase();
    
    // Check for parallel art in ID (_p1, _p2, -p1, etc.)
    if (id.includes('_p') || id.match(/[-_]p\d/i)) {
      const match = id.match(/[_-]p(\d+)/i);
      const num = match ? match[1] : '1';
      return { variant: 'parallel', variantLabel: `P${num}` };
    }
    
    // Check for parallel in image URL (common pattern)
    if (image.includes('_p1') || image.includes('_p2') || image.includes('_p3') || image.includes('_p4')) {
      const match = image.match(/_p(\d+)/i);
      const num = match ? match[1] : '1';
      return { variant: 'parallel', variantLabel: `P${num}` };
    }
    
    // Check for alternate art
    if (id.includes('_aa') || id.includes('-aa') || image.includes('_aa') || id.includes('alternate')) {
      return { variant: 'alternate-art', variantLabel: 'AA' };
    }
    
    // Check for manga art
    if (id.includes('manga') || image.includes('manga') || rarityLower.includes('manga')) {
      return { variant: 'manga', variantLabel: 'Manga' };
    }
    
    // Check for SP (Special) - usually in rarity
    if (rarityLower === 'sp' || rarityLower.includes('special') || id.includes('_sp') || image.includes('_sp')) {
      return { variant: 'sp', variantLabel: 'SP' };
    }
    
    // Check for promo cards (PRB set)
    if (id.startsWith('prb') || id.includes('promo')) {
      return { variant: 'promo', variantLabel: 'Promo' };
    }
    
    // Check rarity for special versions
    if (rarityLower === 'sec' || rarityLower === 'secret') {
      return { variant: 'sp', variantLabel: 'SEC' };
    }
    
    // Check for parallel in rarity field (some APIs use this)
    if (rarityLower.includes('parallel') || rarityLower === 'p') {
      return { variant: 'parallel', variantLabel: 'Parallel' };
    }
    
    // Check for Super Parallel / Alt Art indicators
    if (rarityLower.includes('alt') || rarityLower.includes('super')) {
      return { variant: 'alternate-art', variantLabel: 'Alt Art' };
    }
    
    if (rarityLower === 'l' || rarityLower === 'leader') {
      return { variant: 'standard', variantLabel: 'Leader' };
    }
    
    // Check for DON!! cards
    if (id.includes('don') || rarityLower === 'don') {
      return { variant: 'standard', variantLabel: 'DON!!' };
    }
    
    return { variant: 'standard' };
  }

  private normalizeCard(card: any): Card {
    // Check if this is a Limitless API card (has different structure)
    if (card.card_id) {
      return this.normalizeLimitlessCard(card);
    }
    
    // Check if there's a requested variant suffix (from fallback when API didn't have variant)
    const requestedVariantSuffix = card._requestedVariantSuffix;
    
    let imageUrl = card.card_image || '';
    
    if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
      imageUrl = '';
    }
    
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      imageUrl = `https://${imageUrl}`;
    }
    
    // Use card_image_id if it has variant info, otherwise use card_set_id
    const cardImageId = card.card_image_id || '';
    const cardSetId = card.card_set_id || '';
    
    // Check if card_image_id contains variant suffix (e.g., OP01-001_p1)
    const hasVariantInImageId = cardImageId && (
      cardImageId.includes('_p') || 
      cardImageId.includes('_aa') || 
      cardImageId.includes('_sp') ||
      cardImageId.includes('_manga')
    );
    
    // Use the ID that has variant info, or fall back to card_set_id
    let cardId = hasVariantInImageId ? cardImageId : (cardSetId || cardImageId);
    
    // If the card already has variant info in its ID, use official site for image
    if (hasVariantInImageId) {
      imageUrl = `https://en.onepiece-cardgame.com/images/cardlist/card/${cardImageId}.png`;
      console.log(`Using official site image for existing variant: ${imageUrl}`);
    }
    
    // If requested variant suffix exists and card doesn't have it, apply it
    if (requestedVariantSuffix && !cardId.includes('_')) {
      cardId = `${cardId}${requestedVariantSuffix}`;
      console.log(`Applied variant suffix to OPTCG card ID: ${cardId}`);
      
      // Generate variant image URL from official One Piece Card Game website
      // Format: https://en.onepiece-cardgame.com/images/cardlist/card/OP12-030_p1.png
      imageUrl = `https://en.onepiece-cardgame.com/images/cardlist/card/${cardId}.png`;
      console.log(`Generated variant image URL: ${imageUrl}`);
    }
    
    const { variant, variantLabel } = this.detectCardVariant(cardId, card.rarity, imageUrl);
    
    // Extract base number from card_set_id (without variant suffix)
    const baseNumber = cardSetId?.split('-')[1]?.split('_')[0] || '';
    
    // Determine the number to use (with or without variant suffix)
    const numberWithVariant = requestedVariantSuffix ? `${baseNumber}${requestedVariantSuffix}` : baseNumber;
    
    const normalizedCard: Card = {
      id: cardId,
      name: card.card_name,
      set_code: card.set_id,
      set_name: card.set_name,
      number: numberWithVariant,
      rarity: card.rarity,
      image_uris: {
        full: imageUrl,
        large: imageUrl,
        small: imageUrl
      },
      colors: card.card_color ? [card.card_color] : [],
      cost: card.card_cost === 'NULL' ? undefined : parseInt(card.card_cost) || undefined,
      type: card.card_type,
      subtypes: card.sub_types ? card.sub_types.split(' ') : [],
      characteristics: [],
      text: card.card_text,
      flavor_text: '',
      artist: '',
      variant,
      variantLabel
    };
    
    return normalizedCard;
  }

  private normalizeLimitlessCard(card: any): Card {
    // Check if there's a requested variant suffix (from fallback when API didn't have variant)
    const requestedVariantSuffix = card._requestedVariantSuffix;
    
    // Determine the effective card ID
    let effectiveCardId = card.card_id;
    if (requestedVariantSuffix && !effectiveCardId.includes('_')) {
      // Add the requested variant suffix to the card ID
      effectiveCardId = `${effectiveCardId}${requestedVariantSuffix}`;
      console.log(`Applied variant suffix to card ID: ${effectiveCardId}`);
    }
    
    // Generate image URL for Limitless API cards (with variant if applicable)
    // For fallback cards, use the pre-generated image URL
    let imageUrl: string;
    if (card._isFallback && card._imageUrl) {
      imageUrl = card._imageUrl;
      console.log(`Using fallback image URL: ${imageUrl}`);
    } else {
      imageUrl = this.generateLimitlessCardImageUrl(card, requestedVariantSuffix);
    }
    
    // Detect variant from the effective card ID (which now includes the suffix if requested)
    const { variant, variantLabel } = this.detectCardVariant(effectiveCardId, card.rarity, imageUrl);
    
    // Extract base number (without variant suffix)
    const baseNumber = card.number?.split('_')[0] || card.number || '';
    
    // Determine the number to use (with or without variant suffix)
    const numberWithVariant = requestedVariantSuffix ? `${baseNumber}${requestedVariantSuffix}` : baseNumber;
    
    const normalizedCard: Card = {
      id: effectiveCardId,
      name: card.name,
      set_code: card.set,
      set_name: card.set_name,
      number: numberWithVariant,
      rarity: card.rarity || 'Unknown',
      image_uris: {
        full: imageUrl,
        large: imageUrl,
        small: imageUrl
      },
      colors: card.color ? [card.color] : [],
      cost: card.cost || undefined,
      type: card.category || 'Unknown',
      subtypes: card.type ? card.type.split('/') : [],
      characteristics: [],
      text: card.effect || '',
      flavor_text: card.trigger || '',
      artist: card.illustrator || '',
      variant,
      variantLabel
    };
    
    return normalizedCard;
  }

  // Generate image URL for Limitless API cards
  private generateLimitlessCardImageUrl(card: any, requestedVariantSuffix?: string): string {
    const cardId = card.card_id;
    if (!cardId) return '';
    
    // If there's a requested variant suffix, try to use the variant image URL
    // One Piece Card Game website uses format: OP13-002_p1.png for parallel art
    const effectiveCardId = requestedVariantSuffix && !cardId.includes('_') 
      ? `${cardId}${requestedVariantSuffix}` 
      : cardId;
    
    // Use official One Piece Card Game website for images
    // Format: https://en.onepiece-cardgame.com/images/cardlist/card/OP14-020.png
    // For variants: https://en.onepiece-cardgame.com/images/cardlist/card/OP13-002_p1.png
    return `https://en.onepiece-cardgame.com/images/cardlist/card/${effectiveCardId}.png`;
  }

  // Optimized batch arama - paralel işlem ve cache kullanımı
  async findCardsBatch(entries: { name: string; set_code?: string; number?: string }[], signal?: AbortSignal): Promise<Map<string, Card | null>> {
    const results = new Map<string, Card | null>();
    
    // Abort signal kontrolü
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }
    
    // Önce cache'den mevcut sonuçları al
    const uncachedEntries = entries.filter(entry => {
      const cacheKey = `${entry.name}_${entry.set_code || ''}_${entry.number || ''}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        results.set(cacheKey, cached[0] || null);
        return false;
      }
      return true;
    });
    
    if (uncachedEntries.length === 0) {
      return results;
    }
    
    // Cache'de olmayan kartları paralel olarak ara
    const searchPromises = uncachedEntries.map(async (entry) => {
      // Her iterasyonda abort signal kontrolü
      if (signal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      const cacheKey = `${entry.name}_${entry.set_code || ''}_${entry.number || ''}`;
      const card = await this.findCard(entry.name, entry.set_code, entry.number);
      return { key: cacheKey, card };
    });
    
    const searchResults = await Promise.allSettled(searchPromises);
    
    searchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { key, card } = result.value;
        results.set(key, card);
      }
    });
    
    return results;
  }

  // Basitleştirilmiş findCard
  async findCard(name: string, setCode?: string, cardNumber?: string): Promise<Card | null> {
    // Extract variant suffix from cardNumber if present (e.g., "002_p1" -> base: "002", variant: "_p1")
    let baseNumber = cardNumber;
    let variantSuffix = '';
    if (cardNumber && cardNumber.includes('_')) {
      const parts = cardNumber.split('_');
      baseNumber = parts[0];
      variantSuffix = '_' + parts.slice(1).join('_');
    }
    
    // Pass full cardNumber (with variant) to searchCard so it can generate correct image URL
    const results = await this.searchCard(name, setCode, cardNumber);
    
    if (results.length === 0) {
      return null;
    }

    // En iyi eşleşmeyi bul
    let bestMatch = results[0];
    let bestScore = 0;
    
    for (const card of results) {
      let score = 0;
      
      // Kart isminden parantez içindeki açıklamaları temizle
      const cleanCardName = card.name.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      const cleanSearchName = name.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      const originalCardName = card.name.toLowerCase();
      const originalSearchName = name.toLowerCase();
      
      // Tam isim eşleşmesi (orijinal)
      if (originalCardName === originalSearchName) {
        score += 150;
      }
      // Tam isim eşleşmesi (temizlenmiş)
      else if (cleanCardName === cleanSearchName) {
        score += 100;
      }
      // İsim başlangıcı eşleşmesi (orijinal)
      else if (originalCardName.startsWith(originalSearchName)) {
        score += 90;
      }
      // İsim başlangıcı eşleşmesi (temizlenmiş)
      else if (cleanCardName.startsWith(cleanSearchName)) {
        score += 80;
      }
      // İsim içerme (orijinal)
      else if (originalCardName.includes(originalSearchName)) {
        score += 70;
      }
      // İsim içerme (temizlenmiş)
      else if (cleanCardName.includes(cleanSearchName)) {
        score += 60;
      }
      
      // Set kodu eşleşmesi
      if (setCode && card.set_code?.toLowerCase().replace('-', '') === setCode.toLowerCase().replace('-', '')) {
        score += 50;
      }
      
      // Kart ID'si ile tam eşleşme kontrolü (variant dahil)
      const cardIdLower = (card.id || '').toLowerCase();
      const searchNumberLower = (cardNumber || '').toLowerCase();
      
      // Variant suffix ile tam eşleşme (en yüksek öncelik)
      if (variantSuffix && cardIdLower.includes(variantSuffix.toLowerCase())) {
        score += 200; // Variant eşleşmesi en yüksek öncelik
      }
      
      // Kart ID'sinde tam numara eşleşmesi
      if (cardNumber && cardIdLower.includes(searchNumberLower.replace('_', ''))) {
        score += 100;
      }
      
      // Base numara eşleşmesi
      if (baseNumber) {
        const cardBaseNumber = (card.number || '').split('_')[0];
        if (cardBaseNumber === baseNumber || cardBaseNumber === baseNumber.replace(/^0+/, '')) {
          score += 30;
        }
      }
      
      // Kart numarası varsa bonus
      if (card.number) {
        score += 10;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = card;
      }
    }
    
    return bestMatch;
  }

  // Cache temizleme
  clearCache(): void {
    this.cache.clear();
    this.batchCache.clear();
    this.allCardsCache = null;
    this.allCardsCacheTime = 0;
  }

  // Memory leak önleme
  cleanup(): void {
    // Eski cache'leri temizle
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, value] of entries) {
      if (!this.isValidCache(this.allCardsCacheTime)) {
        this.cache.delete(key);
      }
    }
  }

  // Get all cards for search and filtering
  async getAllCardsForSearch(): Promise<Card[]> {
    // Check cache first
    if (this.fullCardListCache.length > 0 && this.isValidCache(this.fullCardListCacheTime)) {
      return this.fullCardListCache;
    }

    try {
      console.log('Fetching all cards for search...');
      const allSets = await this.getAllSets();
      const allCards: Card[] = [];

      // Fetch cards from each set in parallel (with limit)
      const batchSize = 5;
      for (let i = 0; i < allSets.length; i += batchSize) {
        const batch = allSets.slice(i, i + batchSize);
        const batchPromises = batch.map(async (set: any) => {
          try {
            const setCards = await this.getCardsFromSet(set.set_id);
            return setCards.map((card: any) => this.normalizeCard(card));
          } catch (error) {
            console.error(`Error fetching set ${set.set_id}:`, error);
            return [];
          }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(cards => allCards.push(...cards));
      }

      // Cache the results
      this.fullCardListCache = allCards;
      this.fullCardListCacheTime = Date.now();

      // Initialize Fuse.js for search
      this.initFuseInstance(allCards);

      console.log(`Loaded ${allCards.length} cards for search`);
      return allCards;
    } catch (error) {
      console.error('Error fetching all cards:', error);
      return [];
    }
  }

  // Initialize Fuse.js instance for fuzzy search
  private initFuseInstance(cards: Card[]): void {
    this.fuseInstance = new Fuse(cards, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'id', weight: 1.5 },
        { name: 'number', weight: 1 },
        { name: 'set_code', weight: 0.5 }
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true
    });
  }

  // Check if query is a card ID format (e.g., OP13-046, ST21-001, OP13-0, OP13-)
  private isCardIdFormat(query: string): boolean {
    return /^[A-Za-z]{2,3}\d{1,2}-?\d{0,3}$/i.test(query.trim());
  }

  // Parse card ID format to get set code and number
  private parseCardId(query: string): { setCode: string; number: string | null; fullId: string } | null {
    // Match formats like: OP13-024, OP13024, OP13-02, OP13-0, OP13-
    const match = query.trim().toUpperCase().match(/^([A-Za-z]{2,3})(\d{1,2})-?(\d{0,3})$/i);
    if (match) {
      const setPrefix = match[1].toUpperCase();
      const setNum = match[2].padStart(2, '0');
      const cardNumRaw = match[3];
      const cardNum = cardNumRaw ? cardNumRaw.padStart(3, '0') : null;
      const fullId = cardNum ? `${setPrefix}${setNum}-${cardNum}` : `${setPrefix}${setNum}`;
      return {
        setCode: `${setPrefix}${setNum}`,
        number: cardNum,
        fullId
      };
    }
    return null;
  }

  // Auto-complete search (fast, returns limited results)
  async searchCardsAutocomplete(query: string, limit: number = 10): Promise<Card[]> {
    if (!query || query.length < 2) {
      return [];
    }

    // Ensure cards are loaded
    if (this.fullCardListCache.length === 0) {
      await this.getAllCardsForSearch();
    }

    const normalizedQuery = query.trim().toUpperCase().replace(/-/g, '');
    
    // Check if query looks like a card ID (e.g., OP13-046, ST21-001)
    if (this.isCardIdFormat(query)) {
      const parsed = this.parseCardId(query);
      if (parsed) {
        console.log('Searching for card ID:', parsed);
        
        // Direct search by card ID - include ALL variants (normal, parallel, alternate art, etc.)
        const matches = this.fullCardListCache.filter(card => {
          const cardId = (card.id || '').toUpperCase();
          const cardIdClean = cardId.replace(/-/g, '').replace(/_/g, '');
          const cardNumber = (card.number || '').padStart(3, '0');
          const cardSetCode = (card.set_code || '').toUpperCase().replace(/-/g, '');
          
          // If number is provided, find base card and all its variants
          if (parsed.number) {
            const targetSetCode = parsed.setCode.replace(/-/g, '');
            const targetNumber = parsed.number;
            const targetBase = `${targetSetCode}${targetNumber}`;
            
            // Multiple matching strategies:
            // 1. Exact base match (OP13002 === OP13002)
            const cardBase = cardIdClean.split(/[_]/)[0]; // Remove variant suffix
            const exactBaseMatch = cardBase === targetBase;
            
            // 2. ID starts with target (OP13-002_p1 starts with OP13002)
            const startsWithMatch = cardIdClean.startsWith(targetBase);
            
            // 3. Set code + number match (for cards where ID format differs)
            const setNumberMatch = cardSetCode === targetSetCode && cardNumber === targetNumber;
            
            // 4. Check if card.number matches the target number (handles variants)
            const numberMatch = cardSetCode === targetSetCode && card.number === targetNumber.replace(/^0+/, '');
            
            const isMatch = exactBaseMatch || startsWithMatch || setNumberMatch || numberMatch;
            
            if (isMatch) {
              console.log('Found match:', card.id, card.name, 'variant:', card.variant, card.variantLabel);
            }
            return isMatch;
          } else {
            // If only set code, show cards from that set
            const targetSetCode = parsed.setCode.replace(/-/g, '');
            return cardSetCode === targetSetCode || cardIdClean.startsWith(targetSetCode);
          }
        });
        
        console.log('Total matches found:', matches.length);
        
        // Sort: standard version first, then variants
        matches.sort((a, b) => {
          // First sort by card number
          const numA = parseInt(a.number || '0');
          const numB = parseInt(b.number || '0');
          if (numA !== numB) return numA - numB;
          
          // Then sort by variant (standard first)
          const variantOrder = { 'standard': 0, 'parallel': 1, 'alternate-art': 2, 'sp': 3, 'manga': 4, 'promo': 5 };
          const orderA = variantOrder[a.variant || 'standard'] || 99;
          const orderB = variantOrder[b.variant || 'standard'] || 99;
          return orderA - orderB;
        });
        
        return matches.slice(0, limit);
      }
    }

    // For name-based search, use fuzzy matching
    // If Fuse isn't initialized, do it now
    if (!this.fuseInstance) {
      this.initFuseInstance(this.fullCardListCache);
    }

    // Do a direct name search first (more accurate)
    const queryLower = query.toLowerCase().trim();
    const nameMatches = this.fullCardListCache.filter(card => {
      const cardName = (card.name || '').toLowerCase();
      return cardName.includes(queryLower);
    });
    
    // Sort name matches by relevance (starts with > contains), then by variant
    nameMatches.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aStarts = aName.startsWith(queryLower) ? 0 : 1;
      const bStarts = bName.startsWith(queryLower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      
      // If same name relevance, sort standard first
      if (aName === bName) {
        const variantOrder = { 'standard': 0, 'parallel': 1, 'alternate-art': 2, 'sp': 3, 'manga': 4, 'promo': 5 };
        const orderA = variantOrder[a.variant || 'standard'] || 99;
        const orderB = variantOrder[b.variant || 'standard'] || 99;
        return orderA - orderB;
      }
      
      return aName.localeCompare(bName);
    });
    
    if (nameMatches.length >= limit) {
      return nameMatches.slice(0, limit);
    }
    
    // Use Fuse.js for additional fuzzy results
    const fuseResults = this.fuseInstance!.search(query, { limit: limit - nameMatches.length });
    
    // Combine and deduplicate
    const seen = new Set<string>(nameMatches.map(c => c.id));
    const combined = [...nameMatches];
    
    for (const result of fuseResults) {
      if (!seen.has(result.item.id)) {
        seen.add(result.item.id);
        combined.push(result.item);
      }
    }
    
    return combined.slice(0, limit);
  }

  // Advanced search with filters
  async searchCardsWithFilters(filters: CardFilterOptions, limit: number = 50): Promise<Card[]> {
    // Ensure cards are loaded
    if (this.fullCardListCache.length === 0) {
      await this.getAllCardsForSearch();
    }

    let filteredCards = [...this.fullCardListCache];

    // Apply text search filter
    if (filters.searchQuery && filters.searchQuery.length >= 2) {
      if (!this.fuseInstance) {
        this.initFuseInstance(this.fullCardListCache);
      }
      const searchResults = this.fuseInstance!.search(filters.searchQuery);
      filteredCards = searchResults.map(result => result.item);
    }

    // Apply color filter
    if (filters.colors && filters.colors.length > 0) {
      filteredCards = filteredCards.filter(card => {
        if (!card.colors || card.colors.length === 0) return false;
        return card.colors.some(color => 
          filters.colors!.some(fc => fc.toLowerCase() === color.toLowerCase())
        );
      });
    }

    // Apply cost filter
    if (filters.minCost !== undefined) {
      filteredCards = filteredCards.filter(card => 
        card.cost !== undefined && card.cost >= filters.minCost!
      );
    }
    if (filters.maxCost !== undefined) {
      filteredCards = filteredCards.filter(card => 
        card.cost !== undefined && card.cost <= filters.maxCost!
      );
    }

    // Apply set filter
    if (filters.sets && filters.sets.length > 0) {
      filteredCards = filteredCards.filter(card => {
        if (!card.set_code) return false;
        return filters.sets!.some(set => 
          card.set_code.toLowerCase().includes(set.toLowerCase()) ||
          set.toLowerCase().includes(card.set_code.toLowerCase())
        );
      });
    }

    // Apply rarity filter
    if (filters.rarities && filters.rarities.length > 0) {
      filteredCards = filteredCards.filter(card => {
        if (!card.rarity) return false;
        return filters.rarities!.some(rarity => 
          card.rarity.toLowerCase() === rarity.toLowerCase()
        );
      });
    }

    // Apply type filter
    if (filters.types && filters.types.length > 0) {
      filteredCards = filteredCards.filter(card => {
        if (!card.type) return false;
        return filters.types!.some(type => 
          card.type!.toLowerCase() === type.toLowerCase()
        );
      });
    }

    // Return limited results
    return filteredCards.slice(0, limit);
  }

  // Get available filter options
  async getAvailableFilters(): Promise<AvailableFilters> {
    // Ensure cards are loaded
    if (this.fullCardListCache.length === 0) {
      await this.getAllCardsForSearch();
    }

    const colors = new Set<string>();
    const sets = new Map<string, string>();
    const rarities = new Set<string>();
    const types = new Set<string>();
    let minCost = Infinity;
    let maxCost = -Infinity;

    for (const card of this.fullCardListCache) {
      // Collect colors
      if (card.colors) {
        card.colors.forEach(c => colors.add(c));
      }

      // Collect sets
      if (card.set_code && !sets.has(card.set_code)) {
        sets.set(card.set_code, card.set_name || card.set_code);
      }

      // Collect rarities
      if (card.rarity) {
        rarities.add(card.rarity);
      }

      // Collect types
      if (card.type) {
        types.add(card.type);
      }

      // Track cost range
      if (card.cost !== undefined) {
        minCost = Math.min(minCost, card.cost);
        maxCost = Math.max(maxCost, card.cost);
      }
    }

    return {
      colors: Array.from(colors).sort(),
      sets: Array.from(sets.entries())
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      rarities: Array.from(rarities).sort(),
      types: Array.from(types).sort(),
      costRange: {
        min: minCost === Infinity ? 0 : minCost,
        max: maxCost === -Infinity ? 10 : maxCost
      }
    };
  }

  // Preload cards for faster search (call this early)
  async preloadCardsForSearch(): Promise<void> {
    if (this.fullCardListCache.length === 0) {
      await this.getAllCardsForSearch();
    }
  }

  // Get all variants for a specific card (by base card ID)
  // Example: For OP13-007, get OP13-007, OP13-007_p1, OP13-007_p2, etc.
  async getCardVariants(cardId: string): Promise<Card[]> {
    // Extract base card ID (remove variant suffix if present)
    const baseCardId = cardId.replace(/_p\d+$|_aa$|_sp$|_manga$/i, '');
    const baseCardIdClean = baseCardId.toUpperCase().replace(/-/g, '');
    
    console.log(`Getting variants for card: ${cardId}, base: ${baseCardId}`);
    
    // Extract set code to check if we should use Limitless API
    const setMatch = baseCardId.match(/^([A-Z]{2,3})(\d{2})-(\d{3})$/i);
    if (!setMatch) {
      console.log(`Invalid card ID format: ${baseCardId}`);
      return [];
    }
    
    const setCode = `${setMatch[1].toUpperCase()}${setMatch[2]}`;
    const cardNumber = setMatch[3];
    
    // Check if this set uses Limitless API (ST, PRB, OP13+, EB03+)
    if (this.shouldUseLimitlessAPI(setCode)) {
      console.log(`Using Limitless API variants for ${setCode}`);
      // For Limitless API sets, generate common variants
      const variants: Card[] = [];
      const variantSuffixes = ['', '_p1', '_p2', '_p3', '_p4'];
      
      for (const suffix of variantSuffixes) {
        const variantCardId = `${setCode}-${cardNumber}${suffix}`;
        const imageUrl = `https://en.onepiece-cardgame.com/images/cardlist/card/${variantCardId}.png`;
        
        // Check if image exists by trying to determine variant info
        const { variant, variantLabel } = this.detectCardVariant(variantCardId, '', imageUrl);
        
        const variantCard: Card = {
          id: variantCardId,
          name: `Card ${variantCardId}`,
          set_code: setCode,
          set_name: setCode,
          number: `${cardNumber}${suffix}`,
          rarity: 'Unknown',
          image_uris: {
            full: imageUrl,
            large: imageUrl,
            small: imageUrl
          },
          colors: [],
          type: 'Unknown',
          subtypes: [],
          characteristics: [],
          text: '',
          flavor_text: '',
          artist: '',
          variant: suffix ? 'parallel' : 'standard',
          variantLabel: suffix ? `P${suffix.replace('_p', '')}` : 'Standard'
        };
        
        variants.push(variantCard);
      }
      
      console.log(`Generated ${variants.length} potential variants for ${baseCardId}`);
      return variants;
    }
    
    // For regular OPTCG API sets, search in cache
    if (this.fullCardListCache.length === 0) {
      await this.getAllCardsForSearch();
    }
    
    // Find all cards that match the base card ID
    const variants = this.fullCardListCache.filter(card => {
      const cardBaseId = (card.id || '').replace(/_p\d+$|_aa$|_sp$|_manga$/i, '');
      const cardBaseIdClean = cardBaseId.toUpperCase().replace(/-/g, '');
      
      return cardBaseIdClean === baseCardIdClean;
    });

    // Sort: standard first, then by variant type
    variants.sort((a, b) => {
      const variantOrder: Record<string, number> = {
        'standard': 0,
        'parallel': 1,
        'alternate-art': 2,
        'sp': 3,
        'manga': 4,
        'promo': 5
      };
      const orderA = variantOrder[a.variant || 'standard'] || 99;
      const orderB = variantOrder[b.variant || 'standard'] || 99;
      return orderA - orderB;
    });

    console.log(`Found ${variants.length} variants for ${baseCardId} in cache`);
    return variants;
  }

  // Fetch variant card with specific variant suffix
  async getCardWithVariant(baseCardId: string, variantSuffix: string): Promise<Card | null> {
    const targetId = variantSuffix ? `${baseCardId}${variantSuffix}` : baseCardId;
    
    // Check cache first
    if (this.fullCardListCache.length > 0) {
      const found = this.fullCardListCache.find(card => 
        (card.id || '').toUpperCase() === targetId.toUpperCase()
      );
      if (found) return found;
    }

    // Try to search for it
    const setCode = baseCardId.split('-')[0];
    const number = baseCardId.split('-')[1];
    const fullNumber = variantSuffix ? `${number}${variantSuffix}` : number;
    
    const result = await this.findCard(`Card ${targetId}`, setCode, fullNumber);
    return result;
  }
}

// Singleton instance
export const optcgAPI = new OPTCGAPI();

// Utility functions
export async function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function validateImageURL(url: string): boolean {
  try {
    new URL(url);
    return url.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i) !== null;
  } catch {
    return false;
  }
}
