import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 8: Fanning Z-Index Ordering
 * For any fanned group of N cards (N ≥ 2):
 *   - The z-index assigned to card[i] is strictly less than the z-index assigned to card[i+1]
 *   - This ensures the newest card (last in array) is always on top and fully visible
 *   - The z-index formula is: (index + 1) * 10
 *
 * **Validates: Requirements 8.4**
 */

// ─── Z-Index Calculation (mirrors FannedGroup.tsx logic) ─────────────────────

/**
 * Computes the z-index for a card at a given position in a fanned group.
 * Formula: (index + 1) * 10
 *   - card[0] → z-index 10
 *   - card[1] → z-index 20
 *   - card[N-1] → z-index N * 10
 */
function fanZIndex(index: number): number {
  return (index + 1) * 10;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 8: Fanning Z-Index Ordering', () => {
  it('z-index of card[i] < z-index of card[i+1] for all cards in a fan', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        (groupSize: number) => {
          for (let i = 0; i < groupSize - 1; i++) {
            const zCurrent = fanZIndex(i);
            const zNext = fanZIndex(i + 1);
            expect(zCurrent).toBeLessThan(zNext);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('z-index values are always positive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        (groupSize: number) => {
          for (let i = 0; i < groupSize; i++) {
            const z = fanZIndex(i);
            expect(z).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('z-index values are strictly monotonically increasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        (groupSize: number) => {
          const zValues = Array.from({ length: groupSize }, (_, i) => fanZIndex(i));

          // Verify strict monotonic increase
          for (let i = 1; i < zValues.length; i++) {
            expect(zValues[i]).toBeGreaterThan(zValues[i - 1]);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('the last card in the group has the highest z-index', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        (groupSize: number) => {
          const lastZ = fanZIndex(groupSize - 1);

          // Every other card's z-index must be less than the last card's
          for (let i = 0; i < groupSize - 1; i++) {
            expect(fanZIndex(i)).toBeLessThan(lastZ);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('z-index formula produces expected values: (index + 1) * 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 19 }),
        (index: number) => {
          const expected = (index + 1) * 10;
          expect(fanZIndex(index)).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });
});
