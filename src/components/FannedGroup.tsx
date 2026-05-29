import { DraggableCard } from './DraggableCard';
import type { RowCard } from '../types';

/**
 * Card width in pixels used for overlap calculations.
 * The overlap offset is 5% of card width (~4px exposed per underlying card).
 */
const CARD_WIDTH = 80;
const OVERLAP_OFFSET = CARD_WIDTH * 0.05; // 4px exposed per underlying card

export interface FannedGroupProps {
  /** Cards in this fanned group (all share the same name) */
  cards: RowCard[];
  /** The shared card name for this group */
  groupName: string;
  /** Click handler for individual cards */
  onCardClick: (cardId: string) => void;
  /** Drag start handler for individual cards */
  onDragStart: (cardId: string) => void;
}

/**
 * FannedGroup — Renders a group of same-name cards with 95% horizontal overlap.
 *
 * - Each card after the first is positioned with a negative margin-left so only
 *   5% of each underlying card is visible (showing the art banner on the left edge).
 * - Z-index increments sequentially: card[0] gets z-10, card[1] gets z-20, etc.
 *   The newest/last card is on top and fully visible.
 * - The entire group counts as 1 element for row capacity calculations.
 * - Cards animate smoothly with transition-all duration-300 ease-in-out.
 */
export function FannedGroup({
  cards,
  groupName,
  onCardClick,
  onDragStart,
}: FannedGroupProps) {
  if (cards.length === 0) return null;

  return (
    <div
      className="relative flex items-center"
      data-fanned-group={groupName}
      aria-label={`Fanned group: ${groupName} (${cards.length} card${cards.length !== 1 ? 's' : ''})`}
    >
      {cards.map((rowCard, index) => {
        // First card has no negative margin; subsequent cards overlap 95%
        const marginLeft = index === 0 ? 0 : -(CARD_WIDTH - OVERLAP_OFFSET);
        // Sequential z-index: z-10, z-20, z-30...
        const zIndex = (index + 1) * 10;

        return (
          <div
            key={rowCard.instanceId}
            className="transition-all duration-300 ease-in-out"
            style={{
              marginLeft: index === 0 ? undefined : `${marginLeft}px`,
              zIndex,
              position: 'relative',
            }}
            onPointerDown={() => onDragStart(rowCard.instanceId)}
          >
            <DraggableCard
              card={rowCard.card}
              sourceZone="battlefield"
              isTapped={rowCard.isTapped}
              isFaceDown={rowCard.isFaceDown}
              showingBackFace={rowCard.showingBackFace}
              onClick={onCardClick}
              className="transition-all duration-300 ease-in-out"
            />
          </div>
        );
      })}
    </div>
  );
}
