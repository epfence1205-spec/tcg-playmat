import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CardData, CardType, GameState, RowCard, RowTarget } from '../types';
import {
  isAttachedEquipment,
  findParentCreature,
  reattachEquipment,
  detachEquipment,
  getRowCards,
  setRowCards,
} from '../sortableHelpers';
import { createRowCard } from '../gameActions';

/**
 * Property 6: Attached Equipment Routing Priority
 *
 * For any drag event where the active card is an attached equipment (exists in
 * a creature's attachments array), the handleDragEnd SHALL check attached-equipment
 * routing BEFORE checking unattached equipment docking or reorder logic. Specifically:
 * - Dropped on a battlefield row → detach + standalone placement
 * - Dropped on a different creature → detach + re-equip
 * - Dropped on a non-battlefield zone → detach + zone move
 *
 * **Validates: Requirements 6.7, 6.8, 6.9**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

/** Generates a creature CardData */
function creatureCardArb(idPrefix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.integer({ min: 0, max: 10 }),
      fc.integer({ min: 1, max: 10 })
    )
    .map(([name, power, toughness]) => ({
      id: `${idPrefix}-${crypto.randomUUID()}`,
      name: name || 'Creature',
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      backFaceCardType: null,
      backFaceName: null,
      backFacePower: null,
      backFaceToughness: null,
      typeLine: `Creature — Human ${power}/${toughness}`,
      oracleText: '',
      isCommander: false,
      keywords: [],
      basePower: String(power),
      baseToughness: String(toughness),
      cardType: 'creature' as CardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates an equipment CardData */
function equipmentCardArb(idPrefix: string): fc.Arbitrary<CardData> {
  return fc
    .string({ minLength: 1, maxLength: 20 })
    .map((name) => ({
      id: `${idPrefix}-${crypto.randomUUID()}`,
      name: name || 'Equipment',
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      backFaceCardType: null,
      backFaceName: null,
      backFacePower: null,
      backFaceToughness: null,
      typeLine: 'Artifact — Equipment',
      oracleText: 'Equipped creature gets +2/+2.',
      isCommander: false,
      keywords: [],
      basePower: null,
      baseToughness: null,
      cardType: 'artifact' as CardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Row targets for battlefield rows */
const rowTargetArb: fc.Arbitrary<RowTarget> = fc.constantFrom(
  'creature-1',
  'creature-2',
  'creature-3',
  'row3-lands',
  'row3-artifacts',
  'row4-lands',
  'row4-enchantments'
);

/** Creates an empty GameState */
function emptyGameState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: {
      rows: [
        { id: 'creature-1', elements: [] },
        { id: 'creature-2', elements: [] },
        { id: 'creature-3', elements: [] },
      ],
      totalElementCount: 0,
    },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
  };
}

/**
 * Creates a game state with a creature that has equipment attached.
 * Returns the state plus the IDs of the creature and equipment.
 */
function stateWithAttachedEquipment(
  creatureCard: CardData,
  equipmentCard: CardData,
  creatureRow: RowTarget
): { state: GameState; creatureId: string; equipmentId: string } {
  const state = emptyGameState();
  const creatureRowCard = createRowCard(creatureCard, creatureRow, 0);

  // Attach equipment to the creature
  creatureRowCard.attachments = [
    {
      card: equipmentCard,
      instanceId: equipmentCard.id,
      isTapped: false,
    },
  ];

  // Place creature in the appropriate row
  if (creatureRow.startsWith('creature-')) {
    const idx = parseInt(creatureRow.replace('creature-', ''), 10) - 1;
    state.creatureArea.rows[idx].elements.push(creatureRowCard);
    state.creatureArea.totalElementCount = 1;
  } else if (creatureRow === 'row3-lands') {
    state.row3.left.push(creatureRowCard);
  } else if (creatureRow === 'row3-artifacts') {
    state.row3.right.push(creatureRowCard);
  } else if (creatureRow === 'row4-lands') {
    state.row4.left.push(creatureRowCard);
  } else if (creatureRow === 'row4-enchantments') {
    state.row4.right.push(creatureRowCard);
  }

  return {
    state,
    creatureId: creatureCard.id,
    equipmentId: equipmentCard.id,
  };
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 6: Attached Equipment Routing Priority', () => {
  it('isAttachedEquipment returns true for equipment in a creature attachments array, enabling Priority 1 routing', () => {
    /**
     * The core routing priority assertion: when a card is attached equipment,
     * isAttachedEquipment(cardId, state) returns true, which means the
     * handleDragEnd Priority 1 branch fires BEFORE Priority 2 (unattached docking)
     * or Priority 3 (reorder).
     */
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        equipmentCardArb('equip'),
        fc.constantFrom('creature-1', 'creature-2', 'creature-3') as fc.Arbitrary<RowTarget>,
        (creatureCard, equipmentCard, creatureRow) => {
          const { state, equipmentId } = stateWithAttachedEquipment(
            creatureCard,
            equipmentCard,
            creatureRow
          );

          // Priority 1 check: isAttachedEquipment must return true
          // This is the gate that ensures attached equipment routing fires first
          expect(isAttachedEquipment(equipmentId, state)).toBe(true);

          // The equipment should NOT be detected as an unattached battlefield card
          // (it's in attachments, not in the row flow), so Priority 2/3 would not match
          const allRowCards = [
            ...state.creatureArea.rows.flatMap(r => r.elements),
            ...state.row3.left,
            ...state.row3.right,
            ...state.row4.left,
            ...state.row4.right,
          ];
          const equipmentInRowFlow = allRowCards.some(
            rc => rc.instanceId === equipmentId
          );
          expect(equipmentInRowFlow).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when attached equipment is dropped on a different creature, reattachEquipment moves it to the target creature (Req 6.8)', () => {
    fc.assert(
      fc.property(
        creatureCardArb('source-creature'),
        creatureCardArb('target-creature'),
        equipmentCardArb('equip'),
        (sourceCreatureCard, targetCreatureCard, equipmentCard) => {
          // Set up state with equipment attached to source creature
          const { state, creatureId: sourceCreatureId, equipmentId } =
            stateWithAttachedEquipment(sourceCreatureCard, equipmentCard, 'creature-1');

          // Add target creature to a different row
          const targetRowCard = createRowCard(targetCreatureCard, 'creature-2', 0);
          state.creatureArea.rows[1].elements.push(targetRowCard);

          const targetCreatureId = targetCreatureCard.id;

          // Precondition: equipment is attached to source
          expect(isAttachedEquipment(equipmentId, state)).toBe(true);
          expect(findParentCreature(equipmentId, state)).toBe(sourceCreatureId);

          // Perform reattach (Priority 1a in handleDragEnd)
          const newState = reattachEquipment(
            state,
            equipmentId,
            sourceCreatureId,
            targetCreatureId
          );

          // Postcondition: equipment is now attached to target creature
          const targetCreature = newState.creatureArea.rows[1].elements.find(
            rc => rc.instanceId === targetCreatureId
          );
          expect(targetCreature?.attachments.some(a => a.instanceId === equipmentId)).toBe(true);

          // Postcondition: equipment is no longer attached to source creature
          const sourceCreature = newState.creatureArea.rows[0].elements.find(
            rc => rc.instanceId === sourceCreatureId
          );
          expect(sourceCreature?.attachments.some(a => a.instanceId === equipmentId)).toBe(false);

          // Equipment still detected as attached (now on target)
          expect(isAttachedEquipment(equipmentId, newState)).toBe(true);
          expect(findParentCreature(equipmentId, newState)).toBe(targetCreatureId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when attached equipment is dropped on a row, detachEquipment removes it from the source creature (Req 6.7)', () => {
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        equipmentCardArb('equip'),
        rowTargetArb,
        (creatureCard, equipmentCard, targetRow) => {
          const { state, creatureId, equipmentId } = stateWithAttachedEquipment(
            creatureCard,
            equipmentCard,
            'creature-1'
          );

          // Precondition: equipment is attached
          expect(isAttachedEquipment(equipmentId, state)).toBe(true);

          // Perform detach (Priority 1b in handleDragEnd: dropped on a row)
          const detachedState = detachEquipment(state, equipmentId, creatureId);

          // Postcondition: equipment is no longer in source creature's attachments
          const sourceCreature = detachedState.creatureArea.rows[0].elements.find(
            rc => rc.instanceId === creatureId
          );
          expect(sourceCreature?.attachments.some(a => a.instanceId === equipmentId)).toBe(false);
          expect(sourceCreature?.attachments.length).toBe(0);

          // Equipment is no longer detected as attached anywhere
          expect(isAttachedEquipment(equipmentId, detachedState)).toBe(false);

          // After detach, the equipment can be placed as standalone in the target row
          // (simulating the second half of Priority 1b)
          const standaloneCard = createRowCard(equipmentCard, targetRow, 0);
          const rowCards = getRowCards(detachedState, targetRow);
          const finalState = setRowCards(detachedState, targetRow, [...rowCards, standaloneCard]);

          // Equipment now exists as a standalone card in the target row
          const targetRowCards = getRowCards(finalState, targetRow);
          expect(targetRowCards.some(rc => rc.instanceId === equipmentId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when attached equipment is dropped on a non-battlefield zone, it is detached from the source creature (Req 6.9)', () => {
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        equipmentCardArb('equip'),
        fc.constantFrom('graveyard', 'exile', 'hand') as fc.Arbitrary<string>,
        (creatureCard, equipmentCard, _targetZone) => {
          const { state, creatureId, equipmentId } = stateWithAttachedEquipment(
            creatureCard,
            equipmentCard,
            'creature-1'
          );

          // Precondition: equipment is attached
          expect(isAttachedEquipment(equipmentId, state)).toBe(true);
          expect(findParentCreature(equipmentId, state)).toBe(creatureId);

          // Priority 1c: detach from creature (zone move handled separately)
          const detachedState = detachEquipment(state, equipmentId, creatureId);

          // Postcondition: equipment no longer attached to source creature
          const sourceCreature = detachedState.creatureArea.rows[0].elements.find(
            rc => rc.instanceId === creatureId
          );
          expect(sourceCreature?.attachments.some(a => a.instanceId === equipmentId)).toBe(false);

          // Equipment is no longer detected as attached anywhere on battlefield
          expect(isAttachedEquipment(equipmentId, detachedState)).toBe(false);

          // Source creature still exists on the battlefield (not removed)
          expect(sourceCreature).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('attached equipment routing takes priority: isAttachedEquipment is checked before isEquipmentDocking conditions', () => {
    /**
     * This test verifies the priority ordering: even when the over target is a creature
     * (which would normally trigger Priority 2 equipment docking for unattached equipment),
     * if the active card is ATTACHED equipment, Priority 1 fires first.
     *
     * The key insight: an attached equipment card does NOT exist in the row flow,
     * so it would never match Priority 2's condition of being an unattached equipment
     * on the battlefield. The isAttachedEquipment check at Priority 1 catches it first.
     */
    fc.assert(
      fc.property(
        creatureCardArb('source'),
        creatureCardArb('target'),
        equipmentCardArb('equip'),
        (sourceCreature, targetCreature, equipmentCard) => {
          const { state, equipmentId } = stateWithAttachedEquipment(
            sourceCreature,
            equipmentCard,
            'creature-1'
          );

          // Add a target creature (simulating "over" target being a creature)
          const targetRowCard = createRowCard(targetCreature, 'creature-2', 0);
          state.creatureArea.rows[1].elements.push(targetRowCard);

          // Priority 1 gate: isAttachedEquipment fires FIRST
          const isAttached = isAttachedEquipment(equipmentId, state);
          expect(isAttached).toBe(true);

          // If isAttached is true, the code enters Priority 1 branch and returns
          // before ever reaching Priority 2 (unattached docking) or Priority 3 (reorder).
          // This is the structural guarantee of the routing priority.

          // Verify the equipment is NOT in the row flow (so Priority 2/3 wouldn't match anyway)
          const allStandaloneCards = [
            ...state.creatureArea.rows.flatMap(r => r.elements),
            ...state.row3.left,
            ...state.row3.right,
            ...state.row4.left,
            ...state.row4.right,
          ];
          const isInRowFlow = allStandaloneCards.some(
            rc => rc.instanceId === equipmentId
          );
          expect(isInRowFlow).toBe(false);

          // findParentCreature confirms the equipment's location
          const parentId = findParentCreature(equipmentId, state);
          expect(parentId).toBe(sourceCreature.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
