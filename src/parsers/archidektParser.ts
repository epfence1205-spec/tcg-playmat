import { ARCHIDEKT_BASE } from '../api/proxyBase';

/**
 * Archidekt decklist fetcher and parser.
 * Validates Archidekt URLs, fetches deck data from the Archidekt API,
 * and parses the response into DeckEntry arrays with commander separation.
 */

import type { DeckEntry } from './plainTextParser';

export interface ArchidektResult {
  mainboard: DeckEntry[];
  commanders: DeckEntry[];
}

/** Regex pattern matching valid Archidekt deck URLs */
const ARCHIDEKT_URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?archidekt\.com\/decks\/(\d+)(?:\/[a-zA-Z0-9_-]*)?\/?\s*(?:[?#].*)?$/;

/**
 * Validates whether a string is a valid Archidekt deck URL.
 *
 * Accepted formats:
 * - https://www.archidekt.com/decks/12345
 * - https://archidekt.com/decks/12345
 * - http://www.archidekt.com/decks/12345
 * - www.archidekt.com/decks/12345
 * - archidekt.com/decks/12345
 * - archidekt.com/decks/12345/deck-name
 * - archidekt.com/decks/12345/deck-name/
 */
export function isArchidektUrl(url: string): boolean {
  return ARCHIDEKT_URL_PATTERN.test(url.trim());
}

/**
 * Extracts the numeric deck ID from an Archidekt URL.
 * Returns null if the URL is not a valid Archidekt deck URL.
 */
function extractDeckId(url: string): string | null {
  const match = url.trim().match(ARCHIDEKT_URL_PATTERN);
  return match ? match[1] : null;
}

/**
 * Fetches a deck from Archidekt's API and parses it into mainboard and commander entries.
 *
 * @param url - A valid Archidekt deck URL
 * @returns ArchidektResult with mainboard and commanders arrays
 * @throws Error if URL is invalid, deck is not found, network times out, or other HTTP errors
 */
export async function fetchArchidektDeck(url: string): Promise<ArchidektResult> {
  const deckId = extractDeckId(url);

  if (!deckId) {
    throw new Error(
      'Invalid Archidekt URL. Expected format: https://archidekt.com/decks/{numericId}'
    );
  }

  const apiUrl = `${ARCHIDEKT_BASE}/decks/${deckId}/`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response: Response;

  try {
    response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds. The Archidekt API may be unavailable.');
    }
    throw new Error('Failed to fetch deck from Archidekt. Please check your network connection.');
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
      `Archidekt API returned an error (HTTP ${response.status}). Please try again later.`
    );
  }

  const data = await response.json();

  const mainboard: DeckEntry[] = [];
  const commanders: DeckEntry[] = [];

  const cards: Array<{
    card: { oracleCard: { name: string }; edition?: { editioncode?: string } };
    quantity: number;
    categories: string[];
  }> = data.cards ?? [];

  for (const entry of cards) {
    const name = entry.card?.oracleCard?.name;
    const quantity = entry.quantity;
    const setCode = entry.card?.edition?.editioncode ?? undefined;

    if (!name || !quantity || quantity <= 0) continue;

    const deckEntry: DeckEntry = { name, quantity, set: setCode };

    if (entry.categories?.includes('Commander')) {
      commanders.push(deckEntry);
    } else {
      mainboard.push(deckEntry);
    }
  }

  return { mainboard, commanders };
}
