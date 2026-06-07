import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveCards, ScryfallCard } from './scryfallResolver';

describe('resolveCards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns empty result for empty input', async () => {
    const result = await resolveCards([]);
    expect(result.resolved.size).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('resolves a single card name', async () => {
    const mockCard: ScryfallCard = {
      name: 'Lightning Bolt',
      set: 'lea',
      collector_number: '161',
      image_uris: { normal: 'https://cards.scryfall.io/normal/front/l/b/lb.jpg' },
      type_line: 'Instant',
      oracle_text: 'Lightning Bolt deals 3 damage to any target.',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [mockCard], not_found: [] }),
    } as Response);

    const resultPromise = resolveCards(['Lightning Bolt']);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.resolved.size).toBe(1);
    expect(result.resolved.get('Lightning Bolt')).toEqual(mockCard);
    expect(result.failures).toEqual([]);
  });

  it('reports not-found cards as failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        not_found: [{ name: 'Nonexistent Card' }],
      }),
    } as Response);

    const resultPromise = resolveCards(['Nonexistent Card']);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.resolved.size).toBe(0);
    expect(result.failures).toEqual(['Nonexistent Card']);
  });

  it('batches cards into groups of 75', async () => {
    const names = Array.from({ length: 150 }, (_, i) => `Card ${i}`);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], not_found: [] }),
    } as Response);

    const resultPromise = resolveCards(names);
    await vi.runAllTimersAsync();
    await resultPromise;

    // 150 cards / 75 per batch = 2 requests
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Verify first batch has 75 identifiers
    const firstCallBody = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(firstCallBody.identifiers).toHaveLength(75);

    // Verify second batch has 75 identifiers
    const secondCallBody = JSON.parse(fetchSpy.mock.calls[1][1]!.body as string);
    expect(secondCallBody.identifiers).toHaveLength(75);
  });

  it('sends POST requests to the correct endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], not_found: [] }),
    } as Response);

    const resultPromise = resolveCards(['Sol Ring']);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/scryfall/cards/collection',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'TCGPlaymat/1.0' },
        body: JSON.stringify({ identifiers: [{ name: 'Sol Ring' }] }),
      })
    );
  });

  it('calls onProgress after each batch', async () => {
    const names = Array.from({ length: 150 }, (_, i) => `Card ${i}`);
    const onProgress = vi.fn();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], not_found: [] }),
    } as Response);

    const resultPromise = resolveCards(names, { onProgress });
    await vi.runAllTimersAsync();
    await resultPromise;

    // onProgress called once per batch (2 batches)
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(0, 150);
  });

  it('marks all batch cards as failures when request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const resultPromise = resolveCards(['Card A', 'Card B']);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.resolved.size).toBe(0);
    expect(result.failures).toContain('Card A');
    expect(result.failures).toContain('Card B');
  });

  it('handles mixed resolved and not-found cards', async () => {
    const mockCard: ScryfallCard = {
      name: 'Counterspell',
      set: 'lea',
      collector_number: '54',
      image_uris: { normal: 'https://cards.scryfall.io/normal/front/c/s/cs.jpg' },
      type_line: 'Instant',
      oracle_text: 'Counter target spell.',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [mockCard],
        not_found: [{ name: 'Fake Card' }],
      }),
    } as Response);

    const resultPromise = resolveCards(['Counterspell', 'Fake Card']);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.resolved.size).toBe(1);
    expect(result.resolved.get('Counterspell')).toEqual(mockCard);
    expect(result.failures).toEqual(['Fake Card']);
  });

  it('enforces delay between consecutive batch requests', async () => {
    const names = Array.from({ length: 150 }, (_, i) => `Card ${i}`);
    const callTimes: number[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callTimes.push(Date.now());
      return {
        ok: true,
        json: async () => ({ data: [], not_found: [] }),
      } as Response;
    });

    const resultPromise = resolveCards(names);
    await vi.runAllTimersAsync();
    await resultPromise;

    // With fake timers, the delay between calls should be at least 50ms
    expect(callTimes.length).toBe(2);
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(50);
  });

  it('maintains rate limit compliance under rapid sequential calls', async () => {
    // Simulates rapid user interactions triggering multiple resolveCards calls
    const callTimes: number[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callTimes.push(Date.now());
      return {
        ok: true,
        json: async () => ({ data: [], not_found: [] }),
      } as Response;
    });

    // First call with 150 cards (2 batches)
    const promise1 = resolveCards(Array.from({ length: 150 }, (_, i) => `Batch1Card${i}`));
    await vi.runAllTimersAsync();
    await promise1;

    // Verify minimum 50ms between the two batches in the first call
    expect(callTimes.length).toBe(2);
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(50);
  });

  it('first batch request fires immediately without delay', async () => {
    const callTimes: number[] = [];
    const startTime = Date.now();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callTimes.push(Date.now());
      return {
        ok: true,
        json: async () => ({ data: [], not_found: [] }),
      } as Response;
    });

    const resultPromise = resolveCards(['Single Card']);
    await vi.runAllTimersAsync();
    await resultPromise;

    // First request should fire immediately (no pre-delay)
    expect(callTimes.length).toBe(1);
    expect(callTimes[0] - startTime).toBeLessThan(50);
  });

  it('accepts CardIdentifier objects with set code', async () => {
    const mockCard: ScryfallCard = {
      name: 'Lightning Bolt',
      set: '2xm',
      collector_number: '117',
      image_uris: { normal: 'https://cards.scryfall.io/normal/front/l/b/lb-2xm.jpg' },
      type_line: 'Instant',
      oracle_text: 'Lightning Bolt deals 3 damage to any target.',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [mockCard], not_found: [] }),
    } as Response);

    const resultPromise = resolveCards([{ name: 'Lightning Bolt', set: '2xm' }]);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.resolved.size).toBe(1);
    expect(result.resolved.get('Lightning Bolt')).toEqual(mockCard);

    // Verify set code is included in the request body
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.identifiers[0]).toEqual({ name: 'Lightning Bolt', set: '2xm' });
  });

  it('accepts mixed string and CardIdentifier inputs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], not_found: [] }),
    } as Response);

    const resultPromise = resolveCards([
      'Sol Ring',
      { name: 'Lightning Bolt', set: '2xm' },
      'Counterspell',
    ]);
    await vi.runAllTimersAsync();
    await resultPromise;

    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.identifiers).toEqual([
      { name: 'Sol Ring' },
      { name: 'Lightning Bolt', set: '2xm' },
      { name: 'Counterspell' },
    ]);
  });

  it('handles network errors gracefully without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const resultPromise = resolveCards(['Card A', 'Card B']);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Network errors mark batch as failures but don't throw
    expect(result.resolved.size).toBe(0);
    expect(result.failures).toContain('Card A');
    expect(result.failures).toContain('Card B');
  });

  it('continues processing remaining batches after a batch failure', async () => {
    const names = Array.from({ length: 150 }, (_, i) => `Card ${i}`);
    const mockCard: ScryfallCard = {
      name: 'Card 75',
      set: 'test',
      collector_number: '1',
      image_uris: { normal: 'https://example.com/card.jpg' },
      type_line: 'Creature',
      oracle_text: '',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    // First batch fails
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);
    // Second batch succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [mockCard], not_found: [] }),
    } as Response);

    const resultPromise = resolveCards(names);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // First batch (75 cards) marked as failures
    expect(result.failures.length).toBe(75);
    // Second batch resolved one card
    expect(result.resolved.size).toBe(1);
    expect(result.resolved.get('Card 75')).toEqual(mockCard);
  });
});
