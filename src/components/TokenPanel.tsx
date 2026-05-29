import { useState, useEffect, useRef, useCallback } from 'react';
import type { TokenDefinition } from '../api/tokenResolver';
import { deriveCardType } from '../api/mapToCardData';
import { parseKeywords } from '../keywords';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenPanelProps {
  isOpen: boolean;
  deckTokens: TokenDefinition[];
  onCreateToken: (tokenDef: TokenDefinition, quantity: number) => void;
  onClose: () => void;
}

interface SearchResult extends TokenDefinition {
  _isSearchResult?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SCRYFALL_BASE = import.meta.env.DEV
  ? '/api/scryfall'
  : 'https://api.scryfall.com';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * TokenPanel — dropdown panel for creating tokens on the battlefield.
 *
 * Shows pre-loaded deck tokens and provides a search bar to query Scryfall
 * for any token. Each token has a quantity selector (1-5) and a Create button.
 * Click outside or press Escape to dismiss.
 */
export function TokenPanel({ isOpen, deckTokens, onCreateToken, onClose }: TokenPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid immediate close from the button click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(value.trim());
        const response = await fetch(
          `${SCRYFALL_BASE}/cards/search?q=type%3Atoken+${encoded}&unique=cards`
        );
        if (!response.ok) {
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
        const data = await response.json();
        const results: SearchResult[] = (data.data ?? []).slice(0, 20).map((card: any) => ({
          scryfallId: card.id,
          name: card.name,
          typeLine: card.type_line ?? '',
          power: card.power ?? null,
          toughness: card.toughness ?? null,
          imageURI: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '',
          imageURILarge: card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.large ?? '',
          setCode: card.set ?? '',
          collectorNumber: card.collector_number ?? '',
          oracleText: card.oracle_text ?? '',
          cardType: deriveCardType(card.type_line ?? ''),
          keywords: parseKeywords(card.oracle_text ?? ''),
          _isSearchResult: true,
        }));
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 400);
  }, []);

  // Get quantity for a token (default 1)
  const getQuantity = (id: string) => quantities[id] ?? 1;

  const setQuantity = (id: string, qty: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, Math.min(5, qty)) }));
  };

  const handleCreate = (token: TokenDefinition) => {
    const qty = getQuantity(token.scryfallId);
    onCreateToken(token, qty);
  };

  if (!isOpen) return null;

  const displayTokens = searchQuery.trim() ? searchResults : deckTokens;

  return (
    <div
      ref={panelRef}
      className="fixed z-[100] bg-gray-800 border border-gray-600 rounded-lg shadow-2xl overflow-hidden"
      style={{
        bottom: 'calc(20vh + 8px)',
        left: '8px',
        width: '320px',
        maxHeight: '60vh',
      }}
      role="dialog"
      aria-label="Token creation panel"
    >
      {/* Header */}
      <div className="px-3 py-2 bg-gray-700 border-b border-gray-600 flex items-center justify-between">
        <span className="text-sm font-medium text-white">Create Tokens</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
          aria-label="Close token panel"
        >
          ×
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-gray-700">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search any token..."
          className="w-full px-2 py-1.5 text-sm bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          autoFocus
        />
      </div>

      {/* Token list */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 100px)' }}>
        {isSearching && (
          <div className="px-3 py-4 text-center text-gray-400 text-sm">
            Searching...
          </div>
        )}

        {!isSearching && displayTokens.length === 0 && (
          <div className="px-3 py-4 text-center text-gray-500 text-sm">
            {searchQuery.trim()
              ? 'No tokens found'
              : deckTokens.length === 0
                ? 'No deck tokens available. Use search to find any token.'
                : 'No tokens to display'}
          </div>
        )}

        {!isSearching && displayTokens.map((token) => (
          <div
            key={token.scryfallId}
            className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/50 hover:bg-gray-700/50 transition-colors"
          >
            {/* Token image */}
            <div className="flex-shrink-0 w-10 h-14 rounded overflow-hidden bg-gray-900">
              {token.imageURI ? (
                <img
                  src={token.imageURI}
                  alt={token.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-[8px]">
                  No img
                </div>
              )}
            </div>

            {/* Token info */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{token.name}</div>
              {token.power !== null && token.toughness !== null && (
                <div className="text-[10px] text-gray-400">
                  {token.power}/{token.toughness}
                </div>
              )}
              <div className="text-[10px] text-gray-500 truncate">{token.typeLine}</div>
            </div>

            {/* Quantity selector */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setQuantity(token.scryfallId, getQuantity(token.scryfallId) - 1)}
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-600 hover:bg-gray-500 text-white text-xs"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="text-xs text-white w-4 text-center">
                {getQuantity(token.scryfallId)}
              </span>
              <button
                onClick={() => setQuantity(token.scryfallId, getQuantity(token.scryfallId) + 1)}
                className="w-5 h-5 flex items-center justify-center rounded bg-gray-600 hover:bg-gray-500 text-white text-xs"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {/* Create button */}
            <button
              onClick={() => handleCreate(token)}
              className="flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              Create
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
