import { useRef, useState, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableCardWrapper } from './SortableCardWrapper';
import type {
  CreatureArea,
  SplitRow,
  RowTarget,
  RowCard,
  GamePhase,
} from '../types';
import { RotationDiv } from './RotationDiv';
import { computeCompression } from '../creatureLayout';
import type { EquipmentAction } from './EquipmentDock';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface BattlefieldProps {
  /** Creature area with 1-3 dynamic rows (3/5 of battlefield height) */
  creatureArea: CreatureArea;
  /** Row 3: basic/mana-only lands (left, L→R) + artifacts (right, R→L) */
  row3: SplitRow;
  /** Row 4: utility lands (left, L→R) + enchantments (right, R→L) */
  row4: SplitRow;
  /** Number of cards in the player's hand (for HUD) */
  handCount: number;
  /** Current turn number */
  turnCount: number;
  /** Player life total */
  lifeTotal: number;
  /** Called when life total changes */
  onLifeChange: (delta: number) => void;
  /** Current game phase */
  gamePhase: GamePhase;
  /** Called when a card is dropped onto a row target */
  onDropCard: (cardId: string, targetRow: RowTarget, insertIndex: number) => void;
  /** Called when a card is clicked (tap/untap toggle) */
  onTapCard: (cardId: string) => void;
  /** Called when equipment is attached to a creature */
  onAttachEquipment: (equipmentId: string, creatureId: string) => void;
  /** Called when a card is reordered within a row */
  onMoveWithinRow: (cardId: string, targetRow: RowTarget, insertIndex: number) => void;
  /** Called when an equipment action is triggered from the fanned-out view */
  onEquipmentAction?: (action: EquipmentAction) => void;
  /** Called when the creature area container resizes (width in vh) */
  onCreatureAreaResize?: (widthVh: number) => void;
  /** Set of card instanceIds currently animating collapse before removal */
  collapsingIds?: Set<string>;
  /** Optional children rendered as overlays (e.g., toolbar buttons) */
  children?: React.ReactNode;
}

// ─── Battlefield Component ───────────────────────────────────────────────────

/**
 * Battlefield (Zone A) — Continuous-flow layout with dynamic row system.
 *
 * Layout:
 * - Creature Area (3/5 height, 60%): 1-3 dynamic RowTrack components
 * - Row 3 (1/5 height, 20%): SplitRow — lands left L→R, artifacts right R→L
 * - Row 4 (1/5 height, 20%): SplitRow — utility lands left L→R, enchantments right R→L
 *
 * Conditional PW/Battle column on far-right of creature area.
 * Hand Count HUD at bottom-left above crop line.
 * Renders blank during MULLIGAN phase.
 */
export function Battlefield({
  creatureArea,
  row3,
  row4,
  handCount,
  turnCount,
  lifeTotal,
  onLifeChange,
  gamePhase,
  onDropCard,
  onTapCard,
  onAttachEquipment,
  onMoveWithinRow,
  onEquipmentAction,
  onCreatureAreaResize,
  collapsingIds,
  children,
}: BattlefieldProps) {
  // Suppress unused variable warnings for handlers used by DnD context
  void onDropCard;
  void onAttachEquipment;
  void onMoveWithinRow;

  // ResizeObserver for creature area container — reports width in px
  const creatureAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!creatureAreaRef.current || !onCreatureAreaResize) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        onCreatureAreaResize(entry.contentRect.width);
      }
    });
    observer.observe(creatureAreaRef.current);
    return () => observer.disconnect();
  }, [onCreatureAreaResize, gamePhase]);

  // Check if any planeswalkers or battles exist in creature rows
  const hasPWOrBattles = creatureArea.rows.some((row) =>
    row.elements.some(
      (el) =>
        el.card.cardType === 'planeswalker' || el.card.cardType === 'battle'
    )
  );

  // Collect PW/Battle cards for the column
  const pwBattleCards = creatureArea.rows.flatMap((row) =>
    row.elements.filter(
      (el) =>
        el.card.cardType === 'planeswalker' || el.card.cardType === 'battle'
    )
  );

  return (
    <div
      className="relative w-full bg-green-900/80 overflow-hidden flex flex-col min-h-0"
      style={{ height: '80vh' }}
      data-obs-zone="above"
      role="region"
      aria-label="Battlefield"
    >
      {/* During MULLIGAN phase, render blank battlefield */}
      {gamePhase === 'MULLIGAN' ? (
        <div className="flex-1" aria-label="Battlefield blank during mulligan" />
      ) : (
        <>
          {/* Creature Area — 2/4 of battlefield (same height as row3 + row4 combined) */}
          <div ref={creatureAreaRef} className="flex flex-[2] min-h-0">
            {/* Creature rows container */}
            <div className="flex-1 flex flex-col">
              {creatureArea.rows.map((row) => (
                <RowTrack
                  key={row.id}
                  rowId={row.id as RowTarget}
                  elements={row.elements.filter(
                    (el) =>
                      el.card.cardType !== 'planeswalker' &&
                      el.card.cardType !== 'battle'
                  )}
                  onTapCard={onTapCard}
                  onEquipmentAction={onEquipmentAction}
                  collapsingIds={collapsingIds}
                />
              ))}
            </div>

            {/* Conditional PW/Battle Column — far-right of creature area */}
            {hasPWOrBattles && (
              <PWBattleColumn cards={pwBattleCards} onTapCard={onTapCard} onEquipmentAction={onEquipmentAction} />
            )}
          </div>

          {/* Row 3 — 1/5 (20%) of battlefield height */}
          <SplitRowTrack
            leftRowId="row3-lands"
            rightRowId="row3-artifacts"
            left={row3.left}
            right={row3.right}
            leftLabel="Lands"
            rightLabel="Artifacts"
            onTapCard={onTapCard}
            onEquipmentAction={onEquipmentAction}
            collapsingIds={collapsingIds}
          />

          {/* Row 4 — 1/5 (20%) of battlefield height */}
          <SplitRowTrack
            leftRowId="row4-lands"
            rightRowId="row4-enchantments"
            left={row4.left}
            right={row4.right}
            leftLabel="Utility Lands"
            rightLabel="Enchantments"
            onTapCard={onTapCard}
            onEquipmentAction={onEquipmentAction}
            collapsingIds={collapsingIds}
          />
        </>
      )}

      {/* Children overlay (toolbar, etc.) */}
      {children}

      {/* Player Info HUD — bottom-left of Zone A, above crop line */}
      <div
        className="absolute bottom-2 left-2 bg-black/70 text-white text-sm font-mono px-2 py-1 rounded select-none z-50 flex flex-col gap-0.5"
        aria-label={`Turn: ${turnCount}, Life: ${lifeTotal}, Hand: ${handCount} cards`}
        aria-live="polite"
        aria-atomic="true"
      >
        <span>Turn: {turnCount}</span>
        <span className="flex items-center gap-1">
          Life: {lifeTotal}
          <button
            className="px-1 text-xs bg-gray-600 hover:bg-gray-500 rounded pointer-events-auto"
            onClick={() => onLifeChange(-1)}
            aria-label="Decrease life"
          >▼</button>
          <button
            className="px-1 text-xs bg-gray-600 hover:bg-gray-500 rounded pointer-events-auto"
            onClick={() => onLifeChange(1)}
            aria-label="Increase life"
          >▲</button>
        </span>
        <span>Hand: {handCount}</span>
      </div>
    </div>
  );
}

// ─── RowTrack Component ──────────────────────────────────────────────────────

interface RowTrackProps {
  rowId: RowTarget;
  elements: RowCard[];
  onTapCard: (cardId: string) => void;
  onEquipmentAction?: (action: EquipmentAction) => void;
  collapsingIds?: Set<string>;
}

/**
 * RowTrack — A single horizontal row track rendering cards with dynamic spacing.
 * Cards compress (overlap) as the row fills up so everything always fits visible.
 * Supports drag-to-reorder within the row via @dnd-kit/sortable.
 */
function RowTrack({ rowId, elements, onTapCard, onEquipmentAction, collapsingIds }: RowTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [negativeMargin, setNegativeMargin] = useState(0);
  const { setNodeRef, isOver } = useDroppable({
    id: `row-${rowId}`,
    data: { rowId },
  });

  // Track container width via ResizeObserver for responsive compression
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate dynamic spacing whenever elements or container width change
  const elementsKey = elements.map(el => `${el.instanceId}:${el.isTapped}:${el.attachments.length}`).join(',');
  useEffect(() => {
    if (elements.length <= 1 || containerWidth === 0) {
      setNegativeMargin(0);
      return;
    }
    const availableWidth = containerWidth - 16; // minus px-2 padding
    const vhToPx = window.innerHeight / 100;
    const margin = computeCompression(elements, availableWidth, vhToPx, 4);
    setNegativeMargin(margin);
  }, [elementsKey, containerWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Combine refs
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [setNodeRef]);

  return (
    <div
      ref={combinedRef}
      className={`
        flex-1 flex flex-row items-center gap-1 px-2 min-h-0 overflow-visible transition-all duration-300 ease-in-out
        ${isOver ? 'bg-green-600/30 ring-1 ring-green-400/50' : ''}
      `}
      data-testid={`row-track-${rowId}`}
      data-row-id={rowId}
      aria-label={`${rowId} row`}
    >
      <SortableContext items={elements.map(el => el.instanceId)} strategy={horizontalListSortingStrategy}>
        {elements.map((el, idx) => {
          const prev = idx > 0 ? elements[idx - 1] : null;
          // Same-name aggressive overlap — stacks identical cards tightly
          // NOTE: May exclude isTokenCopy in future to prevent clone stacking
          const sameAsPrev = prev && prev.card.name === el.card.name;
          const vh = window.innerHeight / 100;
          const aggressiveOverlap = sameAsPrev ? 9 * vh : 0;
          const dynamicOverlap = idx > 0 && negativeMargin > 0 ? negativeMargin : 0;
          const totalOverlap = Math.max(aggressiveOverlap, dynamicOverlap);

          return (
            <SortableCardWrapper
              key={el.instanceId}
              id={el.instanceId}
              cardName={el.card.name}
              cardType={el.card.cardType}
              rowId={rowId}
              isTapped={el.isTapped}
              attachmentCount={el.attachments.length}
              isCollapsing={collapsingIds?.has(el.instanceId)}
              style={idx > 0 && totalOverlap > 0 ? { marginLeft: `-${totalOverlap}px` } : undefined}
            >
              <RotationDiv
                creature={el}
                onTapCard={onTapCard}
                onEquipmentAction={onEquipmentAction}
                isCompressed={negativeMargin > 0}
              />
            </SortableCardWrapper>
          );
        })}
      </SortableContext>
    </div>
  );
}

// ─── SplitRowTrack Component ─────────────────────────────────────────────────

interface SplitRowTrackProps {
  leftRowId: RowTarget;
  rightRowId: RowTarget;
  left: RowCard[];
  right: RowCard[];
  leftLabel: string;
  rightLabel: string;
  onTapCard: (cardId: string) => void;
  onEquipmentAction?: (action: EquipmentAction) => void;
  collapsingIds?: Set<string>;
}

/**
 * SplitRowTrack — A row divided into left and right sections with dynamic spacing.
 * Cards compress to fit available width — no clipping.
 */
function SplitRowTrack({
  leftRowId,
  rightRowId,
  left,
  right,
  leftLabel,
  rightLabel,
  onTapCard,
  onEquipmentAction,
  collapsingIds,
}: SplitRowTrackProps) {
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const [leftMargin, setLeftMargin] = useState(0);
  const [rightMargin, setRightMargin] = useState(0);

  const { setNodeRef: setLeftDropRef, isOver: isOverLeft } = useDroppable({
    id: `row-${leftRowId}`,
    data: { rowId: leftRowId },
  });

  const { setNodeRef: setRightDropRef, isOver: isOverRight } = useDroppable({
    id: `row-${rightRowId}`,
    data: { rowId: rightRowId },
  });

  const setLeftRef = useCallback((node: HTMLDivElement | null) => {
    setLeftDropRef(node);
    (leftContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [setLeftDropRef]);

  const setRightRef = useCallback((node: HTMLDivElement | null) => {
    setRightDropRef(node);
    (rightContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [setRightDropRef]);

  // Sort left side: basics first (grouped by name), then non-basics in play order
  const sortedLeft = [...left].sort((a, b) => {
    const aIsBasic = a.card.typeLine.toLowerCase().includes('basic');
    const bIsBasic = b.card.typeLine.toLowerCase().includes('basic');
    if (aIsBasic && !bIsBasic) return -1;
    if (!aIsBasic && bIsBasic) return 1;
    if (aIsBasic && bIsBasic) return a.card.name.localeCompare(b.card.name);
    return 0; // non-basics preserve play order
  });
  const sortedRight = [...right]; // artifacts/enchantments preserve play order

  // Dynamic spacing for left side — recalculates on card changes and container resize
  const [leftContainerWidth, setLeftContainerWidth] = useState(0);
  const [rightContainerWidth, setRightContainerWidth] = useState(0);

  useEffect(() => {
    if (!leftContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setLeftContainerWidth(w);
    });
    observer.observe(leftContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!rightContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setRightContainerWidth(w);
    });
    observer.observe(rightContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (left.length <= 1 || leftContainerWidth === 0) { setLeftMargin(0); return; }
    const availableWidth = leftContainerWidth - 16;
    const vhToPx = window.innerHeight / 100;
    const margin = computeCompression(left, availableWidth, vhToPx, 4);
    setLeftMargin(margin);
  }, [left, leftContainerWidth]);

  useEffect(() => {
    if (right.length <= 1 || rightContainerWidth === 0) { setRightMargin(0); return; }
    const availableWidth = rightContainerWidth - 16;
    const vhToPx = window.innerHeight / 100;
    const margin = computeCompression(right, availableWidth, vhToPx, 4);
    setRightMargin(margin);
  }, [right, rightContainerWidth]);

  return (
    <div
      className="flex flex-row flex-1 min-h-0"
      data-testid={`split-row-${leftRowId}-${rightRowId}`}
    >
      <div
        ref={setLeftRef}
        className={`
          flex-1 flex flex-row items-center gap-1 px-2 min-h-0 overflow-hidden transition-all duration-300 ease-in-out
          ${isOverLeft ? 'bg-green-600/30 ring-1 ring-green-400/50' : ''}
        `}
        data-testid={`row-track-${leftRowId}`}
        data-row-id={leftRowId}
        aria-label={`${leftLabel} row`}
      >
        {left.length === 0 && (
          <span className="text-[10px] text-green-400/30 font-mono select-none pointer-events-none">
            {leftLabel}
          </span>
        )}
        <SortableContext items={sortedLeft.map(el => el.instanceId)} strategy={horizontalListSortingStrategy}>
          {sortedLeft.map((el, idx) => {
            const prev = idx > 0 ? sortedLeft[idx - 1] : null;
            const sameAsPrev = prev && prev.card.name === el.card.name;
            // Same-name cards get aggressive overlap regardless of dynamic spacing
            const vh = window.innerHeight / 100;
            const aggressiveOverlap = sameAsPrev ? 9 * vh : 0;
            const dynamicOverlap = idx > 0 && leftMargin > 0 ? leftMargin : 0;
            const totalOverlap = Math.max(aggressiveOverlap, dynamicOverlap);
            return (
              <SortableCardWrapper
                key={el.instanceId}
                id={el.instanceId}
                cardName={el.card.name}
                cardType={el.card.cardType}
                rowId={leftRowId}
                isTapped={el.isTapped}
                attachmentCount={el.attachments.length}
                isCollapsing={collapsingIds?.has(el.instanceId)}
                style={totalOverlap > 0 ? { marginLeft: `-${totalOverlap}px` } : undefined}
              >
                <RotationDiv
                  creature={el}
                  onTapCard={onTapCard}
                  onEquipmentAction={onEquipmentAction}
                  isCompressed={leftMargin > 0}
                />
              </SortableCardWrapper>
            );
          })}
        </SortableContext>
      </div>

      <div
        ref={setRightRef}
        className={`
          flex-1 flex flex-row-reverse items-center gap-1 px-2 min-h-0 overflow-visible transition-all duration-300 ease-in-out
          ${isOverRight ? 'bg-green-600/30 ring-1 ring-green-400/50' : ''}
        `}
        data-testid={`row-track-${rightRowId}`}
        data-row-id={rightRowId}
        aria-label={`${rightLabel} row`}
      >
        {right.length === 0 && (
          <span className="text-[10px] text-green-400/30 font-mono select-none pointer-events-none">
            {rightLabel}
          </span>
        )}
        <SortableContext items={sortedRight.map(el => el.instanceId)} strategy={horizontalListSortingStrategy}>
          {sortedRight.map((el, idx) => {
            const prev = idx > 0 ? sortedRight[idx - 1] : null;
            const sameAsPrev = prev && prev.card.name === el.card.name;
            const vh = window.innerHeight / 100;
            const aggressiveOverlap = sameAsPrev ? 9 * vh : 0;
            const dynamicOverlap = idx > 0 && rightMargin > 0 ? rightMargin : 0;
            const totalOverlap = Math.max(aggressiveOverlap, dynamicOverlap);
            return (
              <SortableCardWrapper
                key={el.instanceId}
                id={el.instanceId}
                cardName={el.card.name}
                cardType={el.card.cardType}
                rowId={rightRowId}
                isTapped={el.isTapped}
                attachmentCount={el.attachments.length}
                isCollapsing={collapsingIds?.has(el.instanceId)}
                style={totalOverlap > 0 ? { marginRight: `-${totalOverlap}px` } : undefined}
              >
                <RotationDiv
                  creature={el}
                  onTapCard={onTapCard}
                  onEquipmentAction={onEquipmentAction}
                  isCompressed={rightMargin > 0}
                />
              </SortableCardWrapper>
            );
          })}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── PWBattleColumn Component ────────────────────────────────────────────────

interface PWBattleColumnProps {
  cards: RowCard[];
  onTapCard: (cardId: string) => void;
  onEquipmentAction?: (action: EquipmentAction) => void;
}

/**
 * PWBattleColumn — Vertical column on the far-right of the creature area.
 * Only rendered when at least one planeswalker or battle is on the battlefield.
 * Stacks cards vertically, justified with creature rows.
 */
function PWBattleColumn({ cards, onTapCard, onEquipmentAction }: PWBattleColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'row-pw-battle-column',
    data: { rowId: 'pw-battle-column' as RowTarget },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        w-[100px] flex flex-col items-center gap-1 py-2 overflow-y-auto
        border-l border-green-700/30
        transition-all duration-300 ease-in-out
        ${isOver ? 'bg-green-600/30 ring-1 ring-green-400/50' : ''}
      `}
      data-testid="pw-battle-column"
      data-row-id="pw-battle-column"
      aria-label="Planeswalker and Battle column"
    >
      {cards.map((el) => (
        <RotationDiv
          key={el.instanceId}
          creature={el}
          onTapCard={onTapCard}
          onEquipmentAction={onEquipmentAction}
          isCompressed={false}
        />
      ))}
    </div>
  );
}
