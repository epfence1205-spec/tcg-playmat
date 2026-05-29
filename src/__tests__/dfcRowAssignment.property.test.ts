import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CardData, CardType, GameState, RowCard } from '../types';
import {
  transformDFC,
  addToBattlefield,
  getAllBattlefieldCards,
  createRowCard,
} from '../gameActions';

/**
 * Property 28: DFC Transform Toggle
 * For any DFC card on the battlefield (backFaceImageURI !== null),
 * calling transformDFC twice returns showingBackFace to its original value
 * (toggle is its own inverse).
 *
 * Property 29: Card Type Row Assignment
 * For any card added to the battlefield via addToBattlefield:
 *   - creature → placed in creature area (creature-1, creature-2, or creature-3)
 *   - land → placed in row4-lands
 *   - artifact → placed in row4-artifacts
 *   - enchantment → placed in row5-enchantments
 *   - planeswalker/battle → placed in pw-battle-column (stored in creature area)
 *
 * Property 30: Planeswalker/Battle Column Visibility
 * The PW/Battle column should have cards if and only if at least one
 * planeswalker or battle card exists on the battlefield.
 *
 * **Validates: Requirements 27.1, 27.2, 6.1–6.5, 7.1, 7.3, 7.4**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const cardTypeArb: fc.Arbitrary<CardType> = fc.constantFrom(
  'creature',
  'land',
  'artifact',
  'enchantment',
  'planeswalker',
  'battle',
  'instant',
  'sorcery',
  'other'
);

/** Generates a CardData with a specific cardType and optional DFC back face */
function makeCardData(
  id: string,
  cardType: CardType,
  hasDFC: boolean = false
): CardData {
  return {
    id,
    name: `${cardType}-card-${id}`,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
    backFaceImageURI: hasDFC
      ? 'https://cards.scryfall.io/normal/back/test.jpg'
      : null,
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

/** Creates an empty GameState for testing */
function createEmptyState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: {
      rows: [{ id: 'creature-1', elements: [] }],
      totalElementCount: 0,
    },
    row4: { left: [], right: [] },
    row5: { left: [], right: [] },
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

/** Generates a DFC card (backFaceImageURI is non-null) with a unique id */
const dfcCardArb: fc.Arbitrary<CardData> = fc
  .tuple(fc.uuid(), cardTypeArb)
  .map(([id, cardType]) => makeCardData(id, cardType, true));

/** Generates a card with a specific cardType */
const typedCardArb: fc.Arbitrary<CardData> = fc
  .tuple(fc.uuid(), cardTypeArb)
  .map(([id, cardType]) => makeCardData(id, cardType, false));

/** Generates a list of cards with various types, ensuring at least one PW or battle */
const cardsWithPwBattleArb: fc.Arbitrary<CardData[]> = fc
  .tuple(
    fc.array(
      fc.tuple(fc.uuid(), fc.constantFrom<CardType>('creature', 'land', 'artifact', 'enchantment')),
      { minLength: 0, maxLength: 5 }
    ),
    fc.array(
      fc.tuple(fc.uuid(), fc.constantFrom<CardType>('planeswalker', 'battle')),
      { minLength: 1, maxLength: 3 }
    )
  )
  .map(([nonPw, pw]) => {
    const cards: CardData[] = [
      ...nonPw.map(([id, type]) => makeCardData(id, type)),
      ...pw.map(([id, type]) => makeCardData(id, type)),
    ];
    return cards;
  });

/** Generates a list of cards with NO planeswalkers or battles */
const cardsWithoutPwBattleArb: fc.Arbitrary<CardData[]> = fc
  .array(
    fc.tuple(fc.uuid(), fc.constantFrom<CardType>('creature', 'land', 'artifact', 'enchantment')),
    { minLength: 1, maxLength: 8 }
  )
  .map((pairs) => pairs.map(([id, type]) => makeCardData(id, type)));

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 28: DFC Transform Toggle', () => {
  it('transformDFC twice returns showingBackFace to its original value', () => {
    fc.assert(
      fc.property(dfcCardArb, (dfcCard: CardData) => {
        // Place the DFC card on the battlefield
        let state = createEmptyState();
        state = addToBattlefield(state, dfcCard);

        // Get the initial showingBackFace value
        const allCards = getAllBattlefieldCards(state);
        const placed = allCards.find((rc) => rc.instanceId === dfcCard.id);
        expect(placed).toBeDefined();
        const originalValue = placed!.showingBackFace;

        // Transform once
        const stateAfterFirst = transformDFC(state, dfcCard.id);
        const afterFirst = getAllBattlefieldCards(stateAfterFirst).find(
          (rc) => rc.instanceId === dfcCard.id
        );
        expect(afterFirst).toBeDefined();
        expect(afterFirst!.showingBackFace).toBe(!originalValue);

        // Transform twice — should return to original
        const stateAfterSecond = transformDFC(stateAfterFirst, dfcCard.id);
        const afterSecond = getAllBattlefieldCards(stateAfterSecond).find(
          (rc) => rc.instanceId === dfcCard.id
        );
        expect(afterSecond).toBeDefined();
        expect(afterSecond!.showingBackFace).toBe(originalValue);
      }),
      { numRuns: 200 }
    );
  });

  it('transformDFC is a no-op for non-DFC cards (backFaceImageURI === null)', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.uuid(), cardTypeArb),
        ([id, cardType]) => {
          const nonDfcCard = makeCardData(id, cardType, false);
          let state = createEmptyState();
          state = addToBattlefield(state, nonDfcCard);

          const stateAfterTransform = transformDFC(state, nonDfcCard.id);

          // State should be unchanged
          const before = getAllBattlefieldCards(state).find(
            (rc) => rc.instanceId === nonDfcCard.id
          );
          const after = getAllBattlefieldCards(stateAfterTransform).find(
            (rc) => rc.instanceId === nonDfcCard.id
          );
          expect(after!.showingBackFace).toBe(before!.showingBackFace);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property 29: Card Type Row Assignment', () => {
  it('creature cards are placed in creature area (creature-1, creature-2, or creature-3)', () => {
    fc.assert(
      fc.property(fc.uuid(), (id: string) => {
        const card = makeCardData(id, 'creature');
        let state = createEmptyState();
        state = addToBattlefield(state, card);

        const placed = getAllBattlefieldCards(state).find(
          (rc) => rc.instanceId === card.id
        );
        expect(placed).toBeDefined();
        expect(['creature-1', 'creature-2', 'creature-3']).toContain(
          placed!.rowAssignment
        );
      }),
      { numRuns: 200 }
    );
  });

  it('land cards are placed in row4-lands', () => {
    fc.assert(
      fc.property(fc.uuid(), (id: string) => {
        const card = makeCardData(id, 'land');
        let state = createEmptyState();
        state = addToBattlefield(state, card);

        const placed = getAllBattlefieldCards(state).find(
          (rc) => rc.instanceId === card.id
        );
        expect(placed).toBeDefined();
        expect(placed!.rowAssignment).toBe('row4-lands');
      }),
      { numRuns: 200 }
    );
  });

  it('artifact cards are placed in row4-artifacts', () => {
    fc.assert(
      fc.property(fc.uuid(), (id: string) => {
        const card = makeCardData(id, 'artifact');
        let state = createEmptyState();
        state = addToBattlefield(state, card);

        const placed = getAllBattlefieldCards(state).find(
          (rc) => rc.instanceId === card.id
        );
        expect(placed).toBeDefined();
        expect(placed!.rowAssignment).toBe('row4-artifacts');
      }),
      { numRuns: 200 }
    );
  });

  it('enchantment cards are placed in row5-enchantments', () => {
    fc.assert(
      fc.property(fc.uuid(), (id: string) => {
        const card = makeCardData(id, 'enchantment');
        let state = createEmptyState();
        state = addToBattlefield(state, card);

        const placed = getAllBattlefieldCards(state).find(
          (rc) => rc.instanceId === card.id
        );
        expect(placed).toBeDefined();
        expect(placed!.rowAssignment).toBe('row5-enchantments');
      }),
      { numRuns: 200 }
    );
  });

  it('planeswalker cards are placed in pw-battle-column', () => {
    fc.assert(
      fc.property(fc.uuid(), (id: string) => {
        const card = makeCardData(id, 'planeswalker');
        let state = createEmptyState();
        state = addToBattlefield(state, card);

        const placed = getAllBattlefieldCards(state).find(
          (rc) => rc.instanceId === card.id
        );
        expect(placed).toBeDefined();
        expect(placed!.rowAssignment).toBe('pw-battle-column');
      }),
      { numRuns: 200 }
    );
  });

  it('battle cards are placed in pw-battle-column', () => {
    fc.assert(
      fc.property(fc.uuid(), (id: string) => {
        const card = makeCardData(id, 'battle');
        let state = createEmptyState();
        state = addToBattlefield(state, card);

        const placed = getAllBattlefieldCards(state).find(
          (rc) => rc.instanceId === card.id
        );
        expect(placed).toBeDefined();
        expect(placed!.rowAssignment).toBe('pw-battle-column');
      }),
      { numRuns: 200 }
    );
  });

  it('card type determines correct row for any generated card type', () => {
    fc.assert(
      fc.property(typedCardArb, (card: CardData) => {
        let state = createEmptyState();
        state = addToBattlefield(state, card);

        const placed = getAllBattlefieldCards(state).find(
          (rc) => rc.instanceId === card.id
        );
        expect(placed).toBeDefined();

        switch (card.cardType) {
          case 'creature':
            expect(['creature-1', 'creature-2', 'creature-3']).toContain(
              placed!.rowAssignment
            );
            break;
          case 'land':
            expect(placed!.rowAssignment).toBe('row4-lands');
            break;
          case 'artifact':
            expect(placed!.rowAssignment).toBe('row4-artifacts');
            break;
          case 'enchantment':
            expect(placed!.rowAssignment).toBe('row5-enchantments');
            break;
          case 'planeswalker':
          case 'battle':
            expect(placed!.rowAssignment).toBe('pw-battle-column');
            break;
          default:
            // instant, sorcery, other → fallback to creature area
            expect(['creature-1', 'creature-2', 'creature-3']).toContain(
              placed!.rowAssignment
            );
            break;
        }
      }),
      { numRuns: 300 }
    );
  });
});

describe('Property 30: Planeswalker/Battle Column Visibility', () => {
  it('pw-battle-column has cards when at least one PW/battle exists on battlefield', () => {
    fc.assert(
      fc.property(cardsWithPwBattleArb, (cards: CardData[]) => {
        let state = createEmptyState();
        for (const card of cards) {
          state = addToBattlefield(state, card);
        }

        // Check that at least one card has pw-battle-column assignment
        const allCards = getAllBattlefieldCards(state);
        const pwBattleCards = allCards.filter(
          (rc) => rc.rowAssignment === 'pw-battle-column'
        );
        expect(pwBattleCards.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it('pw-battle-column has no cards when no PW/battle exists on battlefield', () => {
    fc.assert(
      fc.property(cardsWithoutPwBattleArb, (cards: CardData[]) => {
        let state = createEmptyState();
        for (const card of cards) {
          state = addToBattlefield(state, card);
        }

        // Check that no card has pw-battle-column assignment
        const allCards = getAllBattlefieldCards(state);
        const pwBattleCards = allCards.filter(
          (rc) => rc.rowAssignment === 'pw-battle-column'
        );
        expect(pwBattleCards.length).toBe(0);
      }),
      { numRuns: 200 }
    );
  });

  it('pw-battle-column card count equals exactly the number of PW/battle cards added', () => {
    fc.assert(
      fc.property(cardsWithPwBattleArb, (cards: CardData[]) => {
        let state = createEmptyState();
        for (const card of cards) {
          state = addToBattlefield(state, card);
        }

        const allCards = getAllBattlefieldCards(state);
        const pwBattleCards = allCards.filter(
          (rc) => rc.rowAssignment === 'pw-battle-column'
        );
        const expectedPwBattleCount = cards.filter(
          (c) => c.cardType === 'planeswalker' || c.cardType === 'battle'
        ).length;

        expect(pwBattleCards.length).toBe(expectedPwBattleCount);
      }),
      { numRuns: 200 }
    );
  });
});
