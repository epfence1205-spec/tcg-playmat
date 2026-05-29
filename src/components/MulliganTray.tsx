import type { MulliganState, CardData } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MulliganTrayProps {
  state: MulliganState;
  onTogglePutBack: (cardId: string) => void;
  onConfirmKeep: () => void;
  onMulliganAgain: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * MulliganTray — Dedicated mulligan UI rendering exclusively within Zone C (bottom 16.67vh).
 *
 * Displays drawn cards fanned horizontally. Clicking a card toggles its selection
 * for put-back (shown with 50% opacity + red border). "Confirm Keep" is disabled
 * until the exact required number of cards are selected for put-back.
 *
 * First mulligan is free (requiredPutBacks = 0), so Confirm Keep is immediately available.
 */
export function MulliganTray({
  state,
  onTogglePutBack,
  onConfirmKeep,
  onMulliganAgain,
}: MulliganTrayProps) {
  const { mulliganCount, drawnCards, selectedToPutBack, requiredPutBacks } = state;

  const canConfirm = selectedToPutBack.size === requiredPutBacks;

  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full gap-2 px-4"
      style={{ maxHeight: '20vh' }}
      role="region"
      aria-label="Mulligan selection"
    >
      {/* Info text */}
      <div className="text-xs text-gray-400 text-center select-none">
        <span>
          {mulliganCount === 0
            ? 'Opening Hand'
            : `Mulligan #${mulliganCount}`}
          {requiredPutBacks > 0 && (
            <> — Select {requiredPutBacks} card{requiredPutBacks !== 1 ? 's' : ''} to put back</>
          )}
          {requiredPutBacks === 0 && mulliganCount === 0 && <> — Keep or mulligan</>}
          {requiredPutBacks === 0 && mulliganCount > 0 && <> — Free mulligan! Keep all cards</>}
        </span>
        {requiredPutBacks > 0 && (
          <span className="ml-2 text-gray-500">
            ({selectedToPutBack.size}/{requiredPutBacks} selected)
          </span>
        )}
      </div>

      {/* Fanned cards */}
      <div
        className="flex items-center justify-center flex-1 min-h-0"
        role="list"
        aria-label="Drawn cards"
      >
        {drawnCards.map((card: CardData, index: number) => {
          const isSelected = selectedToPutBack.has(card.id);

          return (
            <button
              key={card.id}
              type="button"
              className={`
                flex-shrink-0 cursor-pointer rounded-md overflow-hidden
                transition-all duration-150 ease-out
                focus:outline-none focus:ring-2 focus:ring-blue-400
                ${isSelected ? 'border-2 border-red-500 opacity-50' : 'border-2 border-transparent hover:border-blue-400'}
              `}
              style={{
                width: '11.43vh',
                height: '16vh',
                marginLeft: index === 0 ? 0 : '-1.5vh',
                zIndex: index + 1,
                position: 'relative',
              }}
              onClick={() => onTogglePutBack(card.id)}
              role="listitem"
              aria-label={`${card.name}${isSelected ? ' (selected to put back)' : ''}`}
              aria-pressed={isSelected}
              title={`${card.name}${isSelected ? ' — click to deselect' : ' — click to select for put-back'}`}
            >
              <img
                src={card.imageURI}
                alt={card.name}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`
            px-3 py-1 text-xs font-medium rounded
            transition-colors duration-150
            ${canConfirm
              ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
          `}
          disabled={!canConfirm}
          onClick={onConfirmKeep}
          aria-label={canConfirm ? 'Confirm keep hand' : `Select ${requiredPutBacks - selectedToPutBack.size} more card(s) to put back`}
        >
          Confirm Keep
        </button>

        <button
          type="button"
          className="px-3 py-1 text-xs font-medium rounded bg-yellow-700 hover:bg-yellow-600 text-white cursor-pointer transition-colors duration-150"
          onClick={onMulliganAgain}
          aria-label={mulliganCount === 0 ? 'Mulligan' : 'Mulligan again'}
        >
          {mulliganCount === 0 ? 'Mulligan' : 'Mulligan Again'}
        </button>
      </div>
    </div>
  );
}
