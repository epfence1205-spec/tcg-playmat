import type { SplitRow, RowCard } from '../types';
import { StreamCard } from './StreamCard';
import { computeCompression } from '../creatureLayout';

interface StreamSplitRowProps {
  row: SplitRow;
}

/**
 * StreamSplitRow — Read-only mirror of SplitRowTrack from Battlefield.tsx.
 *
 * Exact same structure:
 * - Left side: flex-1 flex-row, items-center, gap-1, px-2 (lands L→R)
 * - Right side: flex-1 flex-row-reverse, items-center, gap-1, px-2 (artifacts/enchantments R→L)
 * - Same-name aggressive overlap (9vh) + dynamic compression
 * - Filters out phased cards
 * - No droppable, no sortable
 */
export function StreamSplitRow({ row }: StreamSplitRowProps) {
  // Sort left: basics first grouped by name, then non-basics in play order
  const sortedLeft = [...row.left].sort((a, b) => {
    const aIsBasic = a.card.typeLine.toLowerCase().includes('basic');
    const bIsBasic = b.card.typeLine.toLowerCase().includes('basic');
    if (aIsBasic && !bIsBasic) return -1;
    if (!aIsBasic && bIsBasic) return 1;
    if (aIsBasic && bIsBasic) return a.card.name.localeCompare(b.card.name);
    return 0;
  });
  const sortedRight = [...row.right];

  return (
    <div className="flex flex-row flex-1 min-h-0 w-full">
      {/* Left side — same as player view */}
      <div className="flex-1 flex flex-row items-center gap-1 px-2 min-h-0 overflow-hidden">
        <StreamRowCards cards={sortedLeft} direction="left" />
      </div>

      {/* Right side — flex-row-reverse (same as player view) */}
      <div className="flex-1 flex flex-row-reverse items-center gap-1 px-2 min-h-0 overflow-visible">
        <StreamRowCards cards={sortedRight} direction="right" />
      </div>
    </div>
  );
}

function StreamRowCards({ cards, direction }: { cards: RowCard[]; direction: 'left' | 'right' }) {
  const visible = cards.filter((rc) => !rc.isPhased);

  const getOverlap = (idx: number): number => {
    if (idx === 0) return 0;
    const prev = visible[idx - 1];
    const vh = window.innerHeight / 100;

    // Same-name aggressive overlap
    if (prev.card.name === visible[idx].card.name) {
      return 9 * vh;
    }

    // Dynamic compression
    if (visible.length > 1) {
      const approxWidth = (window.innerWidth * 0.45); // half of viewport (split row)
      const margin = computeCompression(visible, approxWidth - 16, vh, 4);
      return margin > 0 ? margin : 0;
    }

    return 0;
  };

  const marginProp = direction === 'left' ? 'marginLeft' : 'marginRight';

  return (
    <>
      {visible.map((rc, idx) => {
        const overlap = getOverlap(idx);
        return (
          <div
            key={rc.instanceId}
            style={overlap > 0 ? { [marginProp]: `-${overlap}px` } : undefined}
          >
            <StreamCard rowCard={rc} />
          </div>
        );
      })}
    </>
  );
}
