import type { GameState, CardData, ExileCard } from '../types';
import { CARD_BACK_URL } from '../cardBack';
import { calculateDelirium } from '../components/PublicStack';

export interface StreamPublicStackProps {
  state: GameState;
}

/**
 * StreamPublicStack — Read-only mirror of PublicStack (Zone B).
 *
 * Exact same structure: flex-col, bg-gray-900, h-full w-full.
 * 4 sections: Command Zone → Library → Graveyard → Exile.
 * No droppable zones, no drag sources, no buttons (Draw/Shuffle).
 */
export function StreamPublicStack({ state }: StreamPublicStackProps) {
  const deliriumCount = calculateDelirium(state.graveyard);

  return (
    <div
      className="flex flex-col bg-gray-900 h-full w-full overflow-y-hidden"
      aria-label="Public stack"
    >
      {/* Command Zone */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <h3 className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide mb-0.5 shrink-0">
          Command Zone
        </h3>
        <div className="flex-1 flex items-center justify-center min-h-0">
          {state.commandZone.length === 0 ? (
            <span className="text-gray-500 text-[10px] italic">Empty</span>
          ) : (
            <CommandZoneCards cards={state.commandZone} />
          )}
        </div>
      </div>

      {/* Library */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <h3 className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide mb-0.5 shrink-0">
          Library
        </h3>
        <div className="flex items-center justify-center flex-1 min-h-0">
          {state.library.length > 0 ? (
            <div className="relative" style={{ width: '11.43vh', height: '16vh' }}>
              <img
                src={CARD_BACK_URL}
                alt="Library (face-down)"
                className="w-full h-full object-cover rounded-md"
                draggable={false}
              />
              <span className="absolute bottom-1 right-1 bg-black/90 text-white text-xs font-bold px-1.5 py-0.5 rounded z-10">
                {state.library.length}
              </span>
            </div>
          ) : (
            <span className="text-gray-500 text-[10px] italic">Empty</span>
          )}
        </div>
      </div>

      {/* Graveyard */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-0.5 shrink-0">
          <h3 className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">
            Graveyard
          </h3>
          <span className="text-[10px] font-bold text-gray-200">
            {state.graveyard.length} | D:{deliriumCount}
          </span>
        </div>
        <div className="flex items-center justify-center flex-1 min-h-0">
          {state.graveyard.length > 0 ? (
            <div style={{ width: '11.43vh', height: '16vh' }}>
              <img
                src={state.graveyard[state.graveyard.length - 1].imageURI}
                alt={state.graveyard[state.graveyard.length - 1].name}
                className="w-full h-full object-cover rounded-md"
                draggable={false}
              />
            </div>
          ) : (
            <span className="text-gray-500 text-[10px] italic">Empty</span>
          )}
        </div>
      </div>

      {/* Exile */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-0.5 shrink-0">
          <h3 className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">
            Exile
          </h3>
          <span className="text-[10px] font-bold text-gray-200">{state.exile.length}</span>
        </div>
        <div className="flex items-center justify-center flex-1 min-h-0">
          {state.exile.length > 0 ? (
            <ExileTopCard exile={state.exile} />
          ) : (
            <span className="text-gray-500 text-[10px] italic">Empty</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Command zone cards — stacked with cascade (same as player view) */
function CommandZoneCards({ cards }: { cards: CardData[] }) {
  const sorted = [...cards].sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0));

  if (sorted.length === 1) {
    return (
      <div style={{ width: '11.43vh', height: '16vh' }}>
        <img
          src={sorted[0].imageURI}
          alt={sorted[0].name}
          className="w-full h-full object-cover rounded-md"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: `calc(11.43vh + ${(sorted.length - 1) * 2}vh)`, height: '16vh' }}>
      {sorted.map((card, index) => (
        <div
          key={card.id}
          className="absolute top-0"
          style={{
            right: `${index * 2}vh`,
            zIndex: sorted.length - index,
            position: index === 0 ? 'relative' : 'absolute',
          }}
        >
          <div style={{ width: '11.43vh', height: '16vh' }}>
            <img
              src={card.imageURI}
              alt={card.name}
              className="w-full h-full object-cover rounded-md"
              draggable={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Exile top card — face-up or face-down */
function ExileTopCard({ exile }: { exile: ExileCard[] }) {
  const top = exile[exile.length - 1];
  const src = top.isFaceDown ? CARD_BACK_URL : top.card.imageURI;
  const alt = top.isFaceDown ? 'Face-down exiled card' : top.card.name;

  return (
    <div style={{ width: '11.43vh', height: '16vh' }}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover rounded-md"
        draggable={false}
      />
    </div>
  );
}
