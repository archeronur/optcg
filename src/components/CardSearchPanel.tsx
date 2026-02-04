'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card, DeckCard } from '@/types';
import { optcgAPI } from '@/services/api';
import { debounce } from '@/utils/performance';

interface CardSearchPanelProps {
  onAddCard: (card: Card, count: number) => void;
  existingCards: DeckCard[];
}

export default function CardSearchPanel({ onAddCard, existingCards }: CardSearchPanelProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Loading state
  const [isPreloading, setIsPreloading] = useState(false);
  
  // Selected card for adding
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [addCount, setAddCount] = useState(1);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Preload cards on mount
  useEffect(() => {
    const preload = async () => {
      setIsPreloading(true);
      try {
        await optcgAPI.preloadCardsForSearch();
      } catch (error) {
        console.error('Error preloading cards:', error);
      } finally {
        setIsPreloading(false);
      }
    };
    
    preload();
  }, []);
  
  // Debounced search function
  const debouncedSearch = useMemo(() => 
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }
      
      setIsSearching(true);
      try {
        const results = await optcgAPI.searchCardsAutocomplete(query, 30);
        // Filter out duplicate cards by ID
        const uniqueResults = results.filter((card, index, self) => 
          index === self.findIndex(c => c.id === card.id)
        );
        setSearchResults(uniqueResults);
        setShowDropdown(uniqueResults.length > 0);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300)
  , []);
  
  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  }, [debouncedSearch]);
  
  // Handle card selection from dropdown
  const handleCardSelect = (card: Card) => {
    setSelectedCard(card);
    setShowDropdown(false);
    setAddCount(1);
  };
  
  // Handle adding card to deck
  const handleAddToDeck = () => {
    if (selectedCard) {
      onAddCard(selectedCard, addCount);
      setSelectedCard(null);
      setAddCount(1);
      setSearchQuery('');
    }
  };
  
  // Quick add card from dropdown
  const handleQuickAdd = (card: Card) => {
    onAddCard(card, 1);
  };
  
  // Get existing count for a card
  const getExistingCount = (cardId: string): number => {
    const existing = existingCards.find(dc => dc.card.id === cardId);
    return existing ? existing.count : 0;
  };

  return (
    <div className="card-search-panel">
      <div className="search-panel-header">
        <h3>🔍 Card Search</h3>
        {isPreloading && (
          <span className="preload-indicator">Loading cards...</span>
        )}
      </div>
      
      {/* Search Input with Autocomplete */}
      <div className="search-input-wrapper" ref={dropdownRef}>
        <div className="search-input-container">
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search by name or card ID (e.g. OP13-046)..."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          />
          {isSearching && <div className="search-spinner" />}
          {searchQuery && (
            <button 
              className="search-clear-btn" 
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowDropdown(false);
                searchInputRef.current?.focus();
              }}
              type="button"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
        
        {/* Autocomplete Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="autocomplete-dropdown">
            {searchResults.map((card, index) => (
              <div 
                key={`${card.id}-${index}`} 
                className="autocomplete-item"
                onClick={() => handleCardSelect(card)}
              >
                <img 
                  src={card.image_uris.small || card.image_uris.large} 
                  alt={card.name}
                  className="autocomplete-card-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="autocomplete-card-info">
                  <div className="autocomplete-card-name-row">
                    <span className="autocomplete-card-name">{card.name}</span>
                    {card.variantLabel && card.variant !== 'standard' && (
                      <span className={`variant-badge variant-${card.variant}`}>
                        {card.variantLabel}
                      </span>
                    )}
                  </div>
                  <span className="autocomplete-card-id">{card.id}</span>
                  <span className="autocomplete-card-details">
                    {card.type || 'Unknown'}
                    {card.colors && card.colors.length > 0 && ` • ${card.colors.join('/')}`}
                    {card.cost !== undefined && ` • Cost: ${card.cost}`}
                    {card.rarity && ` • ${card.rarity}`}
                  </span>
                </div>
                <div className="autocomplete-card-actions">
                  {getExistingCount(card.id) > 0 && (
                    <span className="existing-count-badge">
                      {getExistingCount(card.id)}x in deck
                    </span>
                  )}
                  <button 
                    className="quick-add-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickAdd(card);
                    }}
                    title="Quick add 1x"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Selected Card Preview */}
      {selectedCard && (
        <div className="selected-card-preview">
          <div className="selected-card-image-wrapper">
            <img 
              src={selectedCard.image_uris.large || selectedCard.image_uris.small} 
              alt={selectedCard.name}
              className="selected-card-image"
            />
          </div>
          <div className="selected-card-details">
            <div className="selected-card-name-row">
              <h4>{selectedCard.name}</h4>
              {selectedCard.variantLabel && selectedCard.variant !== 'standard' && (
                <span className={`variant-badge variant-${selectedCard.variant} large`}>
                  {selectedCard.variantLabel}
                </span>
              )}
            </div>
            <p className="selected-card-id-display">{selectedCard.id}</p>
            <p className="selected-card-meta">
              {selectedCard.type}
              {selectedCard.cost !== undefined && ` • Cost: ${selectedCard.cost}`}
              {selectedCard.rarity && ` • ${selectedCard.rarity}`}
            </p>
            {selectedCard.colors && selectedCard.colors.length > 0 && (
              <div className="selected-card-colors">
                {selectedCard.colors.map((color, idx) => (
                  <span key={idx} className={`color-badge color-${color.toLowerCase()}`}>
                    {color}
                  </span>
                ))}
              </div>
            )}
            <div className="add-to-deck-controls">
              <div className="count-selector">
                <button 
                  className="count-btn"
                  onClick={() => setAddCount(Math.max(1, addCount - 1))}
                  disabled={addCount <= 1}
                >
                  −
                </button>
                <span className="count-value">{addCount}</span>
                <button 
                  className="count-btn"
                  onClick={() => setAddCount(Math.min(4, addCount + 1))}
                  disabled={addCount >= 4}
                >
                  +
                </button>
              </div>
              <button className="add-to-deck-btn" onClick={handleAddToDeck}>
                Add to Deck
              </button>
            </div>
            {getExistingCount(selectedCard.id) > 0 && (
              <p className="existing-in-deck-note">
                Already {getExistingCount(selectedCard.id)}x in deck
              </p>
            )}
          </div>
          <button 
            className="close-preview-btn" 
            onClick={() => setSelectedCard(null)}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Search Results Count */}
      {searchResults.length > 0 && !showDropdown && (
        <p className="results-count">
          {searchResults.length} cards found
        </p>
      )}
    </div>
  );
}
