import type { Zone } from '../types'

export type BatchAction = 'tap' | 'untap' | { moveTo: Zone | 'top-library' }

interface SelectionToolbarProps {
  isVisible: boolean
  onBatchAction: (action: BatchAction) => void
}

/**
 * SelectionToolbar — Floating toolbar with batch actions for multi-selected cards.
 * Position: top-right of Zone A below SelectionOverlay (`top-12 right-2`), z-index 90.
 * Appears/disappears with 150ms opacity+transform transition.
 */
export function SelectionToolbar({ isVisible, onBatchAction }: SelectionToolbarProps) {
  return (
    <div
      className={`absolute top-12 right-2 flex flex-col gap-1 bg-gray-900/95 border border-gray-600 rounded-md p-2 transition-all duration-150 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}
      style={{ zIndex: 90 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => onBatchAction('tap')}
        className="text-xs text-gray-200 hover:text-white hover:bg-gray-700 px-2 py-1 rounded text-left whitespace-nowrap"
      >
        Tap All
      </button>
      <button
        onClick={() => onBatchAction('untap')}
        className="text-xs text-gray-200 hover:text-white hover:bg-gray-700 px-2 py-1 rounded text-left whitespace-nowrap"
      >
        Untap All
      </button>
      <hr className="border-gray-600" />
      <button
        onClick={() => onBatchAction({ moveTo: 'graveyard' })}
        className="text-xs text-gray-200 hover:text-white hover:bg-gray-700 px-2 py-1 rounded text-left whitespace-nowrap"
      >
        → Graveyard
      </button>
      <button
        onClick={() => onBatchAction({ moveTo: 'exile' })}
        className="text-xs text-gray-200 hover:text-white hover:bg-gray-700 px-2 py-1 rounded text-left whitespace-nowrap"
      >
        → Exile
      </button>
      <button
        onClick={() => onBatchAction({ moveTo: 'hand' })}
        className="text-xs text-gray-200 hover:text-white hover:bg-gray-700 px-2 py-1 rounded text-left whitespace-nowrap"
      >
        → Hand
      </button>
      <button
        onClick={() => onBatchAction({ moveTo: 'top-library' })}
        className="text-xs text-gray-200 hover:text-white hover:bg-gray-700 px-2 py-1 rounded text-left whitespace-nowrap"
      >
        → Library Top
      </button>
    </div>
  )
}
