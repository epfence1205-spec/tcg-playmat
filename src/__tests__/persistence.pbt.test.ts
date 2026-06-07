import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  patchCardData,
  loadGameState,
  STORAGE_KEY,
} from '../persistence';
import type { CardData, CardType, KeywordAbility } from '../types';

/**
 * Property 10: Backward compatibility
 * CardData without `landCategory` deserializes with `landCategory === null`.
 *
 * **Validates: Requirements 6.1, 6.2**
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

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

/**
 * Generates a CardData-like object WITHOUT `landCategory`,
 * simulating persisted data from before this feature was added.
 */
const legacyCardDataArb: fc.Arbitrary<Omit<CardData, 'landCategory'>> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  setCode: fc.stringMatching(/^[a-z0-9]{3,5}$/),
  collectorNumber: fc.stringMatching(/^[0-9]{1,4}$/),
  imageURI: fc.constant('https://cards.scryfall.io/normal/front/a/b/ab.jpg'),
  imageURILarge: fc.constant('https://cards.scryfall.io/large/front/a/b/ab.jpg'),
  backFaceImageURI: fc.option(
    fc.constant('https://cards.scryfall.io/normal/back/a/b/ab.jpg'),
    { nil: null }
  ),
  backFaceCardType: fc.option(cardTypeArb, { nil: null }),
  backFaceName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  backFacePower: fc.option(fc.stringMatching(/^[0-9*]{1,2}$/), { nil: null }),
  backFaceToughness: fc.option(fc.stringMatching(/^[0-9*]{1,2}$/), { nil: null }),
  typeLine: fc.string({ minLength: 1, maxLength: 40 }),
  oracleText: fc.string({ minLength: 0, maxLength: 100 }),
  isCommander: fc.boolean(),
  keywords: fc.array(keywordAbilityArb, { minLength: 0, maxLength: 4 }),
  basePower: fc.option(fc.stringMatching(/^[0-9*]{1,2}$/), { nil: null }),
  baseToughness: fc.option(fc.stringMatching(/^[0-9*]{1,2}$/), { nil: null }),
  cardType: cardTypeArb,
  cmc: fc.nat({ max: 16 }),
  manaCost: fc.string({ minLength: 0, maxLength: 20 }),
  colorIdentity: fc.array(fc.constantFrom('W', 'U', 'B', 'R', 'G'), { minLength: 0, maxLength: 5 }),
  producedMana: fc.array(fc.constantFrom('W', 'U', 'B', 'R', 'G', 'C'), { minLength: 0, maxLength: 6 }),
  isToken: fc.boolean(),
  isTokenCopy: fc.boolean(),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 10: Backward compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('patchCardData defaults missing landCategory to null', () => {
    fc.assert(
      fc.property(legacyCardDataArb, (legacyCard) => {
        // Cast to CardData without landCategory (simulates old persisted data)
        const patched = patchCardData(legacyCard as unknown as CardData);

        expect(patched.landCategory).toBe(null);
        // Verify all original fields are preserved
        expect(patched.id).toBe(legacyCard.id);
        expect(patched.name).toBe(legacyCard.name);
        expect(patched.cardType).toBe(legacyCard.cardType);
      }),
      { numRuns: 100 }
    );
  });

  it('patchCardData preserves existing landCategory when present', () => {
    const landCategoryArb = fc.constantFrom(
      'basic', 'dual', 'shockland', 'fetchland', 'checkland',
      'tangoland', 'fastland', 'slowland', 'bondland', 'painland',
      'filterland', 'bounceland', 'canopyland', 'shadowland', 'scryland',
      'gainland', 'surveilland', 'storageland', 'bikeland', 'tricycleland',
      'triland', 'creatureland', 'pathway', 'rainbow', 'utility', 'unknown'
    );

    fc.assert(
      fc.property(legacyCardDataArb, landCategoryArb, (legacyCard, category) => {
        const cardWithCategory = { ...legacyCard, landCategory: category } as unknown as CardData;
        const patched = patchCardData(cardWithCategory);

        expect(patched.landCategory).toBe(category);
      }),
      { numRuns: 100 }
    );
  });

  it('full deserialization pipeline patches legacy CardData in all zones', () => {
    fc.assert(
      fc.property(
        fc.array(legacyCardDataArb, { minLength: 1, maxLength: 5 }),
        (legacyCards) => {
          // Build a minimal valid serialized game state with legacy cards (no landCategory)
          const serializedState = {
            gamePhase: 'PLAYING',
            creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
            row3: { left: [], right: [] },
            row4: { left: [], right: [] },
            hand: legacyCards,
            commandZone: [],
            graveyard: legacyCards.slice(0, 2),
            library: legacyCards.slice(0, 3),
            exile: [],
            mulliganState: null,
            deckLoaded: true,
            lifeTotal: 40,
          };

          localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedState));
          const loaded = loadGameState();

          // Every card in hand should have landCategory === null
          for (const card of loaded.hand) {
            expect(card.landCategory).toBe(null);
          }
          // Every card in graveyard should have landCategory === null
          for (const card of loaded.graveyard) {
            expect(card.landCategory).toBe(null);
          }
          // Every card in library should have landCategory === null
          for (const card of loaded.library) {
            expect(card.landCategory).toBe(null);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
