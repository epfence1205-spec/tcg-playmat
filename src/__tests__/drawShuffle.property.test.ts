import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { drawCard, shuffleLibrary } from '../gameActions';
import type { CardData, GameState, CardType, KeywordAbility } from '../types';

/**
 * Property 18: Draw Correctness
 * - draw moves top card to hand, lengths change by 1
 * - empty library is no-op
 *
 * Property 19: Shuffle Preservation
 * - shuffle produces permutation of same cards, no cards added/removed
 *
 * **Validates: Requirements 28.1, 28.2, 28.3, 28.4**
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
    fc.string({ minLength: 1, maxLength: 30 }),
    fc.stringMatching(/^[a-z0-9]{3,5}$/),
    fc.stringMatching(/^[0-9]{1,4}$/),
    fc.constant('https://cards.scryfall.io/normal/front/a/b/test.jpg'),
    fc.constant('https://cards.scryfall.io/large/front/a/b/test.jpg'),
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 40 }),
    fc.string({ minLength: 0, maxLength: 100 }),
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

/** Generates a library of CardData with various sizes */
const libraryArb = (minSize: number, maxSize: number): fc.Arbitrary<CardData[]> =>
  fc.array(cardDataArb, { minLength: minSize, maxLength: maxSize });

/** Generates a minimal valid GameState with a given library and hand */
function gameStateArb(libMin: number, libMax: number): fc.Arbitrary<GameState> {
  return fc.tuple(
    libraryArb(libMin, libMax),
    fc.array(cardDataArb, { minLength: 0, maxLength: 5 })
  ).map(([library, hand]) => ({
    gamePhase: 'PLAYING' as const,
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row4: { left: [], right: [] },
    row5: { left: [], right: [] },
    hand,
    commandZone: [],
    graveyard: [],
    library,
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
  }));
}

// ─── Property 18: Draw Correctness ──────────────────────────────────────────

describe('Property 18: Draw Correctness', () => {
  it('drawCard increases hand length by 1 when library is non-empty', () => {
    fc.assert(
      fc.property(gameStateArb(1, 60), (state) => {
        const result = drawCard(state);
        expect(result.hand.length).toBe(state.hand.length + 1);
      }),
      { numRuns: 200 }
    );
  });

  it('drawCard decreases library length by 1 when library is non-empty', () => {
    fc.assert(
      fc.property(gameStateArb(1, 60), (state) => {
        const result = drawCard(state);
        expect(result.library.length).toBe(state.library.length - 1);
      }),
      { numRuns: 200 }
    );
  });

  it('the drawn card is the former top of library (library[0])', () => {
    fc.assert(
      fc.property(gameStateArb(1, 60), (state) => {
        const topCard = state.library[0];
        const result = drawCard(state);
        // The last card in the new hand should be the former top of library
        const drawnCard = result.hand[result.hand.length - 1];
        expect(drawnCard.id).toBe(topCard.id);
        expect(drawnCard.name).toBe(topCard.name);
      }),
      { numRuns: 200 }
    );
  });

  it('drawCard on empty library is a no-op (state unchanged)', () => {
    fc.assert(
      fc.property(gameStateArb(0, 0), (state) => {
        const result = drawCard(state);
        // State reference should be identical (no-op returns same object)
        expect(result).toBe(state);
        expect(result.hand.length).toBe(state.hand.length);
        expect(result.library.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('total cards across hand + library is preserved after draw', () => {
    fc.assert(
      fc.property(gameStateArb(0, 60), (state) => {
        const totalBefore = state.hand.length + state.library.length;
        const result = drawCard(state);
        const totalAfter = result.hand.length + result.library.length;
        expect(totalAfter).toBe(totalBefore);
      }),
      { numRuns: 200 }
    );
  });
});

// ─── Property 19: Shuffle Preservation ───────────────────────────────────────

describe('Property 19: Shuffle Preservation', () => {
  it('shuffleLibrary preserves library length', () => {
    fc.assert(
      fc.property(gameStateArb(0, 60), (state) => {
        const result = shuffleLibrary(state);
        expect(result.library.length).toBe(state.library.length);
      }),
      { numRuns: 200 }
    );
  });

  it('shuffleLibrary contains the same card IDs (multiset equality)', () => {
    fc.assert(
      fc.property(gameStateArb(0, 60), (state) => {
        const result = shuffleLibrary(state);
        const originalIds = state.library.map(c => c.id).sort();
        const shuffledIds = result.library.map(c => c.id).sort();
        expect(shuffledIds).toEqual(originalIds);
      }),
      { numRuns: 200 }
    );
  });

  it('shuffleLibrary does not add or remove any cards', () => {
    fc.assert(
      fc.property(gameStateArb(0, 60), (state) => {
        const result = shuffleLibrary(state);
        // No cards added: every card in shuffled exists in original
        for (const card of result.library) {
          const existsInOriginal = state.library.some(c => c.id === card.id);
          expect(existsInOriginal).toBe(true);
        }
        // No cards removed: every card in original exists in shuffled
        for (const card of state.library) {
          const existsInShuffled = result.library.some(c => c.id === card.id);
          expect(existsInShuffled).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('shuffleLibrary does not modify hand or other zones', () => {
    fc.assert(
      fc.property(gameStateArb(0, 60), (state) => {
        const result = shuffleLibrary(state);
        expect(result.hand).toEqual(state.hand);
        expect(result.graveyard).toEqual(state.graveyard);
        expect(result.commandZone).toEqual(state.commandZone);
        expect(result.exile).toEqual(state.exile);
      }),
      { numRuns: 200 }
    );
  });
});
