import { arrayMove } from '@dnd-kit/sortable';
import type { GameState, RowCard, RowTarget, Attachment } from './types';

/**
 * Checks whether a given cardId is currently attached as equipment/aura
 * on any card on the battlefield.
 *
 * Requirements: 6.7, 6.8, 6.9
 */
export function isAttachedEquipment(cardId: string, state: GameState): boolean {
  const allBattlefieldCards = [
    ...state.creatureArea.rows.flatMap(r => r.elements),
    ...state.row3.left,
    ...state.row3.right,
    ...state.row4.left,
    ...state.row4.right,
  ];
  return allBattlefieldCards.some(rc =>
    rc.attachments.some(a => a.instanceId === cardId)
  );
}

/**
 * Finds the instanceId of the creature that currently has the given
 * equipment attached. Returns undefined if not found.
 *
 * Requirements: 6.7, 6.8, 6.9
 */
export function findParentCreature(
  equipmentId: string,
  state: GameState
): string | undefined {
  const allBattlefieldCards = [
    ...state.creatureArea.rows.flatMap(r => r.elements),
    ...state.row3.left,
    ...state.row3.right,
    ...state.row4.left,
    ...state.row4.right,
  ];
  const parent = allBattlefieldCards.find(rc =>
    rc.attachments.some(a => a.instanceId === equipmentId)
  );
  return parent?.instanceId;
}

/**
 * Returns the RowCard array for a given rowId.
 *
 * Requirements: 7.4, 7.5, 7.6
 */
export function getRowCards(state: GameState, rowId: RowTarget): RowCard[] {
  if (rowId.startsWith('creature-')) {
    const idx = parseInt(rowId.replace('creature-', ''), 10) - 1;
    return state.creatureArea.rows[idx]?.elements ?? [];
  }
  if (rowId === 'row3-lands') return state.row3.left;
  if (rowId === 'row3-artifacts') return state.row3.right;
  if (rowId === 'row4-lands') return state.row4.left;
  if (rowId === 'row4-enchantments') return state.row4.right;
  return [];
}

/**
 * Returns a new GameState with the specified row's cards replaced.
 *
 * Requirements: 7.4, 7.5, 7.6
 */
export function setRowCards(
  state: GameState,
  rowId: RowTarget,
  cards: RowCard[]
): GameState {
  if (rowId.startsWith('creature-')) {
    const idx = parseInt(rowId.replace('creature-', ''), 10) - 1;
    const newRows = state.creatureArea.rows.map((r, i) =>
      i === idx ? { ...r, elements: cards } : r
    );
    return {
      ...state,
      creatureArea: { ...state.creatureArea, rows: newRows },
    };
  }
  if (rowId === 'row3-lands') {
    return { ...state, row3: { ...state.row3, left: cards } };
  }
  if (rowId === 'row3-artifacts') {
    return { ...state, row3: { ...state.row3, right: cards } };
  }
  if (rowId === 'row4-lands') {
    return { ...state, row4: { ...state.row4, left: cards } };
  }
  if (rowId === 'row4-enchantments') {
    return { ...state, row4: { ...state.row4, right: cards } };
  }
  return state;
}

/**
 * Removes an equipment card from a creature's attachments array.
 * Does NOT place the equipment elsewhere — the caller is responsible
 * for placing the detached equipment in its target location.
 *
 * Preconditions:
 * - equipmentId exists in sourceCreatureId's attachments array
 * - sourceCreatureId exists on the battlefield
 *
 * Postconditions:
 * - Equipment no longer in source creature's attachments
 * - Total card count unchanged (equipment is removed from attachments only)
 * - No duplicate instanceIds
 *
 * Requirements: 7.4, 7.5
 */
export function detachEquipment(
  state: GameState,
  equipmentId: string,
  sourceCreatureId: string
): GameState {
  const mapRow = (cards: RowCard[]): RowCard[] =>
    cards.map(rc => {
      if (rc.instanceId !== sourceCreatureId) return rc;
      return {
        ...rc,
        attachments: rc.attachments.filter(a => a.instanceId !== equipmentId),
      };
    });

  return {
    ...state,
    creatureArea: {
      ...state.creatureArea,
      rows: state.creatureArea.rows.map(r => ({
        ...r,
        elements: mapRow(r.elements),
      })),
    },
    row3: {
      ...state.row3,
      left: mapRow(state.row3.left),
      right: mapRow(state.row3.right),
    },
    row4: {
      ...state.row4,
      left: mapRow(state.row4.left),
      right: mapRow(state.row4.right),
    },
  };
}

/**
 * Detaches equipment from one creature and immediately attaches it to another.
 * Combines detach + attach in a single state transition to prevent intermediate
 * states where the equipment exists in neither location.
 *
 * Preconditions:
 * - equipmentId exists in sourceCreatureId's attachments
 * - targetCreatureId exists on the battlefield
 * - sourceCreatureId !== targetCreatureId
 *
 * Postconditions:
 * - Equipment removed from source creature's attachments
 * - Equipment added to target creature's attachments
 * - Total card count unchanged
 * - Equipment appears in exactly one attachments array
 *
 * Requirements: 7.4, 7.5, 7.6
 */
export function reattachEquipment(
  state: GameState,
  equipmentId: string,
  sourceCreatureId: string,
  targetCreatureId: string
): GameState {
  // Step 1: Find the equipment attachment on the source creature
  const allCards = [
    ...state.creatureArea.rows.flatMap(r => r.elements),
    ...state.row3.left,
    ...state.row3.right,
    ...state.row4.left,
    ...state.row4.right,
  ];
  const sourceCreature = allCards.find(
    rc => rc.instanceId === sourceCreatureId
  );
  const equipmentAttachment = sourceCreature?.attachments.find(
    a => a.instanceId === equipmentId
  );
  if (!equipmentAttachment) return state;

  // Step 2: Remove from source creature's attachments
  const detached = detachEquipment(state, equipmentId, sourceCreatureId);

  // Step 3: Add to target creature's attachments
  const addToTarget = (cards: RowCard[]): RowCard[] =>
    cards.map(rc => {
      if (rc.instanceId !== targetCreatureId) return rc;
      return {
        ...rc,
        attachments: [...rc.attachments, equipmentAttachment],
      };
    });

  return {
    ...detached,
    creatureArea: {
      ...detached.creatureArea,
      rows: detached.creatureArea.rows.map(r => ({
        ...r,
        elements: addToTarget(r.elements),
      })),
    },
    row3: {
      ...detached.row3,
      left: addToTarget(detached.row3.left),
      right: addToTarget(detached.row3.right),
    },
    row4: {
      ...detached.row4,
      left: addToTarget(detached.row4.left),
      right: addToTarget(detached.row4.right),
    },
  };
}

/**
 * Reorder a card within a row using arrayMove.
 * Returns new GameState with the card moved from oldIndex to newIndex.
 *
 * Requirements: 7.4, 7.5, 7.6
 */
export function reorderWithinRow(
  state: GameState,
  rowId: RowTarget,
  oldIndex: number,
  newIndex: number
): GameState {
  const cards = getRowCards(state, rowId);
  if (oldIndex < 0 || oldIndex >= cards.length || newIndex < 0 || newIndex >= cards.length) {
    return state; // Invalid indices — no-op
  }
  const reordered = arrayMove(cards, oldIndex, newIndex);
  return setRowCards(state, rowId, reordered);
}
