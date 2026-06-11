import type { CardType, KeywordAbility } from '../types';
import type { ScryfallCard } from './scryfallResolver';
import { deriveCardType } from './mapToCardData';
import { parseKeywords } from '../keywords';

export interface TokenDefinition {
  scryfallId: string;
  name: string;
  typeLine: string;
  power: string | null;
  toughness: string | null;
  imageURI: string;
  imageURILarge: string;
  setCode: string;
  collectorNumber: string;
  oracleText: string;
  cardType: CardType;
  keywords: KeywordAbility[];
}

/** Base URL for Scryfall API — uses Vite proxy in dev to avoid CORS. */
const SCRYFALL_COLLECTION_URL = import.meta.env.DEV
  ? '/api/scryfall/cards/collection'
  : 'https://api.scryfall.com/cards/collection';

/** Maximum identifiers per Scryfall /cards/collection request. */
const BATCH_SIZE = 75;

/** Minimum delay between consecutive API requests. */
const MIN_DELAY_MS = 50;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Extract unique token Scryfall IDs from resolved deck cards.
 * Uses the `all_parts` field returned by Scryfall's /cards/collection endpoint.
 */
export function extractTokenIds(resolvedCards: ScryfallCard[]): string[] {
  const seen = new Set<string>();
  for (const card of resolvedCards) {
    const parts = card.all_parts ?? [];
    for (const part of parts) {
      if (part.component === 'token' && !seen.has(part.id)) {
        seen.add(part.id);
      }
    }
  }
  return [...seen];
}

/**
 * Resolve token definitions by their Scryfall IDs using batch /cards/collection.
 * Accepts IDs extracted from `extractTokenIds`.
 * Returns deduplicated TokenDefinitions (by name).
 */
export async function resolveTokensByIds(tokenIds: string[]): Promise<TokenDefinition[]> {
  if (tokenIds.length === 0) return [];

  const identifiers = tokenIds.map(id => ({ id }));
  const batches = chunk(identifiers, BATCH_SIZE);
  const allTokens: TokenDefinition[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await delay(MIN_DELAY_MS);

    try {
      const response = await fetch(SCRYFALL_COLLECTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'TCGPlaymat/1.0',
        },
        body: JSON.stringify({ identifiers: batches[i] }),
      });

      if (!response.ok) continue;
      const json = await response.json();

      for (const tokenCard of (json.data ?? []) as ScryfallCard[]) {
        if (seenNames.has(tokenCard.name)) continue;
        seenNames.add(tokenCard.name);

        allTokens.push({
          scryfallId: (tokenCard as any).id ?? tokenCard.name,
          name: tokenCard.name,
          typeLine: tokenCard.type_line ?? '',
          power: tokenCard.power ?? null,
          toughness: tokenCard.toughness ?? null,
          imageURI: tokenCard.image_uris?.normal ?? tokenCard.card_faces?.[0]?.image_uris?.normal ?? '',
          imageURILarge: tokenCard.image_uris?.large ?? tokenCard.card_faces?.[0]?.image_uris?.large ?? '',
          setCode: tokenCard.set ?? '',
          collectorNumber: tokenCard.collector_number ?? '',
          oracleText: tokenCard.oracle_text ?? '',
          cardType: deriveCardType(tokenCard.type_line ?? ''),
          keywords: parseKeywords(tokenCard.oracle_text ?? ''),
        });
      }
    } catch {
      // Skip failed batch, continue with remaining
    }
  }

  return allTokens;
}

/**
 * Two-pass token resolution from already-resolved deck cards.
 * Pass 1: Extract token IDs from all_parts
 * Pass 2: Batch-resolve token IDs
 *
 * This replaces the old N+1 individual fetch approach.
 */
export async function resolveTokensFromCards(resolvedCards: ScryfallCard[]): Promise<TokenDefinition[]> {
  const tokenIds = extractTokenIds(resolvedCards);
  return resolveTokensByIds(tokenIds);
}

// ─── Legacy compatibility ────────────────────────────────────────────────────

/**
 * @deprecated Use resolveTokensFromCards instead.
 * Kept for backward compatibility — falls back to empty array.
 * Callers should migrate to resolveTokensFromCards.
 */
export async function resolveTokensForDeck(): Promise<TokenDefinition[]> {
  return [];
}

export function clearTokenCache(): void {
  // No cache to clear in the new batch approach — tokens are resolved fresh each import
}
