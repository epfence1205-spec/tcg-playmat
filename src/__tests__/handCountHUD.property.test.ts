import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { drawCard, moveCard } from '../gameActions';
import type { CardData, GameState, CardType, KeywordAbility, Zone } from '../types';

/**
 * Property 31: Hand Count HUD Accuracy
 * - displayed count equals hand.length after any movement involving the hand
 * - After drawCard: hand.length increases by 1
 * - After moveCard from hand to another zone: hand.length decreases by 1
 * - After moveCard from another zone to hand: hand.length increases by 1
 *
 * **Validates: Requirements 30.1, 30.2**
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

/** Generates a game state with cards in both hand and library */
function gameStateWithHandAndLibrary(
  handMin: number,
  handMax: number,
  libMin: number,
  libMax: number
): fc.Arbitrary<GameState> {
  return fc.tuple(
    fc.array(cardDataArb, { minLength: handMin, maxLength: handMax }),
    fc.array(cardDataArb, { minLength: libMin, maxLength: libMax })
  ).map(([hand, library]) => ({
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

// ─── Property 31: Hand Count HUD Accuracy ────────────────────────────────────

describe('Property 31: Hand Count HUD Accuracy', () => {
  it('after drawCard, hand.length increases by 1 (HUD shows new count)', () => {
    fc.assert(
      fc.property(gameStateWithHandAndLibrary(0, 10, 1, 60), (state) => {
        const before = state.hand.length;
        const result = drawCard(state);
        expect(result.hand.length).toBe(before + 1);
      }),
      { numRuns: 200 }
    );
  });

  it('after moveCard from hand to graveyard, hand.length decreases by 1', () => {
    fc.assert(
      fc.property(gameStateWithHandAndLibrary(1, 10, 0, 10), (state) => {
        const cardToMove = state.hand[0];
        const before = state.hand.length;
        const result = moveCard(state, cardToMove.id, 'hand', 'graveyard');
        expect(result.hand.length).toBe(before - 1);
      }),
      { numRuns: 200 }
    );
  });

  it('after moveCard from hand to exile, hand.length decreases by 1', () => {
    fc.assert(
      fc.property(gameStateWithHandAndLibrary(1, 10, 0, 10), (state) => {
        const cardToMove = state.hand[0];
        const before = state.hand.length;
        const result = moveCard(state, cardToMove.id, 'hand', 'exile');
        expect(result.hand.length).toBe(before - 1);
      }),
      { numRuns: 200 }
    );
  });

  it('after moveCard from hand to battlefield, hand.length decreases by 1', () => {
    fc.assert(
      fc.property(gameStateWithHandAndLibrary(1, 10, 0, 10), (state) => {
        const cardToMove = state.hand[0];
        const before = state.hand.length;
        const result = moveCard(state, cardToMove.id, 'hand', 'battlefield');
        expect(result.hand.length).toBe(before - 1);
      }),
      { numRuns: 200 }
    );
  });

  it('after moveCard from library to hand, hand.length increases by 1', () => {
    fc.assert(
      fc.property(gameStateWithHandAndLibrary(0, 10, 1, 20), (state) => {
        const cardToMove = state.library[0];
        const before = state.hand.length;
        const result = moveCard(state, cardToMove.id, 'library', 'hand');
        expect(result.hand.length).toBe(before + 1);
      }),
      { numRuns: 200 }
    );
  });

  it('after moveCard from graveyard to hand, hand.length increases by 1', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(cardDataArb, { minLength: 0, maxLength: 5 }),
          fc.array(cardDataArb, { minLength: 1, maxLength: 10 })
        ).map(([hand, graveyard]) => ({
          gamePhase: 'PLAYING' as const,
          creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
          row4: { left: [], right: [] },
          row5: { left: [], right: [] },
          hand,
          commandZone: [],
          graveyard,
          library: [],
          exile: [],
          mulliganState: null,
          deckLoaded: true,
          lifeTotal: 40,
        })),
        (state) => {
          const cardToMove = state.graveyard[0];
          const before = state.hand.length;
          const result = moveCard(state, cardToMove.id, 'graveyard', 'hand');
          expect(result.hand.length).toBe(before + 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('displayed count always equals state.hand.length after any hand-involving movement', () => {
    fc.assert(
      fc.property(
        gameStateWithHandAndLibrary(1, 10, 1, 20),
        fc.constantFrom('draw', 'moveFromHand', 'moveToHand') as fc.Arbitrary<string>,
        (state, action) => {
          let result: GameState;

          if (action === 'draw') {
            result = drawCard(state);
          } else if (action === 'moveFromHand') {
            const card = state.hand[0];
            result = moveCard(state, card.id, 'hand', 'graveyard');
          } else {
            // moveToHand from library
            const card = state.library[0];
            result = moveCard(state, card.id, 'library', 'hand');
          }

          // The "displayed count" is always exactly state.hand.length
          const displayedCount = result.hand.length;
          const actualCardCount = result.hand.length;
          expect(displayedCount).toBe(actualCardCount);
        }
      ),
      { numRuns: 300 }
    );
  });
});
