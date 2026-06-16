import type { GameState, RowCard, CardData, KeywordAbility, ExileCard } from './types';
import { getAllBattlefieldCards, findCardOnBattlefield, removeCardFromZone, createRowCard } from './gameActions';
import { recalculateCreatureRows } from './creatureRows';
import { parseKeywords } from './keywords';

/**
 * Determines if a creature's typeLine qualifies it as non-Human.
 * A creature is non-Human if the subtype portion (after the em-dash "—") does not
 * contain "Human" as a complete word boundary match.
 * TypeLines without "—" are considered valid (non-Human).
 *
 * Requirements: 4.1, 4.3
 *
 * Preconditions:
 * - typeLine is a string (may be empty)
 *
 * Postconditions:
 * - Returns true if creature has no subtypes or subtypes don't contain "Human" as a whole word
 * - Returns false only if subtypes contain "Human" as a complete word (not "Superhuman", etc.)
 */
export function isNonHumanCreature(typeLine: string): boolean {
  const dashIndex = typeLine.indexOf('—');
  if (dashIndex === -1) {
    // No subtypes — valid mutate target
    return true;
  }
  const subtypes = typeLine.slice(dashIndex + 1);
  // Word boundary match: "Human" must not be part of a larger word
  return !/\bHuman\b/i.test(subtypes);
}

/**
 * Returns all valid mutate targets on the battlefield.
 * A valid target is:
 * - A creature (cardType === 'creature')
 * - Non-Human (isNonHumanCreature) OR face-down (isFaceDown === true)
 * - Not the source card itself
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 2.3
 *
 * Preconditions:
 * - state is a valid GameState
 * - sourceCardId identifies the card initiating the mutate
 *
 * Postconditions:
 * - Returns array of RowCards that are legal mutate targets
 * - Source card is never included in the result
 */
export function getValidMutateTargets(state: GameState, sourceCardId: string): RowCard[] {
  const allCards = getAllBattlefieldCards(state);
  return allCards.filter((rc) => {
    // Must be a creature
    if (rc.card.cardType !== 'creature') return false;
    // Must not be the source card
    if (rc.instanceId === sourceCardId) return false;
    // Face-down creatures are always valid targets
    if (rc.isFaceDown) return true;
    // Otherwise, must be non-Human
    return isNonHumanCreature(rc.card.typeLine);
  });
}

/**
 * Aggregates keywords from all cards in a mutate stack.
 * Returns the deduplicated union of:
 * - Top_Card.keywords + parseKeywords(Top_Card.oracleText)
 * - For each card in mutateStack: card.keywords + parseKeywords(card.oracleText)
 *
 * Requirements: 5.1, 5.2, 5.4
 *
 * Preconditions:
 * - rowCard is a valid RowCard (mutateStack may be empty)
 *
 * Postconditions:
 * - Each keyword appears at most once in the result
 * - If mutateStack is empty, returns keywords from Top_Card only
 * - Returns KeywordAbility[] with no duplicates
 */
export function aggregateMutateKeywords(rowCard: RowCard): KeywordAbility[] {
  const keywordSet = new Set<KeywordAbility>();

  // Top_Card keywords
  for (const kw of rowCard.card.keywords) {
    keywordSet.add(kw);
  }
  for (const kw of parseKeywords(rowCard.card.oracleText)) {
    keywordSet.add(kw);
  }

  // Each mutateStack entry's keywords
  for (const stackCard of rowCard.mutateStack) {
    for (const kw of stackCard.keywords) {
      keywordSet.add(kw);
    }
    for (const kw of parseKeywords(stackCard.oracleText)) {
      keywordSet.add(kw);
    }
  }

  return [...keywordSet];
}

/** Maximum number of entries allowed in mutateStack */
const MAX_MUTATE_STACK_SIZE = 19;

/**
 * Performs an Over-Mutate: source becomes new Top_Card.
 * 1. Current RowCard.card moves to mutateStack (prepended at index 0)
 * 2. Source card becomes new RowCard.card
 * 3. Source removed from its current battlefield position (or from hand)
 * 4. Keywords recalculated via aggregateMutateKeywords
 * 5. Counters, attachments, isTapped, rowAssignment preserved
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 1.5
 *
 * Preconditions:
 * - sourceCardId identifies an existing card in the specified sourceZone
 * - targetCardId identifies an existing RowCard on the battlefield
 * - target's mutateStack.length < MAX_MUTATE_STACK_SIZE
 *
 * Postconditions:
 * - Source card is the new Top_Card (RowCard.card)
 * - Previous Top_Card is at mutateStack[0]
 * - Existing mutateStack entries shift right (indices increase by 1)
 * - Source removed from its original zone
 * - Target retains counters, attachments, isTapped, rowAssignment
 * - If at stack limit, returns state unchanged
 */
export function mutateOver(
  state: GameState,
  sourceCardId: string,
  targetCardId: string,
  sourceZone: 'battlefield' | 'hand'
): GameState {
  // Find target on battlefield
  const targetResult = findCardOnBattlefield(state, targetCardId);
  if (!targetResult) {
    throw new Error(`Mutate target ${targetCardId} not found on battlefield`);
  }
  const targetCard = targetResult.card;

  // Enforce max stack size (current stack + the old top card that will be added = stack+1)
  if (targetCard.mutateStack.length >= MAX_MUTATE_STACK_SIZE) {
    return state;
  }

  // Get source CardData
  let sourceCardData: CardData;
  let newState: GameState;

  if (sourceZone === 'hand') {
    const handIndex = state.hand.findIndex((c) => c.id === sourceCardId);
    if (handIndex === -1) {
      throw new Error(`Mutate source ${sourceCardId} not found in hand`);
    }
    sourceCardData = state.hand[handIndex];
    // Remove from hand
    newState = {
      ...state,
      hand: [...state.hand.slice(0, handIndex), ...state.hand.slice(handIndex + 1)],
    };
  } else {
    // sourceZone === 'battlefield'
    const sourceResult = findCardOnBattlefield(state, sourceCardId);
    if (!sourceResult) {
      throw new Error(`Mutate source ${sourceCardId} not found on battlefield`);
    }
    sourceCardData = sourceResult.card.card;
    // Remove from battlefield
    const removed = removeCardFromZone(state, 'battlefield', sourceCardId);
    newState = removed.newState;
  }

  // Apply Over-Mutate to the target:
  // - Old Top_Card gets prepended to mutateStack at index 0
  // - Source becomes the new Top_Card
  // - Preserve counters, attachments, isTapped, rowAssignment
  newState = mapTargetCard(newState, targetCardId, (rowCard) => {
    const newMutateStack = [rowCard.card, ...rowCard.mutateStack];
    const updatedCard: RowCard = {
      ...rowCard,
      card: sourceCardData,
      mutateStack: newMutateStack,
    };
    return updatedCard;
  });

  return newState;
}

/**
 * Performs an Under-Mutate: source goes underneath, Top_Card preserved.
 * 1. Source card appended to end of mutateStack
 * 2. RowCard.card remains unchanged
 * 3. Source removed from its current battlefield position (or from hand)
 * 4. Keywords recalculated via aggregateMutateKeywords
 * 5. Counters, attachments, isTapped, rowAssignment preserved
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 1.5
 *
 * Preconditions:
 * - sourceCardId identifies an existing card in the specified sourceZone
 * - targetCardId identifies an existing RowCard on the battlefield
 * - target's mutateStack.length < MAX_MUTATE_STACK_SIZE
 *
 * Postconditions:
 * - Top_Card (RowCard.card) is unchanged
 * - Source CardData is appended at end of mutateStack
 * - Source removed from its original zone
 * - Target retains counters, attachments, isTapped, rowAssignment
 * - If at stack limit, returns state unchanged
 */
export function mutateUnder(
  state: GameState,
  sourceCardId: string,
  targetCardId: string,
  sourceZone: 'battlefield' | 'hand'
): GameState {
  // Find target on battlefield
  const targetResult = findCardOnBattlefield(state, targetCardId);
  if (!targetResult) {
    throw new Error(`Mutate target ${targetCardId} not found on battlefield`);
  }
  const targetCard = targetResult.card;

  // Enforce max stack size
  if (targetCard.mutateStack.length >= MAX_MUTATE_STACK_SIZE) {
    return state;
  }

  // Get source CardData
  let sourceCardData: CardData;
  let newState: GameState;

  if (sourceZone === 'hand') {
    const handIndex = state.hand.findIndex((c) => c.id === sourceCardId);
    if (handIndex === -1) {
      throw new Error(`Mutate source ${sourceCardId} not found in hand`);
    }
    sourceCardData = state.hand[handIndex];
    // Remove from hand
    newState = {
      ...state,
      hand: [...state.hand.slice(0, handIndex), ...state.hand.slice(handIndex + 1)],
    };
  } else {
    // sourceZone === 'battlefield'
    const sourceResult = findCardOnBattlefield(state, sourceCardId);
    if (!sourceResult) {
      throw new Error(`Mutate source ${sourceCardId} not found on battlefield`);
    }
    sourceCardData = sourceResult.card.card;
    // Remove from battlefield
    const removed = removeCardFromZone(state, 'battlefield', sourceCardId);
    newState = removed.newState;
  }

  // Apply Under-Mutate to the target:
  // - Source CardData appended to end of mutateStack
  // - Top_Card (RowCard.card) unchanged
  // - Preserve counters, attachments, isTapped, rowAssignment
  newState = mapTargetCard(newState, targetCardId, (rowCard) => {
    const newMutateStack = [...rowCard.mutateStack, sourceCardData];
    const updatedCard: RowCard = {
      ...rowCard,
      mutateStack: newMutateStack,
    };
    return updatedCard;
  });

  return newState;
}

/**
 * Splits a mutate stack into individual creatures on the battlefield.
 * 1. Each mutateStack entry becomes an independent RowCard with default state
 * 2. Original RowCard's mutateStack cleared to []
 * 3. Original RowCard preserves tap, counters, attachments
 * 4. New RowCards placed in same creature row
 * 5. Creature rows rebalanced
 *
 * Requirements: 11.2, 11.3, 11.4, 11.5
 *
 * Preconditions:
 * - cardId identifies an existing RowCard on the battlefield with a non-empty mutateStack
 *
 * Postconditions:
 * - Original RowCard has mutateStack === []
 * - Original RowCard retains isTapped, counters, attachments, rowAssignment
 * - Each former mutateStack entry is a new independent RowCard with default state:
 *   isTapped=false, isFaceDown=false, showingBackFace=false, isPhased=false,
 *   attachments=[], counters=[], mutateStack=[]
 * - New RowCards are in the same creature row as the original
 * - Creature rows are rebalanced via recalculateCreatureRows
 * - If card not found or mutateStack is empty, returns state unchanged
 */
export function splitMutateStack(state: GameState, cardId: string): GameState {
  // Find the card on the battlefield
  const result = findCardOnBattlefield(state, cardId);
  if (!result) return state;

  const rowCard = result.card;
  if (rowCard.mutateStack.length === 0) return state;

  // splitMutateStack only applies to creature area cards
  if (result.location !== 'creatureArea' || result.rowIndex === undefined) return state;

  const rowIndex = result.rowIndex;
  const rowId = state.creatureArea.rows[rowIndex].id as 'creature-1' | 'creature-2' | 'creature-3';

  // Create new independent RowCards from each mutateStack entry
  const newRowCards: RowCard[] = rowCard.mutateStack.map((cardData) =>
    createRowCard(cardData, rowId, 0)
  );

  // Find the position of the original card in the row and insert new cards after it
  const currentElements = state.creatureArea.rows[rowIndex].elements;
  const originalIdx = currentElements.findIndex((rc) => rc.instanceId === cardId);

  // Clear mutateStack on the original, preserving everything else
  const updatedOriginal: RowCard = {
    ...rowCard,
    mutateStack: [],
  };

  // Build new elements: original (cleared), then new cards placed after it
  const newElements = [
    ...currentElements.slice(0, originalIdx),
    updatedOriginal,
    ...newRowCards,
    ...currentElements.slice(originalIdx + 1),
  ];

  const newRows = state.creatureArea.rows.map((r, i) =>
    i === rowIndex ? { ...r, elements: newElements } : r
  );

  // Rebalance creature rows
  const updatedCreatureArea = recalculateCreatureRows({ rows: newRows, totalElementCount: 0 });

  return {
    ...state,
    creatureArea: updatedCreatureArea,
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Applies a transformation function to a specific RowCard on the battlefield
 * identified by instanceId. Searches creature area, row3, and row4.
 * Returns new GameState with the transformed card.
 */
function mapTargetCard(
  state: GameState,
  targetId: string,
  fn: (rowCard: RowCard) => RowCard
): GameState {
  // Search creature area rows
  for (let i = 0; i < state.creatureArea.rows.length; i++) {
    const row = state.creatureArea.rows[i];
    const idx = row.elements.findIndex((rc) => rc.instanceId === targetId);
    if (idx !== -1) {
      const newElements = row.elements.map((rc) =>
        rc.instanceId === targetId ? fn(rc) : rc
      );
      const newRows = state.creatureArea.rows.map((r, ri) =>
        ri === i ? { ...r, elements: newElements } : r
      );
      return {
        ...state,
        creatureArea: { ...state.creatureArea, rows: newRows },
      };
    }
  }

  // Search row3 left
  if (state.row3.left.some((rc) => rc.instanceId === targetId)) {
    return {
      ...state,
      row3: {
        ...state.row3,
        left: state.row3.left.map((rc) =>
          rc.instanceId === targetId ? fn(rc) : rc
        ),
      },
    };
  }

  // Search row3 right
  if (state.row3.right.some((rc) => rc.instanceId === targetId)) {
    return {
      ...state,
      row3: {
        ...state.row3,
        right: state.row3.right.map((rc) =>
          rc.instanceId === targetId ? fn(rc) : rc
        ),
      },
    };
  }

  // Search row4 left
  if (state.row4.left.some((rc) => rc.instanceId === targetId)) {
    return {
      ...state,
      row4: {
        ...state.row4,
        left: state.row4.left.map((rc) =>
          rc.instanceId === targetId ? fn(rc) : rc
        ),
      },
    };
  }

  // Search row4 right
  if (state.row4.right.some((rc) => rc.instanceId === targetId)) {
    return {
      ...state,
      row4: {
        ...state.row4,
        right: state.row4.right.map((rc) =>
          rc.instanceId === targetId ? fn(rc) : rc
        ),
      },
    };
  }

  throw new Error(`Target card ${targetId} not found on battlefield for mutate`);
}

/**
 * Separates a mutate stack into individual CardData for zone movement.
 * Returns array: [Top_Card_CardData, ...mutateStack entries]
 * Filters out tokens (isToken === true) when excludeTokens is true.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.6, 9.1, 9.4
 *
 * Preconditions:
 * - rowCard is a valid RowCard (mutateStack may be empty)
 *
 * Postconditions:
 * - Returns array with Top_Card at index 0, followed by mutateStack entries in order
 * - When excludeTokens is true, cards with isToken===true are excluded from result
 * - When excludeTokens is false, all cards are included regardless of isToken
 * - Original RowCard is not modified
 */
export function separateMutateStack(rowCard: RowCard, excludeTokens: boolean): CardData[] {
  const allCards: CardData[] = [rowCard.card, ...rowCard.mutateStack];

  if (excludeTokens) {
    return allCards.filter((card) => !card.isToken);
  }

  return allCards;
}

/**
 * Identifies commanders within a mutate stack for zone replacement prompting.
 * Returns CardData[] of cards with isCommander === true (may be 0, 1, or 2 for partners).
 * Checks both the Top_Card and all mutateStack entries.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 *
 * Preconditions:
 * - rowCard is a valid RowCard
 *
 * Postconditions:
 * - Returns only cards where isCommander === true
 * - Searches both Top_Card (rowCard.card) and all mutateStack entries
 * - Returns empty array if no commanders exist in the stack
 */
export function getCommandersInStack(rowCard: RowCard): CardData[] {
  const allCards: CardData[] = [rowCard.card, ...rowCard.mutateStack];
  return allCards.filter((card) => card.isCommander);
}

/**
 * Performs zone movement for a mutated creature with commander zone replacement.
 * Separates the stack, routing commander(s) to commandZone based on commanderChoices,
 * and sends remaining cards to the destination zone.
 * Tokens are discarded (not added to any zone) per token ephemerality rules.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.6, 9.1, 9.4, 13.1, 13.2, 13.3, 13.4
 *
 * Preconditions:
 * - state is a valid GameState
 * - rowCard exists on the battlefield
 * - destination is 'graveyard' or 'exile'
 * - commanderChoices maps commander card IDs to their destination ('commandZone' or the destination zone)
 *
 * Postconditions:
 * - The original RowCard is removed from the battlefield
 * - Token cards (isToken===true) are discarded (not added to any zone)
 * - Commanders with commanderChoices.get(id)==='commandZone' are added to state.commandZone
 * - All other non-token cards are added to the destination zone
 * - Returns new state with all zone changes applied
 */
export function separateMutateStackWithCommanderChoice(
  state: GameState,
  rowCard: RowCard,
  destination: 'graveyard' | 'exile',
  commanderChoices: Map<string, 'commandZone' | 'graveyard' | 'exile'>
): GameState {
  // Get all cards from the stack (including tokens — we filter them below)
  const allCards = separateMutateStack(rowCard, false);

  // Remove the original RowCard from the battlefield
  const removed = removeCardFromZone(state, 'battlefield', rowCard.instanceId);
  let newState = removed.newState;

  // Route each card to its destination
  for (const card of allCards) {
    // Token ephemerality: tokens don't go to any zone
    if (card.isToken) {
      continue;
    }

    // Commander zone replacement
    if (card.isCommander && commanderChoices.get(card.id) === 'commandZone') {
      newState = {
        ...newState,
        commandZone: [...newState.commandZone, card],
      };
      continue;
    }

    // Send to destination zone
    if (destination === 'graveyard') {
      newState = {
        ...newState,
        graveyard: [...newState.graveyard, card],
      };
    } else {
      // destination === 'exile'
      const exileCard: ExileCard = { card, isFaceDown: false };
      newState = {
        ...newState,
        exile: [...newState.exile, exileCard],
      };
    }
  }

  return newState;
}
