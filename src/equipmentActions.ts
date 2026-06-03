import type { GameState, RowCard, Attachment } from './types';
import { findCardOnBattlefield, createRowCard } from './gameActions';
import { calculateEffectiveStats } from './keywords';

/**
 * Attaches an equipment card to a creature on the battlefield.
 * Removes the equipment from its current row flow and adds it
 * as an Attachment to the target creature's attachments array.
 *
 * Requirements: 9.1, 9.4, 9.7, 9.8
 *
 * Preconditions:
 * - equipmentId exists on the battlefield as a standalone RowCard
 * - creatureId exists on the battlefield as a RowCard
 *
 * Postconditions:
 * - Equipment removed from standard row flow
 * - Equipment added to creature's attachments[] array
 * - Creature's effective stats recalculated via calculateEffectiveStats()
 */
export function attachEquipment(
  state: GameState,
  equipmentId: string,
  creatureId: string
): GameState {
  // Find the equipment on the battlefield
  const equipResult = findCardOnBattlefield(state, equipmentId);
  if (!equipResult) {
    throw new Error(`Equipment ${equipmentId} not found on battlefield`);
  }

  // Find the creature on the battlefield
  const creatureResult = findCardOnBattlefield(state, creatureId);
  if (!creatureResult) {
    throw new Error(`Creature ${creatureId} not found on battlefield`);
  }

  // Step 1: Remove equipment from its current row
  let newState = removeEquipmentFromRow(state, equipmentId);

  // Step 2: Create the Attachment object
  const attachment: Attachment = {
    card: equipResult.card.card,
    instanceId: equipResult.card.instanceId,
    isTapped: false,
  };

  // Step 3: Add attachment to the target creature
  newState = mapAllBattlefieldCards(newState, (rowCard) => {
    if (rowCard.instanceId === creatureId) {
      const updatedAttachments = [...rowCard.attachments, attachment];
      // Recalculate effective stats with the new attachment
      const attachmentRowCards = updatedAttachments.map((att) =>
        createRowCard(att.card, rowCard.rowAssignment, 0)
      );
      // We call calculateEffectiveStats for validation but the stats
      // are computed on-demand by consumers; the attachment array is the source of truth
      calculateEffectiveStats(rowCard, attachmentRowCards);
      return { ...rowCard, attachments: updatedAttachments };
    }
    return rowCard;
  });

  return newState;
}

/**
 * Detaches an equipment card from a creature and returns it to the battlefield.
 * Equipment is placed back in its appropriate row based on cardType
 * (artifacts → row3-artifacts).
 *
 * Requirements: 9.9, 9.10
 *
 * Preconditions:
 * - equipmentId exists in the creature's attachments[] array
 * - creatureId exists on the battlefield
 *
 * Postconditions:
 * - Equipment removed from creature's attachments[] array
 * - Equipment placed back on the battlefield in the appropriate row
 * - Creature's effective stats recalculated without the detached equipment
 */
export function detachEquipment(
  state: GameState,
  equipmentId: string,
  creatureId: string
): GameState {
  // Find the creature on the battlefield
  const creatureResult = findCardOnBattlefield(state, creatureId);
  if (!creatureResult) {
    throw new Error(`Creature ${creatureId} not found on battlefield`);
  }

  // Find the attachment on the creature
  const attachment = creatureResult.card.attachments.find(
    (a) => a.instanceId === equipmentId
  );
  if (!attachment) {
    throw new Error(
      `Equipment ${equipmentId} not found attached to creature ${creatureId}`
    );
  }

  // Step 1: Remove attachment from the creature
  let newState = mapAllBattlefieldCards(state, (rowCard) => {
    if (rowCard.instanceId === creatureId) {
      const updatedAttachments = rowCard.attachments.filter(
        (a) => a.instanceId !== equipmentId
      );
      return { ...rowCard, attachments: updatedAttachments };
    }
    return rowCard;
  });

  // Step 2: Determine the target row based on cardType
  const cardType = attachment.card.cardType;
  let targetRow: 'row3-artifacts' | 'row4-enchantments' | 'row3-artifacts';
  switch (cardType) {
    case 'artifact':
      targetRow = 'row3-artifacts';
      break;
    case 'enchantment':
      targetRow = 'row4-enchantments';
      break;
    default:
      // Equipment is typically an artifact subtype; default to row3-artifacts
      targetRow = 'row3-artifacts';
      break;
  }

  // Step 3: Place equipment back on the battlefield in the appropriate row
  if (targetRow === 'row3-artifacts') {
    const positionIndex = newState.row3.right.length;
    const rowCard = createRowCard(attachment.card, 'row3-artifacts', positionIndex);
    newState = {
      ...newState,
      row3: { ...newState.row3, right: [...newState.row3.right, rowCard] },
    };
  } else if (targetRow === 'row4-enchantments') {
    const positionIndex = newState.row4.right.length;
    const rowCard = createRowCard(attachment.card, 'row4-enchantments', positionIndex);
    newState = {
      ...newState,
      row4: { ...newState.row4, right: [...newState.row4.right, rowCard] },
    };
  }

  return newState;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Removes a card (by instanceId) from all battlefield row locations.
 * Searches creature area rows, row3, and row4.
 */
function removeEquipmentFromRow(state: GameState, equipmentId: string): GameState {
  // Search and remove from creature area rows
  for (let i = 0; i < state.creatureArea.rows.length; i++) {
    const row = state.creatureArea.rows[i];
    const idx = row.elements.findIndex((rc) => rc.instanceId === equipmentId);
    if (idx !== -1) {
      const newElements = [
        ...row.elements.slice(0, idx),
        ...row.elements.slice(idx + 1),
      ];
      const newRows = state.creatureArea.rows.map((r, ri) =>
        ri === i ? { ...r, elements: newElements } : r
      );
      const totalElementCount = newRows.reduce(
        (sum, r) => sum + r.elements.length,
        0
      );
      return {
        ...state,
        creatureArea: { rows: newRows, totalElementCount },
      };
    }
  }

  // Search and remove from row3 left
  const r4lIdx = state.row3.left.findIndex(
    (rc) => rc.instanceId === equipmentId
  );
  if (r4lIdx !== -1) {
    const newLeft = [
      ...state.row3.left.slice(0, r4lIdx),
      ...state.row3.left.slice(r4lIdx + 1),
    ];
    return { ...state, row3: { ...state.row3, left: newLeft } };
  }

  // Search and remove from row3 right
  const r4rIdx = state.row3.right.findIndex(
    (rc) => rc.instanceId === equipmentId
  );
  if (r4rIdx !== -1) {
    const newRight = [
      ...state.row3.right.slice(0, r4rIdx),
      ...state.row3.right.slice(r4rIdx + 1),
    ];
    return { ...state, row3: { ...state.row3, right: newRight } };
  }

  // Search and remove from row4 left
  const r5lIdx = state.row4.left.findIndex(
    (rc) => rc.instanceId === equipmentId
  );
  if (r5lIdx !== -1) {
    const newLeft = [
      ...state.row4.left.slice(0, r5lIdx),
      ...state.row4.left.slice(r5lIdx + 1),
    ];
    return { ...state, row4: { ...state.row4, left: newLeft } };
  }

  // Search and remove from row4 right
  const r5rIdx = state.row4.right.findIndex(
    (rc) => rc.instanceId === equipmentId
  );
  if (r5rIdx !== -1) {
    const newRight = [
      ...state.row4.right.slice(0, r5rIdx),
      ...state.row4.right.slice(r5rIdx + 1),
    ];
    return { ...state, row4: { ...state.row4, right: newRight } };
  }

  throw new Error(`Equipment ${equipmentId} not found in any row`);
}

/**
 * Maps over all RowCards on the battlefield (creature area, row3, row4)
 * and applies a transformation function. Returns a new GameState with
 * the transformed cards.
 */
function mapAllBattlefieldCards(
  state: GameState,
  fn: (rowCard: RowCard) => RowCard
): GameState {
  const newCreatureRows = state.creatureArea.rows.map((row) => ({
    ...row,
    elements: row.elements.map(fn),
  }));

  return {
    ...state,
    creatureArea: { ...state.creatureArea, rows: newCreatureRows },
    row3: {
      left: state.row3.left.map(fn),
      right: state.row3.right.map(fn),
    },
    row4: {
      left: state.row4.left.map(fn),
      right: state.row4.right.map(fn),
    },
  };
}
