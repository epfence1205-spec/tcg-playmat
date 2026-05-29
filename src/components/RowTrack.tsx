import { useDroppable } from '@dnd-kit/core';
import { useDndContext } from '@dnd-kit/core';
import type { RowTarget, RowCard } from '../types';
import { DraggableCard } from './DraggableCard';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface RowTrackProps {
  /** Which row this track represents */
  rowId: RowTarget;
  /** Cards assigned to this row */
  elements: RowCard[];
  /** CSS height value for this row (e.g., '100%', '33.33%') */
  height: string;
  /** Called when a card is dropped into this row at a given index */
  onDrop: (cardId: string, insertIndex: number) => void;
  /** Called when a card is reordered within this row */
  onReorder: (cardId: string, newIndex: number) => void;
  /** Called when a card is clicked (tap/untap toggle) */
  onTapCard?: (cardId: string) => void;
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** A logical group of same-name cards or a single card */
interface CardGroup {
  /** The shared card name for this group */
  name: string;
  /** Cards in this group (1 for singles, 2+ for fanned groups) */
  cards: RowCard[];
  /** The index in the original elements array where this group starts */
  startIndex: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Groups consecutive same-name cards into CardGroup objects.
 * Cards with the same name that are adjacent form a fanned group.
 * Non-adjacent same-name cards are treated as separate groups.
 */
function groupElements(elements: RowCard[]): CardGroup[] {
  if (elements.length === 0) return [];

  const groups: CardGroup[] = [];
  let currentGroup: CardGroup = {
    name: elements[0].card.name,
    cards: [elements[0]],
    startIndex: 0,
  };

  for (let i = 1; i < elements.length; i++) {
    const el = elements[i];
    if (el.card.name === currentGroup.name) {
      currentGroup.cards.push(el);
    } else {
      groups.push(currentGroup);
      currentGroup = {
        name: el.card.name,
        cards: [el],
        startIndex: i,
      };
    }
  }
  groups.push(currentGroup);

  return groups;
}

// ─── FannedGroup Fallback ────────────────────────────────────────────────────

/**
 * Inline fallback for FannedGroup rendering.
 * Renders same-name cards with 95% horizontal overlap.
 * Will be replaced by the full FannedGroup component (task 7.4).
 */
function FannedGroupFallback({
  cards,
  groupName,
  baseZIndex,
  onTapCard,
}: {
  cards: RowCard[];
  groupName: string;
  baseZIndex: number;
  onTapCard?: (cardId: string) => void;
}) {
  // Card width is 93px; 5% visible = ~4.65px offset per stacked card
  const CARD_WIDTH = 93;
  const OVERLAP_PERCENT = 0.95;
  const OFFSET = CARD_WIDTH * (1 - OVERLAP_PERCENT);

  return (
    <div
      className="relative flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{
        // Total width: first card full + offset for each additional card
        width: `${CARD_WIDTH + OFFSET * (cards.length - 1)}px`,
        height: '130px',
      }}
      data-testid={`fanned-group-${groupName}`}
      aria-label={`${groupName} group (${cards.length} cards)`}
    >
      {cards.map((card, idx) => (
        <div
          key={card.instanceId}
          className="absolute top-0 transition-all duration-300 ease-in-out"
          style={{
            left: `${idx * OFFSET}px`,
            zIndex: baseZIndex + idx,
          }}
        >
          <DraggableCard
            card={card.card}
            sourceZone="battlefield"
            isTapped={card.isTapped}
            isFaceDown={card.isFaceDown}
            showingBackFace={card.showingBackFace}
            onClick={onTapCard}
          />
        </div>
      ))}
    </div>
  );
}

// ─── DropZone Component ──────────────────────────────────────────────────────

/**
 * An invisible drop zone between cards/groups that expands with an animated
 * gap when a card is dragged over it.
 */
function InsertionDropZone({
  rowId,
  insertIndex,
  isActive,
}: {
  rowId: RowTarget;
  insertIndex: number;
  isActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `insert-${rowId}-${insertIndex}`,
    data: {
      type: 'insertion',
      rowId,
      insertIndex,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 transition-all duration-300 ease-in-out
        ${isOver && isActive ? 'w-[60px] bg-green-400/20 border border-dashed border-green-400/50 rounded' : 'w-[4px]'}
      `}
      style={{
        height: '130px',
        minWidth: isOver && isActive ? '60px' : '4px',
      }}
      data-testid={`drop-zone-${rowId}-${insertIndex}`}
      aria-label={`Insert position ${insertIndex}`}
    />
  );
}

// ─── RowTrack Component ──────────────────────────────────────────────────────

/**
 * RowTrack — A single horizontal row track that renders cards in continuous flow.
 *
 * Features:
 * - Flex-row layout with cards arranged left-to-right
 * - Same-name cards grouped into fanned stacks (95% overlap)
 * - Drop zones between cards/groups for insertion with animated gap preview
 * - Z-index management: sequential increment per card/group (z-10, z-20, z-30...)
 * - Smooth entry/exit/reposition animations
 * - Supports drag-between-rows for reordering
 *
 * Requirements: 4.2, 4.4, 4.5, 8.1, 8.7, 8.8
 */
export function RowTrack({
  rowId,
  elements,
  height,
  onDrop,
  onReorder,
  onTapCard,
}: RowTrackProps) {
  // Suppress unused variable warnings — these are used by the DnD context
  void onDrop;
  void onReorder;

  // Make the entire row a droppable target for cross-zone drops
  const { setNodeRef, isOver } = useDroppable({
    id: `row-${rowId}`,
    data: { type: 'row', rowId },
  });

  // Access the active drag state to determine if we should show insertion gaps
  const { active } = useDndContext();
  const isDragging = active !== null;

  // Determine if the dragged card would join an existing fan group
  // (i.e., the dragged card has the same name as an adjacent group)
  const draggedCardName = active?.data?.current?.cardName as string | undefined;

  // Group same-name adjacent cards
  const groups = groupElements(elements);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-row items-center px-2 min-h-0 overflow-hidden
        transition-all duration-300 ease-in-out
        ${isOver ? 'bg-green-600/20 ring-1 ring-green-400/40' : ''}
      `}
      style={{ height }}
      data-testid={`row-track-${rowId}`}
      data-row-id={rowId}
      role="region"
      aria-label={`${rowId} row`}
    >
      {/* Leading drop zone */}
      {isDragging && (
        <InsertionDropZone
          rowId={rowId}
          insertIndex={0}
          isActive={isDragging && draggedCardName !== groups[0]?.name}
        />
      )}

      {groups.map((group, groupIdx) => {
        // Z-index base: increments by 10 per group position
        const baseZIndex = (groupIdx + 1) * 10;

        // The insert index after this group
        const insertAfterIndex = group.startIndex + group.cards.length;

        // Determine if the next group has the same name as the dragged card
        // If so, the drop zone should not show (card would join the fan)
        const nextGroup = groups[groupIdx + 1];
        const showInsertionGap =
          isDragging &&
          draggedCardName !== group.name &&
          draggedCardName !== nextGroup?.name;

        return (
          <div
            key={`group-${group.name}-${group.startIndex}`}
            className="flex flex-row items-center transition-all duration-300 ease-in-out"
          >
            {/* Render the group */}
            {group.cards.length === 1 ? (
              // Single card — render directly
              <div
                className="flex-shrink-0 transition-all duration-300 ease-in-out"
                style={{ zIndex: baseZIndex }}
              >
                <DraggableCard
                  card={group.cards[0].card}
                  sourceZone="battlefield"
                  isTapped={group.cards[0].isTapped}
                  isFaceDown={group.cards[0].isFaceDown}
                  showingBackFace={group.cards[0].showingBackFace}
                  onClick={onTapCard}
                />
              </div>
            ) : (
              // Multiple same-name cards — render as fanned group
              <FannedGroupFallback
                cards={group.cards}
                groupName={group.name}
                baseZIndex={baseZIndex}
                onTapCard={onTapCard}
              />
            )}

            {/* Insertion drop zone after this group (not after the last group) */}
            {isDragging && groupIdx < groups.length - 1 && (
              <InsertionDropZone
                rowId={rowId}
                insertIndex={insertAfterIndex}
                isActive={showInsertionGap}
              />
            )}
          </div>
        );
      })}

      {/* Trailing drop zone */}
      {isDragging && elements.length > 0 && (
        <InsertionDropZone
          rowId={rowId}
          insertIndex={elements.length}
          isActive={isDragging && draggedCardName !== groups[groups.length - 1]?.name}
        />
      )}

      {/* Empty state — show when no cards and not dragging */}
      {elements.length === 0 && !isDragging && (
        <span className="text-[10px] text-green-400/30 font-mono select-none pointer-events-none">
          {rowId}
        </span>
      )}
    </div>
  );
}
