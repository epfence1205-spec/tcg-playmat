import { useEffect } from 'react';

export interface KeybindOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const KEYBIND_SECTIONS = [
  {
    title: 'Game Actions',
    binds: [
      { key: 'N', desc: 'Next turn (untap + draw)' },
      { key: 'U', desc: 'Untap all' },
      { key: 'D', desc: 'Draw a card' },
      { key: 'Ctrl+G', desc: 'New game (reset)' },
      { key: 'Ctrl+S', desc: 'Shuffle library' },
    ],
  },
  {
    title: 'Card Movement',
    binds: [
      { key: 'B', desc: 'Move to battlefield' },
      { key: 'H', desc: 'Move to hand' },
      { key: 'G', desc: 'Move to graveyard' },
      { key: 'E', desc: 'Move to exile' },
      { key: 'Z', desc: 'Move to command zone' },
      { key: 'Y', desc: 'Move to top of library' },
      { key: '1-9', desc: 'Quick play Nth hand card' },
    ],
  },
  {
    title: 'Card Actions',
    binds: [
      { key: 'T', desc: 'Tap / untap' },
      { key: 'F', desc: 'Transform (DFC)' },
      { key: 'M', desc: 'Morph (face-down)' },
      { key: 'P', desc: 'Phase out' },
      { key: 'C', desc: 'Create token copy' },
      { key: '+/=', desc: 'Add +1/+1 counter' },
      { key: '-', desc: 'Remove +1/+1 counter' },
      { key: 'Del', desc: 'Delete card' },
      { key: 'Space', desc: 'Reveal / hide (hand)' },
    ],
  },
  {
    title: 'Other',
    binds: [
      { key: 'Alt+1-9', desc: 'Peek top N cards' },
      { key: 'Ctrl+F', desc: 'Browse library' },
      { key: 'Ctrl+Y', desc: 'Browse graveyard' },
      { key: 'Ctrl+E', desc: 'Browse exile' },
      { key: 'Alt+E', desc: 'Equip mode' },
      { key: 'Ctrl+Z', desc: 'Undo' },
      { key: '?', desc: 'Toggle this overlay' },
    ],
  },
];

/**
 * KeybindOverlay — Full-screen overlay showing all keyboard shortcuts.
 * Toggled by pressing '?' key. Dismissed by Escape or clicking outside.
 */
export function KeybindOverlay({ isOpen, onClose }: KeybindOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-2xl max-w-[700px] w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors"
          >
            Esc
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {KEYBIND_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.binds.map((bind) => (
                  <div key={bind.key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{bind.desc}</span>
                    <kbd className="ml-2 px-1.5 py-0.5 text-xs font-mono bg-gray-800 border border-gray-600 rounded text-gray-200">
                      {bind.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-500 mt-4 text-center">
          Hover a card to target it with card actions. Right-click for context menu.
        </p>
      </div>
    </div>
  );
}
