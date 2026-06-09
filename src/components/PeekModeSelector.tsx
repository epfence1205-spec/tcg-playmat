import { useEffect, useState, useCallback } from 'react';
import type { PeekMode } from '../peekActions';

export interface PeekModeSelectorProps {
  /** Number of cards to peek at */
  count: number;
  /** Whether the selector is open */
  isOpen: boolean;
  /** Called when a mode is selected */
  onSelectMode: (mode: PeekMode) => void;
  /** Called when dismissed without selection */
  onClose: () => void;
}

const MODES: { mode: PeekMode; label: string; shortcut: string; description: string }[] = [
  { mode: 'scry', label: 'Scry', shortcut: 'S', description: 'Top or bottom of library' },
  { mode: 'surveil', label: 'Surveil', shortcut: 'V', description: 'Top of library or graveyard' },
  { mode: 'select', label: 'Select', shortcut: 'E', description: 'Pick cards to hand, rest to bottom' },
  { mode: 'peek', label: 'Peek', shortcut: 'P', description: 'Look only (read-only)' },
];

/**
 * PeekModeSelector — Small centered popup that lets the player choose
 * which peek mode to use before the PeekModal opens.
 *
 * Keyboard: Arrow Up/Down to highlight, Enter to confirm,
 * or S/V/E/P single-letter shortcuts.
 * Escape or backdrop click dismisses.
 */
export function PeekModeSelector({ count, isOpen, onSelectMode, onClose }: PeekModeSelectorProps) {
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  // Reset highlight when opening
  useEffect(() => {
    if (isOpen) setHighlightedIdx(0);
  }, [isOpen]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    // Suppress all keybinds while open
    e.stopPropagation();

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIdx(prev => (prev + 1) % MODES.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIdx(prev => (prev - 1 + MODES.length) % MODES.length);
        break;
      case 'Enter':
        e.preventDefault();
        onSelectMode(MODES[highlightedIdx].mode);
        break;
      default: {
        const key = e.key.toLowerCase();
        const match = MODES.find(m => m.shortcut.toLowerCase() === key);
        if (match) {
          e.preventDefault();
          onSelectMode(match.mode);
        }
        break;
      }
    }
  }, [isOpen, highlightedIdx, onSelectMode, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      style={{ maxHeight: '83.33vh' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choose peek mode"
    >
      <div
        className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-2xl w-[220px]"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xs font-medium text-gray-300 mb-2 text-center">
          Peek {count} — Choose Mode
        </h3>
        <div className="flex flex-col gap-1">
          {MODES.map((m, idx) => (
            <button
              key={m.mode}
              className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                idx === highlightedIdx
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => onSelectMode(m.mode)}
              onMouseEnter={() => setHighlightedIdx(idx)}
            >
              <span className="flex items-center gap-2">
                <span className="font-medium">{m.label}</span>
                <span className="text-[10px] text-gray-400">{m.description}</span>
              </span>
              <kbd className="text-[10px] bg-gray-800 px-1 rounded text-gray-500">{m.shortcut}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
