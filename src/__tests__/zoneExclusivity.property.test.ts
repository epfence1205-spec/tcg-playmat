import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  CardData,
  CardType,
  KeywordAbility,
  GameState,
  RowCard,
  RowTarget,
  CreatureArea,
  SplitRow,
  Attachment,
  ExileCard,
} from '../types';
import {
  drawCard,
  moveCard,
  softReset,
  addToBattlefield,
  getAllBattlefieldCards,
} from '../gameActions';

/**
 * Property 1: Zone Exclusivity
 * For any game state, each card ID appears in exactly one location.
 *
 * Property 2: Card Count Conservation
 * For any state transition, total card count remains constant.
 *
 * **Validates: Requirements 22.4, 25.6, 28.4**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const cardTypeArb: fc.Arbitrary<CardType> = fc.constantFrom(
  'creature',
  'land',
  'artifact',
  'enchantment',
  'planeswalker',
  'instant',
  'sorcery',
  'battle',
  'other'
);

const keywordAbilityArb: fc.Arbitrary<KeywordAbility> = fc.constantFrom(
  'flying',
  'trample',
  'haste',
  'vigilance',
  'lifelink',
  'deathtouch',
  'hexproof',
  'indestructible',
  'menace',
  'reach',
  'first_strike',
  'double_strike',
  'flash',
  'defender',
  'ward',
  'shroud',
  'protection'
);

/** Generates a valid CardData with a unique ID */
function cardDataArb(idSuffix: number): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 30 }),
      cardTypeArb,
      fc.boolean(),
      fc.array(keywordAbilityArb, { minLength: 0, maxLength: 3 })
    )
    .map(([name, cardType, isCommander, keywords]) => ({
      id: `card-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
      name,
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      typeLine: cardType === 'creature' ? 'Creature — Human' : 'Land',
      oracleText: '',
      isCommander,
      keywords,
      basePower: cardType === 'creature' ? '2' : null,
      baseToughness: cardType === 'creature' ? '2' : null,
      cardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates a list of unique CardData instances */
function cardListArb(minSize: number, maxSize: number): fc.Arbitrary<CardData[]> {
  return fc
    .integer({ min: minSize, max: maxSize })
    .chain((size) => {
      if (size === 0) return fc.constant([]);
      const arbs = Array.from({ length: size }, (_, i) => cardDataArb(i));
      return fc.tuple(...(arbs as [fc.Arbitrary<CardData>, ...fc.Arbitrary<CardData>[]]));
    })
    .map((result) => (Array.isArray(result) ? result : []));
}

/** Creates a RowCard from CardData */
function makeRowCard(card: CardData, rowTarget: RowTarget, positionIndex: number): RowCard {
  return {
    card,
    instanceId: card.id,
    rowAssignment: rowTarget,
    positionIndex,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters: [],
    isRevealed: false,
  };
}

/** Creates an empty GameState */
function emptyGameState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
  };
}

/**
 * Generates a valid GameState with cards distributed across zones.
 * Ensures all card IDs are unique across the entire state.
 */
const gameStateArb: fc.Arbitrary<GameState> = fc
  .integer({ min: 1, max: 20 })
  .chain((totalCards) => {
    // Generate unique cards
    const cardArbs = Array.from({ length: totalCards }, (_, i) => cardDataArb(i));
    return fc.tuple(
      fc.tuple(...(cardArbs as [fc.Arbitrary<CardData>, ...fc.Arbitrary<CardData>[]])),
      // Distribution: for each card, pick a zone (0-7)
      fc.array(fc.integer({ min: 0, max: 7 }), { minLength: totalCards, maxLength: totalCards })
    );
  })
  .map(([cards, zoneAssignments]) => {
    const state = emptyGameState();
    const cardArray = Array.isArray(cards) ? cards : [cards];

    for (let i = 0; i < cardArray.length; i++) {
      const card = cardArray[i];
      const zone = zoneAssignments[i];

      switch (zone) {
        case 0: // hand
          state.hand.push(card);
          break;
        case 1: // library
          state.library.push(card);
          break;
        case 2: // graveyard
          state.graveyard.push(card);
          break;
        case 3: // commandZone
          state.commandZone.push(card);
          break;
        case 4: // exile
          state.exile.push({ card, isFaceDown: false });
          break;
        case 5: // creature area
          {
            const rowCard = makeRowCard(card, 'creature-1', state.creatureArea.rows[0].elements.length);
            state.creatureArea.rows[0].elements.push(rowCard);
            state.creatureArea.totalElementCount++;
          }
          break;
        case 6: // row3
          {
            const rowCard = makeRowCard(card, 'row3-lands', state.row3.left.length);
            state.row3.left.push(rowCard);
          }
          break;
        case 7: // row4
          {
            const rowCard = makeRowCard(card, 'row4-enchantments', state.row4.right.length);
            state.row4.right.push(rowCard);
          }
          break;
      }
    }

    return state;
  });

// ─── Helper: Collect all card IDs from a GameState ───────────────────────────

/**
 * Collects all card IDs from every zone in the game state,
 * including cards within attachments.
 */
function collectAllCardIds(state: GameState): string[] {
  const ids: string[] = [];

  // Hand
  for (const card of state.hand) {
    ids.push(card.id);
  }

  // Library
  for (const card of state.library) {
    ids.push(card.id);
  }

  // Graveyard
  for (const card of state.graveyard) {
    ids.push(card.id);
  }

  // Command Zone
  for (const card of state.commandZone) {
    ids.push(card.id);
  }

  // Exile
  for (const ec of state.exile) {
    ids.push(ec.card.id);
  }

  // Battlefield: creature area rows
  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      ids.push(rc.card.id);
      for (const att of rc.attachments) {
        ids.push(att.card.id);
      }
    }
  }

  // Battlefield: row3
  for (const rc of state.row3.left) {
    ids.push(rc.card.id);
    for (const att of rc.attachments) {
      ids.push(att.card.id);
    }
  }
  for (const rc of state.row3.right) {
    ids.push(rc.card.id);
    for (const att of rc.attachments) {
      ids.push(att.card.id);
    }
  }

  // Battlefield: row4
  for (const rc of state.row4.left) {
    ids.push(rc.card.id);
    for (const att of rc.attachments) {
      ids.push(att.card.id);
    }
  }
  for (const rc of state.row4.right) {
    ids.push(rc.card.id);
    for (const att of rc.attachments) {
      ids.push(att.card.id);
    }
  }

  return ids;
}

/**
 * Returns the total card count across all zones.
 */
function totalCardCount(state: GameState): number {
  return collectAllCardIds(state).length;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 1: Zone Exclusivity', () => {
  it('each card ID appears in exactly one location across all zones', () => {
    fc.assert(
      fc.property(gameStateArb, (state: GameState) => {
        const allIds = collectAllCardIds(state);
        const uniqueIds = new Set(allIds);

        // Every ID must appear exactly once — no duplicates
        expect(allIds.length).toBe(uniqueIds.size);
      }),
      { numRuns: 200 }
    );
  });

  it('after drawCard, drawn card ID is only in hand (not in library)', () => {
    fc.assert(
      fc.property(
        gameStateArb.filter((s) => s.library.length > 0),
        (state: GameState) => {
          const topCardId = state.library[0].id;
          const newState = drawCard(state);

          // Card should be in hand
          const inHand = newState.hand.some((c) => c.id === topCardId);
          expect(inHand).toBe(true);

          // Card should NOT be in library
          const inLibrary = newState.library.some((c) => c.id === topCardId);
          expect(inLibrary).toBe(false);

          // All IDs still unique
          const allIds = collectAllCardIds(newState);
          expect(allIds.length).toBe(new Set(allIds).size);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('after moveCard, card ID exists only in destination zone', () => {
    fc.assert(
      fc.property(
        gameStateArb.filter((s) => s.hand.length > 0),
        (state: GameState) => {
          const cardToMove = state.hand[0];
          const newState = moveCard(state, cardToMove.id, 'hand', 'graveyard');

          // Card should be in graveyard
          const inGraveyard = newState.graveyard.some((c) => c.id === cardToMove.id);
          expect(inGraveyard).toBe(true);

          // Card should NOT be in hand
          const inHand = newState.hand.some((c) => c.id === cardToMove.id);
          expect(inHand).toBe(false);

          // All IDs still unique
          const allIds = collectAllCardIds(newState);
          expect(allIds.length).toBe(new Set(allIds).size);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property 2: Card Count Conservation', () => {
  it('drawCard preserves total card count', () => {
    fc.assert(
      fc.property(gameStateArb, (state: GameState) => {
        const before = totalCardCount(state);
        const newState = drawCard(state);
        const after = totalCardCount(newState);

        expect(after).toBe(before);
      }),
      { numRuns: 200 }
    );
  });

  it('moveCard (hand → graveyard) preserves total card count', () => {
    fc.assert(
      fc.property(
        gameStateArb.filter((s) => s.hand.length > 0),
        (state: GameState) => {
          const cardToMove = state.hand[0];
          const before = totalCardCount(state);
          const newState = moveCard(state, cardToMove.id, 'hand', 'graveyard');
          const after = totalCardCount(newState);

          expect(after).toBe(before);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('moveCard (hand → battlefield) preserves total card count', () => {
    fc.assert(
      fc.property(
        gameStateArb.filter((s) => s.hand.length > 0),
        (state: GameState) => {
          const cardToMove = state.hand[0];
          const before = totalCardCount(state);
          const newState = moveCard(state, cardToMove.id, 'hand', 'battlefield');
          const after = totalCardCount(newState);

          expect(after).toBe(before);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('moveCard (hand → exile) preserves total card count', () => {
    fc.assert(
      fc.property(
        gameStateArb.filter((s) => s.hand.length > 0),
        (state: GameState) => {
          const cardToMove = state.hand[0];
          const before = totalCardCount(state);
          const newState = moveCard(state, cardToMove.id, 'hand', 'exile');
          const after = totalCardCount(newState);

          expect(after).toBe(before);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('softReset preserves total card count', () => {
    fc.assert(
      fc.property(gameStateArb, (state: GameState) => {
        const before = totalCardCount(state);
        const newState = softReset(state);
        const after = totalCardCount(newState);

        expect(after).toBe(before);
      }),
      { numRuns: 200 }
    );
  });

  it('addToBattlefield increases total card count by exactly 1', () => {
    fc.assert(
      fc.property(
        fc.tuple(gameStateArb, cardDataArb(999)),
        ([state, newCard]: [GameState, CardData]) => {
          const before = totalCardCount(state);
          const newState = addToBattlefield(state, newCard);
          const after = totalCardCount(newState);

          // addToBattlefield adds a card to the state, so count increases by 1
          expect(after).toBe(before + 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('moveCard (battlefield → hand) preserves total card count', () => {
    fc.assert(
      fc.property(
        gameStateArb.filter(
          (s) => s.creatureArea.rows.some((r) => r.elements.length > 0) ||
                 s.row3.left.length > 0 ||
                 s.row3.right.length > 0 ||
                 s.row4.left.length > 0 ||
                 s.row4.right.length > 0
        ),
        (state: GameState) => {
          // Find a card on the battlefield
          const allBattlefieldCards = getAllBattlefieldCards(state);
          if (allBattlefieldCards.length === 0) return; // skip if no battlefield cards

          const cardToMove = allBattlefieldCards[0];
          const before = totalCardCount(state);
          const newState = moveCard(state, cardToMove.instanceId, 'battlefield', 'hand');
          const after = totalCardCount(newState);

          expect(after).toBe(before);
        }
      ),
      { numRuns: 200 }
    );
  });
});
