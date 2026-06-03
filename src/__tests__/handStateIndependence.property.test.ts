import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { arrayMove } from '@dnd-kit/sortable';
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
  getRowCards,
  setRowCards,
  detachEquipment,
  reattachEquipment,
} from '../sortableHelpers';

/**
 * Property 7: Hand State Independence
 *
 * *For any* battlefield reorder or equipment detach operation, the `hand` array
 * in GameState SHALL remain unchanged (same cards, same order).
 *
 * **Validates: Requirements 9.1, 9.2**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

/** Generates a CardData with a unique ID */
function cardDataArb(idPrefix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.constantFrom<CardType>(
        'creature',
        'land',
        'artifact',
        'enchantment',
        'planeswalker',
        'instant',
        'sorcery',
        'other'
      )
    )
    .map(([name, cardType]) => ({
      id: `${idPrefix}-${Math.random().toString(36).slice(2, 10)}`,
      name: name || 'Card',
      setCode: 'tst',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      backFaceCardType: null,
      backFaceName: null,
      backFacePower: null,
      backFaceToughness: null,
      typeLine: cardType === 'creature' ? 'Creature — Human' : 'Artifact — Equipment',
      oracleText: '',
      isCommander: false,
      keywords: [],
      basePower: cardType === 'creature' ? '2' : null,
      baseToughness: cardType === 'creature' ? '2' : null,
      cardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates a hand of 1-7 CardData items */
const handArb: fc.Arbitrary<CardData[]> = fc
  .integer({ min: 1, max: 7 })
  .chain((count) =>
    fc.array(cardDataArb('hand'), { minLength: count, maxLength: count })
  );

/** Generates a creature RowCard with optional equipment attachments */
function creatureWithAttachmentsArb(
  creatureIdPrefix: string,
  equipCount: number
): fc.Arbitrary<RowCard> {
  return fc
    .tuple(
      cardDataArb(creatureIdPrefix),
      fc.array(cardDataArb('equip'), { minLength: equipCount, maxLength: equipCount })
    )
    .map(([creatureCard, equipCards]) => {
      const creature = createRowCard(
        { ...creatureCard, cardType: 'creature', typeLine: 'Creature — Human', basePower: '3', baseToughness: '3' },
        'creature-1',
        0
      );
      const attachments: Attachment[] = equipCards.map((eq) => ({
        card: { ...eq, cardType: 'artifact', typeLine: 'Artifact — Equipment' },
        instanceId: eq.id,
        isTapped: false,
      }));
      return { ...creature, attachments };
    });
}

/** Generates a valid row target for battlefield operations */
const rowTargetArb: fc.Arbitrary<RowTarget> = fc.constantFrom<RowTarget>(
  'creature-1',
  'creature-2',
  'creature-3',
  'row3-lands',
  'row3-artifacts',
  'row4-lands',
  'row4-enchantments'
);

/**
 * Generates a GameState with cards in both hand and battlefield.
 * The hand has 1-7 cards, and the battlefield has 2-5 cards in a row.
 */
const gameStateWithHandAndBattlefieldArb: fc.Arbitrary<{
  state: GameState;
  rowId: RowTarget;
}> = fc
  .tuple(
    handArb,
    fc.integer({ min: 2, max: 5 }),
    rowTargetArb
  )
  .chain(([handCards, battlefieldCount, rowId]) =>
    fc
      .array(cardDataArb('bf'), { minLength: battlefieldCount, maxLength: battlefieldCount })
      .map((bfCards) => {
        const rowCards = bfCards.map((card, i) =>
          createRowCard(
            { ...card, cardType: 'creature', typeLine: 'Creature — Human', basePower: '2', baseToughness: '2' },
            rowId,
            i
          )
        );

        const state: GameState = {
          gamePhase: 'PLAYING',
          creatureArea: {
            rows: [
              { id: 'creature-1', elements: rowId === 'creature-1' ? rowCards : [] },
              { id: 'creature-2', elements: rowId === 'creature-2' ? rowCards : [] },
              { id: 'creature-3', elements: rowId === 'creature-3' ? rowCards : [] },
            ],
            totalElementCount: rowId.startsWith('creature-') ? rowCards.length : 0,
          },
          row3: {
            left: rowId === 'row3-lands' ? rowCards : [],
            right: rowId === 'row3-artifacts' ? rowCards : [],
          },
          row4: {
            left: rowId === 'row4-lands' ? rowCards : [],
            right: rowId === 'row4-enchantments' ? rowCards : [],
          },
          hand: handCards,
          commandZone: [],
          graveyard: [],
          library: [],
          exile: [],
          mulliganState: null,
          deckLoaded: true,
          lifeTotal: 40,
        };

        return { state, rowId };
      })
  );

/**
 * Generates a GameState with a creature that has equipment attached,
 * plus cards in hand.
 */
const gameStateWithEquipmentAndHandArb: fc.Arbitrary<{
  state: GameState;
  equipmentId: string;
  sourceCreatureId: string;
  targetCreatureId: string;
}> = fc
  .tuple(
    handArb,
    fc.integer({ min: 1, max: 3 })
  )
  .chain(([handCards, equipCount]) =>
    fc
      .tuple(
        creatureWithAttachmentsArb('creature-src', equipCount),
        cardDataArb('creature-tgt')
      )
      .map(([sourceCreature, targetCreatureCard]) => {
        const targetCreature = createRowCard(
          { ...targetCreatureCard, cardType: 'creature', typeLine: 'Creature — Elf', basePower: '4', baseToughness: '4' },
          'creature-1',
          1
        );

        const state: GameState = {
          gamePhase: 'PLAYING',
          creatureArea: {
            rows: [
              { id: 'creature-1', elements: [sourceCreature, targetCreature] },
              { id: 'creature-2', elements: [] },
              { id: 'creature-3', elements: [] },
            ],
            totalElementCount: 2,
          },
          row3: { left: [], right: [] },
          row4: { left: [], right: [] },
          hand: handCards,
          commandZone: [],
          graveyard: [],
          library: [],
          exile: [],
          mulliganState: null,
          deckLoaded: true,
          lifeTotal: 40,
        };

        return {
          state,
          equipmentId: sourceCreature.attachments[0]?.instanceId ?? '',
          sourceCreatureId: sourceCreature.instanceId,
          targetCreatureId: targetCreature.instanceId,
        };
      })
  );

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 7: Hand State Independence', () => {
  it('hand array remains unchanged after battlefield reorder (arrayMove)', () => {
    fc.assert(
      fc.property(
        gameStateWithHandAndBattlefieldArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        ({ state, rowId }, rawOldIdx, rawNewIdx) => {
          const rowCards = getRowCards(state, rowId);
          if (rowCards.length < 2) return; // Need at least 2 cards to reorder

          // Constrain indices to valid range
          const oldIndex = rawOldIdx % rowCards.length;
          let newIndex = rawNewIdx % rowCards.length;
          if (newIndex === oldIndex) {
            newIndex = (oldIndex + 1) % rowCards.length;
          }

          // Snapshot hand before operation
          const handBefore = state.hand.map((c) => c.id);

          // Perform reorder
          const reordered = arrayMove(rowCards, oldIndex, newIndex);
          const newState = setRowCards(state, rowId, reordered);

          // Assert hand is unchanged — same cards, same order
          expect(newState.hand).toHaveLength(handBefore.length);
          const handAfter = newState.hand.map((c) => c.id);
          expect(handAfter).toEqual(handBefore);

          // Deep equality: same card objects, same order
          expect(newState.hand).toEqual(state.hand);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('hand array remains unchanged after equipment detach operation', () => {
    fc.assert(
      fc.property(
        gameStateWithEquipmentAndHandArb,
        ({ state, equipmentId, sourceCreatureId }) => {
          if (!equipmentId) return; // Skip if no equipment generated

          // Snapshot hand before operation
          const handBefore = state.hand.map((c) => c.id);

          // Perform detach
          const newState = detachEquipment(state, equipmentId, sourceCreatureId);

          // Assert hand is unchanged — same cards, same order
          expect(newState.hand).toHaveLength(handBefore.length);
          const handAfter = newState.hand.map((c) => c.id);
          expect(handAfter).toEqual(handBefore);

          // Deep equality
          expect(newState.hand).toEqual(state.hand);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('hand array remains unchanged after equipment reattach operation', () => {
    fc.assert(
      fc.property(
        gameStateWithEquipmentAndHandArb,
        ({ state, equipmentId, sourceCreatureId, targetCreatureId }) => {
          if (!equipmentId) return; // Skip if no equipment generated
          if (sourceCreatureId === targetCreatureId) return; // Skip same creature

          // Snapshot hand before operation
          const handBefore = state.hand.map((c) => c.id);

          // Perform reattach
          const newState = reattachEquipment(
            state,
            equipmentId,
            sourceCreatureId,
            targetCreatureId
          );

          // Assert hand is unchanged — same cards, same order
          expect(newState.hand).toHaveLength(handBefore.length);
          const handAfter = newState.hand.map((c) => c.id);
          expect(handAfter).toEqual(handBefore);

          // Deep equality
          expect(newState.hand).toEqual(state.hand);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('hand array is referentially equal after battlefield operations (no mutation)', () => {
    fc.assert(
      fc.property(
        gameStateWithHandAndBattlefieldArb,
        ({ state, rowId }) => {
          const rowCards = getRowCards(state, rowId);
          if (rowCards.length < 2) return;

          // Perform reorder
          const reordered = arrayMove(rowCards, 0, rowCards.length - 1);
          const newState = setRowCards(state, rowId, reordered);

          // The hand array reference should be the same object (no copy/mutation)
          expect(newState.hand).toBe(state.hand);
        }
      ),
      { numRuns: 200 }
    );
  });
});
