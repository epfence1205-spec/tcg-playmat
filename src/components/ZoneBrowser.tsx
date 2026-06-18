import { useState, useEffect, useMemo } from 'react';
import type { Zone } from '../types';

export type ZoneBrowserDestination = Zone | 'battlefield-tapped' | 'battlefield-facedown' | 'battlefield-backface';

export interface ZoneBrowserCard {
  id: string;
  name: string;
  typeLine: string;
  oracleText: string;
  imageURI: string;
  isFaceDown?: boolean;
  backFaceImageURI?: string | null;
}

export interface ZoneBrowserProps {
  /** Zone label displayed in the header */
  zoneName: string;
  /** Zone identifier for data attributes */
  sourceZone: Zone;
  /** Cards to display */
  cards: ZoneBrowserCard[];
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close the modal */
  onClose: () => void;
  /** Move a card to a destination */
  onMoveCard: (cardId: string, destination: ZoneBrowserDestination) => void;
  /** Available move destinations (order preserved in action menu) */
  destinations: { label: string; destination: ZoneBrowserDestination }[];
  /** Hover ring color class (e.g. 'ring-blue-400') */
  ringColor?: string;
  /** Footer text */
  footerText?: string;
}

import { CARD_BACK_URL } from '../cardBack';

/**
 * ZoneBrowser — Universal searchable modal for browsing any card zone.
 * Used for library (Ctrl+F), graveyard (Ctrl+Y), and exile (Ctrl+E).
 */
export function ZoneBrowser({
  zoneName,
  sourceZone,
  cards,
  isOpen,
  onClose,
  onMoveCard,
  destinations,
  ringColor = 'ring-blue-400',
  footerText = 'Click a card for move options.',
}: ZoneBrowserProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) setSearch('');
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
    return cards.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      c.typeLine.toLowerCase().includes(lower) ||
      c.oracleText.toLowerCase().includes(lower)
    );
  }, [cards, search]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${zoneName} browser`}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl w-[90vw] max-w-[900px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-200">
            {zoneName} ({cards.length} cards)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            Esc
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, type, or text..."
          className="w-full px-3 py-2 mb-3 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="flex-1 overflow-y-auto">
          {filteredCards.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              {search ? 'No cards match your search' : `${zoneName} is empty`}
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,93px)] gap-2 justify-center">
              {filteredCards.map((card) => (
                <ZoneBrowserCardItem
                  key={card.id}
                  card={card}
                  sourceZone={sourceZone}
                  ringColor={ringColor}
                  destinations={destinations}
                  onMoveCard={onMoveCard}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-500 mt-2 text-center">
          {footerText}
        </p>
      </div>
    </div>
  );
}

function ZoneBrowserCardItem({
  card,
  sourceZone,
  ringColor,
  destinations,
  onMoveCard,
}: {
  card: ZoneBrowserCard;
  sourceZone: Zone;
  ringColor: string;
  destinations: { label: string; destination: ZoneBrowserDestination }[];
  onMoveCard: (cardId: string, destination: ZoneBrowserDestination) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const imgSrc = card.isFaceDown ? CARD_BACK_URL : card.imageURI;
  const altText = card.isFaceDown ? 'Face-down card' : card.name;

  return (
    <div className="relative group" data-card-id={card.id} data-card-zone={sourceZone}>
      <img
        src={imgSrc}
        alt={altText}
        className={`w-[93px] h-[130px] object-cover rounded-md shadow cursor-pointer hover:ring-2 hover:${ringColor} transition-all`}
        draggable={false}
        onClick={() => setShowActions(!showActions)}
        title={card.isFaceDown ? 'Face-down' : card.name}
      />
      {showActions && (
        <div className="absolute top-0 left-0 right-0 bg-gray-800/95 rounded-md p-1 z-10 flex flex-col gap-0.5">
          {destinations
            .filter(({ destination }) => destination !== 'battlefield-backface' || card.backFaceImageURI)
            .map(({ label, destination }) => (
            <button
              key={destination}
              className="text-[10px] text-gray-200 hover:bg-gray-700 rounded px-1 py-0.5 text-left"
              onClick={() => { onMoveCard(card.id, destination); setShowActions(false); }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
