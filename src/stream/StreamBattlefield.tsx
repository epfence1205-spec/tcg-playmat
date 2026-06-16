import type { GameState, RowCard } from '../types';
import { StreamCard } from './StreamCard';
import { StreamSplitRow } from './StreamSplitRow';
import { computeCompression } from '../creatureLayout';

export interface StreamBattlefieldProps {
  state: GameState;
}

/**
 * StreamBattlefield — Read-only mirror of Battlefield (Zone A).
 *
 * Exact same structure as components/Battlefield.tsx:
 * - bg-green-900/80, height 80vh (from parent grid)
 * - Creature Area (flex-[2]): 1-3 dynamic rows
 * - Row 3 (flex-[1]): SplitRow — lands left, artifacts right
 * - Row 4 (flex-[1]): SplitRow — utility lands left, enchantments right
 * - PW/Battle column on far-right of creature area (conditional)
 *
 * No DndContext, no droppable zones, no sortable contexts.
 * Excludes phased-out cards. Blank during MULLIGAN.
 */
export function StreamBattlefield({ state }: StreamBattlefieldProps) {
  // During MULLIGAN phase, render blank (same as player view)
  if (state.gamePhase === 'MULLIGAN') {
    return (
      <div
        className="relative w-full bg-green-900/80 overflow-hidden flex flex-col min-h-0"
        data-testid="stream-battlefield"
        aria-label="Battlefield blank during mulligan"
      />
    );
  }

  // Check if any PW/battles exist
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
      data-testid="stream-battlefield"
      aria-label="Battlefield"
    >
      {/* Creature Area — flex-[2] (same as player view) */}
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

        {/* PW/Battle Column — same as player view */}
        {hasPWOrBattles && (
          <div className="w-[100px] flex flex-col items-center gap-1 py-2 overflow-y-auto border-l border-green-700/30">
            {pwBattleCards.filter(el => !el.isPhased).map((el) => (
              <StreamCard key={el.instanceId} rowCard={el} />
            ))}
          </div>
        )}
      </div>

      {/* Row 3 — flex-[1] (same as player view SplitRowTrack) */}
      <div className="flex flex-row flex-1 min-h-0">
        <StreamSplitRow row={state.row3} />
      </div>

      {/* Row 4 — flex-[1] (same as player view SplitRowTrack) */}
      <div className="flex flex-row flex-1 min-h-0">
        <StreamSplitRow row={state.row4} />
      </div>
    </div>
  );
}

/**
 * StreamRowTrack — mirrors RowTrack from Battlefield.tsx.
 * Same flex-1 row, same gap-1 px-2, same dynamic compression logic.
 * No droppable, no sortable context.
 */
function StreamRowTrack({ elements }: { elements: RowCard[] }) {
  const visible = elements.filter((rc) => !rc.isPhased);

  // Same-name aggressive overlap + dynamic compression (copied from Battlefield RowTrack)
  const getOverlap = (idx: number): number => {
    if (idx === 0) return 0;
    const prev = visible[idx - 1];
    const curr = visible[idx];
    const vh = window.innerHeight / 100;

    // Same-name aggressive overlap
    if (prev.card.name === curr.card.name) {
      return 9 * vh;
    }

    // Dynamic compression if row is crowded
    if (visible.length > 1) {
      // Approximate container width as ~90% of viewport (minus sidebar)
      const approxWidth = window.innerWidth * 0.9;
      const margin = computeCompression(visible, approxWidth - 16, vh, 4);
      return margin > 0 ? margin : 0;
    }

    return 0;
  };

  return (
    <div className="flex-1 flex flex-row items-center gap-1 px-2 min-h-0 overflow-visible">
      {visible.map((rc, idx) => {
        const overlap = getOverlap(idx);
        return (
          <div
            key={rc.instanceId}
            style={overlap > 0 ? { marginLeft: `-${overlap}px` } : undefined}
          >
            <StreamCard rowCard={rc} />
          </div>
        );
      })}
    </div>
  );
}
