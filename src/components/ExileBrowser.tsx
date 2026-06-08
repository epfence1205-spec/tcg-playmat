import { useState, useEffect, useMemo } from 'react';
import type { ExileCard, Zone } from '../types';

export interface ExileBrowserProps {
  /** All cards in exile */
  cards: ExileCard[];
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close the modal */
  onClose: () => void;
  /** Move a card from exile to a destination zone (or battlefield variant) */
  onMoveCard: (cardId: string, destination: Zone | 'battlefield-tapped' | 'battlefield-facedown') => void;
}

/**
 * ExileBrowser — Modal for searching and browsing the exile zone.
 * Triggered by Ctrl+E. Shows all exiled cards with a search filter.
 * Cards can be moved to hand, battlefield, library, or graveyard.
 */
export function ExileBrowser({ cards, isOpen, onClose, onMoveCard }: ExileBrowserProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

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

  const filteredCards = useMemo(() => {
    if (!search.trim()) return cards;
    const lower = search.toLowerCase();
    return cards.filter(ec =>
      ec.card.name.toLowerCase().includes(lower) ||
      ec.card.typeLine.toLowerCase().includes(lower) ||
      ec.card.oracleText.toLowerCase().includes(lower)
    );
  }, [cards, search]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Exile browser"
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl w-[90vw] max-w-[900px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-200">
            Exile ({cards.length} cards)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Search input */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, type, or text..."
          className="w-full px-3 py-2 mb-3 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredCards.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              {search ? 'No cards match your search' : 'Exile is empty'}
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,93px)] gap-2 justify-center">
              {filteredCards.map((ec) => (
                <ExileCardItem
                  key={ec.card.id}
                  exileCard={ec}
                  onMoveCard={onMoveCard}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-500 mt-2 text-center">
          Click a card for move options.
        </p>
      </div>
    </div>
  );
}

const CARD_BACK_URL = '/card-back.webp';

function ExileCardItem({ exileCard, onMoveCard }: { exileCard: ExileCard; onMoveCard: (cardId: string, dest: Zone | 'battlefield-tapped' | 'battlefield-facedown') => void }) {
  const [showActions, setShowActions] = useState(false);
  const { card, isFaceDown } = exileCard;

  return (
    <div className="relative group">
      <img
        src={isFaceDown ? CARD_BACK_URL : card.imageURI}
        alt={isFaceDown ? 'Face-down exiled card' : card.name}
        className="w-[93px] h-[130px] object-cover rounded-md shadow cursor-pointer hover:ring-2 hover:ring-orange-400 transition-all"
        draggable={false}
        onClick={() => setShowActions(!showActions)}
        title={isFaceDown ? 'Face-down' : card.name}
      />
      {showActions && (
        <div className="absolute top-0 left-0 right-0 bg-gray-800/95 rounded-md p-1 z-10 flex flex-col gap-0.5">
          <button
            className="text-[10px] text-gray-200 hover:bg-gray-700 rounded px-1 py-0.5 text-left"
            onClick={() => { onMoveCard(card.id, 'battlefield'); setShowActions(false); }}
          >
            → Battlefield
          </button>
          <button
            className="text-[10px] text-gray-200 hover:bg-gray-700 rounded px-1 py-0.5 text-left"
            onClick={() => { onMoveCard(card.id, 'battlefield-tapped'); setShowActions(false); }}
          >
            → Battlefield (tapped)
          </button>
          <button
            className="text-[10px] text-gray-200 hover:bg-gray-700 rounded px-1 py-0.5 text-left"
            onClick={() => { onMoveCard(card.id, 'battlefield-facedown'); setShowActions(false); }}
          >
            → Battlefield (face-down)
          </button>
          <button
            className="text-[10px] text-gray-200 hover:bg-gray-700 rounded px-1 py-0.5 text-left"
            onClick={() => { onMoveCard(card.id, 'hand'); setShowActions(false); }}
          >
            → Hand
          </button>
          <button
            className="text-[10px] text-gray-200 hover:bg-gray-700 rounded px-1 py-0.5 text-left"
            onClick={() => { onMoveCard(card.id, 'library'); setShowActions(false); }}
          >
            → Library (top)
          </button>
          <button
            className="text-[10px] text-gray-200 hover:bg-gray-700 rounded px-1 py-0.5 text-left"
            onClick={() => { onMoveCard(card.id, 'graveyard'); setShowActions(false); }}
          >
            → Graveyard
          </button>
        </div>
      )}
    </div>
  );
}
