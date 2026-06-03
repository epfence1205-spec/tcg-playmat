import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { addCounter, removeCounter } from '../counterActions';
import type { GameState, CounterType, RowCard, CardData, Counter } from '../types';

/**
 * Property 21: Counter Arithmetic
 * - increment produces V+1, decrement produces V-1
 * - addCounter followed by removeCounter returns to original value V
 * - removeCounter followed by addCounter returns to original value V (if V > 0)
 * - addCounter on a card with no counters of that type creates counter with value 1
 * - removeCounter on a card with no counters of that type is a no-op
 * - Counter values are always positive (never negative)
 *
 * **Validates: Requirements 17.3**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const ALL_COUNTER_TYPES: CounterType[] = [
  '+1/+1', '-1/-1', 'lifelink', 'hexproof', 'indestructible', 'shroud',
  'time', 'charge', 'generic', 'loyalty', 'flying', 'deathtouch',
  'menace', 'trample', 'first_strike', 'double_strike', 'reach',
  'vigilance', 'token', 'lore', 'shield', 'haste', 'custom',
];

const counterTypeArb: fc.Arbitrary<CounterType> = fc.constantFrom(...ALL_COUNTER_TYPES);

/** Generates a positive counter value (1-100) */
const counterValueArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 100 });

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeCard(id: string): CardData {
  return {
    id,
    name: 'Test Card',
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
    backFaceImageURI: null,
    typeLine: 'Creature — Human',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: '2',
    baseToughness: '2',
    cardType: 'creature',
    isToken: false,
    isTokenCopy: false,
  };
}

function makeRowCard(id: string, counters: Counter[] = []): RowCard {
  return {
    card: makeCard(id),
    instanceId: id,
    rowAssignment: 'creature-1',
    positionIndex: 0,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters,
    isRevealed: false,
  };
}

function makeStateWithCard(cardId: string, counters: Counter[] = []): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: {
      rows: [{ id: 'creature-1', elements: [makeRowCard(cardId, counters)] }],
      totalElementCount: 1,
    },
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

/** Gets the counter value for a specific type from the first card on the battlefield */
function getCounterValue(state: GameState, counterType: CounterType): number | undefined {
  const card = state.creatureArea.rows[0].elements[0];
  const counter = card.counters.find(c => c.type === counterType);
  return counter?.value;
}

/** Gets all counters from the first card on the battlefield */
function getCounters(state: GameState): Counter[] {
  return state.creatureArea.rows[0].elements[0].counters;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 21: Counter Arithmetic', () => {
  it('addCounter produces V+1 for any card with counter value V', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        counterValueArb,
        (counterType: CounterType, initialValue: number) => {
          const state = makeStateWithCard('card-1', [{ type: counterType, value: initialValue }]);
          const result = addCounter(state, 'card-1', counterType);
          const newValue = getCounterValue(result, counterType);

          expect(newValue).toBe(initialValue + 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('removeCounter produces V-1 for any card with counter value V > 1', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        fc.integer({ min: 2, max: 100 }),
        (counterType: CounterType, initialValue: number) => {
          const state = makeStateWithCard('card-1', [{ type: counterType, value: initialValue }]);
          const result = removeCounter(state, 'card-1', counterType);
          const newValue = getCounterValue(result, counterType);

          expect(newValue).toBe(initialValue - 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('removeCounter removes counter entirely when V=1', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        (counterType: CounterType) => {
          const state = makeStateWithCard('card-1', [{ type: counterType, value: 1 }]);
          const result = removeCounter(state, 'card-1', counterType);
          const counters = getCounters(result);

          expect(counters.find(c => c.type === counterType)).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('addCounter followed by removeCounter returns to original value V', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        counterValueArb,
        (counterType: CounterType, initialValue: number) => {
          const state = makeStateWithCard('card-1', [{ type: counterType, value: initialValue }]);
          const afterAdd = addCounter(state, 'card-1', counterType);
          const afterRemove = removeCounter(afterAdd, 'card-1', counterType);
          const finalValue = getCounterValue(afterRemove, counterType);

          expect(finalValue).toBe(initialValue);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('removeCounter followed by addCounter returns to original value V (when V > 1)', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        fc.integer({ min: 2, max: 100 }),
        (counterType: CounterType, initialValue: number) => {
          const state = makeStateWithCard('card-1', [{ type: counterType, value: initialValue }]);
          const afterRemove = removeCounter(state, 'card-1', counterType);
          const afterAdd = addCounter(afterRemove, 'card-1', counterType);
          const finalValue = getCounterValue(afterAdd, counterType);

          expect(finalValue).toBe(initialValue);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('addCounter on a card with no counters of that type creates counter with value 1', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        (counterType: CounterType) => {
          const state = makeStateWithCard('card-1', []);
          const result = addCounter(state, 'card-1', counterType);
          const newValue = getCounterValue(result, counterType);

          expect(newValue).toBe(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('removeCounter on a card with no counters of that type is a no-op', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        (counterType: CounterType) => {
          const state = makeStateWithCard('card-1', []);
          const result = removeCounter(state, 'card-1', counterType);
          const counters = getCounters(result);

          expect(counters).toHaveLength(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('counter values are always positive after any sequence of addCounter operations', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        fc.integer({ min: 1, max: 20 }),
        (counterType: CounterType, numAdds: number) => {
          let state = makeStateWithCard('card-1', []);
          for (let i = 0; i < numAdds; i++) {
            state = addCounter(state, 'card-1', counterType);
          }
          const value = getCounterValue(state, counterType);

          expect(value).toBeGreaterThan(0);
          expect(value).toBe(numAdds);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('counter values never become negative through removeCounter', () => {
    fc.assert(
      fc.property(
        counterTypeArb,
        counterValueArb,
        fc.integer({ min: 1, max: 200 }),
        (counterType: CounterType, initialValue: number, numRemoves: number) => {
          let state = makeStateWithCard('card-1', [{ type: counterType, value: initialValue }]);
          for (let i = 0; i < numRemoves; i++) {
            state = removeCounter(state, 'card-1', counterType);
          }
          const counters = getCounters(state);
          const counter = counters.find(c => c.type === counterType);

          // Counter either has a positive value or was removed entirely
          if (counter) {
            expect(counter.value).toBeGreaterThan(0);
          }
          // If counter is undefined, it was removed (value reached 0) — this is valid
        }
      ),
      { numRuns: 200 }
    );
  });
});
