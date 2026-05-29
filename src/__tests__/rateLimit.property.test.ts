import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { resolveCards } from '../api/scryfallResolver';

/**
 * Property 15: Rate Limit Compliance
 * - Time between consecutive requests ≥ 50ms
 * - Batch size ≤ 75
 * - First batch fires immediately (no pre-delay)
 *
 * **Validates: Requirements 21.1, 21.2**
 */

describe('Property 15: Rate Limit Compliance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Property 15a: For any number of cards N (1-300), each batch has at most 75 identifiers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 300 }),
        async (cardCount) => {
          const names = Array.from({ length: cardCount }, (_, i) => `Card ${i}`);
          const batchSizes: number[] = [];

          const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            const body = JSON.parse(init!.body as string);
            batchSizes.push(body.identifiers.length);
            return {
              ok: true,
              json: async () => ({ data: [], not_found: [] }),
            } as Response;
          });

          const resultPromise = resolveCards(names);
          await vi.runAllTimersAsync();
          await resultPromise;

          // Every batch must have at most 75 identifiers
          for (const size of batchSizes) {
            expect(size).toBeLessThanOrEqual(75);
            expect(size).toBeGreaterThan(0);
          }

          // Total identifiers across all batches must equal input count
          const totalSent = batchSizes.reduce((sum, s) => sum + s, 0);
          expect(totalSent).toBe(cardCount);

          fetchSpy.mockRestore();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 15b: For any number of cards requiring multiple batches, time between consecutive fetch calls is ≥ 50ms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 76, max: 300 }),
        async (cardCount) => {
          const names = Array.from({ length: cardCount }, (_, i) => `Card ${i}`);
          const callTimestamps: number[] = [];

          const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            callTimestamps.push(Date.now());
            return {
              ok: true,
              json: async () => ({ data: [], not_found: [] }),
            } as Response;
          });

          const resultPromise = resolveCards(names);
          await vi.runAllTimersAsync();
          await resultPromise;

          // Must have more than 1 batch since cardCount > 75
          expect(callTimestamps.length).toBeGreaterThan(1);

          // For all consecutive pairs, the gap must be ≥ 50ms
          for (let i = 1; i < callTimestamps.length; i++) {
            const gap = callTimestamps[i] - callTimestamps[i - 1];
            expect(gap).toBeGreaterThanOrEqual(50);
          }

          fetchSpy.mockRestore();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 15c: The first batch request fires immediately (no pre-delay)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 300 }),
        async (cardCount) => {
          const names = Array.from({ length: cardCount }, (_, i) => `Card ${i}`);
          const startTime = Date.now();
          let firstCallTime: number | null = null;

          const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
            if (firstCallTime === null) {
              firstCallTime = Date.now();
            }
            return {
              ok: true,
              json: async () => ({ data: [], not_found: [] }),
            } as Response;
          });

          const resultPromise = resolveCards(names);
          await vi.runAllTimersAsync();
          await resultPromise;

          // First request should fire immediately — no 50ms pre-delay
          expect(firstCallTime).not.toBeNull();
          expect(firstCallTime! - startTime).toBeLessThan(50);

          fetchSpy.mockRestore();
        }
      ),
      { numRuns: 50 }
    );
  });
});
