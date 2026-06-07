/**
 * Scryfall /cards/collection batch resolver with rate limiting.
 *
 * Batches card identifiers into groups of 75 (Scryfall's max per request),
 * enforces minimum 50ms delay between consecutive requests, and
 * provides progress callbacks for UI updates.
 *
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4
 */

/** Card data as returned by the Scryfall API. */
export interface ScryfallCard {
  name: string;
  set: string;
  collector_number: string;
  image_uris?: { normal: string; large?: string };
  card_faces?: Array<{ image_uris?: { normal: string; large?: string }; oracle_text?: string; mana_cost?: string; name?: string; type_line?: string; power?: string; toughness?: string }>;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  keywords?: string[];
  cmc?: number;
  mana_cost?: string;
  color_identity?: string[];
  produced_mana?: string[];
}

/** A card identifier for Scryfall's /cards/collection endpoint. */
export interface CardIdentifier {
  name: string;
  set?: string;
}

/** Result of resolving a batch of card identifiers against Scryfall. */
export interface ResolveResult {
  resolved: Map<string, ScryfallCard>;
  failures: string[];
}

/** Options for the resolveCards function. */
export interface ResolveOptions {
  /** Called after each batch completes with (resolved so far, total identifiers). */
  onProgress?: (resolved: number, total: number) => void;
}

/** Maximum number of card identifiers per Scryfall /cards/collection request. */
const BATCH_SIZE = 75;

/** Minimum delay in milliseconds between consecutive API requests. */
const MIN_DELAY_MS = 50;

/** Scryfall collection endpoint URL — uses Vite proxy in dev to avoid CORS. */
const SCRYFALL_COLLECTION_URL = import.meta.env.DEV
  ? '/api/scryfall/cards/collection'
  : 'https://api.scryfall.com/cards/collection';

/**
 * Splits an array into chunks of the specified size.
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Waits for the specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes input to CardIdentifier array.
 * Accepts either plain strings (card names) or structured CardIdentifier objects.
 */
function normalizeIdentifiers(input: (string | CardIdentifier)[]): CardIdentifier[] {
  return input.map((item) =>
    typeof item === 'string' ? { name: item } : item
  );
}

/**
 * Normalizes a card name for Scryfall lookup.
 * DFC cards with " // " in the name are sent as just the front face name,
 * since Scryfall resolves the full card from the front face alone.
 */
function normalizeDfcName(name: string): string {
  if (name.includes(' // ')) {
    return name.split(' // ')[0].trim();
  }
  return name;
}

/**
 * Builds the Scryfall identifier payload for a batch.
 * Includes set code when available for more precise lookups.
 * Normalizes DFC names to front face only for reliable resolution.
 */
function buildScryfallIdentifiers(
  identifiers: CardIdentifier[]
): Array<{ name: string; set?: string }> {
  return identifiers.map((id) => {
    const entry: { name: string; set?: string } = { name: normalizeDfcName(id.name) };
    if (id.set) {
      entry.set = id.set;
    }
    return entry;
  });
}

/**
 * Resolves an array of card identifiers against the Scryfall /cards/collection endpoint.
 *
 * - Accepts plain card names (strings) or structured identifiers with optional set code
 * - Batches identifiers into groups of 75 (Scryfall's max per request)
 * - Enforces minimum 50ms delay between consecutive requests
 * - Returns resolved cards and a list of failures
 * - Reports failed cards without blocking successful imports
 * - Provides progress callbacks for UI updates
 *
 * @param input - Array of card names (strings) or CardIdentifier objects
 * @param options - Optional configuration including progress callback
 * @returns ResolveResult with resolved cards map and failures list
 */
export async function resolveCards(
  input: (string | CardIdentifier)[],
  options?: ResolveOptions
): Promise<ResolveResult> {
  const resolved = new Map<string, ScryfallCard>();
  const failures: string[] = [];

  const identifiers = normalizeIdentifiers(input);
  const total = identifiers.length;

  if (total === 0) {
    return { resolved, failures };
  }

  const batches = chunk(identifiers, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    // Enforce rate limiting: wait at least 50ms between consecutive requests
    if (i > 0) {
      await delay(MIN_DELAY_MS);
    }

    const batch = batches[i];
    const scryfallIdentifiers = buildScryfallIdentifiers(batch);

    try {
      const response = await fetch(SCRYFALL_COLLECTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: scryfallIdentifiers }),
      });

      if (!response.ok) {
        // If the request fails, mark all cards in this batch as failures
        // but do NOT throw — allow other batches to proceed
        failures.push(...batch.map((id) => id.name));
      } else {
        const data = await response.json();

        // Process resolved cards
        if (data.data) {
          for (const card of data.data as ScryfallCard[]) {
            // Store under the full Scryfall name
            resolved.set(card.name, card);
            // Also store under the front face name for DFC lookup
            if (card.name.includes(' // ')) {
              resolved.set(card.name.split(' // ')[0].trim(), card);
            }
          }
        }

        // Process not-found cards
        if (data.not_found) {
          for (const nf of data.not_found) {
            failures.push(nf.name);
          }
        }
      }
    } catch {
      // Network errors: mark batch as failures without blocking other batches
      failures.push(...batch.map((id) => id.name));
    }

    // Report progress after each batch
    options?.onProgress?.(resolved.size, total);
  }

  return { resolved, failures };
}
