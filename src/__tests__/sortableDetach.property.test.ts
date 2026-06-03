import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  CardData,
  CardType,
  GameState,
  RowCard,
  RowTarget,
  Attachment,
} from '../types';
import { createRowCard } from '../gameActions';
import {
  isAttachedEquipment,
  findParentCreature,
  detachEquipment,
  reattachEquipment,
  getRowCards,
  setRowCards,
} from '../sortableHelpers';

/**
 * Property 2: Card Count Invariant (Detach Operations)
 *
 * For any equipment detach operation (equipment moved to row, zone, or
 * re-equipped to another creature), the total number of card instances
 * across all zones SHALL remain constant. The detached equipment SHALL
 * no longer appear in the original creature's attachments array AND SHALL
 * appear exactly once in the target row or zone. When re-equipped, the
 * equipment SHALL appear in the new creature's attachments array and SHALL
 * NOT appear in the original creature's attachments array.
 *
 * **Validates: Requirements 7.4, 7.5, 7.6**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

/** Generates a creature CardData with a unique ID */
function creatureCardArb(idSuffix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 15 }),
      fc.integer({ min: 1, max: 10 }),
      fc.integer({ min: 1, max: 10 })
    )
    .map(([name, power, toughness]) => ({
      id: `creature-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
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

/** Generates an equipment CardData with a unique ID */
function equipmentCardArb(idSuffix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(fc.string({ minLength: 1, maxLength: 15 }))
    .map(([name]) => ({
      id: `equip-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
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
      oracleText: 'Equipped creature gets +2/+2',
      isCommander: false,
      keywords: [],
      basePower: null,
      baseToughness: null,
      cardType: 'artifact' as CardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Creates an empty GameState for testing */
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
 * Counts total card instances across the entire game state.
 * Includes: standalone RowCards on battlefield + their attachments +
 * hand + commandZone + graveyard + library + exile.
 */
function countTotalCards(state: GameState): number {
  let count = 0;

  // Battlefield standalone cards + their attachments
  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      count += 1; // the card itself
      count += rc.attachments.length; // its attachments
    }
  }
  for (const rc of [...state.row3.left, ...state.row3.right, ...state.row4.left, ...state.row4.right]) {
    count += 1;
    count += rc.attachments.length;
  }

  // Off-battlefield zones
  count += state.hand.length;
  count += state.commandZone.length;
  count += state.graveyard.length;
  count += state.library.length;
  count += state.exile.length;

  return count;
}

/** Target row for detach-to-standalone operations */
const targetRowArb: fc.Arbitrary<RowTarget> = fc.constantFrom(
  'creature-1',
  'creature-2',
  'creature-3',
  'row3-lands',
  'row3-artifacts',
  'row4-lands',
  'row4-enchantments'
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 2: Card Count Invariant (Detach Operations)', () => {
  it('detachEquipment preserves total card count (equipment detached to standalone in target row)', () => {
    fc.assert(
      fc.property(
        creatureCardArb('src'),
        equipmentCardArb('det'),
        targetRowArb,
        (creatureCard, equipmentCard, targetRow) => {
          // Setup: creature with one attached equipment
          let state = emptyGameState();
          const creature = createRowCard(creatureCard, 'creature-1', 0);
          const attachment: Attachment = {
            card: equipmentCard,
            instanceId: equipmentCard.id,
            isTapped: false,
          };
          creature.attachments = [attachment];
          state.creatureArea.rows[0].elements = [creature];
          state.creatureArea.totalElementCount = 1;

          const countBefore = countTotalCards(state);

          // Perform detach
          const detachedState = detachEquipment(state, equipmentCard.id, creatureCard.id);

          // Place equipment as standalone in target row
          const equipRowCard = createRowCard(equipmentCard, targetRow, 0);
          const rowCards = getRowCards(detachedState, targetRow);
          const finalState = setRowCards(detachedState, targetRow, [...rowCards, equipRowCard]);

          const countAfter = countTotalCards(finalState);

          // Total card count unchanged
          expect(countAfter).toBe(countBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detachEquipment removes equipment from original creature attachments', () => {
    fc.assert(
      fc.property(
        creatureCardArb('src'),
        equipmentCardArb('det'),
        (creatureCard, equipmentCard) => {
          // Setup: creature with attached equipment
          let state = emptyGameState();
          const creature = createRowCard(creatureCard, 'creature-1', 0);
          const attachment: Attachment = {
            card: equipmentCard,
            instanceId: equipmentCard.id,
            isTapped: false,
          };
          creature.attachments = [attachment];
          state.creatureArea.rows[0].elements = [creature];

          // Perform detach
          const detachedState = detachEquipment(state, equipmentCard.id, creatureCard.id);

          // Equipment no longer in source creature's attachments
          const sourceCreature = detachedState.creatureArea.rows[0].elements.find(
            rc => rc.instanceId === creatureCard.id
          );
          expect(sourceCreature).toBeDefined();
          expect(sourceCreature!.attachments.some(a => a.instanceId === equipmentCard.id)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after detach + place as standalone, equipment appears exactly once in target location', () => {
    fc.assert(
      fc.property(
        creatureCardArb('src'),
        equipmentCardArb('det'),
        targetRowArb,
        (creatureCard, equipmentCard, targetRow) => {
          // Setup: creature with attached equipment
          let state = emptyGameState();
          const creature = createRowCard(creatureCard, 'creature-1', 0);
          const attachment: Attachment = {
            card: equipmentCard,
            instanceId: equipmentCard.id,
            isTapped: false,
          };
          creature.attachments = [attachment];
          state.creatureArea.rows[0].elements = [creature];

          // Perform detach + place as standalone
          const detachedState = detachEquipment(state, equipmentCard.id, creatureCard.id);
          const equipRowCard = createRowCard(equipmentCard, targetRow, 0);
          const rowCards = getRowCards(detachedState, targetRow);
          const finalState = setRowCards(detachedState, targetRow, [...rowCards, equipRowCard]);

          // Equipment appears exactly once in target row
          const targetCards = getRowCards(finalState, targetRow);
          const equipOccurrences = targetCards.filter(rc => rc.instanceId === equipmentCard.id);
          expect(equipOccurrences).toHaveLength(1);

          // Equipment does NOT appear in any attachments array
          expect(isAttachedEquipment(equipmentCard.id, finalState)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reattachEquipment preserves total card count', () => {
    fc.assert(
      fc.property(
        creatureCardArb('src'),
        creatureCardArb('tgt'),
        equipmentCardArb('reattach'),
        (sourceCreatureCard, targetCreatureCard, equipmentCard) => {
          // Setup: two creatures, equipment attached to source
          let state = emptyGameState();
          const sourceCreature = createRowCard(sourceCreatureCard, 'creature-1', 0);
          const targetCreature = createRowCard(targetCreatureCard, 'creature-1', 1);
          const attachment: Attachment = {
            card: equipmentCard,
            instanceId: equipmentCard.id,
            isTapped: false,
          };
          sourceCreature.attachments = [attachment];
          state.creatureArea.rows[0].elements = [sourceCreature, targetCreature];
          state.creatureArea.totalElementCount = 2;

          const countBefore = countTotalCards(state);

          // Perform reattach
          const newState = reattachEquipment(
            state,
            equipmentCard.id,
            sourceCreatureCard.id,
            targetCreatureCard.id
          );

          const countAfter = countTotalCards(newState);

          // Total card count unchanged
          expect(countAfter).toBe(countBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reattachEquipment moves equipment to new creature and removes from original', () => {
    fc.assert(
      fc.property(
        creatureCardArb('src'),
        creatureCardArb('tgt'),
        equipmentCardArb('reattach'),
        (sourceCreatureCard, targetCreatureCard, equipmentCard) => {
          // Setup: two creatures, equipment attached to source
          let state = emptyGameState();
          const sourceCreature = createRowCard(sourceCreatureCard, 'creature-1', 0);
          const targetCreature = createRowCard(targetCreatureCard, 'creature-1', 1);
          const attachment: Attachment = {
            card: equipmentCard,
            instanceId: equipmentCard.id,
            isTapped: false,
          };
          sourceCreature.attachments = [attachment];
          state.creatureArea.rows[0].elements = [sourceCreature, targetCreature];

          // Perform reattach
          const newState = reattachEquipment(
            state,
            equipmentCard.id,
            sourceCreatureCard.id,
            targetCreatureCard.id
          );

          // Equipment NOT in source creature's attachments
          const srcCreature = newState.creatureArea.rows[0].elements.find(
            rc => rc.instanceId === sourceCreatureCard.id
          );
          expect(srcCreature).toBeDefined();
          expect(srcCreature!.attachments.some(a => a.instanceId === equipmentCard.id)).toBe(false);

          // Equipment IS in target creature's attachments
          const tgtCreature = newState.creatureArea.rows[0].elements.find(
            rc => rc.instanceId === targetCreatureCard.id
          );
          expect(tgtCreature).toBeDefined();
          expect(tgtCreature!.attachments.some(a => a.instanceId === equipmentCard.id)).toBe(true);

          // Equipment appears exactly once across all attachments
          const allAttachmentIds: string[] = [];
          for (const row of newState.creatureArea.rows) {
            for (const rc of row.elements) {
              for (const att of rc.attachments) {
                allAttachmentIds.push(att.instanceId);
              }
            }
          }
          const equipOccurrences = allAttachmentIds.filter(id => id === equipmentCard.id);
          expect(equipOccurrences).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detach with multiple equipment preserves card count and only removes the targeted one', () => {
    fc.assert(
      fc.property(
        creatureCardArb('src'),
        equipmentCardArb('eq1'),
        equipmentCardArb('eq2'),
        targetRowArb,
        (creatureCard, equip1Card, equip2Card, targetRow) => {
          // Setup: creature with two attached equipment
          let state = emptyGameState();
          const creature = createRowCard(creatureCard, 'creature-1', 0);
          const att1: Attachment = { card: equip1Card, instanceId: equip1Card.id, isTapped: false };
          const att2: Attachment = { card: equip2Card, instanceId: equip2Card.id, isTapped: false };
          creature.attachments = [att1, att2];
          state.creatureArea.rows[0].elements = [creature];
          state.creatureArea.totalElementCount = 1;

          const countBefore = countTotalCards(state);

          // Detach only equip1
          const detachedState = detachEquipment(state, equip1Card.id, creatureCard.id);
          const equipRowCard = createRowCard(equip1Card, targetRow, 0);
          const rowCards = getRowCards(detachedState, targetRow);
          const finalState = setRowCards(detachedState, targetRow, [...rowCards, equipRowCard]);

          // Total card count unchanged
          expect(countTotalCards(finalState)).toBe(countBefore);

          // equip1 no longer attached
          const srcCreature = finalState.creatureArea.rows[0].elements.find(
            rc => rc.instanceId === creatureCard.id
          );
          expect(srcCreature!.attachments.some(a => a.instanceId === equip1Card.id)).toBe(false);

          // equip2 still attached
          expect(srcCreature!.attachments.some(a => a.instanceId === equip2Card.id)).toBe(true);

          // equip1 appears exactly once as standalone in target row
          const targetCards = getRowCards(finalState, targetRow);
          expect(targetCards.filter(rc => rc.instanceId === equip1Card.id)).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
