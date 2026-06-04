import { useDroppable } from '@dnd-kit/core';
import type { CardData, ExileCard, StackZone } from '../types';
import { DraggableCard } from './DraggableCard';

/** URL for the generic card back image (local asset) */
const CARD_BACK_URL = '/card-back.webp';

// ─── Delirium Calculation ────────────────────────────────────────────────────

type DeliriumType =
  | 'creature'
  | 'instant'
  | 'sorcery'
  | 'artifact'
  | 'enchantment'
  | 'planeswalker'
  | 'land'
  | 'tribal'
  | 'battle';

const DELIRIUM_TYPES: DeliriumType[] = [
  'creature',
  'instant',
  'sorcery',
  'artifact',
  'enchantment',
  'planeswalker',
  'land',
  'tribal',
  'battle',
];

/**
 * Calculates the delirium count for a graveyard — the number of unique
 * MTG card types present among the cards (0-9).
 */
export function calculateDelirium(graveyard: CardData[]): number {
  const typesPresent = new Set<DeliriumType>();
  for (const card of graveyard) {
    const typeLine = card.typeLine.toLowerCase();
    for (const type of DELIRIUM_TYPES) {
      if (typeLine.includes(type)) {
        typesPresent.add(type);
      }
    }
  }
  return typesPresent.size;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface PublicStackProps {
  libraryCount: number;
  commandZone: CardData[];
  graveyard: CardData[];
  exile: ExileCard[];
  library: CardData[];
  deliriumCount: number;
  onDropToZone: (cardId: string, zone: StackZone) => void;
  onDrawCard: () => void;
  onShuffle: () => void;
  onBrowseLibrary: () => void;
  onBrowseGraveyard: () => void;
}

// ─── Droppable Section Wrapper ───────────────────────────────────────────────

/** Droppable section wrapper for each zone in the public stack */
function DroppableSection({
  id,
  children,
  className = '',
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col flex-1 min-h-0 overflow-hidden
        ${isOver ? 'bg-yellow-400/10' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ─── Command Zone Section ────────────────────────────────────────────────────

/** Command Zone section — displays commander cards face-up */
function CommandZoneSection({ cards }: { cards: CardData[] }) {
  return (
    <DroppableSection id="commandZone" className="flex-1">
      <h3 className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide mb-0.5 shrink-0">
        Command Zone
      </h3>
      <div className="flex flex-wrap gap-0.5 flex-1 items-center justify-center min-h-0">
        {cards.length === 0 ? (
          <span className="text-gray-500 text-[10px] italic">Empty</span>
        ) : (
          cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              sourceZone="commandZone"
            />
          ))
        )}
      </div>
    </DroppableSection>
  );
}

// ─── Library Section ─────────────────────────────────────────────────────────

/** Library section — face-down stack with count, Draw and Shuffle buttons */
function LibrarySection({
  libraryCount,
  topCardId,
  onDrawCard,
  onShuffle,
}: {
  libraryCount: number;
  topCardId: string | null;
  onDrawCard: () => void;
  onShuffle: () => void;
}) {

  return (
    <DroppableSection id="library" className="flex-1">
      <h3 className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide mb-0.5 shrink-0 relative z-10">
        Library
      </h3>
      <div className="flex items-center justify-center flex-1 min-h-0">
        {libraryCount > 0 ? (
          <div
            className="relative"
            style={{ width: '11.43vh', height: '16vh' }}
            data-card-id={topCardId}
            data-card-zone="library"
          >
            <img
              src={CARD_BACK_URL}
              alt="Library (face-down)"
              className="w-full h-full object-cover rounded-md"
              draggable={false}
            />
            <span className="absolute bottom-1 right-1 bg-black/90 text-white text-xs font-bold px-1.5 py-0.5 rounded z-10">
              {libraryCount}
            </span>
          </div>
        ) : (
          <span className="text-gray-500 text-[10px] italic">Empty</span>
        )}
      </div>
      <div className="flex gap-0.5 mt-1 shrink-0 relative z-10">
        <button
          onClick={onDrawCard}
          disabled={libraryCount === 0}
          className="flex-1 text-[10px] font-medium py-0.5 px-1 rounded bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
          aria-label="Draw card from library"
        >
          Draw
        </button>
        <button
          onClick={onShuffle}
          disabled={libraryCount === 0}
          className="flex-1 text-[10px] font-medium py-0.5 px-1 rounded bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
          aria-label="Shuffle library"
        >
          Shuffle
        </button>
      </div>
    </DroppableSection>
  );
}

// ─── Graveyard Section ───────────────────────────────────────────────────────

/** Graveyard section — shows top card face-up with count + delirium display */
function GraveyardSection({
  cards,
  deliriumCount,
}: {
  cards: CardData[];
  deliriumCount: number;
}) {
  const topCard = cards.length > 0 ? cards[cards.length - 1] : null;

  return (
    <DroppableSection id="graveyard" className="flex-1">
      <div className="flex items-center justify-between mb-0.5 shrink-0">
        <h3 className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">
          Graveyard
        </h3>
        <span className="text-[10px] font-bold text-gray-200">
          {cards.length} | D:{deliriumCount}
        </span>
      </div>
      <div className="flex items-center justify-center flex-1 min-h-0">
        {topCard ? (
          <DraggableCard
            card={topCard}
            sourceZone="graveyard"
          />
        ) : (
          <span className="text-gray-500 text-[10px] italic">Empty</span>
        )}
      </div>
    </DroppableSection>
  );
}

// ─── Exile Section ───────────────────────────────────────────────────────────

/** Exile section — top card face-up or face-down with count badge */
function ExileSection({ cards }: { cards: ExileCard[] }) {
  const topExile = cards.length > 0 ? cards[cards.length - 1] : null;

  return (
    <DroppableSection id="exile" className="flex-1">
      <div className="flex items-center justify-between mb-0.5 shrink-0">
        <h3 className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">
          Exile
        </h3>
        <span className="text-[10px] font-bold text-gray-200">{cards.length}</span>
      </div>
      <div className="flex items-center justify-center flex-1 min-h-0">
        {topExile ? (
          <DraggableCard
            card={topExile.card}
            sourceZone="exile"
            isFaceDown={topExile.isFaceDown}
          />
        ) : (
          <span className="text-gray-500 text-[10px] italic">Empty</span>
        )}
      </div>
    </DroppableSection>
  );
}

// ─── PublicStack Component ───────────────────────────────────────────────────

/**
 * PublicStack (Zone B) — Responsive-width sidebar displaying 4 card-sized stacks vertically.
 *
 * Width: responsive (set by parent grid column, approximately min(10vw, 150px)).
 * Height: fills the full upper region (83.33vh), divided equally among 4 stacks.
 * Order: Command Zone → Library → Graveyard → Exile (top to bottom).
 * Each stack is a valid drop target for drag-and-drop.
 */
export function PublicStack({
  libraryCount,
  commandZone,
  graveyard,
  exile,
  library,
  deliriumCount,
  onDropToZone: _onDropToZone,
  onDrawCard,
  onShuffle,
  onBrowseLibrary: _onBrowseLibrary,
  onBrowseGraveyard: _onBrowseGraveyard,
}: PublicStackProps) {
  return (
    <div
      className="flex flex-col bg-gray-900 h-full w-full overflow-y-hidden"
      data-obs-zone="above"
      role="region"
      aria-label="Public stack"
    >
      <CommandZoneSection cards={commandZone} />
      <LibrarySection
        libraryCount={libraryCount}
        topCardId={library.length > 0 ? library[0].id : null}
        onDrawCard={onDrawCard}
        onShuffle={onShuffle}
      />
      <GraveyardSection cards={graveyard} deliriumCount={deliriumCount} />
      <ExileSection cards={exile} />
    </div>
  );
}
