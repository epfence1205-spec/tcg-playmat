import { useRef, useState, useEffect } from 'react';
import type { GameState, RowCard } from '../types';
import { StreamCard } from './StreamCard';
import { computeCompression, computeSortableWrapperWidthVh } from '../creatureLayout';

export interface StreamBattlefieldProps {
  state: GameState;
}

/**
 * StreamBattlefield — Mechanical copy of Battlefield (Zone A).
 * Stripped: DndContext, useDroppable, SortableContext, SortableCardWrapper,
 * RotationDiv (→ StreamCard), click handlers, hover highlights, collapsingIds.
 * Kept: ResizeObserver, computeCompression, same classNames, same overlap math.
 */
export function StreamBattlefield({ state }: StreamBattlefieldProps) {
  if (state.gamePhase === 'MULLIGAN') {
    return (
      <div
        className="relative w-full bg-green-900/80 overflow-hidden flex flex-col min-h-0"
        data-testid="stream-battlefield"
        aria-label="Battlefield blank during mulligan"
      />
    );
  }

  const hasPWOrBattles = state.creatureArea.rows.some((row) =>
    row.elements.some(
      (el) => el.card.cardType === 'planeswalker' || el.card.cardType === 'battle'
    )
  );

  const pwBattleCards = state.creatureArea.rows.flatMap((row) =>
    row.elements.filter(
      (el) => el.card.cardType === 'planeswalker' || el.card.cardType === 'battle'
    )
  );

  return (
    <div
      className="relative w-full bg-green-900/80 overflow-hidden flex flex-col min-h-0"
      style={{ height: '80vh' }}
      data-testid="stream-battlefield"
      aria-label="Battlefield"
    >
      {/* Creature Area — flex-[2] */}
      <div className="flex flex-[2] min-h-0">
        <div className="flex-1 flex flex-col">
          {state.creatureArea.rows.map((row) => (
            <StreamRowTrack
              key={row.id}
              elements={row.elements.filter(
                (el) => el.card.cardType !== 'planeswalker' && el.card.cardType !== 'battle'
              )}
            />
          ))}
        </div>

        {hasPWOrBattles && (
          <div className="w-[100px] flex flex-col items-center gap-1 py-2 overflow-y-auto border-l border-green-700/30">
            {pwBattleCards.map((el) => (
              <StreamCard key={el.instanceId} rowCard={el} />
            ))}
          </div>
        )}
      </div>

      {/* Row 3 — flex-[1] */}
      <StreamSplitRowTrack left={state.row3.left} right={state.row3.right} />

      {/* Row 4 — flex-[1] */}
      <StreamSplitRowTrack left={state.row4.left} right={state.row4.right} />
    </div>
  );
}

/**
 * StreamRowTrack — Mechanical copy of RowTrack.
 * Kept: ResizeObserver, containerWidth state, computeCompression, same overlap math.
 * Stripped: useDroppable, SortableContext, SortableCardWrapper, combinedRef, isOver highlight.
 */
function StreamRowTrack({ elements }: { elements: RowCard[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [negativeMargin, setNegativeMargin] = useState(0);

  // Track container width via ResizeObserver — SAME as player view RowTrack
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

  // Calculate dynamic spacing — SAME as player view RowTrack (no phased filtering)
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

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-row items-center gap-1 px-2 min-h-0 overflow-visible transition-all duration-300 ease-in-out"
    >
      {elements.map((el, idx) => {
        const prev = idx > 0 ? elements[idx - 1] : null;
        const sameAsPrev = prev && prev.card.name === el.card.name;
        const vh = window.innerHeight / 100;
        const aggressiveOverlap = sameAsPrev ? 9 * vh : 0;
        const dynamicOverlap = idx > 0 && negativeMargin > 0 ? negativeMargin : 0;
        const totalOverlap = Math.max(aggressiveOverlap, dynamicOverlap);
        const cardZIndex = idx + 1;

        return (
          <div
            key={el.instanceId}
            style={{
              width: `${computeSortableWrapperWidthVh(el.isTapped, el.attachments.length)}vh`,
              height: '16vh',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: el.isTapped ? cardZIndex + 50 : cardZIndex,
              ...(idx > 0 && totalOverlap > 0 ? { marginLeft: `-${totalOverlap}px` } : {}),
            }}
          >
            <StreamCard rowCard={el} isCompressed={negativeMargin > 0} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * StreamSplitRowTrack — Mechanical copy of SplitRowTrack.
 * Kept: ResizeObserver on both sides, computeCompression, sort logic, same overlap math.
 * Stripped: useDroppable, SortableContext, SortableCardWrapper, isOver highlight, labels.
 */
function StreamSplitRowTrack({ left, right }: { left: RowCard[]; right: RowCard[] }) {
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const [leftMargin, setLeftMargin] = useState(0);
  const [rightMargin, setRightMargin] = useState(0);

  // Sort left: basics first grouped by name, then non-basics in play order — SAME as player view
  const sortedLeft = [...left].sort((a, b) => {
    const aIsBasic = a.card.typeLine.toLowerCase().includes('basic');
    const bIsBasic = b.card.typeLine.toLowerCase().includes('basic');
    if (aIsBasic && !bIsBasic) return -1;
    if (!aIsBasic && bIsBasic) return 1;
    if (aIsBasic && bIsBasic) return a.card.name.localeCompare(b.card.name);
    return 0;
  });
  const sortedRight = [...right];

  // ResizeObserver — SAME as player view SplitRowTrack
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
    if (sortedLeft.length <= 1 || leftContainerWidth === 0) { setLeftMargin(0); return; }
    const availableWidth = leftContainerWidth - 16;
    const vhToPx = window.innerHeight / 100;
    const margin = computeCompression(sortedLeft, availableWidth, vhToPx, 4);
    setLeftMargin(margin);
  }, [sortedLeft, leftContainerWidth]);

  useEffect(() => {
    if (sortedRight.length <= 1 || rightContainerWidth === 0) { setRightMargin(0); return; }
    const availableWidth = rightContainerWidth - 16;
    const vhToPx = window.innerHeight / 100;
    const margin = computeCompression(sortedRight, availableWidth, vhToPx, 4);
    setRightMargin(margin);
  }, [sortedRight, rightContainerWidth]);

  return (
    <div className="flex flex-row flex-1 min-h-0">
      {/* Left side — same className as player view */}
      <div
        ref={leftContainerRef}
        className="flex-1 flex flex-row items-center gap-1 px-2 min-h-0 overflow-hidden transition-all duration-300 ease-in-out"
      >
        {sortedLeft.map((el, idx) => {
          const prev = idx > 0 ? sortedLeft[idx - 1] : null;
          const sameAsPrev = prev && prev.card.name === el.card.name;
          const vh = window.innerHeight / 100;
          const aggressiveOverlap = sameAsPrev ? 9 * vh : 0;
          const dynamicOverlap = idx > 0 && leftMargin > 0 ? leftMargin : 0;
          const totalOverlap = Math.max(aggressiveOverlap, dynamicOverlap);
          const cardZIndex = idx + 1;
          return (
            <div
              key={el.instanceId}
              style={{
                width: `${computeSortableWrapperWidthVh(el.isTapped, el.attachments.length)}vh`,
                height: '16vh',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: el.isTapped ? cardZIndex + 50 : cardZIndex,
                ...(totalOverlap > 0 ? { marginLeft: `-${totalOverlap}px` } : {}),
              }}
            >
              <StreamCard rowCard={el} isCompressed={leftMargin > 0} />
            </div>
          );
        })}
      </div>

      {/* Right side — flex-row-reverse, same as player view */}
      <div
        ref={rightContainerRef}
        className="flex-1 flex flex-row-reverse items-center gap-1 px-2 min-h-0 overflow-visible transition-all duration-300 ease-in-out"
      >
        {sortedRight.map((el, idx) => {
          const prev = idx > 0 ? sortedRight[idx - 1] : null;
          const sameAsPrev = prev && prev.card.name === el.card.name;
          const vh = window.innerHeight / 100;
          const aggressiveOverlap = sameAsPrev ? 9 * vh : 0;
          const dynamicOverlap = idx > 0 && rightMargin > 0 ? rightMargin : 0;
          const totalOverlap = Math.max(aggressiveOverlap, dynamicOverlap);
          const cardZIndex = idx + 1;
          return (
            <div
              key={el.instanceId}
              style={{
                width: `${computeSortableWrapperWidthVh(el.isTapped, el.attachments.length)}vh`,
                height: '16vh',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: el.isTapped ? cardZIndex + 50 : cardZIndex,
                ...(totalOverlap > 0 ? { marginRight: `-${totalOverlap}px` } : {}),
              }}
            >
              <StreamCard rowCard={el} isCompressed={rightMargin > 0} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
