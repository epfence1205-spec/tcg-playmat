import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getManaGroupKey,
  findColorGroupInsertionIndex,
  insertLandSorted,
} from '../gameActions';
import type { CardData, RowCard } from '../types';

/**
 * Property tests for land grouping (Properties 6, 7, 8)
 *
 * Strategy:
 * 1. Generate a sequence of lands with varying producedMana arrays
 * 2. Simulate inserting them one by one using findColorGroupInsertionIndex
 * 3. After all insertions, verify the three properties hold on the final array
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WUBRG = ['W', 'U', 'B', 'R', 'G'] as const;

/**
 * Creates a minimal CardData mock sufficient for land grouping tests.
 */
function makeLandCardData(producedMana: string[], index: number): CardData {
  return {
    id: `land-${index}-${producedMana.join('')}`,
    name: `Test Land ${index}`,
    setCode: 'tst',
    collectorNumber: `${index}`,
    imageURI: 'https://example.com/img.jpg',
    imageURILarge: 'https://example.com/img-large.jpg',
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: 'Land',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: null,
    baseToughness: null,
    cardType: 'land',
    cmc: 0,
    manaCost: '',
    colorIdentity: producedMana.filter(c => 'WUBRG'.includes(c)),
    producedMana,
    landCategory: 'basic',
    isToken: false,
    isTokenCopy: false,
  };
}

/**
 * Simulates inserting a sequence of lands one by one using insertLandSorted.
 * Returns the final row array.
 */
function simulateInsertions(landManaArrays: string[][]): RowCard[] {
  let lands: RowCard[] = [];

  for (let i = 0; i < landManaArrays.length; i++) {
    const producedMana = landManaArrays[i];
    const card = makeLandCardData(producedMana, i);
    lands = insertLandSorted(lands, card);
  }

  return lands;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a producedMana array for a single land:
 * - 1-4 colors from WUBRG (non-rainbow groups)
 * - Exactly 5 colors (rainbow)
 * - Empty array (colorless)
 */
const producedManaArb: fc.Arbitrary<string[]> = fc.oneof(
  // Single color
  fc.subarray([...WUBRG], { minLength: 1, maxLength: 1 }),
  // Two colors
  fc.subarray([...WUBRG], { minLength: 2, maxLength: 2 }),
  // Three colors
  fc.subarray([...WUBRG], { minLength: 3, maxLength: 3 }),
  // Four colors
  fc.subarray([...WUBRG], { minLength: 4, maxLength: 4 }),
  // Rainbow (all 5)
  fc.constant([...WUBRG] as string[]),
  // Colorless
  fc.constant([] as string[])
);

/**
 * Generates a sequence of land producedMana arrays (3-20 lands).
 */
const landSequenceArb: fc.Arbitrary<string[][]> = fc.array(producedManaArb, {
  minLength: 3,
  maxLength: 20,
});

// ─── Property 6: Color-group adjacency ──────────────────────────────────────

describe('Property 6: Color-group adjacency', () => {
  it('all lands with same group key are adjacent after arbitrary insertions', () => {
    fc.assert(
      fc.property(landSequenceArb, (landManas) => {
        const lands = simulateInsertions(landManas);

        // Extract group keys in order
        const keys = lands.map(rc => getManaGroupKey(rc.card.producedMana));

        // For each unique group key, verify all occurrences are contiguous
        const seen = new Set<string>();
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (seen.has(key)) {
            // If we've seen this key before, the previous element must have the same key
            expect(keys[i - 1]).toBe(key);
          }
          seen.add(key);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: Rainbow endpoint ───────────────────────────────────────────

describe('Property 7: Rainbow endpoint', () => {
  it('rainbow lands are contiguously at the rightmost end', () => {
    fc.assert(
      fc.property(landSequenceArb, (landManas) => {
        const lands = simulateInsertions(landManas);

        const keys = lands.map(rc => getManaGroupKey(rc.card.producedMana));
        const firstRainbowIdx = keys.indexOf('rainbow');

        if (firstRainbowIdx === -1) {
          // No rainbow lands — property trivially holds
          return;
        }

        // All elements from firstRainbowIdx onward must be rainbow
        for (let i = firstRainbowIdx; i < keys.length; i++) {
          expect(keys[i]).toBe('rainbow');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 8: Stable insertion ───────────────────────────────────────────

describe('Property 8: Stable insertion', () => {
  it('unrelated groups maintain relative order after insertion', () => {
    fc.assert(
      fc.property(landSequenceArb, producedManaArb, (landManas, newLandMana) => {
        // Build the initial row from the sequence
        const landsBefore = simulateInsertions(landManas);

        // Record relative order of groups unrelated to the new land's group
        const newKey = getManaGroupKey(newLandMana);

        // Get the ordered list of group keys (preserving first occurrence order) excluding newKey
        const groupOrderBefore: string[] = [];
        const seenBefore = new Set<string>();
        for (const rc of landsBefore) {
          const k = getManaGroupKey(rc.card.producedMana);
          if (k !== newKey && !seenBefore.has(k)) {
            groupOrderBefore.push(k);
            seenBefore.add(k);
          }
        }

        // Now insert the new land using insertLandSorted
        const newCard = makeLandCardData(newLandMana, 999);
        const landsAfter = insertLandSorted(landsBefore, newCard);

        // Get group order after insertion (excluding newKey)
        const groupOrderAfter: string[] = [];
        const seenAfter = new Set<string>();
        for (const rc of landsAfter) {
          const k = getManaGroupKey(rc.card.producedMana);
          if (k !== newKey && !seenAfter.has(k)) {
            groupOrderAfter.push(k);
            seenAfter.add(k);
          }
        }

        // Relative order of unrelated groups must be preserved
        expect(groupOrderAfter).toEqual(groupOrderBefore);
      }),
      { numRuns: 100 }
    );
  });
});
