import type { GameState, Zone, ExileCard } from './types';
import {
  findCardOnBattlefield,
  updateBattlefieldCard,
  removeCardFromZone,
  createRowCard,
} from './gameActions';
import { separateMutateStack } from './mutateActions';

/**
 * Batch-taps all cards with the given instanceIds on the battlefield.
 * Cards not found on the battlefield are silently skipped.
 *
 * Preconditions:
 * - state is a valid GameState
 * - instanceIds is an array of card instanceIds
 *
 * Postconditions:
 * - Each found card has isTapped set to true
 * - Cards already tapped remain tapped (idempotent)
 * - Cards not on battlefield are skipped
 */
export function batchTap(state: GameState, instanceIds: string[]): GameState {
  let result = state;
  for (const id of instanceIds) {
    const found = findCardOnBattlefield(result, id);
    if (!found) continue;
    result = updateBattlefieldCard(result, id, (rc) => ({ ...rc, isTapped: true }));
  }
  return result;
}

/**
 * Batch-untaps all cards with the given instanceIds on the battlefield.
 * Cards not found on the battlefield are silently skipped.
 *
 * Preconditions:
 * - state is a valid GameState
 * - instanceIds is an array of card instanceIds
 *
 * Postconditions:
 * - Each found card has isTapped set to false
 * - Cards already untapped remain untapped (idempotent)
 * - Cards not on battlefield are skipped
 */
export function batchUntap(state: GameState, instanceIds: string[]): GameState {
  let result = state;
  for (const id of instanceIds) {
    const found = findCardOnBattlefield(result, id);
    if (!found) continue;
    result = updateBattlefieldCard(result, id, (rc) => ({ ...rc, isTapped: false }));
  }
  return result;
}

/**
 * Batch-moves cards to a target zone, processing sequentially.
 * For each card:
 * - If card has attachments: detach equipment → row3-artifacts, auras → graveyard
 * - If card has mutateStack: separate stack, route each card individually (tokens discarded)
 * - Move the card itself to target zone
 * Cards not found (removed as side-effect of prior processing) are skipped.
 *
 * Preconditions:
 * - state is a valid GameState
 * - instanceIds is an array of card instanceIds on the battlefield
 * - targetZone is a valid destination zone
 *
 * Postconditions:
 * - All found cards moved to targetZone (or library top for 'top-library')
 * - Equipment detached to row3-artifacts
 * - Auras sent to graveyard
 * - Mutate stacks separated, tokens discarded
 * - Missing cards silently skipped
 */
export function batchMoveToZone(
  state: GameState,
  instanceIds: string[],
  targetZone: Zone | 'top-library'
): GameState {
  let result = state;

  for (const id of instanceIds) {
    // Card may have been removed as a side-effect of a prior card's processing
    const found = findCardOnBattlefield(result, id);
    if (!found) continue;

    const rowCard = found.card;

    // Step 1: Detach attachments
    if (rowCard.attachments.length > 0) {
      for (const att of rowCard.attachments) {
        const isAura = /\baura\b/i.test(att.card.typeLine);
        if (isAura) {
          // Auras go to graveyard
          result = { ...result, graveyard: [...result.graveyard, att.card] };
        } else {
          // Equipment stays on battlefield in row3-artifacts
          const equipRowCard = createRowCard(att.card, 'row3-artifacts', result.row3.right.length);
          result = { ...result, row3: { ...result.row3, right: [...result.row3.right, equipRowCard] } };
        }
      }
      // Clear attachments on the card before removing it
      result = updateBattlefieldCard(result, id, (rc) => ({ ...rc, attachments: [] }));
    }

    // Step 2: Handle mutate stack
    if (rowCard.mutateStack && rowCard.mutateStack.length > 0) {
      // Separate stack — get all cards (tokens included for routing)
      const separatedCards = separateMutateStack(rowCard, false);

      // Remove the card from battlefield
      try {
        const { newState } = removeCardFromZone(result, 'battlefield', id);
        result = newState;
      } catch {
        continue; // Card already gone
      }

      // Route each card individually
      for (const card of separatedCards) {
        // Token ephemerality: tokens cease to exist when leaving battlefield
        if (card.isToken) continue;

        result = addCardToZone(result, card, targetZone);
      }
      continue; // Already handled, skip normal move
    }

    // Step 3: Normal move — remove from battlefield, add to destination
    try {
      const { card, newState } = removeCardFromZone(result, 'battlefield', id);
      result = newState;

      // Token ephemerality
      if (card.isToken && targetZone !== 'battlefield') {
        continue;
      }

      result = addCardToZone(result, card, targetZone);
    } catch {
      continue; // Card not found
    }
  }

  return result;
}

/**
 * Helper: adds a CardData to the specified zone.
 */
function addCardToZone(state: GameState, card: import('./types').CardData, zone: Zone | 'top-library'): GameState {
  if (zone === 'top-library' || zone === 'library') {
    // Place on top of library
    return { ...state, library: [card, ...state.library] };
  }
  if (zone === 'exile') {
    const exileCard: ExileCard = { card, isFaceDown: false };
    return { ...state, exile: [...state.exile, exileCard] };
  }
  // hand, graveyard, commandZone — append
  const zoneKey = zone as 'hand' | 'graveyard' | 'commandZone';
  return { ...state, [zoneKey]: [...state[zoneKey], card] };
}
