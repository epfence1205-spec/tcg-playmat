import type { GameState, RowCard, CardType } from '../types';
import { attachEquipment, detachEquipment } from '../equipmentActions';
import { findCardOnBattlefield } from '../gameActions';

/**
 * Result interface for the equipment docking hook.
 */
export interface EquipmentDockingResult {
  /**
   * Handles a drag-end event to determine if equipment docking/undocking should occur.
   *
   * Returns `true` if the drop was handled as an equipment docking operation
   * (attach or detach), meaning normal drop logic should be skipped.
   * Returns `false` if this is not an equipment docking scenario and normal
   * drop logic should proceed.
   *
   * @param draggedCardId - The ID of the card being dragged
   * @param draggedCardType - The cardType of the dragged card (e.g., 'artifact', 'creature')
   * @param targetId - The droppable target ID (e.g., 'row-creature-1', a card instanceId)
   * @param targetData - The data attached to the droppable target (e.g., { rowId, cardId, cardType })
   */
  handleEquipmentDrop: (
    draggedCardId: string,
    draggedCardType: CardType,
    targetId: string,
    targetData: Record<string, unknown> | undefined
  ) => boolean;
}

/**
 * Checks if a card is an equipment based on its typeLine.
 * Equipment cards have "Equipment" in their type line (e.g., "Artifact — Equipment").
 */
export function isEquipmentCard(typeLine: string): boolean {
  return /\bequipment\b/i.test(typeLine);
}

/**
 * Checks if a card is an aura based on its typeLine.
 * Aura cards have "Aura" in their type line (e.g., "Enchantment — Aura").
 */
export function isAuraCard(typeLine: string): boolean {
  return /\baura\b/i.test(typeLine);
}

/**
 * Checks if a card can be docked (attached) to a creature.
 * Equipment and Aura cards can be docked.
 */
export function isDockableCard(typeLine: string, cardType: CardType): boolean {
  if (cardType === 'artifact' && isEquipmentCard(typeLine)) return true;
  if (cardType === 'artifact' && /\bfortification\b/i.test(typeLine)) return true;
  if (cardType === 'enchantment' && isAuraCard(typeLine)) return true;
  return false;
}

/**
 * Determines the valid target card types for an equipment/aura attachment.
 * Based on oracle text "enchant X" for auras, or fixed rules for equipment/fortification.
 *
 * @returns Array of CardType values that this card can legally attach to.
 *          Empty array means no valid permanent targets (e.g., "enchant player").
 */
export function getValidDockTargets(oracleText: string, typeLine: string, cardType: CardType): CardType[] {
  // Equipment always targets creatures
  if (cardType === 'artifact' && isEquipmentCard(typeLine)) return ['creature'];
  // Fortification always targets lands
  if (cardType === 'artifact' && /\bfortification\b/i.test(typeLine)) return ['land'];

  // Auras — parse "enchant X" from oracle text
  if (cardType === 'enchantment' && isAuraCard(typeLine)) {
    const lower = oracleText.toLowerCase();
    if (/enchant permanent/i.test(lower)) return ['creature', 'land', 'artifact', 'enchantment', 'planeswalker'];
    if (/enchant (a |tapped )?creature/i.test(lower)) return ['creature'];
    if (/enchant (land|forest|island|mountain|plains|swamp)/i.test(lower)) return ['land'];
    if (/enchant artifact/i.test(lower)) return ['artifact'];
    if (/enchant enchantment/i.test(lower)) return ['enchantment'];
    if (/enchant planeswalker/i.test(lower)) return ['planeswalker'];
    if (/enchant (player|opponent)/i.test(lower)) return [];
    // Default: auras without explicit "enchant X" target creatures
    return ['creature'];
  }

  return [];
}

/**
 * Finds the creature that a given equipment is currently attached to.
 * Returns the creature's instanceId, or null if the equipment is not attached.
 */
export function findAttachedCreatureId(
  state: GameState,
  equipmentId: string
): string | null {
  // Search creature area rows
  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      const attached = rc.attachments.find((a) => a.instanceId === equipmentId);
      if (attached) return rc.instanceId;
    }
  }

  // Search row3
  for (const rc of [...state.row3.left, ...state.row3.right]) {
    const attached = rc.attachments.find((a) => a.instanceId === equipmentId);
    if (attached) return rc.instanceId;
  }

  // Search row4
  for (const rc of [...state.row4.left, ...state.row4.right]) {
    const attached = rc.attachments.find((a) => a.instanceId === equipmentId);
    if (attached) return rc.instanceId;
  }

  return null;
}

/**
 * Hook that provides equipment docking logic for drag-and-drop interactions.
 *
 * Implements Requirements 9.4 and 9.10:
 * - 9.4: WHEN a user drags an Equipment card onto a creature, trigger equipment docking
 * - 9.10: Support undocking via drag-away from creature
 *
 * Usage: Call `handleEquipmentDrop` in the `onDragEnd` handler. If it returns `true`,
 * the drop was handled as an equipment operation and normal drop logic should be skipped.
 *
 * @param state - Current game state
 * @param setState - State setter function to apply equipment actions
 */
export function useEquipmentDocking(
  state: GameState,
  setState: (updater: (prev: GameState) => GameState) => void
): EquipmentDockingResult {
  const handleEquipmentDrop = (
    draggedCardId: string,
    draggedCardType: CardType,
    targetId: string,
    targetData: Record<string, unknown> | undefined
  ): boolean => {
    // ─── Case 1: Attaching equipment to a valid target ─────────────────────────
    // The dragged card is an equipment/aura and the target is a valid dock target
    if (targetData?.cardId && targetData?.cardType) {
      const targetCardType = targetData.cardType as CardType;
      const targetCardId = targetData.cardId as string;

      // Find the dragged card to check if it's dockable
      const draggedResult = findCardOnBattlefield(state, draggedCardId);
      if (!draggedResult) return false;

      const typeLine = draggedResult.card.card.typeLine;
      const oracleText = draggedResult.card.card.oracleText;
      if (!isDockableCard(typeLine, draggedCardType)) return false;

      // Check if the target type is valid for this attachment
      const validTargets = getValidDockTargets(oracleText, typeLine, draggedCardType);
      if (!validTargets.includes(targetCardType)) return false;

      // Don't attach to self
      if (draggedCardId === targetCardId) return false;

      // Perform the attach
      try {
        setState((prev) => attachEquipment(prev, draggedCardId, targetCardId));
        return true;
      } catch {
        return false;
      }
    }

    // ─── Case 2: Detaching equipment by dragging away from creature ────────
    // The dragged card is currently attached to a creature and is dropped on a row/zone
    const attachedCreatureId = findAttachedCreatureId(state, draggedCardId);
    if (attachedCreatureId) {
      // The equipment is currently docked — check if it's being dropped on a row (not back on the same creature)
      const isDroppedOnRow =
        targetData?.rowId !== undefined ||
        targetData?.type === 'row' ||
        targetId.startsWith('row-');

      const isDroppedOnZone =
        targetId === 'hand-zone' ||
        targetId === 'commandZone' ||
        targetId === 'graveyard' ||
        targetId === 'library' ||
        targetId === 'exile';

      // If dropped on the same creature it's attached to, do nothing special
      if (targetData?.cardId === attachedCreatureId) return false;

      if (isDroppedOnRow || isDroppedOnZone) {
        // Detach the equipment from the creature
        try {
          setState((prev) => detachEquipment(prev, draggedCardId, attachedCreatureId));
          return true;
        } catch {
          return false;
        }
      }

      // If dropped on a different valid target, detach from current and attach to new
      if (targetData?.cardId && targetData?.cardType) {
        const newTargetId = targetData.cardId as string;
        const newTargetType = targetData.cardType as CardType;
        // Validate the new target is valid for this attachment
        const draggedResult = findCardOnBattlefield(state, draggedCardId);
        if (draggedResult) {
          const typeLine = draggedResult.card.card.typeLine;
          const oracleText = draggedResult.card.card.oracleText;
          const validTargets = getValidDockTargets(oracleText, typeLine, draggedCardType);
          if (validTargets.includes(newTargetType)) {
            try {
              setState((prev) => {
                const detached = detachEquipment(prev, draggedCardId, attachedCreatureId);
                return attachEquipment(detached, draggedCardId, newTargetId);
              });
              return true;
            } catch {
              return false;
            }
          }
        }
      }
    }

    return false;
  };

  return { handleEquipmentDrop };
}
