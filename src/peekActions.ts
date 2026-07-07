import type { GameState, CardData } from './types';

// ─── Peek Mode Types ─────────────────────────────────────────────────────────

/**
 * Operational modes for the Peek Modal.
 * - scry: assign cards to top or bottom of library
 * - surveil: assign cards to top of library or graveyard
 * - select: assign cards to hand or bottom of library
 * - peek: read-only, no manipulation
 */
export type PeekMode = 'scry' | 'surveil' | 'select' | 'peek';

/**
 * Result of a peek modal confirmation.
 * Contains cards sorted into their assigned destinations.
 */
export interface PeekResult {
  mode: PeekMode;
  /** Cards assigned to top of library, in desired order (index 0 = new top of library) */
  topCards: CardData[];
  /** Cards assigned to bottom of library, in desired order (index 0 = first placed on bottom) */
  bottomCards: CardData[];
  /** Cards assigned to hand */
  handCards: CardData[];
  /** Cards assigned to graveyard */
  graveyardCards: CardData[];
  /** Original card IDs that were peeked (for removal from library) */
  originalCardIds: string[];
}

// ─── State Transform ─────────────────────────────────────────────────────────

/**
 * Applies the result of a peek modal confirmation to game state.
 * Removes the peeked cards from the library, then places them
 * in their assigned destinations:
 *
 * - topCards → prepended to library (index 0 = new top)
 * - bottomCards → appended to library end
 * - handCards → appended to hand array
 * - graveyardCards → appended to graveyard array (top of graveyard = last element)
 */
export function applyPeekResult(state: GameState, result: PeekResult): GameState {
  const peekedIds = new Set(result.originalCardIds);

  // Remove peeked cards from library
  const remainingLibrary = state.library.filter(c => !peekedIds.has(c.id));

  return {
    ...state,
    library: [...result.topCards, ...remainingLibrary, ...result.bottomCards],
    hand: [...state.hand, ...result.handCards],
    graveyard: [...state.graveyard, ...result.graveyardCards],
  };
}
