/**
 * Deck import orchestrator.
 * Combines parsed deck entries with Scryfall resolution and commander separation.
 */

import type { CardData, GameState } from '../types';
import type { DeckEntry } from '../parsers/plainTextParser';
import { resolveCards } from '../api/scryfallResolver';
import { mapToCardData } from '../api/mapToCardData';
import { createEmptyGameState } from '../persistence';
import { initializeMulligan } from '../mulliganEngine';

export interface ImportResult {
  mainboard: CardData[];
  commanders: CardData[];
  failures: string[];
}

export interface ImportOptions {
  onProgress?: (resolved: number, total: number) => void;
}

/**
 * Orchestrates the full deck import pipeline:
 * 1. Collects unique card names from entries
 * 2. Resolves them via Scryfall batch API
 * 3. Maps resolved cards to CardData (creating quantity copies)
 * 4. Marks commanders with isCommander: true
 * 5. Separates into mainboard and commanders arrays
 *
 * @param entries - Parsed deck entries with name and quantity
 * @param commanderNames - Names of cards that should be marked as commanders
 * @param options - Optional progress callback
 * @returns ImportResult with mainboard, commanders, and failures
 */
export async function importDeck(
  entries: DeckEntry[],
  commanderNames: string[],
  options?: ImportOptions
): Promise<ImportResult> {
  // 1. Build unique identifiers (name + optional set code for specific printings)
  const identifierMap = new Map<string, { name: string; set?: string }>();
  for (const entry of entries) {
    if (!identifierMap.has(entry.name)) {
      identifierMap.set(entry.name, { name: entry.name, ...(entry.set ? { set: entry.set } : {}) });
    }
  }
  const uniqueIdentifiers = [...identifierMap.values()];

  // 2. Resolve via Scryfall (with set codes for correct art)
  const { resolved, failures } = await resolveCards(uniqueIdentifiers, {
    onProgress: options?.onProgress,
  });

  // 3. Normalize commander names for case-insensitive comparison
  const commanderNameSet = new Set(
    commanderNames.map((n) => n.toLowerCase())
  );

  // 4. Map to CardData, creating quantity copies and marking commanders
  const mainboard: CardData[] = [];
  const commanders: CardData[] = [];

  for (const entry of entries) {
    const scryfallCard = resolved.get(entry.name);
    if (!scryfallCard) continue;

    const isCommander = commanderNameSet.has(entry.name.toLowerCase());

    for (let i = 0; i < entry.quantity; i++) {
      const cardData = mapToCardData(scryfallCard, isCommander);

      if (isCommander) {
        commanders.push(cardData);
      } else {
        mainboard.push(cardData);
      }
    }
  }

  return { mainboard, commanders, failures };
}

/**
 * Builds a complete GameState from an ImportResult and initializes the mulligan phase.
 *
 * Flow:
 * 1. Creates an empty GameState as the base
 * 2. Places commanders into commandZone
 * 3. Places mainboard cards into library
 * 4. Calls initializeMulligan() to draw 7 cards and set gamePhase = 'MULLIGAN'
 * 5. Marks deckLoaded = true
 *
 * @param importResult - The result from importDeck() with mainboard, commanders, and failures
 * @returns A GameState with gamePhase = 'MULLIGAN', mulliganState populated, and 7 cards drawn
 */
export function importDeckToGameState(importResult: ImportResult): GameState {
  const baseState = createEmptyGameState();

  // Place commanders in commandZone, mainboard in library
  const stateWithCards: GameState = {
    ...baseState,
    commandZone: importResult.commanders,
    library: importResult.mainboard,
    deckLoaded: true,
  };

  // Initialize mulligan: draws 7 from library, sets gamePhase = 'MULLIGAN'
  return initializeMulligan(stateWithCards);
}
