/**
 * Moxfield decklist fetcher and parser.
 * Validates Moxfield URLs, fetches deck data from the Moxfield API,
 * and parses the response into DeckEntry arrays with commander separation.
 */

import type { DeckEntry } from './plainTextParser';

export interface MoxfieldResult {
  mainboard: DeckEntry[];
  commanders: DeckEntry[];
}

/** Regex pattern matching valid Moxfield deck URLs */
const MOXFIELD_URL_PATTERN = /^(?:https?:\/\/)?(?:www\.)?moxfield\.com\/decks\/([a-zA-Z0-9_-]+)\/?(?:[?#].*)?$/;

/**
 * Validates whether a string is a valid Moxfield deck URL.
 *
 * Accepted formats:
 * - https://www.moxfield.com/decks/{id}
 * - https://moxfield.com/decks/{id}
 * - http://www.moxfield.com/decks/{id}
 * - www.moxfield.com/decks/{id}
 * - moxfield.com/decks/{id}
 */
export function isMoxfieldUrl(url: string): boolean {
  return MOXFIELD_URL_PATTERN.test(url.trim());
}

/**
 * Extracts the deck ID from a Moxfield URL.
 * Returns null if the URL is not a valid Moxfield deck URL.
 */
function extractDeckId(url: string): string | null {
  const match = url.trim().match(MOXFIELD_URL_PATTERN);
  return match ? match[1] : null;
}

/**
 * Parses a Moxfield API card map into DeckEntry[].
 * The API returns objects where keys are internal IDs and values contain card data.
 */
function parseCardMap(cardMap: Record<string, { quantity: number; card?: { name?: string; set?: string; collector_number?: string } }>): DeckEntry[] {
  const entries: DeckEntry[] = [];

  for (const [key, data] of Object.entries(cardMap)) {
    if (data.quantity > 0) {
      const name = data.card?.name ?? key;
      const set = data.card?.set ?? undefined;
      const collectorNumber = data.card?.collector_number ?? undefined;
      entries.push({ name, quantity: data.quantity, set, collectorNumber });
    }
  }

  return entries;
}

/**
 * Fetches a deck from Moxfield's API and parses it into mainboard and commander entries.
 *
 * @param url - A valid Moxfield deck URL
 * @returns MoxfieldResult with mainboard and commanders arrays
 * @throws Error if URL is invalid, deck is private/not found, network times out, or other HTTP errors
 */
export async function fetchMoxfieldDeck(url: string): Promise<MoxfieldResult> {
  const deckId = extractDeckId(url);

  if (!deckId) {
    throw new Error(
      'Invalid Moxfield URL. Expected format: https://www.moxfield.com/decks/{id}'
    );
  }

  const apiUrl = `/api/moxfield/v3/decks/all/${deckId}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response: Response;

  try {
    response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TCGPlaymat/1.0',
      },
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds. The Moxfield API may be unavailable.');
    }
    throw new Error('Failed to fetch deck from Moxfield. Please check your network connection.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 404) {
    throw new Error(
      'Deck not found. It may be private or the URL may be incorrect.'
    );
  }

  if (!response.ok) {
    throw new Error(
      `Moxfield API returned an error (HTTP ${response.status}). Please try again later.`
    );
  }

  const data = await response.json();

  const mainboard = parseCardMap(data.mainboard ?? {});
  const commanders = parseCardMap(data.commanders ?? {});

  return { mainboard, commanders };
}
