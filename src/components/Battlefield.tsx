import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableCardWrapper } from './SortableCardWrapper';
import type {
  CreatureArea,
  SplitRow,
  RowTarget,
  RowCard,
  GamePhase,
  MutateTargetingState,
} from '../types';
import { RotationDiv } from './RotationDiv';
import { computeCompression } from '../creatureLayout';
import type { EquipmentAction } from './EquipmentDock';
import { SelectionOverlay } from './SelectionOverlay';
import { SelectionToolbar } from './SelectionToolbar';
import type { BatchAction } from './SelectionToolbar';
import { LassoOverlay } from './LassoOverlay';

// ─── Lasso Intersection Utility ──────────────────────────────────────────────

function computeLassoIntersection(lassoRect: DOMRect, containerEl: HTMLElement): string[] {
  const cards = containerEl.querySelectorAll('[data-card-id]')
  const result: string[] = []
  cards.forEach(card => {
    const cardRect = card.getBoundingClientRect()
    // Two rects intersect if NOT (one is fully left/right/above/below the other)
    const intersects = !(
      cardRect.right < lassoRect.left ||
      cardRect.left > lassoRect.right ||
      cardRect.bottom < lassoRect.top ||
      cardRect.top > lassoRect.bottom
    )
    if (intersects) {
      result.push((card as HTMLElement).dataset.cardId!)
    }
  })
  return result
}

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
  /** Mutate targeting state — highlights valid targets and dims non-valid cards */
  mutateTargeting?: MutateTargetingState;
  /** Called when a valid mutate target card is clicked during targeting mode */
  onMutateTargetSelect?: (cardId: string) => void;
  /** Set of currently multi-selected card instanceIds */
  selectedCardIds?: Set<string>;
  /** Called when Ctrl+Click toggles selection for a card */
  onSelectionToggle?: (cardId: string) => void;
  /** Called to clear the entire multi-select selection */
  onClearSelection?: () => void;
  /** Called when lasso selection sets the selection to a specific set of ids */
  onSetSelection?: (ids: Set<string>) => void;
  /** Called when a batch action is triggered from the SelectionToolbar */
  onBatchAction?: (action: BatchAction) => void;
  /** Called when a selected card is clicked (no modifier) — taps all selected */
  onTapSelected?: () => void;
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
  mutateTargeting,
  onMutateTargetSelect,
  selectedCardIds,
  onSelectionToggle,
  onClearSelection,
  onSetSelection,
  onBatchAction,
  onTapSelected,
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

  // Collect all battlefield RowCards for selection overlay
  const selectedCardsArray = useMemo(() => {
    if (!selectedCardIds || selectedCardIds.size === 0) return []
    const allCards: RowCard[] = [
      ...creatureArea.rows.flatMap(r => r.elements),
      ...row3.left,
      ...row3.right,
      ...row4.left,
      ...row4.right,
    ]
    return allCards.filter(rc => selectedCardIds.has(rc.instanceId))
  }, [selectedCardIds, creatureArea, row3, row4]);

  // ─── Lasso selection state and handlers ──────────────────────────────────────
  const battlefieldRef = useRef<HTMLDivElement>(null)
  const [isLassoActive, setIsLassoActive] = useState(false)
  const [lassoOrigin, setLassoOrigin] = useState<{ x: number; y: number } | null>(null)
  const [lassoEnd, setLassoEnd] = useState<{ x: number; y: number } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Suppress during mutate targeting
    if (mutateTargeting?.isActive) return

    // Only start lasso on empty space
    if ((e.target as HTMLElement).closest('[data-card-id]')) return

    // Only primary button
    if (e.button !== 0) return

    setIsLassoActive(true)
    setLassoOrigin({ x: e.clientX, y: e.clientY })
    setLassoEnd({ x: e.clientX, y: e.clientY })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [mutateTargeting?.isActive])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isLassoActive) return
    setLassoEnd({ x: e.clientX, y: e.clientY })
  }, [isLassoActive])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isLassoActive || !lassoOrigin) return

    const endPoint = { x: e.clientX, y: e.clientY }

    // Zero-distance check (click on empty = clear selection)
    const dx = Math.abs(endPoint.x - lassoOrigin.x)
    const dy = Math.abs(endPoint.y - lassoOrigin.y)
    if (dx < 3 && dy < 3) {
      onClearSelection?.()
      setIsLassoActive(false)
      setLassoOrigin(null)
      setLassoEnd(null)
      return
    }

    // Compute lasso rectangle
    const lassoRect = new DOMRect(
      Math.min(lassoOrigin.x, endPoint.x),
      Math.min(lassoOrigin.y, endPoint.y),
      Math.abs(endPoint.x - lassoOrigin.x),
      Math.abs(endPoint.y - lassoOrigin.y)
    )

    // Intersect with cards
    if (battlefieldRef.current) {
      const intersectedIds = computeLassoIntersection(lassoRect, battlefieldRef.current)

      if (e.ctrlKey || e.metaKey) {
        // Additive: union with existing selection
        onSetSelection?.(new Set<string>([...Array.from(selectedCardIds ?? new Set<string>()), ...intersectedIds]))
      } else {
        // Replace
        onSetSelection?.(new Set(intersectedIds))
      }
    }

    setIsLassoActive(false)
    setLassoOrigin(null)
    setLassoEnd(null)
  }, [isLassoActive, lassoOrigin, selectedCardIds, onClearSelection, onSetSelection])

  return (
    <div
      ref={battlefieldRef}
      className="relative w-full bg-gray-900 overflow-hidden flex flex-col min-h-0"
      style={{ height: '80vh' }}
      data-obs-zone="above"
      role="region"
      aria-label="Battlefield"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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
                  mutateTargeting={mutateTargeting}
                  onMutateTargetSelect={onMutateTargetSelect}
                  selectedCardIds={selectedCardIds}
                  onSelectionToggle={onSelectionToggle}
                  onClearSelection={onClearSelection}
                  onTapSelected={onTapSelected}
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
            mutateTargeting={mutateTargeting}
            onMutateTargetSelect={onMutateTargetSelect}
            selectedCardIds={selectedCardIds}
            onSelectionToggle={onSelectionToggle}
            onClearSelection={onClearSelection}
            onTapSelected={onTapSelected}
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
            mutateTargeting={mutateTargeting}
            onMutateTargetSelect={onMutateTargetSelect}
            selectedCardIds={selectedCardIds}
            onSelectionToggle={onSelectionToggle}
            onClearSelection={onClearSelection}
            onTapSelected={onTapSelected}
          />
        </>
      )}

      {/* Selection Overlay badge — top-right, z-index 91 */}
      {selectedCardsArray.length > 0 && (
        <SelectionOverlay selectedCards={selectedCardsArray} />
      )}

      {/* Selection Toolbar — top-right below overlay, z-index 90 */}
      {onBatchAction && (
        <SelectionToolbar
          isVisible={selectedCardsArray.length > 0}
          onBatchAction={onBatchAction}
        />
      )}

      {/* Children overlay (toolbar, etc.) */}
      {children}

      {/* Lasso selection overlay */}
      {isLassoActive && lassoOrigin && lassoEnd && (
        <LassoOverlay origin={lassoOrigin} end={lassoEnd} />
      )}

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
  mutateTargeting?: MutateTargetingState;
  onMutateTargetSelect?: (cardId: string) => void;
  selectedCardIds?: Set<string>;
  onSelectionToggle?: (cardId: string) => void;
  onClearSelection?: () => void;
  onTapSelected?: () => void;
}

/**
 * RowTrack — A single horizontal row track rendering cards with dynamic spacing.
 * Cards compress (overlap) as the row fills up so everything always fits visible.
 * Supports drag-to-reorder within the row via @dnd-kit/sortable.
 */
function RowTrack({ rowId, elements, onTapCard, onEquipmentAction, collapsingIds, mutateTargeting, onMutateTargetSelect, selectedCardIds, onSelectionToggle, onClearSelection, onTapSelected }: RowTrackProps) {
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
        ${isOver ? 'bg-blue-900/20 ring-1 ring-blue-400/40' : ''}
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

          // Z-index: each card gets idx+1 so later cards in a fanned group
          // (token copies) always render above earlier ones (equipped creature).
          // The equipped creature's internal stacking context (zIndex: N for
          // equipment layers) would otherwise elevate it above plain tokens.
          const cardZIndex = idx + 1;

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
              isSelected={selectedCardIds?.has(el.instanceId) ?? false}
              style={{
                ...(idx > 0 && totalOverlap > 0 ? { marginLeft: `-${totalOverlap}px` } : {}),
                zIndex: cardZIndex,
              }}
              mutateTargeting={mutateTargeting}
              onMutateTargetSelect={onMutateTargetSelect}
              onSelectionToggle={onSelectionToggle}
              hasSelection={selectedCardIds ? selectedCardIds.size > 0 : false}
              onClearSelection={onClearSelection}
              onTapSelected={onTapSelected}
            >
              <RotationDiv
                creature={el}
                onTapCard={onTapCard}
                onEquipmentAction={onEquipmentAction}
                isCompressed={negativeMargin > 0}
                isSelected={selectedCardIds?.has(el.instanceId) ?? false}
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
  mutateTargeting?: MutateTargetingState;
  onMutateTargetSelect?: (cardId: string) => void;
  selectedCardIds?: Set<string>;
  onSelectionToggle?: (cardId: string) => void;
  onClearSelection?: () => void;
  onTapSelected?: () => void;
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
  mutateTargeting,
  onMutateTargetSelect,
  selectedCardIds,
  onSelectionToggle,
  onClearSelection,
  onTapSelected,
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
          ${isOverLeft ? 'bg-blue-900/20 ring-1 ring-blue-400/40' : ''}
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
            const cardZIndex = idx + 1;
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
                isSelected={selectedCardIds?.has(el.instanceId) ?? false}
                style={{
                  ...(totalOverlap > 0 ? { marginLeft: `-${totalOverlap}px` } : {}),
                  zIndex: cardZIndex,
                }}
                mutateTargeting={mutateTargeting}
                onMutateTargetSelect={onMutateTargetSelect}
                onSelectionToggle={onSelectionToggle}
                hasSelection={selectedCardIds ? selectedCardIds.size > 0 : false}
                onClearSelection={onClearSelection}
                onTapSelected={onTapSelected}
              >
                <RotationDiv
                  creature={el}
                  onTapCard={onTapCard}
                  onEquipmentAction={onEquipmentAction}
                  isCompressed={leftMargin > 0}
                  isSelected={selectedCardIds?.has(el.instanceId) ?? false}
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
          ${isOverRight ? 'bg-blue-900/20 ring-1 ring-blue-400/40' : ''}
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
            const cardZIndex = idx + 1;
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
                isSelected={selectedCardIds?.has(el.instanceId) ?? false}
                style={{
                  ...(totalOverlap > 0 ? { marginRight: `-${totalOverlap}px` } : {}),
                  zIndex: cardZIndex,
                }}
                mutateTargeting={mutateTargeting}
                onMutateTargetSelect={onMutateTargetSelect}
                onSelectionToggle={onSelectionToggle}
                hasSelection={selectedCardIds ? selectedCardIds.size > 0 : false}
                onClearSelection={onClearSelection}
                onTapSelected={onTapSelected}
              >
                <RotationDiv
                  creature={el}
                  onTapCard={onTapCard}
                  onEquipmentAction={onEquipmentAction}
                  isCompressed={rightMargin > 0}
                  isSelected={selectedCardIds?.has(el.instanceId) ?? false}
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
        ${isOver ? 'bg-blue-900/20 ring-1 ring-blue-400/40' : ''}
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
