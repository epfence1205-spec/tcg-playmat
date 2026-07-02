import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { arrayMove } from '@dnd-kit/sortable';
import type { CardData, RowCard, RowTarget, GameState, Attachment } from '../types';
import { getRowCards, setRowCards } from '../sortableHelpers';

/**
 * Property 1: Card Count Invariant (Reorder)
 *
 * For any valid GameState and for any reorder operation (arrayMove) within a row,
 * the total number of card instances across all zones SHALL remain constant,
 * no duplicate instanceId values SHALL exist, and the row involved SHALL have
 * the same number of elements as before the operation.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCardData(id: string, cardType: 'creature' | 'artifact' | 'enchantment' | 'land' = 'creature'): CardData {
  return {
    id,
    name: `Card ${id}`,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: `${cardType.charAt(0).toUpperCase() + cardType.slice(1)} — Test`,
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: cardType === 'creature' ? '2' : null,
    baseToughness: cardType === 'creature' ? '2' : null,
    cardType,
    isToken: false,
    isTokenCopy: false,
  };
}

function makeRowCard(id: string, rowAssignment: RowTarget, attachments: Attachment[] = []): RowCard {
  const card = makeCardData(id);
  return {
    card,
    instanceId: id,
    rowAssignment,
    positionIndex: 0,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments,
    counters: [],
    isRevealed: false,
  };
}

function makeAttachment(id: string): Attachment {
  return {
    card: makeCardData(id, 'artifact'),
    instanceId: id,
    isTapped: false,
  };
}

function makeEmptyGameState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: {
      rows: [
        { id: 'creature-1', elements: [] },
        { id: 'creature-2', elements: [] },
        { id: 'creature-3', elements: [] },
      ],
      totalElementCount: 0,
    },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: false,
    lifeTotal: 40,
    turnCount: 0,
    gameLog: [],
  };
}

/** Counts all card instances across the entire game state (including attachments) */
function totalCardCount(state: GameState): number {
  let count = 0;

  const allBattlefieldCards = [
    ...state.creatureArea.rows.flatMap(r => r.elements),
    ...state.row3.left,
    ...state.row3.right,
    ...state.row4.left,
    ...state.row4.right,
  ];
  for (const rc of allBattlefieldCards) {
    count += 1;
    count += rc.attachments.length;
  }

  count += state.hand.length;
  count += state.commandZone.length;
  count += state.graveyard.length;
  count += state.library.length;
  count += state.exile.length;

  return count;
}

/** Collects all instanceIds across the entire game state */
function allInstanceIds(state: GameState): string[] {
  const ids: string[] = [];

  const allBattlefieldCards = [
    ...state.creatureArea.rows.flatMap(r => r.elements),
    ...state.row3.left,
    ...state.row3.right,
    ...state.row4.left,
    ...state.row4.right,
  ];
  for (const rc of allBattlefieldCards) {
    ids.push(rc.instanceId);
    for (const a of rc.attachments) {
      ids.push(a.instanceId);
    }
  }

  for (const c of state.hand) ids.push(c.id);
  for (const c of state.commandZone) ids.push(c.id);
  for (const c of state.graveyard) ids.push(c.id);
  for (const c of state.library) ids.push(c.id);
  for (const e of state.exile) ids.push(e.card.id);

  return ids;
}

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const ROW_TARGETS: RowTarget[] = [
  'creature-1', 'creature-2', 'creature-3',
  'row3-lands', 'row3-artifacts',
  'row4-lands', 'row4-enchantments',
];

/** Generates a row with 2-10 unique cards, optionally some with attachments */
function arbRowCards(rowId: RowTarget): fc.Arbitrary<RowCard[]> {
  return fc.integer({ min: 2, max: 10 }).chain(cardCount => {
    return fc.array(
      fc.integer({ min: 0, max: 2 }),
      { minLength: cardCount, maxLength: cardCount }
    ).map(attachmentCounts => {
      let globalId = 0;
      const cards: RowCard[] = [];
      for (let i = 0; i < cardCount; i++) {
        const cardId = `${rowId}-card-${globalId++}`;
        const attachments: Attachment[] = [];
        for (let a = 0; a < attachmentCounts[i]; a++) {
          attachments.push(makeAttachment(`${rowId}-attach-${globalId++}`));
        }
        cards.push(makeRowCard(cardId, rowId, attachments));
      }
      return cards;
    });
  });
}

/** Generates a GameState with cards in a specific row */
function arbGameStateWithRow(rowId: RowTarget): fc.Arbitrary<{ state: GameState; rowId: RowTarget }> {
  return arbRowCards(rowId).map(rowCards => {
    const state = makeEmptyGameState();
    const newState = setRowCards(state, rowId, rowCards);
    return { state: newState, rowId };
  });
}

/** Generates a GameState with cards in a random row, plus valid reorder indices */
const arbReorderOperation: fc.Arbitrary<{
  state: GameState;
  rowId: RowTarget;
  oldIndex: number;
  newIndex: number;
}> = fc.oneof(...ROW_TARGETS.map(rowId =>
  arbGameStateWithRow(rowId).chain(({ state, rowId }) => {
    const rowCards = getRowCards(state, rowId);
    const len = rowCards.length;
    return fc.tuple(
      fc.integer({ min: 0, max: len - 1 }),
      fc.integer({ min: 0, max: len - 1 })
    ).filter(([a, b]) => a !== b).map(([oldIndex, newIndex]) => ({
      state,
      rowId,
      oldIndex,
      newIndex,
    }));
  })
));

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 1: Card Count Invariant (Reorder)', () => {
  it('total card count is unchanged after arrayMove reorder', () => {
    fc.assert(
      fc.property(arbReorderOperation, ({ state, rowId, oldIndex, newIndex }) => {
        const rowCards = getRowCards(state, rowId);
        const reordered = arrayMove(rowCards, oldIndex, newIndex);
        const newState = setRowCards(state, rowId, reordered);

        const countBefore = totalCardCount(state);
        const countAfter = totalCardCount(newState);
        expect(countAfter).toBe(countBefore);
      }),
      { numRuns: 200 }
    );
  });

  it('no duplicate instanceIds exist after reorder', () => {
    fc.assert(
      fc.property(arbReorderOperation, ({ state, rowId, oldIndex, newIndex }) => {
        const rowCards = getRowCards(state, rowId);
        const reordered = arrayMove(rowCards, oldIndex, newIndex);
        const newState = setRowCards(state, rowId, reordered);

        const ids = allInstanceIds(newState);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }),
      { numRuns: 200 }
    );
  });

  it('row element count is unchanged after reorder', () => {
    fc.assert(
      fc.property(arbReorderOperation, ({ state, rowId, oldIndex, newIndex }) => {
        const rowCardsBefore = getRowCards(state, rowId);
        const reordered = arrayMove(rowCardsBefore, oldIndex, newIndex);
        const newState = setRowCards(state, rowId, reordered);
        const rowCardsAfter = getRowCards(newState, rowId);

        expect(rowCardsAfter.length).toBe(rowCardsBefore.length);
      }),
      { numRuns: 200 }
    );
  });
});
