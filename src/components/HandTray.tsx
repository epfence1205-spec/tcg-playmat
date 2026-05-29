import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MulliganTray } from './MulliganTray';
import type { CardData, GamePhase, MulliganState } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MulliganAction =
  | { type: 'TOGGLE_PUT_BACK'; cardId: string }
  | { type: 'CONFIRM_KEEP' }
  | { type: 'MULLIGAN_AGAIN' };

export interface HandTrayProps {
  cards: CardData[];
  gamePhase: GamePhase;
  mulliganState: MulliganState | null;
  hoveredCard: CardData | null;
  onDragStart: (cardId: string) => void;
  onToggleReveal: (cardId: string) => void;
  onMulliganAction: (action: MulliganAction) => void;
  onCardHoverStart?: (cardId: string, zone: 'hand') => void;
  onCardHoverEnd?: (cardId: string) => void;
  onImportDeck: () => void;
  onNewGame: () => void;
  onDraw: () => void;
  onOpenTokenPanel: () => void;
  deckLoaded: boolean;
}

// ─── Fan Layout Helpers ──────────────────────────────────────────────────────

/**
 * Compute fan rotation and vertical offset for a card at `index` in a hand of `total` cards.
 * Cards overlap at the bottom like holding a real hand. Hovered card stands upright,
 * neighbors spread away.
 */
function getFanTransform(
  index: number,
  total: number,
  hoveredIndex: number | null
): { rotation: number; translateY: number; translateX: number; zIndex: number } {
  if (total <= 1) return { rotation: 0, translateY: 0, translateX: 0, zIndex: 1 };

  // Normalize position to [-1, 1] range (center = 0)
  const normalized = (2 * index) / (total - 1) - 1;

  // Max rotation scales with hand size but caps out
  const maxRotation = Math.min(2 + total * 0.7, 14);
  let rotation = normalized * maxRotation;

  // Vertical arc: edge cards drop down, center stays higher
  const maxDrop = Math.min(3 + total * 0.4, 14);
  let translateY = normalized * normalized * maxDrop;

  let translateX = 0;
  let zIndex = index + 1;

  // Hover behavior: hovered card stands upright and lifts, neighbors spread
  if (hoveredIndex !== null) {
    if (index === hoveredIndex) {
      rotation = 0;
      translateY = -12; // lift up
      zIndex = total + 10;
    } else {
      // Push neighbors away from hovered card
      const distance = index - hoveredIndex;
      const spread = distance > 0 ? 18 : -18;
      // Closer neighbors spread more
      const proximity = Math.max(0, 1 - Math.abs(distance) * 0.3);
      translateX = spread * proximity;
    }
  }

  return { rotation, translateY, translateX, zIndex };
}

// ─── SortableHandCard ────────────────────────────────────────────────────────

/**
 * SortableHandCard — A hand card that supports drag-to-reorder via @dnd-kit/sortable.
 * Also supports cross-container drag (hand → battlefield) since useSortable
 * extends useDraggable. Cards overlap and fan out; hovered card stands upright.
 */
function SortableHandCard({ card, index, total, hoveredIndex, onClick, onHoverStart, onHoverEnd }: {
  card: CardData;
  index: number;
  total: number;
  hoveredIndex: number | null;
  onClick: () => void;
  onHoverStart?: (cardId: string, zone: 'hand') => void;
  onHoverEnd?: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { cardId: card.id, cardName: card.name, sourceZone: 'hand', cardType: card.cardType },
  });

  const { rotation, translateY, translateX, zIndex } = getFanTransform(index, total, hoveredIndex);

  // Layer dnd-kit's sort transform on top of the fan transform
  const dndTransform = CSS.Transform.toString(transform);
  const fanTransform = `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg)`;
  const combinedTransform = dndTransform
    ? `${dndTransform} ${fanTransform}`
    : fanTransform;

  const isHovered = hoveredIndex === index;

  // Always use our fan transition for smooth hover; let dnd-kit control only during active drag
  const fanTransition = 'transform 250ms ease, scale 250ms ease, z-index 0ms';

  const style: React.CSSProperties = {
    transform: combinedTransform,
    transition: isDragging ? (transition || fanTransition) : fanTransition,
    opacity: isDragging ? 0.3 : 1,
    width: '11.43vh',
    height: '16vh',
    cursor: 'grab',
    flexShrink: 0,
    transformOrigin: 'bottom center',
    zIndex,
    marginLeft: index === 0 ? 0 : '-2.5vh', // overlap cards
    scale: isHovered ? '1.05' : '1',
  };

  const displayImage = card.imageURI;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="select-none touch-none"
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => onHoverStart?.(card.id, 'hand')}
      onMouseLeave={() => onHoverEnd?.(card.id)}
      title={card.name}
      role="button"
      aria-label={`${card.name} in hand`}
    >
      <img
        src={displayImage}
        alt={card.name}
        className="w-full h-full object-cover rounded-md pointer-events-none"
        draggable={false}
      />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * HandTray — Zone C: Private hand display below OBS crop.
 *
 * During PLAYING phase: renders hand cards in a horizontal sortable list.
 * - Cards can be drag-reordered within the hand via @dnd-kit/sortable.
 * - Cards can also be dragged from the hand to the battlefield (cross-container).
 * - Horizontal scroll enabled for overflow.
 *
 * During MULLIGAN phase: hosts MulliganTray placeholder.
 *
 * Reserves space on the right for HDZoomPortal.
 * Full viewport width, height set by parent (16.67vh).
 */
export function HandTray({
  cards,
  gamePhase,
  mulliganState,
  hoveredCard,
  onDragStart: _onDragStart,
  onToggleReveal,
  onMulliganAction,
  onCardHoverStart,
  onCardHoverEnd,
  onImportDeck,
  onNewGame,
  onDraw,
  onOpenTokenPanel,
  deckLoaded,
}: HandTrayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Droppable zone — must be called unconditionally (React hooks rules)
  const { setNodeRef: setDroppableRef, isOver: isOverHand } = useDroppable({
    id: 'hand-zone',
    data: { zone: 'hand' },
  });

  // Track which card index is hovered for fan spread effect
  const [hoveredHandIndex, setHoveredHandIndex] = useState<number | null>(null);

  // ─── MULLIGAN Phase Rendering ────────────────────────────────────────────

  if (gamePhase === 'MULLIGAN') {
    if (!mulliganState) {
      // Edge case: state loaded from persistence with MULLIGAN phase but no mulliganState
      // This shouldn't happen in normal flow — show keep button to transition to PLAYING
      return (
        <div
          className="relative flex items-center justify-center w-full h-full bg-gray-900/80 border-t border-gray-700"
          data-obs-zone="below"
          role="region"
          aria-label="Mulligan tray"
        >
          <button
            onClick={() => onMulliganAction({ type: 'CONFIRM_KEEP' })}
            className="px-4 py-2 text-sm font-medium rounded bg-green-600 hover:bg-green-500 text-white"
          >
            Start Game
          </button>
        </div>
      );
    }
    return (
      <div
        className="relative flex items-center justify-center w-full h-full bg-gray-900/80 border-t border-gray-700"
        data-obs-zone="below"
        data-zone="hand"
        role="region"
        aria-label="Mulligan tray"
      >
        <MulliganTray
          state={mulliganState}
          onTogglePutBack={(cardId) => onMulliganAction({ type: 'TOGGLE_PUT_BACK', cardId })}
          onConfirmKeep={() => onMulliganAction({ type: 'CONFIRM_KEEP' })}
          onMulliganAgain={() => onMulliganAction({ type: 'MULLIGAN_AGAIN' })}
        />
      </div>
    );
  }

  // ─── PLAYING Phase Rendering ─────────────────────────────────────────────

  // Track which card index is hovered for fan spread effect
  // (moved above early returns — hooks must not be conditional)

  return (
    <div
      ref={setDroppableRef}
      className={`
        relative flex w-full h-full bg-gray-900/80 border-t border-gray-700 min-h-0 overflow-hidden
        transition-colors duration-200
        ${isOverHand ? 'bg-blue-900/30 ring-1 ring-blue-400/50' : ''}
      `}
      data-obs-zone="below"
      data-zone="hand"
      role="region"
      aria-label={`Hand tray with ${cards.length} cards`}
    >
      {/* Toolbar — left side of Zone C */}
      <div className="flex-shrink-0 flex flex-col gap-1 p-1 justify-center border-r border-gray-700/50" style={{ width: '8vh' }}>
        <button onClick={onImportDeck} className="text-[9px] font-medium rounded bg-blue-700 hover:bg-blue-600 text-white px-1 py-1 transition-colors">
          {deckLoaded ? 'Switch' : 'Import'}
        </button>
        {deckLoaded && (
          <>
            <button onClick={onNewGame} className="text-[9px] font-medium rounded bg-yellow-700 hover:bg-yellow-600 text-white px-1 py-1 transition-colors">
              New Game
            </button>
            <button onClick={onDraw} className="text-[9px] font-medium rounded bg-green-700 hover:bg-green-600 text-white px-1 py-1 transition-colors">
              Draw
            </button>
            <button onClick={onOpenTokenPanel} className="text-[9px] font-medium rounded bg-purple-700 hover:bg-purple-600 text-white px-1 py-1 transition-colors">
              Tokens
            </button>
          </>
        )}
      </div>

      {/* Hand cards area — takes remaining space minus HDZoomPortal */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center select-none overflow-x-auto overflow-y-hidden min-h-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {cards.length === 0 && (
          <span className="text-gray-500 text-sm italic pointer-events-none mx-auto">
            Hand is empty
          </span>
        )}

        {cards.length > 0 && (
          <SortableContext items={cards.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div
              className="flex items-end justify-center pt-2 pb-1"
              style={{ height: '100%' }}
              onMouseLeave={() => setHoveredHandIndex(null)}
            >
              {cards.map((card, index) => (
                <SortableHandCard
                  key={card.id}
                  card={card}
                  index={index}
                  total={cards.length}
                  hoveredIndex={hoveredHandIndex}
                  onClick={() => onToggleReveal(card.id)}
                  onHoverStart={(cardId, zone) => {
                    setHoveredHandIndex(index);
                    onCardHoverStart?.(cardId, zone);
                  }}
                  onHoverEnd={(cardId) => {
                    setHoveredHandIndex(null);
                    onCardHoverEnd?.(cardId);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>

      {/* HDZoomPortal reserved space (right side) — actual component is task 8.4 */}
      <div
        className="flex-shrink-0 w-[140px] flex items-center justify-center border-l border-gray-700/50"
        data-slot="hd-zoom-portal"
      >
        {hoveredCard && (
          <div className="flex flex-col items-center gap-1">
            <img
              src={hoveredCard.imageURILarge || hoveredCard.imageURI}
              alt={hoveredCard.name}
              className="max-h-full max-w-full object-contain rounded"
              style={{ maxHeight: 'calc(20vh - 16px)' }}
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
