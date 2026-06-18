import { useEffect, useRef } from 'react';
import type { GameLogEntry } from '../types';

export interface GameLogOverlayProps {
  isOpen: boolean;
  entries: GameLogEntry[];
  currentTurn: number;
  onClose: () => void;
}

/**
 * GameLogOverlay — Scrollable overlay showing the play history log.
 * Toggled by 'L' key. Shows zone transitions and turn markers.
 */
export function GameLogOverlay({ isOpen, entries, currentTurn, onClose }: GameLogOverlayProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-scroll to bottom when opened or new entries arrive
  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, entries.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-end pointer-events-none"
      onClick={onClose}
    >
      <div
        className="pointer-events-auto w-72 h-[70vh] mr-4 bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-white">Game Log — Turn {currentTurn}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm leading-none"
            aria-label="Close game log"
          >
            ×
          </button>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {entries.length === 0 ? (
            <p className="text-gray-500 text-[10px] italic text-center mt-4">No actions yet</p>
          ) : (
            entries.map((entry, i) => {
              const showTurnHeader = i === 0 || entries[i - 1].turn !== entry.turn;
              return (
                <div key={i}>
                  {showTurnHeader && (
                    <div className="text-[9px] font-bold text-purple-400 uppercase tracking-wider mt-1 mb-0.5 border-b border-gray-700/50 pb-0.5">
                      Turn {entry.turn}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-300 py-0.5 leading-tight">
                    {entry.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
