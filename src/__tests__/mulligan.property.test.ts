import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CardData, CardType, KeywordAbility, GameState } from '../types';
import {
  initializeMulligan,
  mulliganAgain,
  confirmKeep,
  togglePutBack,
} from '../mulliganEngine';

/**
 * Property 11: Mulligan Put-Back Formula — requiredPutBacks = max(0, N-1)
 * Property 12: Mulligan Card Conservation — total cards constant through mulligan actions
 * Property 13: Mulligan Privacy Invariant — during MULLIGAN phase, all battlefield zones empty
 *
 * **Validates: Requirements 11.7, 11.8, 11.10, 11.6, 11.11, 11.2, 11.3**
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
      fc.string({ minLength: 1, maxLength: 20 }),
      cardTypeArb,
      fc.array(keywordAbilityArb, { minLength: 0, maxLength: 2 })
    )
    .map(([name, cardType, keywords]) => ({
      id: `mulligan-card-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
      name,
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      typeLine: cardType === 'creature' ? 'Creature — Human' : 'Land',
      oracleText: '',
      isCommander: false,
      keywords,
      basePower: cardType === 'creature' ? '2' : null,
      baseToughness: cardType === 'creature' ? '2' : null,
      cardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates a library of cards with size between min and max */
function libraryArb(minSize: number, maxSize: number): fc.Arbitrary<CardData[]> {
  return fc
    .integer({ min: minSize, max: maxSize })
    .chain((size) => {
      if (size === 0) return fc.constant([]);
      const arbs = Array.from({ length: size }, (_, i) => cardDataArb(i));
      return fc.tuple(...(arbs as [fc.Arbitrary<CardData>, ...fc.Arbitrary<CardData>[]]));
    })
    .map((result) => (Array.isArray(result) ? result : [result]));
}

/** Creates a fresh GameState with cards only in the library (pre-mulligan) */
function makePreMulliganState(library: CardData[]): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand: [],
    commandZone: [],
    graveyard: [],
    library,
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
    turnCount: 0,
    gameLog: [],
  };
}

/**
 * Counts total cards across all zones including mulliganState.drawnCards.
 */
function totalCardCount(state: GameState): number {
  let count = 0;

  // Off-battlefield zones
  count += state.hand.length;
  count += state.library.length;
  count += state.graveyard.length;
  count += state.commandZone.length;
  count += state.exile.length;

  // Battlefield: creature area
  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      count++;
      count += rc.attachments.length;
    }
  }

  // Battlefield: row3
  for (const rc of state.row3.left) {
    count++;
    count += rc.attachments.length;
  }
  for (const rc of state.row3.right) {
    count++;
    count += rc.attachments.length;
  }

  // Battlefield: row4
  for (const rc of state.row4.left) {
    count++;
    count += rc.attachments.length;
  }
  for (const rc of state.row4.right) {
    count++;
    count += rc.attachments.length;
  }

  // Mulligan state drawn cards
  if (state.mulliganState) {
    count += state.mulliganState.drawnCards.length;
  }

  return count;
}

/**
 * Checks if all battlefield zones are empty.
 */
function isBattlefieldEmpty(state: GameState): boolean {
  // Creature area
  for (const row of state.creatureArea.rows) {
    if (row.elements.length > 0) return false;
  }

  // Row 3
  if (state.row3.left.length > 0 || state.row3.right.length > 0) return false;

  // Row 4
  if (state.row4.left.length > 0 || state.row4.right.length > 0) return false;

  return true;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 11: Mulligan Put-Back Formula', () => {
  it('first mulligan (N=1) requires 0 put-backs (free mulligan)', () => {
    fc.assert(
      fc.property(
        libraryArb(7, 99),
        (library: CardData[]) => {
          const state = makePreMulliganState(library);
          const afterInit = initializeMulligan(state);

          expect(afterInit.mulliganState).not.toBeNull();
          expect(afterInit.mulliganState!.mulliganCount).toBe(0);
          expect(afterInit.mulliganState!.requiredPutBacks).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after mulliganAgain is called N times, requiredPutBacks = max(0, N-1)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          libraryArb(7, 99),
          fc.integer({ min: 1, max: 5 }) // number of additional mulligans
        ),
        ([library, mulliganCount]: [CardData[], number]) => {
          let state = makePreMulliganState(library);
          state = initializeMulligan(state);

          // Perform N additional mulligans
          for (let i = 0; i < mulliganCount; i++) {
            state = mulliganAgain(state);
          }

          // After init (count=0) + N mulligans, count should be N
          const expectedPutBacks = Math.max(0, mulliganCount - 1);

          expect(state.mulliganState).not.toBeNull();
          expect(state.mulliganState!.mulliganCount).toBe(mulliganCount);
          expect(state.mulliganState!.requiredPutBacks).toBe(expectedPutBacks);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('requiredPutBacks always equals max(0, mulliganCount - 1)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          libraryArb(7, 60),
          fc.integer({ min: 0, max: 6 }) // number of additional mulligans (0 = keep first)
        ),
        ([library, additionalMulligans]: [CardData[], number]) => {
          let state = makePreMulliganState(library);
          state = initializeMulligan(state);

          for (let i = 0; i < additionalMulligans; i++) {
            state = mulliganAgain(state);
          }

          // After init (count=0) + N mulligans, count = N
          const expectedCount = additionalMulligans;
          const expectedPutBacks = Math.max(0, expectedCount - 1);

          expect(state.mulliganState!.requiredPutBacks).toBe(expectedPutBacks);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 12: Mulligan Card Conservation', () => {
  it('initializeMulligan preserves total card count', () => {
    fc.assert(
      fc.property(
        libraryArb(7, 99),
        (library: CardData[]) => {
          const state = makePreMulliganState(library);
          const before = totalCardCount(state);
          const afterInit = initializeMulligan(state);
          const after = totalCardCount(afterInit);

          expect(after).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mulliganAgain preserves total card count', () => {
    fc.assert(
      fc.property(
        libraryArb(7, 99),
        (library: CardData[]) => {
          const state = makePreMulliganState(library);
          const afterInit = initializeMulligan(state);
          const before = totalCardCount(afterInit);
          const afterMulligan = mulliganAgain(afterInit);
          const after = totalCardCount(afterMulligan);

          expect(after).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple mulliganAgain calls preserve total card count', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          libraryArb(7, 60),
          fc.integer({ min: 1, max: 5 })
        ),
        ([library, mulliganCount]: [CardData[], number]) => {
          const state = makePreMulliganState(library);
          const initialCount = totalCardCount(state);

          let current = initializeMulligan(state);
          expect(totalCardCount(current)).toBe(initialCount);

          for (let i = 0; i < mulliganCount; i++) {
            current = mulliganAgain(current);
            expect(totalCardCount(current)).toBe(initialCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('confirmKeep preserves total card count', () => {
    fc.assert(
      fc.property(
        libraryArb(7, 99),
        (library: CardData[]) => {
          const state = makePreMulliganState(library);
          let current = initializeMulligan(state);
          const before = totalCardCount(current);

          // For first mulligan, requiredPutBacks = 0, so we can confirm immediately
          const afterKeep = confirmKeep(current);
          const after = totalCardCount(afterKeep);

          expect(after).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('confirmKeep after mulligan with put-backs preserves total card count', () => {
    fc.assert(
      fc.property(
        libraryArb(14, 99),
        (library: CardData[]) => {
          const state = makePreMulliganState(library);
          let current = initializeMulligan(state);
          current = mulliganAgain(current); // Now requires 1 put-back

          const before = totalCardCount(current);

          // Select one card to put back
          if (current.mulliganState && current.mulliganState.drawnCards.length > 0) {
            const cardToPutBack = current.mulliganState.drawnCards[0];
            current = togglePutBack(current, cardToPutBack.id);
          }

          const afterKeep = confirmKeep(current);
          const after = totalCardCount(afterKeep);

          expect(after).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('togglePutBack preserves total card count', () => {
    fc.assert(
      fc.property(
        libraryArb(7, 99),
        (library: CardData[]) => {
          const state = makePreMulliganState(library);
          let current = initializeMulligan(state);
          const before = totalCardCount(current);

          if (current.mulliganState && current.mulliganState.drawnCards.length > 0) {
            const cardId = current.mulliganState.drawnCards[0].id;
            current = togglePutBack(current, cardId);
          }

          const after = totalCardCount(current);
          expect(after).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 13: Mulligan Privacy Invariant', () => {
  it('after initializeMulligan, all battlefield zones are empty', () => {
    fc.assert(
      fc.property(
        libraryArb(7, 99),
        (library: CardData[]) => {
          const state = makePreMulliganState(library);
          const afterInit = initializeMulligan(state);

          expect(afterInit.gamePhase).toBe('MULLIGAN');
          expect(isBattlefieldEmpty(afterInit)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after mulliganAgain, all battlefield zones remain empty', () => {
    fc.assert(
      fc.property(
        libraryArb(7, 99),
        (library: CardData[]) => {
          const state = makePreMulliganState(library);
          let current = initializeMulligan(state);
          current = mulliganAgain(current);

          expect(current.gamePhase).toBe('MULLIGAN');
          expect(isBattlefieldEmpty(current)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('through any sequence of mulligan actions, battlefield stays empty', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          libraryArb(7, 60),
          fc.integer({ min: 0, max: 5 }) // number of additional mulligans
        ),
        ([library, additionalMulligans]: [CardData[], number]) => {
          const state = makePreMulliganState(library);
          let current = initializeMulligan(state);

          // Verify after initial mulligan
          expect(current.gamePhase).toBe('MULLIGAN');
          expect(isBattlefieldEmpty(current)).toBe(true);

          // Verify after each additional mulligan
          for (let i = 0; i < additionalMulligans; i++) {
            current = mulliganAgain(current);
            expect(current.gamePhase).toBe('MULLIGAN');
            expect(isBattlefieldEmpty(current)).toBe(true);
          }

          // Verify togglePutBack doesn't affect battlefield
          if (current.mulliganState && current.mulliganState.drawnCards.length > 0) {
            current = togglePutBack(current, current.mulliganState.drawnCards[0].id);
            expect(isBattlefieldEmpty(current)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('during MULLIGAN phase, creatureArea, row3, and row4 are all empty', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          libraryArb(7, 99),
          fc.integer({ min: 0, max: 4 })
        ),
        ([library, mulliganRounds]: [CardData[], number]) => {
          const state = makePreMulliganState(library);
          let current = initializeMulligan(state);

          for (let i = 0; i < mulliganRounds; i++) {
            current = mulliganAgain(current);
          }

          // Explicitly check each battlefield zone
          for (const row of current.creatureArea.rows) {
            expect(row.elements).toHaveLength(0);
          }
          expect(current.row3.left).toHaveLength(0);
          expect(current.row3.right).toHaveLength(0);
          expect(current.row4.left).toHaveLength(0);
          expect(current.row4.right).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
