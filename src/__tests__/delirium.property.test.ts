import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateDelirium } from '../components/PublicStack';
import type { CardData } from '../types';

/**
 * Property 24: Delirium Count Accuracy
 * - count equals unique MTG card types in graveyard, range 0-9
 * - Recognized types: creature, instant, sorcery, artifact, enchantment, planeswalker, land, tribal, battle
 * - A card with multiple types (e.g., "Artifact Creature") contributes to multiple type counts
 * - Empty graveyard → delirium = 0
 * - Graveyard with all 9 types → delirium = 9
 * - Adding a card with a new type increases delirium by 1
 * - Adding a card with an existing type does not change delirium
 *
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4**
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const DELIRIUM_TYPES = [
  'creature',
  'instant',
  'sorcery',
  'artifact',
  'enchantment',
  'planeswalker',
  'land',
  'tribal',
  'battle',
] as const;

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

/** Generates a single recognized delirium type */
const deliriumTypeArb: fc.Arbitrary<string> = fc.constantFrom(...DELIRIUM_TYPES);

/** Generates a non-empty subset of delirium types */
const deliriumTypeSubsetArb: fc.Arbitrary<string[]> = fc
  .subarray([...DELIRIUM_TYPES], { minLength: 1, maxLength: 9 })
  .filter((arr) => arr.length > 0);

/** Generates a type line from one or more delirium types */
const typeLineFromTypesArb = (types: string[]): string => {
  // Capitalize each type and join with space (e.g., "Artifact Creature")
  return types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
};

/** Generates a CardData with a specific type line */
function makeCard(id: string, typeLine: string): CardData {
  return {
    id,
    name: `Card ${id}`,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
    backFaceImageURI: null,
    typeLine,
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: null,
    baseToughness: null,
    cardType: 'other',
    isToken: false,
    isTokenCopy: false,
  };
}

/** Generates a CardData with a random type line containing 1-3 delirium types */
const cardWithTypesArb: fc.Arbitrary<CardData> = fc
  .tuple(
    fc.uuid(),
    fc.subarray([...DELIRIUM_TYPES], { minLength: 1, maxLength: 3 })
  )
  .map(([id, types]) => makeCard(id, typeLineFromTypesArb(types)));

/** Generates a graveyard of 0-20 cards with various type lines */
const graveyardArb: fc.Arbitrary<CardData[]> = fc.array(cardWithTypesArb, {
  minLength: 0,
  maxLength: 20,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 24: Delirium Count Accuracy', () => {
  it('delirium count equals the number of unique card types present in graveyard', () => {
    fc.assert(
      fc.property(graveyardArb, (graveyard: CardData[]) => {
        const result = calculateDelirium(graveyard);

        // Manually compute expected delirium
        const typesPresent = new Set<string>();
        for (const card of graveyard) {
          const typeLine = card.typeLine.toLowerCase();
          for (const type of DELIRIUM_TYPES) {
            if (typeLine.includes(type)) {
              typesPresent.add(type);
            }
          }
        }

        expect(result).toBe(typesPresent.size);
      }),
      { numRuns: 300 }
    );
  });

  it('delirium count is always in range [0, 9]', () => {
    fc.assert(
      fc.property(graveyardArb, (graveyard: CardData[]) => {
        const result = calculateDelirium(graveyard);

        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(9);
      }),
      { numRuns: 300 }
    );
  });

  it('empty graveyard produces delirium = 0', () => {
    const result = calculateDelirium([]);
    expect(result).toBe(0);
  });

  it('graveyard with all 9 types produces delirium = 9', () => {
    const graveyard = DELIRIUM_TYPES.map((type, i) =>
      makeCard(`card-${i}`, type.charAt(0).toUpperCase() + type.slice(1))
    );
    const result = calculateDelirium(graveyard);
    expect(result).toBe(9);
  });

  it('a card with multiple types contributes to multiple type counts', () => {
    fc.assert(
      fc.property(
        fc.subarray([...DELIRIUM_TYPES], { minLength: 2, maxLength: 4 }),
        (types: string[]) => {
          const typeLine = typeLineFromTypesArb(types);
          const graveyard = [makeCard('multi-type', typeLine)];
          const result = calculateDelirium(graveyard);

          // Each type in the type line should be counted
          expect(result).toBe(types.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('adding a card with a new type increases delirium by 1', () => {
    fc.assert(
      fc.property(
        deliriumTypeSubsetArb,
        deliriumTypeArb,
        (existingTypes: string[], newType: string) => {
          // Only test when newType is NOT already in existingTypes
          if (existingTypes.includes(newType)) return;

          // Build graveyard with existing types (one card per type)
          const graveyard = existingTypes.map((type, i) =>
            makeCard(`card-${i}`, type.charAt(0).toUpperCase() + type.slice(1))
          );

          const deliriumBefore = calculateDelirium(graveyard);

          // Add a card with the new type
          const newCard = makeCard(
            'new-card',
            newType.charAt(0).toUpperCase() + newType.slice(1)
          );
          const updatedGraveyard = [...graveyard, newCard];
          const deliriumAfter = calculateDelirium(updatedGraveyard);

          expect(deliriumAfter).toBe(deliriumBefore + 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('adding a card with an existing type does not change delirium', () => {
    fc.assert(
      fc.property(
        deliriumTypeSubsetArb,
        (existingTypes: string[]) => {
          // Build graveyard with existing types
          const graveyard = existingTypes.map((type, i) =>
            makeCard(`card-${i}`, type.charAt(0).toUpperCase() + type.slice(1))
          );

          const deliriumBefore = calculateDelirium(graveyard);

          // Add another card with one of the existing types
          const duplicateType = existingTypes[0];
          const newCard = makeCard(
            'duplicate-card',
            duplicateType.charAt(0).toUpperCase() + duplicateType.slice(1)
          );
          const updatedGraveyard = [...graveyard, newCard];
          const deliriumAfter = calculateDelirium(updatedGraveyard);

          expect(deliriumAfter).toBe(deliriumBefore);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('delirium is case-insensitive for type line matching', () => {
    fc.assert(
      fc.property(
        deliriumTypeArb,
        fc.constantFrom('upper', 'lower', 'mixed'),
        (type: string, caseStyle: string) => {
          let typeLine: string;
          switch (caseStyle) {
            case 'upper':
              typeLine = type.toUpperCase();
              break;
            case 'lower':
              typeLine = type.toLowerCase();
              break;
            case 'mixed':
              typeLine = type.charAt(0).toUpperCase() + type.slice(1);
              break;
            default:
              typeLine = type;
          }

          const graveyard = [makeCard('case-card', typeLine)];
          const result = calculateDelirium(graveyard);

          expect(result).toBe(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('only recognized types contribute to delirium (unrecognized types ignored)', () => {
    const unrecognizedTypes = ['Token', 'Legendary', 'Snow', 'World', 'Kindred'];
    for (const typeLine of unrecognizedTypes) {
      const graveyard = [makeCard('unknown-type', typeLine)];
      const result = calculateDelirium(graveyard);
      expect(result).toBe(0);
    }
  });
});
