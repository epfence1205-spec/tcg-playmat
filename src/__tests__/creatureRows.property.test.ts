import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CardData, RowCard, CreatureArea } from '../types';
import { recalculateCreatureRows, countIndependentElements } from '../creatureRows';

/**
 * Property 6: Creature Row Capacity
 * For any creature area with N independent elements:
 *   - N ≤ 14 → recalculateCreatureRows produces exactly 1 row
 *   - 14 < N ≤ 28 → produces exactly 2 rows
 *   - N > 28 → still exactly 2 rows (overlap with banners handles overflow)
 *
 * Property 7: Fanned Group Invariant
 * For any set of RowCards where some share the same name:
 *   - countIndependentElements counts each unique name exactly once
 *   - A group of K cards with the same name counts as 1 element (not K)
 *
 * **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 8.1, 8.5, 8.6**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

/** Generates a valid CardData with a given name */
function cardDataWithName(name: string, id: string): CardData {
  return {
    id,
    name,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
    backFaceImageURI: null,
    typeLine: 'Creature — Test',
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

/** Creates a RowCard from a name and id */
function makeRowCard(name: string, id: string): RowCard {
  const card = cardDataWithName(name, id);
  return {
    card,
    instanceId: card.id,
    rowAssignment: 'creature-1',
    positionIndex: 0,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters: [],
    isRevealed: false,
  };
}

/**
 * Generates a list of RowCards with exactly `uniqueCount` unique names.
 * Each unique name may have 1 or more copies (fanned group).
 */
function rowCardsWithUniqueNames(uniqueCount: number): fc.Arbitrary<RowCard[]> {
  if (uniqueCount === 0) return fc.constant([]);

  // For each unique name, generate 1-4 copies
  return fc
    .array(fc.integer({ min: 1, max: 4 }), {
      minLength: uniqueCount,
      maxLength: uniqueCount,
    })
    .map((copyCounts) => {
      const cards: RowCard[] = [];
      for (let nameIdx = 0; nameIdx < uniqueCount; nameIdx++) {
        const name = `Card_${nameIdx}`;
        const copies = copyCounts[nameIdx];
        for (let copyIdx = 0; copyIdx < copies; copyIdx++) {
          cards.push(makeRowCard(name, `id-${nameIdx}-${copyIdx}`));
        }
      }
      return cards;
    });
}

/**
 * Generates a CreatureArea with a controlled number of unique element names.
 * All elements are placed in a single row initially.
 */
function creatureAreaWithElements(uniqueCount: number): fc.Arbitrary<CreatureArea> {
  return rowCardsWithUniqueNames(uniqueCount).map((elements) => ({
    rows: [{ id: 'creature-1', elements }],
    totalElementCount: 0,
  }));
}

/**
 * Generates a set of RowCards with controlled name distributions.
 * Returns both the cards and the expected unique name count.
 */
const rowCardsWithKnownGrouping: fc.Arbitrary<{
  cards: RowCard[];
  uniqueNames: number;
  totalCards: number;
}> = fc
  .integer({ min: 1, max: 30 })
  .chain((uniqueCount) =>
    fc
      .array(fc.integer({ min: 1, max: 5 }), {
        minLength: uniqueCount,
        maxLength: uniqueCount,
      })
      .map((copyCounts) => {
        const cards: RowCard[] = [];
        for (let nameIdx = 0; nameIdx < uniqueCount; nameIdx++) {
          const name = `GroupCard_${nameIdx}`;
          const copies = copyCounts[nameIdx];
          for (let copyIdx = 0; copyIdx < copies; copyIdx++) {
            cards.push(makeRowCard(name, `grp-${nameIdx}-${copyIdx}`));
          }
        }
        return {
          cards,
          uniqueNames: uniqueCount,
          totalCards: cards.length,
        };
      })
  );

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 6: Creature Row Capacity', () => {
  // Wide container must handle up to 14 names × 5 copies = 70 cards at 16vh * 10.8 ≈ 12400px
  const WIDE = 13000;
  const NARROW = 2000;
  const VH = 10.8;
  const GAP = 4;

  it('N ≤ 14 independent elements → exactly 1 row (wide container)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 14 }).chain((n) => creatureAreaWithElements(n)),
        (area: CreatureArea) => {
          const result = recalculateCreatureRows(area, WIDE, VH, GAP);
          expect(result.rows.length).toBe(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('14 < N ≤ 28 independent elements → exactly 2 rows (narrow container)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 15, max: 28 }).chain((n) => creatureAreaWithElements(n)),
        (area: CreatureArea) => {
          const result = recalculateCreatureRows(area, NARROW, VH, GAP);
          expect(result.rows.length).toBe(2);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('N > 28 independent elements → still exactly 2 rows (overlap handles overflow)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 29, max: 40 }).chain((n) => creatureAreaWithElements(n)),
        (area: CreatureArea) => {
          const result = recalculateCreatureRows(area, NARROW, VH, GAP);
          expect(result.rows.length).toBe(2);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('totalElementCount matches the independent element count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 35 }).chain((n) => creatureAreaWithElements(n)),
        (area: CreatureArea) => {
          const allElements = area.rows.flatMap((r) => r.elements);
          const expectedCount = countIndependentElements(allElements);
          const result = recalculateCreatureRows(area, WIDE, VH, GAP);
          expect(result.totalElementCount).toBe(expectedCount);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('row count never exceeds 2 regardless of element count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }).chain((n) => creatureAreaWithElements(n)),
        (area: CreatureArea) => {
          const result = recalculateCreatureRows(area, NARROW, VH, GAP);
          expect(result.rows.length).toBeGreaterThanOrEqual(1);
          expect(result.rows.length).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property 7: Fanned Group Invariant', () => {
  it('countIndependentElements counts each unique name exactly once', () => {
    fc.assert(
      fc.property(rowCardsWithKnownGrouping, ({ cards, uniqueNames }) => {
        const result = countIndependentElements(cards);
        expect(result).toBe(uniqueNames);
      }),
      { numRuns: 200 }
    );
  });

  it('a group of K cards with the same name counts as 1 element, not K', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (groupSize: number) => {
          // Create K cards all with the same name
          const cards: RowCard[] = [];
          for (let i = 0; i < groupSize; i++) {
            cards.push(makeRowCard('SameName', `same-${i}`));
          }
          const result = countIndependentElements(cards);
          expect(result).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fanned groups do not inflate row count thresholds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 14 }).chain((uniqueCount) =>
          fc
            .array(fc.integer({ min: 1, max: 10 }), {
              minLength: uniqueCount,
              maxLength: uniqueCount,
            })
            .map((copyCounts) => {
              const cards: RowCard[] = [];
              for (let nameIdx = 0; nameIdx < uniqueCount; nameIdx++) {
                const name = `Fan_${nameIdx}`;
                for (let copyIdx = 0; copyIdx < copyCounts[nameIdx]; copyIdx++) {
                  cards.push(makeRowCard(name, `fan-${nameIdx}-${copyIdx}`));
                }
              }
              return { cards, uniqueCount };
            })
        ),
        ({ cards, uniqueCount }) => {
          // Max 14 names × 10 copies = 140 cards. Use wide container that fits all.
          const area: CreatureArea = {
            rows: [{ id: 'creature-1', elements: cards }],
            totalElementCount: 0,
          };
          const result = recalculateCreatureRows(area, 25000, 10.8, 4);
          expect(result.rows.length).toBe(1);
          expect(result.totalElementCount).toBe(uniqueCount);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('only cards with identical names form a group (not by type or other attribute)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        (count: number) => {
          // Create cards with all different names — each should count independently
          const cards: RowCard[] = [];
          for (let i = 0; i < count; i++) {
            cards.push(makeRowCard(`Unique_${i}`, `uniq-${i}`));
          }
          const result = countIndependentElements(cards);
          expect(result).toBe(count);
        }
      ),
      { numRuns: 100 }
    );
  });
});
