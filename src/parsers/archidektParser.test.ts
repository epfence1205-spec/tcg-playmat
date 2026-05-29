import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isArchidektUrl, fetchArchidektDeck } from './archidektParser';

describe('isArchidektUrl', () => {
  it('accepts https://archidekt.com/decks/{numericId}', () => {
    expect(isArchidektUrl('https://archidekt.com/decks/12345')).toBe(true);
  });

  it('accepts https://www.archidekt.com/decks/{numericId}', () => {
    expect(isArchidektUrl('https://www.archidekt.com/decks/12345')).toBe(true);
  });

  it('accepts http://www.archidekt.com/decks/{numericId}', () => {
    expect(isArchidektUrl('http://www.archidekt.com/decks/12345')).toBe(true);
  });

  it('accepts archidekt.com/decks/{numericId} without protocol', () => {
    expect(isArchidektUrl('archidekt.com/decks/12345')).toBe(true);
  });

  it('accepts www.archidekt.com/decks/{numericId} without protocol', () => {
    expect(isArchidektUrl('www.archidekt.com/decks/12345')).toBe(true);
  });

  it('accepts URLs with slug after numeric ID', () => {
    expect(isArchidektUrl('https://archidekt.com/decks/12345/my-cool-deck')).toBe(true);
  });

  it('accepts URLs with trailing slash', () => {
    expect(isArchidektUrl('https://archidekt.com/decks/12345/')).toBe(true);
  });

  it('accepts URLs with slug and trailing slash', () => {
    expect(isArchidektUrl('https://archidekt.com/decks/12345/my-deck/')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isArchidektUrl('  https://archidekt.com/decks/12345  ')).toBe(true);
  });

  it('rejects non-archidekt URLs', () => {
    expect(isArchidektUrl('https://moxfield.com/decks/abc123')).toBe(false);
  });

  it('rejects archidekt URLs without /decks/ path', () => {
    expect(isArchidektUrl('https://archidekt.com/users/someone')).toBe(false);
  });

  it('rejects archidekt URLs with non-numeric deck ID', () => {
    expect(isArchidektUrl('https://archidekt.com/decks/abc')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isArchidektUrl('')).toBe(false);
  });
});

describe('fetchArchidektDeck', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('throws on invalid URL format', async () => {
    await expect(fetchArchidektDeck('not-a-url')).rejects.toThrow(
      'Invalid Archidekt URL'
    );
  });

  it('throws on non-archidekt URL', async () => {
    await expect(
      fetchArchidektDeck('https://moxfield.com/decks/abc123')
    ).rejects.toThrow('Invalid Archidekt URL');
  });

  it('throws on non-numeric deck ID', async () => {
    await expect(
      fetchArchidektDeck('https://archidekt.com/decks/abc')
    ).rejects.toThrow('Invalid Archidekt URL');
  });

  it('fetches and parses a deck with mainboard and commanders', async () => {
    const mockResponse = {
      cards: [
        {
          card: { oracleCard: { name: 'Lightning Bolt' }, edition: { editioncode: 'lea' } },
          quantity: 4,
          categories: ['Instant'],
        },
        {
          card: { oracleCard: { name: 'Mountain' }, edition: { editioncode: 'lea' } },
          quantity: 20,
          categories: ['Land'],
        },
        {
          card: { oracleCard: { name: 'Krenko, Mob Boss' }, edition: { editioncode: 'dds' } },
          quantity: 1,
          categories: ['Commander'],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchArchidektDeck(
      'https://archidekt.com/decks/12345'
    );

    expect(result.mainboard).toEqual([
      { name: 'Lightning Bolt', quantity: 4, set: 'lea' },
      { name: 'Mountain', quantity: 20, set: 'lea' },
    ]);
    expect(result.commanders).toEqual([
      { name: 'Krenko, Mob Boss', quantity: 1, set: 'dds' },
    ]);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/archidekt/decks/12345/',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    );
  });

  it('handles deck with no commanders', async () => {
    const mockResponse = {
      cards: [
        {
          card: { oracleCard: { name: 'Sol Ring' } },
          quantity: 1,
          categories: ['Artifact'],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchArchidektDeck(
      'https://archidekt.com/decks/99999'
    );

    expect(result.mainboard).toEqual([{ name: 'Sol Ring', quantity: 1 }]);
    expect(result.commanders).toEqual([]);
  });

  it('handles missing cards field gracefully', async () => {
    const mockResponse = {};

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchArchidektDeck(
      'https://archidekt.com/decks/11111'
    );

    expect(result.mainboard).toEqual([]);
    expect(result.commanders).toEqual([]);
  });

  it('skips entries with missing card name', async () => {
    const mockResponse = {
      cards: [
        {
          card: { oracleCard: {} },
          quantity: 1,
          categories: ['Creature'],
        },
        {
          card: { oracleCard: { name: 'Island' } },
          quantity: 10,
          categories: ['Land'],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchArchidektDeck(
      'https://archidekt.com/decks/22222'
    );

    expect(result.mainboard).toEqual([{ name: 'Island', quantity: 10 }]);
  });

  it('throws on 404 (private or non-existent deck)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });

    await expect(
      fetchArchidektDeck('https://archidekt.com/decks/99999')
    ).rejects.toThrow('Deck not found');
  });

  it('throws on other HTTP errors with status code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    await expect(
      fetchArchidektDeck('https://archidekt.com/decks/12345')
    ).rejects.toThrow('HTTP 500');
  });

  it('throws on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      fetchArchidektDeck('https://archidekt.com/decks/12345')
    ).rejects.toThrow('Failed to fetch deck from Archidekt');
  });

  it('throws on timeout (AbortError)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(
      fetchArchidektDeck('https://archidekt.com/decks/12345')
    ).rejects.toThrow('timed out');
  });

  it('extracts deck ID from URL with slug', async () => {
    const mockResponse = {
      cards: [
        {
          card: { oracleCard: { name: 'Forest' }, edition: { editioncode: 'lea' } },
          quantity: 1,
          categories: ['Land'],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchArchidektDeck('https://archidekt.com/decks/67890/my-deck-name');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/archidekt/decks/67890/',
      expect.anything()
    );
  });
});
