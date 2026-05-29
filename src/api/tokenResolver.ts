import type { CardData, CardType, KeywordAbility } from '../types';
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
const SCRYFALL_BASE = import.meta.env.DEV
  ? '/api/scryfall'
  : 'https://api.scryfall.com';

// In-memory cache keyed by "setCode/collectorNumber"
const tokenCache = new Map<string, TokenDefinition[]>();

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function resolveTokensForDeck(cards: CardData[]): Promise<TokenDefinition[]> {
  const allTokens: TokenDefinition[] = [];
  const seenTokenNames = new Set<string>();

  // Get unique cards by set/collector to avoid redundant fetches
  const uniqueCards = new Map<string, CardData>();
  for (const card of cards) {
    const key = `${card.setCode}/${card.collectorNumber}`;
    if (!uniqueCards.has(key)) uniqueCards.set(key, card);
  }

  for (const [key, card] of uniqueCards) {
    // Check cache
    if (tokenCache.has(key)) {
      for (const t of tokenCache.get(key)!) {
        if (!seenTokenNames.has(t.name)) {
          seenTokenNames.add(t.name);
          allTokens.push(t);
        }
      }
      continue;
    }

    // Fetch full card data from Scryfall
    try {
      await delay(50);
      const response = await fetch(`${SCRYFALL_BASE}/cards/${card.setCode}/${card.collectorNumber}`);
      if (!response.ok) {
        tokenCache.set(key, []);
        continue;
      }
      const fullCard = await response.json();

      // Filter for token parts
      const tokenParts = (fullCard.all_parts ?? [])
        .filter((part: { component: string }) => part.component === 'token');

      if (tokenParts.length === 0) {
        tokenCache.set(key, []);
        continue;
      }

      // Resolve each token
      const cardTokens: TokenDefinition[] = [];
      for (const part of tokenParts) {
        await delay(50);
        try {
          const tokenResponse = await fetch(`${SCRYFALL_BASE}/cards/${part.id}`);
          if (!tokenResponse.ok) continue;
          const tokenCard = await tokenResponse.json();

          const tokenDef: TokenDefinition = {
            scryfallId: tokenCard.id,
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
          };
          cardTokens.push(tokenDef);
        } catch {
          // Skip failed token resolution
        }
      }

      tokenCache.set(key, cardTokens);
      for (const t of cardTokens) {
        if (!seenTokenNames.has(t.name)) {
          seenTokenNames.add(t.name);
          allTokens.push(t);
        }
      }
    } catch {
      tokenCache.set(key, []);
    }
  }

  return allTokens;
}

export function clearTokenCache(): void {
  tokenCache.clear();
}
