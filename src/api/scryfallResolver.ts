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
  collector_number?: string;
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
 * Prefers {set, collector_number} for exact printing when both are available.
 * Falls back to {name, set} or {name} otherwise.
 * Normalizes DFC names to front face only for reliable resolution.
 */
function buildScryfallIdentifiers(
  identifiers: CardIdentifier[]
): Array<{ name?: string; set?: string; collector_number?: string }> {
  return identifiers.map((id) => {
    // Prefer set + collector_number (exact printing, most reliable)
    if (id.set && id.collector_number) {
      return { set: id.set, collector_number: id.collector_number };
    }
    // Fall back to name + optional set
    const entry: { name: string; set?: string } = { name: normalizeDfcName(id.name) };
    if (id.set) {
      entry.set = id.set;
    }
    return entry;
  });
}

/**
 * Separates identifiers that would collide when batched together.
 *
 * Scryfall's /cards/collection deduplicates within a batch: if a DFC front face
 * (e.g. "Grave Researcher") and a standalone card matching the back face name
 * (e.g. "Reanimate") are sent together without set codes, Scryfall returns the
 * DFC for both. We detect these collisions and defer the standalone to a
 * separate request where it resolves correctly in isolation.
 *
 * Only applies to name-only lookups (no set code). Set-coded identifiers are
 * always safe because Scryfall disambiguates by set.
 */
function separateDfcCollisions(
  identifiers: CardIdentifier[]
): { primary: CardIdentifier[]; deferred: CardIdentifier[] } {
  // Collect back-face names from all DFC identifiers that lack a set code
  const backFaceNames = new Set<string>();
  for (const id of identifiers) {
    if (!id.set && id.name.includes(' // ')) {
      const backFace = id.name.split(' // ').slice(1).join(' // ').trim().toLowerCase();
      backFaceNames.add(backFace);
    }
  }

  // If no DFCs without set codes, no collision possible
  if (backFaceNames.size === 0) {
    return { primary: identifiers, deferred: [] };
  }

  // Any standalone identifier (no " // ", no set code) whose name matches a
  // back face gets deferred to a separate batch
  const primary: CardIdentifier[] = [];
  const deferred: CardIdentifier[] = [];

  for (const id of identifiers) {
    if (!id.set && !id.name.includes(' // ') && backFaceNames.has(id.name.toLowerCase())) {
      deferred.push(id);
    } else {
      primary.push(id);
    }
  }

  return { primary, deferred };
}

/**
 * Executes a single batch request against Scryfall /cards/collection.
 * Returns resolved cards and failures for the batch.
 */
async function executeBatch(
  batch: CardIdentifier[]
): Promise<{ data: ScryfallCard[]; notFound: string[] }> {
  const scryfallIdentifiers = buildScryfallIdentifiers(batch);
  const data: ScryfallCard[] = [];
  const notFound: string[] = [];

  try {
    const response = await fetch(SCRYFALL_COLLECTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'TCGPlaymat/1.0',
      },
      body: JSON.stringify({ identifiers: scryfallIdentifiers }),
    });

    if (!response.ok) {
      notFound.push(...batch.map((id) => id.name));
    } else {
      const json = await response.json();
      if (json.data) {
        data.push(...(json.data as ScryfallCard[]));
      }
      if (json.not_found) {
        for (const nf of json.not_found) {
          notFound.push(nf.name);
        }
      }
    }
  } catch {
    notFound.push(...batch.map((id) => id.name));
  }

  return { data, notFound };
}

/**
 * Resolves an array of card identifiers against the Scryfall /cards/collection endpoint.
 *
 * - Accepts plain card names (strings) or structured identifiers with optional set code
 * - Detects DFC back-face name collisions and resolves them in a separate request
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

  // Separate DFC back-face collisions into a deferred batch
  const { primary, deferred } = separateDfcCollisions(identifiers);

  const batches = chunk(primary, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    // Enforce rate limiting: wait at least 50ms between consecutive requests
    if (i > 0) {
      await delay(MIN_DELAY_MS);
    }

    const { data, notFound } = await executeBatch(batches[i]);

    for (const card of data) {
      resolved.set(card.name, card);
      if (card.name.includes(' // ')) {
        resolved.set(card.name.split(' // ')[0].trim(), card);
      }
    }
    failures.push(...notFound);

    options?.onProgress?.(resolved.size, total);
  }

  // Resolve deferred colliders in a separate batch (isolated from DFC front faces)
  if (deferred.length > 0) {
    await delay(MIN_DELAY_MS);

    const deferredBatches = chunk(deferred, BATCH_SIZE);
    for (let i = 0; i < deferredBatches.length; i++) {
      if (i > 0) {
        await delay(MIN_DELAY_MS);
      }

      const { data, notFound } = await executeBatch(deferredBatches[i]);

      for (const card of data) {
        resolved.set(card.name, card);
        if (card.name.includes(' // ')) {
          resolved.set(card.name.split(' // ')[0].trim(), card);
        }
      }
      failures.push(...notFound);

      options?.onProgress?.(resolved.size, total);
    }
  }

  return { resolved, failures };
}
