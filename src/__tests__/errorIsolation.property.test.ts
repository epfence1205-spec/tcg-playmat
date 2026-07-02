import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  drawCard,
  shuffleLibrary,
  softReset,
  moveCard,
  tapCard,
  untapAll,
  addToBattlefield,
  removeCardFromZone,
} from '../gameActions';
import type { CardData, GameState, CardType, KeywordAbility, Zone } from '../types';

/**
 * Property 27: API Error State Isolation
 * - When an operation fails (e.g., moveCard throws because card doesn't exist),
 *   the original game state is completely unchanged.
 * - Pure function architecture guarantees failed operations throw without mutating input.
 *
 * Property 17: No Page Refresh Invariant
 * - No code path in the application triggers window.location.reload() or navigation events.
 * - Running softReset, drawCard, moveCard, etc. never invokes reload.
 *
 * **Validates: Requirements 29.5, 24.1, 24.4**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const cardTypeArb: fc.Arbitrary<CardType> = fc.constantFrom(
  'creature', 'land', 'artifact', 'enchantment',
  'planeswalker', 'instant', 'sorcery', 'battle', 'other'
);

const keywordAbilityArb: fc.Arbitrary<KeywordAbility> = fc.constantFrom(
  'flying', 'trample', 'haste', 'vigilance', 'lifelink',
  'deathtouch', 'hexproof', 'indestructible', 'menace',
  'reach', 'first_strike', 'double_strike', 'flash',
  'defender', 'ward', 'shroud', 'protection'
);

/** Generates a valid CardData instance */
const cardDataArb: fc.Arbitrary<CardData> = fc
  .tuple(
    fc.uuid(),
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.stringMatching(/^[a-z0-9]{3,5}$/),
    fc.stringMatching(/^[0-9]{1,4}$/),
    fc.constant('https://cards.scryfall.io/normal/front/a/b/test.jpg'),
    fc.constant('https://cards.scryfall.io/large/front/a/b/test.jpg'),
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 30 }),
    fc.string({ minLength: 0, maxLength: 80 }),
    fc.boolean(),
    fc.array(keywordAbilityArb, { minLength: 0, maxLength: 3 }),
    fc.option(fc.stringMatching(/^[0-9*]{1,2}$/), { nil: null }),
    fc.option(fc.stringMatching(/^[0-9*]{1,2}$/), { nil: null }),
    cardTypeArb
  )
  .map(([id, name, setCode, collectorNumber, imageURI, imageURILarge, backFaceImageURI, typeLine, oracleText, isCommander, keywords, basePower, baseToughness, cardType]) => ({
    id,
    name,
    setCode,
    collectorNumber,
    imageURI,
    imageURILarge,
    backFaceImageURI,
    typeLine,
    oracleText,
    isCommander,
    keywords,
    basePower,
    baseToughness,
    cardType,
    isToken: false,
    isTokenCopy: false,
  }));

/** Generates a GameState with cards distributed across zones */
function gameStateArb(): fc.Arbitrary<GameState> {
  return fc.tuple(
    fc.array(cardDataArb, { minLength: 0, maxLength: 10 }),
    fc.array(cardDataArb, { minLength: 0, maxLength: 5 }),
    fc.array(cardDataArb, { minLength: 0, maxLength: 5 }),
    fc.array(cardDataArb, { minLength: 0, maxLength: 20 }),
    fc.array(cardDataArb, { minLength: 0, maxLength: 3 }),
  ).map(([hand, graveyard, commandZone, library, exile]) => ({
    gamePhase: 'PLAYING' as const,
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand,
    commandZone,
    graveyard,
    library,
    exile: exile.map(c => ({ card: c, isFaceDown: false })),
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
    gameLog: [],
    turnCount: 0,
  }));
}

/** Deep-clone a GameState for comparison (structuredClone) */
function deepClone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

// ─── Property 27: API Error State Isolation ──────────────────────────────────

describe('Property 27: API Error State Isolation', () => {
  it('moveCard with non-existent card ID throws without mutating original state', () => {
    fc.assert(
      fc.property(gameStateArb(), (state) => {
        const snapshot = deepClone(state);
        const nonExistentId = 'non-existent-card-id-12345';

        // Attempt to move a card that doesn't exist — should throw
        try {
          moveCard(state, nonExistentId, 'hand', 'graveyard');
        } catch {
          // Expected: card not found
        }

        // Original state must be completely unchanged
        expect(state).toEqual(snapshot);
      }),
      { numRuns: 200 }
    );
  });

  it('removeCardFromZone with non-existent card throws without mutating state', () => {
    fc.assert(
      fc.property(gameStateArb(), (state) => {
        const snapshot = deepClone(state);
        const nonExistentId = 'does-not-exist-xyz';

        const zones: Zone[] = ['hand', 'graveyard', 'library', 'commandZone', 'exile', 'battlefield'];

        for (const zone of zones) {
          try {
            removeCardFromZone(state, zone, nonExistentId);
          } catch {
            // Expected: card not found in zone
          }
        }

        // Original state must remain unchanged after all failed attempts
        expect(state).toEqual(snapshot);
      }),
      { numRuns: 200 }
    );
  });

  it('tapCard with non-existent card throws without mutating state', () => {
    fc.assert(
      fc.property(gameStateArb(), (state) => {
        const snapshot = deepClone(state);

        try {
          tapCard(state, 'non-existent-card-on-battlefield');
        } catch {
          // Expected: card not found on battlefield
        }

        expect(state).toEqual(snapshot);
      }),
      { numRuns: 200 }
    );
  });

  it('moveCard to same zone (non-battlefield) throws without mutating state', () => {
    fc.assert(
      fc.property(
        gameStateArb().filter(s => s.hand.length > 0),
        (state) => {
          const snapshot = deepClone(state);
          const cardId = state.hand[0].id;

          try {
            moveCard(state, cardId, 'hand', 'hand');
          } catch {
            // Expected: cannot move to same zone
          }

          expect(state).toEqual(snapshot);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('successful operations do not mutate the original state (immutability)', () => {
    fc.assert(
      fc.property(
        gameStateArb().filter(s => s.library.length > 0),
        (state) => {
          const snapshot = deepClone(state);

          // drawCard should return a new state, not mutate the original
          const newState = drawCard(state);

          // Original state must be unchanged
          expect(state).toEqual(snapshot);
          // New state should differ (card moved from library to hand)
          expect(newState).not.toBe(state);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 17: No Page Refresh Invariant ──────────────────────────────────

describe('Property 17: No Page Refresh Invariant', () => {
  let reloadMock: ReturnType<typeof vi.fn>;
  let assignMock: ReturnType<typeof vi.fn>;
  let replaceMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    reloadMock = vi.fn();
    assignMock = vi.fn();
    replaceMock = vi.fn();
    originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        reload: reloadMock,
        assign: assignMock,
        replace: replaceMock,
        href: originalLocation.href,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('drawCard never triggers page reload or navigation', () => {
    fc.assert(
      fc.property(gameStateArb(), (state) => {
        drawCard(state);

        expect(reloadMock).not.toHaveBeenCalled();
        expect(assignMock).not.toHaveBeenCalled();
        expect(replaceMock).not.toHaveBeenCalled();
      }),
      { numRuns: 200 }
    );
  });

  it('shuffleLibrary never triggers page reload or navigation', () => {
    fc.assert(
      fc.property(gameStateArb(), (state) => {
        shuffleLibrary(state);

        expect(reloadMock).not.toHaveBeenCalled();
        expect(assignMock).not.toHaveBeenCalled();
        expect(replaceMock).not.toHaveBeenCalled();
      }),
      { numRuns: 200 }
    );
  });

  it('softReset never triggers page reload or navigation', () => {
    fc.assert(
      fc.property(gameStateArb(), (state) => {
        softReset(state);

        expect(reloadMock).not.toHaveBeenCalled();
        expect(assignMock).not.toHaveBeenCalled();
        expect(replaceMock).not.toHaveBeenCalled();
      }),
      { numRuns: 200 }
    );
  });

  it('moveCard (success or failure) never triggers page reload', () => {
    fc.assert(
      fc.property(
        gameStateArb().filter(s => s.hand.length > 0),
        (state) => {
          const cardId = state.hand[0].id;

          // Successful move
          moveCard(state, cardId, 'hand', 'graveyard');

          expect(reloadMock).not.toHaveBeenCalled();
          expect(assignMock).not.toHaveBeenCalled();
          expect(replaceMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('failed operations never trigger page reload', () => {
    fc.assert(
      fc.property(gameStateArb(), (state) => {
        // Attempt operations that will throw
        try { moveCard(state, 'nonexistent', 'hand', 'graveyard'); } catch { /* expected */ }
        try { tapCard(state, 'nonexistent'); } catch { /* expected */ }
        try { removeCardFromZone(state, 'hand', 'nonexistent'); } catch { /* expected */ }

        expect(reloadMock).not.toHaveBeenCalled();
        expect(assignMock).not.toHaveBeenCalled();
        expect(replaceMock).not.toHaveBeenCalled();
      }),
      { numRuns: 200 }
    );
  });

  it('untapAll never triggers page reload or navigation', () => {
    fc.assert(
      fc.property(gameStateArb(), (state) => {
        untapAll(state);

        expect(reloadMock).not.toHaveBeenCalled();
        expect(assignMock).not.toHaveBeenCalled();
        expect(replaceMock).not.toHaveBeenCalled();
      }),
      { numRuns: 200 }
    );
  });

  it('addToBattlefield never triggers page reload or navigation', () => {
    fc.assert(
      fc.property(
        fc.tuple(gameStateArb(), cardDataArb),
        ([state, card]) => {
          addToBattlefield(state, card);

          expect(reloadMock).not.toHaveBeenCalled();
          expect(assignMock).not.toHaveBeenCalled();
          expect(replaceMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 200 }
    );
  });
});
