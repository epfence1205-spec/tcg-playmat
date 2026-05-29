import type { CardData, GameState, MulliganState } from './types';
import { shuffleLibrary } from './gameActions';

/**
 * Initializes the mulligan phase by drawing 7 cards from the library.
 * Sets gamePhase to MULLIGAN, mulliganCount to 1, and requiredPutBacks to 0 (first is free).
 *
 * Preconditions:
 * - state.library has at least 7 cards (gracefully handles fewer)
 *
 * Postconditions:
 * - 7 cards (or all remaining) moved from library to mulliganState.drawnCards
 * - gamePhase set to 'MULLIGAN'
 * - mulliganCount = 1
 * - requiredPutBacks = 0 (first mulligan is free)
 * - Total card count unchanged
 */
export function initializeMulligan(state: GameState): GameState {
  // Shuffle the library before drawing the opening hand
  const shuffled = [...state.library];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const drawCount = Math.min(7, shuffled.length);
  const drawnCards = shuffled.slice(0, drawCount);
  const remainingLibrary = shuffled.slice(drawCount);

  const mulliganState: MulliganState = {
    mulliganCount: 0,
    drawnCards,
    selectedToPutBack: new Set<string>(),
    requiredPutBacks: 0, // Opening hand — no put-backs required
  };

  return {
    ...state,
    gamePhase: 'MULLIGAN',
    library: remainingLibrary,
    mulliganState,
  };
}

/**
 * Shuffles the current mulligan hand back into the library, shuffles, and draws 7 new cards.
 * Increments mulliganCount and updates requiredPutBacks = max(0, mulliganCount - 1).
 *
 * Preconditions:
 * - state.mulliganState is not null
 * - state.gamePhase === 'MULLIGAN'
 *
 * Postconditions:
 * - Previous drawnCards shuffled back into library
 * - Library shuffled
 * - 7 new cards drawn
 * - mulliganCount incremented
 * - requiredPutBacks = max(0, newMulliganCount - 1)
 * - Total card count unchanged
 */
export function mulliganAgain(state: GameState): GameState {
  if (!state.mulliganState) {
    return state;
  }

  // Put drawn cards back into library
  const libraryWithReturned = [...state.library, ...state.mulliganState.drawnCards];
  const intermediateState: GameState = {
    ...state,
    library: libraryWithReturned,
  };

  // Shuffle the library
  const shuffledState = shuffleLibrary(intermediateState);

  // Draw 7 new cards
  const drawCount = Math.min(7, shuffledState.library.length);
  const drawnCards = shuffledState.library.slice(0, drawCount);
  const remainingLibrary = shuffledState.library.slice(drawCount);

  const newMulliganCount = state.mulliganState.mulliganCount + 1;

  const mulliganState: MulliganState = {
    mulliganCount: newMulliganCount,
    drawnCards,
    selectedToPutBack: new Set<string>(),
    requiredPutBacks: Math.max(0, newMulliganCount - 1),
  };

  return {
    ...shuffledState,
    library: remainingLibrary,
    mulliganState,
  };
}

/**
 * Confirms the kept hand: puts selected cards on the bottom of the library,
 * moves remaining drawn cards to hand, and transitions to PLAYING phase.
 *
 * Preconditions:
 * - state.mulliganState is not null
 * - selectedToPutBack.size === requiredPutBacks
 *
 * Postconditions:
 * - Selected cards moved to bottom of library
 * - Remaining drawn cards moved to hand
 * - gamePhase set to 'PLAYING'
 * - mulliganState set to null
 * - Total card count unchanged
 */
export function confirmKeep(state: GameState): GameState {
  if (!state.mulliganState) {
    return state;
  }

  const { drawnCards, selectedToPutBack } = state.mulliganState;

  // Separate cards to put back from cards to keep
  const cardsToPutBack: CardData[] = [];
  const cardsToKeep: CardData[] = [];

  for (const card of drawnCards) {
    if (selectedToPutBack.has(card.id)) {
      cardsToPutBack.push(card);
    } else {
      cardsToKeep.push(card);
    }
  }

  // Put back cards go to bottom of library
  const newLibrary = [...state.library, ...cardsToPutBack];

  // Remaining cards go to hand
  const newHand = [...state.hand, ...cardsToKeep];

  return {
    ...state,
    gamePhase: 'PLAYING',
    library: newLibrary,
    hand: newHand,
    mulliganState: null,
  };
}

/**
 * Toggles a card's selection for put-back during mulligan.
 * Adds the cardId to selectedToPutBack if not present, removes it if already selected.
 *
 * Preconditions:
 * - state.mulliganState is not null
 * - cardId exists in mulliganState.drawnCards
 *
 * Postconditions:
 * - cardId toggled in selectedToPutBack set
 * - No other state changes
 */
export function togglePutBack(state: GameState, cardId: string): GameState {
  if (!state.mulliganState) {
    return state;
  }

  const newSelected = new Set(state.mulliganState.selectedToPutBack);

  if (newSelected.has(cardId)) {
    newSelected.delete(cardId);
  } else {
    newSelected.add(cardId);
  }

  return {
    ...state,
    mulliganState: {
      ...state.mulliganState,
      selectedToPutBack: newSelected,
    },
  };
}
