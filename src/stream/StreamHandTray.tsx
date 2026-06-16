import type { CardData } from '../types';

export interface StreamHandTrayProps {
  hand: CardData[];
  revealedIds: string[];
}

/**
 * StreamHandTray — Read-only mirror of HandTray (Zone C).
 *
 * Exact same structure as components/HandTray.tsx (PLAYING phase):
 * - bg-gray-900/80, border-t border-gray-700, full width/height from parent
 * - Hand cards fanned with same transform logic
 * - Cards rendered as card-backs unless in revealedIds
 * - No toolbar (Switch/New Game/Draw/Tokens buttons removed)
 * - No HD Zoom Portal area
 * - No sortable context, no drag handlers, no hover states
 */
export function StreamHandTray({ hand, revealedIds }: StreamHandTrayProps) {
  return (
    <div
      className="relative flex w-full h-full bg-gray-900/80 border-t border-gray-700 min-h-0 overflow-hidden"
      data-testid="stream-hand-tray"
      aria-label={`Hand tray with ${hand.length} cards (hidden)`}
    >
      {/* Count badge — top-left (replaces the toolbar area) */}
      <div className="absolute top-2 left-4 bg-black/70 text-white text-sm font-medium px-2 py-0.5 rounded z-10">
        Cards in hand: {hand.length}
      </div>

      {/* Hand cards area — centered, same as HandTray's card container */}
      <div
        className="relative flex-1 flex items-center justify-center select-none overflow-x-auto overflow-y-hidden min-h-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {hand.length > 0 && (
          <div
            className="flex items-end justify-center pt-2 pb-1"
            style={{ height: '100%' }}
          >
            {hand.map((card, index) => {
              const { rotation, translateY } = getStaticFanTransform(index, hand.length);
              const isRevealed = revealedIds.includes(card.id);
              const imageSrc = isRevealed ? card.imageURI : '/card-back.webp';

              return (
                <div
                  key={card.id}
                  className="select-none"
                  style={{
                    width: '11.43vh',
                    height: '16vh',
                    transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
                    transformOrigin: 'bottom center',
                    flexShrink: 0,
                    marginLeft: index === 0 ? 0 : '-2.5vh', // Same overlap as player view
                  }}
                >
                  <img
                    src={imageSrc}
                    alt={isRevealed ? card.name : 'Card back'}
                    className="w-full h-full object-cover rounded-md"
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Static fan transform — same math as HandTray's getFanTransform but
 * without hover behavior (no hoveredIndex, no lift/spread).
 */
function getStaticFanTransform(index: number, total: number) {
  if (total <= 1) return { rotation: 0, translateY: 0 };

  const normalized = (2 * index) / (total - 1) - 1;
  const maxRotation = Math.min(2 + total * 0.7, 14);
  const rotation = normalized * maxRotation;
  const maxDrop = Math.min(3 + total * 0.4, 14);
  const translateY = normalized * normalized * maxDrop;

  return { rotation, translateY };
}
