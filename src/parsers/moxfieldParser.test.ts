import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMoxfieldUrl, fetchMoxfieldDeck } from './moxfieldParser';

describe('isMoxfieldUrl', () => {
  it('accepts https://www.moxfield.com/decks/{id}', () => {
    expect(isMoxfieldUrl('https://www.moxfield.com/decks/abc123')).toBe(true);
  });

  it('accepts https://moxfield.com/decks/{id}', () => {
    expect(isMoxfieldUrl('https://moxfield.com/decks/abc123')).toBe(true);
  });

  it('accepts http://www.moxfield.com/decks/{id}', () => {
    expect(isMoxfieldUrl('http://www.moxfield.com/decks/abc123')).toBe(true);
  });

  it('accepts moxfield.com/decks/{id} without protocol', () => {
    expect(isMoxfieldUrl('moxfield.com/decks/abc123')).toBe(true);
  });

  it('accepts www.moxfield.com/decks/{id} without protocol', () => {
    expect(isMoxfieldUrl('www.moxfield.com/decks/abc123')).toBe(true);
  });

  it('accepts URLs with trailing slash', () => {
    expect(isMoxfieldUrl('https://www.moxfield.com/decks/abc123/')).toBe(true);
  });

  it('accepts deck IDs with hyphens and underscores', () => {
    expect(isMoxfieldUrl('https://www.moxfield.com/decks/my-deck_v2')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isMoxfieldUrl('  https://www.moxfield.com/decks/abc123  ')).toBe(true);
  });

  it('rejects non-moxfield URLs', () => {
    expect(isMoxfieldUrl('https://archidekt.com/decks/123')).toBe(false);
  });

  it('rejects moxfield URLs without /decks/ path', () => {
    expect(isMoxfieldUrl('https://www.moxfield.com/users/someone')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isMoxfieldUrl('')).toBe(false);
  });

  it('rejects URLs with extra path segments', () => {
    expect(isMoxfieldUrl('https://www.moxfield.com/decks/abc123/edit')).toBe(false);
  });
});

describe('fetchMoxfieldDeck', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('throws on invalid URL format', async () => {
    await expect(fetchMoxfieldDeck('not-a-url')).rejects.toThrow(
      'Invalid Moxfield URL'
    );
  });

  it('throws on non-moxfield URL', async () => {
    await expect(
      fetchMoxfieldDeck('https://archidekt.com/decks/123')
    ).rejects.toThrow('Invalid Moxfield URL');
  });

  it('fetches and parses a deck with mainboard and commanders', async () => {
    const mockResponse = {
      mainboard: {
        'Lightning Bolt': { quantity: 4 },
        'Mountain': { quantity: 20 },
      },
      commanders: {
        'Krenko, Mob Boss': { quantity: 1 },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchMoxfieldDeck(
      'https://www.moxfield.com/decks/test123'
    );

    expect(result.mainboard).toEqual([
      { name: 'Lightning Bolt', quantity: 4 },
      { name: 'Mountain', quantity: 20 },
    ]);
    expect(result.commanders).toEqual([
      { name: 'Krenko, Mob Boss', quantity: 1 },
    ]);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/moxfield/v3/decks/all/test123',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    );
  });

  it('handles deck with no commanders', async () => {
    const mockResponse = {
      mainboard: {
        'Sol Ring': { quantity: 1 },
      },
      commanders: {},
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchMoxfieldDeck(
      'https://moxfield.com/decks/deck456'
    );

    expect(result.mainboard).toEqual([{ name: 'Sol Ring', quantity: 1 }]);
    expect(result.commanders).toEqual([]);
  });

  it('handles missing mainboard/commanders fields gracefully', async () => {
    const mockResponse = {};

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchMoxfieldDeck(
      'https://moxfield.com/decks/empty-deck'
    );

    expect(result.mainboard).toEqual([]);
    expect(result.commanders).toEqual([]);
  });

  it('throws on 404 (private or non-existent deck)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });

    await expect(
      fetchMoxfieldDeck('https://www.moxfield.com/decks/private-deck')
    ).rejects.toThrow('Deck not found');
  });

  it('throws on other HTTP errors with status code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    await expect(
      fetchMoxfieldDeck('https://www.moxfield.com/decks/server-error')
    ).rejects.toThrow('HTTP 500');
  });

  it('throws on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      fetchMoxfieldDeck('https://www.moxfield.com/decks/network-fail')
    ).rejects.toThrow('Failed to fetch deck from Moxfield');
  });

  it('throws on timeout (AbortError)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(
      fetchMoxfieldDeck('https://www.moxfield.com/decks/slow-deck')
    ).rejects.toThrow('timed out');
  });

  it('extracts deck ID from URL with trailing slash', async () => {
    const mockResponse = {
      mainboard: { 'Island': { quantity: 1 } },
      commanders: {},
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchMoxfieldDeck('https://www.moxfield.com/decks/my-deck/');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/moxfield/v3/decks/all/my-deck',
      expect.anything()
    );
  });
});
