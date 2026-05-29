import { useEffect } from 'react';
import type { CardData } from '../types';

export interface PeekModalProps {
  /** Cards to display (top N from library) */
  cards: CardData[];
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close the modal */
  onClose: () => void;
}

/**
 * PeekModal — Shows the top N cards of the library in a modal overlay.
 * Triggered by Alt+1-9. Cards are displayed face-up in a horizontal row.
 * Press Escape or click outside to dismiss.
 */
export function PeekModal({ cards, isOpen, onClose }: PeekModalProps) {
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

  if (!isOpen || cards.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Peeking at top ${cards.length} cards of library`}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-200">
            Top {cards.length} of Library
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            Esc
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {cards.map((card, idx) => (
            <div key={card.id} className="flex-shrink-0 flex flex-col items-center gap-1">
              <img
                src={card.imageURI}
                alt={card.name}
                className="w-[93px] h-[130px] object-cover rounded-md shadow-lg"
                draggable={false}
              />
              <span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          Cards remain in this order on top of library
        </p>
      </div>
    </div>
  );
}
