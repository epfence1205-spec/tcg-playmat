import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { arrayMove } from '@dnd-kit/sortable';
import type {
  CardData,
  CardType,
  KeywordAbility,
  GameState,
  RowCard,
  RowTarget,
  Attachment,
} from '../types';
import { getRowCards, setRowCards } from '../sortableHelpers';
import { createRowCard } from '../gameActions';

/**
 * Property 3: Attachment Preservation
 *
 * For any card with attachments that is reordered within a row, the card's
 * attachments array must be deeply equal before and after the reorder.
 * No attachments are lost, duplicated, or reassigned during a reorder.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const keywordAbilityArb: fc.Arbitrary<KeywordAbility> = fc.constantFrom(
  'flying',
  'trample',
  'haste',
  'vigilance',
  'lifelink',
  'deathtouch',
  'hexproof',
  'indestructible',
  'menace',
  'reach',
  'first_strike',
  'double_strike',
  'flash',
  'defender',
  'ward',
  'shroud',
  'protection'
);

/** Generates a unique CardData for a creature */
function creatureCardArb(idSuffix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 15 }),
      fc.integer({ min: 0, max: 10 }),
      fc.integer({ min: 1, max: 10 }),
      fc.array(keywordAbilityArb, { minLength: 0, maxLength: 2 })
    )
    .map(([name, power, toughness, keywords]) => ({
      id: `creature-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
      name: name || 'Creature',
      setCode: 'tst',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      backFaceCardType: null,
      backFaceName: null,
      backFacePower: null,
      backFaceToughness: null,
      typeLine: `Creature — Test ${power}/${toughness}`,
      oracleText: '',
      isCommander: false,
      keywords,
      basePower: String(power),
      baseToughness: String(toughness),
      cardType: 'creature' as CardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates a unique CardData for an equipment */
function equipmentCardArb(idSuffix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 15 }),
      fc.integer({ min: 0, max: 5 }),
      fc.integer({ min: 0, max: 5 })
    )
    .map(([name, power, toughness]) => ({
      id: `equip-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
      name: name || 'Equipment',
      setCode: 'tst',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      backFaceCardType: null,
      backFaceName: null,
      backFacePower: null,
      backFaceToughness: null,
      typeLine: 'Artifact — Equipment',
      oracleText: `Equipped creature gets +${power}/+${toughness}`,
      isCommander: false,
      keywords: [],
      basePower: null,
      baseToughness: null,
      cardType: 'artifact' as CardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates an Attachment from a CardData */
function attachmentFromCard(card: CardData, tapped: boolean): Attachment {
  return {
    card,
    instanceId: card.id,
    isTapped: tapped,
  };
}

/** Generates a random list of attachments (0-3 equipment) */
const attachmentsArb: fc.Arbitrary<Attachment[]> = fc
  .array(
    fc.tuple(equipmentCardArb('att'), fc.boolean()),
    { minLength: 0, maxLength: 3 }
  )
  .map(pairs => pairs.map(([card, tapped]) => attachmentFromCard(card, tapped)));

/** Generates a RowCard with random attachments */
function rowCardWithAttachmentsArb(
  index: number,
  rowId: RowTarget
): fc.Arbitrary<RowCard> {
  return fc
    .tuple(creatureCardArb(String(index)), attachmentsArb)
    .map(([card, attachments]) => ({
      ...createRowCard(card, rowId, index),
      attachments,
    }));
}

/** Generates a valid reorder operation (two distinct indices within a row) */
function reorderIndicesArb(rowLength: number): fc.Arbitrary<{ oldIndex: number; newIndex: number }> {
  return fc
    .tuple(
      fc.integer({ min: 0, max: rowLength - 1 }),
      fc.integer({ min: 0, max: rowLength - 1 })
    )
    .filter(([a, b]) => a !== b)
    .map(([oldIndex, newIndex]) => ({ oldIndex, newIndex }));
}

const rowTargetArb: fc.Arbitrary<RowTarget> = fc.constantFrom(
  'creature-1',
  'creature-2',
  'creature-3',
  'row3-lands',
  'row3-artifacts',
  'row4-lands',
  'row4-enchantments'
);

/** Creates a GameState with a single populated row */
function stateWithRow(rowId: RowTarget, cards: RowCard[]): GameState {
  const base: GameState = {
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
  return setRowCards(base, rowId, cards);
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 3: Attachment Preservation', () => {
  it('reordering a card with attachments preserves its attachments array unchanged', () => {
    /**
     * **Validates: Requirements 8.1, 8.2**
     *
     * For any card with attachments that is reordered within a row,
     * the card's attachments array must be deeply equal before and after.
     */
    fc.assert(
      fc.property(
        rowTargetArb,
        fc.integer({ min: 2, max: 5 }).chain(count =>
          fc.tuple(
            fc.constant(count),
            fc.tuple(
              ...Array.from({ length: count }, (_, i) =>
                rowCardWithAttachmentsArb(i, 'creature-1')
              )
            )
          )
        ),
        (rowId, [count, cards]) => {
          const rowCards = cards as unknown as RowCard[];
          // Assign correct rowId to all cards
          const adjustedCards = rowCards.map((rc, i) => ({
            ...rc,
            rowAssignment: rowId,
            positionIndex: i,
          }));

          const state = stateWithRow(rowId, adjustedCards);

          // Pick two distinct indices for reorder
          const oldIndex = Math.floor(Math.random() * adjustedCards.length);
          let newIndex = Math.floor(Math.random() * (adjustedCards.length - 1));
          if (newIndex >= oldIndex) newIndex++;

          // Capture attachments before reorder (deep copy for comparison)
          const attachmentsBefore = adjustedCards.map(rc =>
            JSON.parse(JSON.stringify(rc.attachments))
          );

          // Perform reorder using arrayMove (same as production code)
          const reordered = arrayMove(adjustedCards, oldIndex, newIndex);
          const newState = setRowCards(state, rowId, reordered);
          const resultRow = getRowCards(newState, rowId);

          // For each card, find it in the result and verify attachments are unchanged
          for (let i = 0; i < adjustedCards.length; i++) {
            const originalCard = adjustedCards[i];
            const resultCard = resultRow.find(
              rc => rc.instanceId === originalCard.instanceId
            );
            expect(resultCard).toBeDefined();
            expect(resultCard!.attachments).toEqual(attachmentsBefore[i]);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('cards not involved in reorder retain their attachments unchanged', () => {
    /**
     * **Validates: Requirements 8.3**
     *
     * When a card without attachments is reordered, the cards with
     * attachments in the same row retain their attachments unchanged.
     */
    fc.assert(
      fc.property(
        rowTargetArb,
        fc.integer({ min: 3, max: 6 }).chain(count =>
          fc.tuple(
            fc.constant(count),
            fc.tuple(
              ...Array.from({ length: count }, (_, i) =>
                rowCardWithAttachmentsArb(i, 'creature-1')
              )
            )
          )
        ),
        (rowId, [count, cards]) => {
          const rowCards = cards as unknown as RowCard[];
          const adjustedCards = rowCards.map((rc, i) => ({
            ...rc,
            rowAssignment: rowId,
            positionIndex: i,
          }));

          const state = stateWithRow(rowId, adjustedCards);

          // Pick a random card to move
          const oldIndex = Math.floor(Math.random() * adjustedCards.length);
          let newIndex = Math.floor(Math.random() * (adjustedCards.length - 1));
          if (newIndex >= oldIndex) newIndex++;

          // Capture all attachments before reorder
          const attachmentsMap = new Map<string, Attachment[]>();
          for (const rc of adjustedCards) {
            attachmentsMap.set(rc.instanceId, JSON.parse(JSON.stringify(rc.attachments)));
          }

          // Perform reorder
          const reordered = arrayMove(adjustedCards, oldIndex, newIndex);
          const newState = setRowCards(state, rowId, reordered);
          const resultRow = getRowCards(newState, rowId);

          // All cards that were NOT moved should have identical attachments
          const movedCardId = adjustedCards[oldIndex].instanceId;
          for (const resultCard of resultRow) {
            if (resultCard.instanceId !== movedCardId) {
              const originalAttachments = attachmentsMap.get(resultCard.instanceId);
              expect(resultCard.attachments).toEqual(originalAttachments);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('no attachments are lost, duplicated, or reassigned during reorder', () => {
    /**
     * **Validates: Requirements 8.1, 8.2, 8.3**
     *
     * After any reorder operation, the total set of attachments across
     * all cards in the row is identical to before (same instanceIds,
     * same parent assignments).
     */
    fc.assert(
      fc.property(
        rowTargetArb,
        fc.integer({ min: 2, max: 6 }).chain(count =>
          fc.tuple(
            fc.constant(count),
            fc.tuple(
              ...Array.from({ length: count }, (_, i) =>
                rowCardWithAttachmentsArb(i, 'creature-1')
              )
            )
          )
        ),
        (rowId, [count, cards]) => {
          const rowCards = cards as unknown as RowCard[];
          const adjustedCards = rowCards.map((rc, i) => ({
            ...rc,
            rowAssignment: rowId,
            positionIndex: i,
          }));

          // Collect all attachment instanceIds mapped to their parent before reorder
          const attachmentParentsBefore = new Map<string, string>();
          for (const rc of adjustedCards) {
            for (const att of rc.attachments) {
              attachmentParentsBefore.set(att.instanceId, rc.instanceId);
            }
          }

          // Perform a random reorder
          const oldIndex = Math.floor(Math.random() * adjustedCards.length);
          let newIndex = Math.floor(Math.random() * (adjustedCards.length - 1));
          if (newIndex >= oldIndex) newIndex++;

          const reordered = arrayMove(adjustedCards, oldIndex, newIndex);
          const newState = setRowCards(stateWithRow(rowId, adjustedCards), rowId, reordered);
          const resultRow = getRowCards(newState, rowId);

          // Collect all attachment instanceIds mapped to their parent after reorder
          const attachmentParentsAfter = new Map<string, string>();
          for (const rc of resultRow) {
            for (const att of rc.attachments) {
              attachmentParentsAfter.set(att.instanceId, rc.instanceId);
            }
          }

          // Same number of total attachments
          expect(attachmentParentsAfter.size).toBe(attachmentParentsBefore.size);

          // Same attachment-to-parent mapping (no reassignment)
          for (const [attId, parentId] of attachmentParentsBefore) {
            expect(attachmentParentsAfter.has(attId)).toBe(true);
            expect(attachmentParentsAfter.get(attId)).toBe(parentId);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
