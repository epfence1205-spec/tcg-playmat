import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  CardData,
  CardType,
  GameState,
  RowCard,
  RowTarget,
} from '../types';
import { createRowCard } from '../gameActions';
import { isAttachedEquipment } from '../sortableHelpers';

/**
 * Property 5: Equipment Docking Routing
 *
 * For any drag event where the active card has cardType of equipment or aura
 * and the over target has cardType of creature, the handleDragEnd SHALL route
 * to equipment docking (not reorder or cross-zone).
 *
 * This test validates the routing decision logic extracted from handleDragEnd:
 * - When active is unattached equipment/aura on the battlefield
 * - And over target is a creature (via card-drop- prefix or sortable with creature cardType)
 * - The operation is classified as "equipment-dock" rather than "reorder" or "cross-zone"
 *
 * **Validates: Requirement 6.2**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

/** Generates a creature CardData */
function creatureCardArb(idPrefix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.integer({ min: 1, max: 10 }),
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

/** Generates an equipment CardData (Artifact — Equipment) */
function equipmentCardArb(idPrefix: string): fc.Arbitrary<CardData> {
  return fc
    .string({ minLength: 1, maxLength: 20 })
    .map((name) => ({
      id: `${idPrefix}-${crypto.randomUUID()}`,
      name: name || 'Sword',
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

/** Generates an aura CardData (Enchantment — Aura) */
function auraCardArb(idPrefix: string): fc.Arbitrary<CardData> {
  return fc
    .string({ minLength: 1, maxLength: 20 })
    .map((name) => ({
      id: `${idPrefix}-${crypto.randomUUID()}`,
      name: name || 'Pacifism',
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      backFaceCardType: null,
      backFaceName: null,
      backFacePower: null,
      backFaceToughness: null,
      typeLine: 'Enchantment — Aura',
      oracleText: 'Enchanted creature can\'t attack or block.',
      isCommander: false,
      keywords: [],
      basePower: null,
      baseToughness: null,
      cardType: 'enchantment' as CardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates either an equipment or aura card */
const dockableCardArb: fc.Arbitrary<CardData> = fc.oneof(
  equipmentCardArb('equip'),
  auraCardArb('aura')
);

/** Row targets where equipment/aura can be placed on the battlefield */
const equipmentRowArb: fc.Arbitrary<RowTarget> = fc.constantFrom(
  'row3-artifacts',
  'row4-enchantments'
);

/** Creature row targets */
const creatureRowArb: fc.Arbitrary<RowTarget> = fc.constantFrom(
  'creature-1',
  'creature-2',
  'creature-3'
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

// ─── Routing Logic (extracted from handleDragEnd for testability) ─────────────

/**
 * Determines the drag intent based on the active and over data.
 * This mirrors the priority routing in App.tsx handleDragEnd.
 *
 * Returns the routing decision:
 * - 'attached-equipment': Priority 1 — active is attached equipment
 * - 'equipment-dock': Priority 2 — active is unattached equipment/aura, over is creature
 * - 'reorder': Priority 3 — same-row reorder
 * - 'cross-row': Priority 4 — different row on battlefield
 * - 'cross-zone': Priority 5 — different zone
 * - 'no-op': dropped on self or invalid
 */
function detectDragIntent(
  activeCardId: string,
  activeSourceZone: string,
  activeCardType: string,
  activeRowId: string | undefined,
  overCardId: string,
  overSourceZone: string | undefined,
  overCardType: string | undefined,
  overRowId: string | undefined,
  overIdPrefix: string,
  gameState: GameState,
  activeTypeLine: string
): 'attached-equipment' | 'equipment-dock' | 'reorder' | 'cross-row' | 'cross-zone' | 'no-op' {
  // Priority 1: Attached equipment drag-to-unequip
  if (isAttachedEquipment(activeCardId, gameState)) {
    return 'attached-equipment';
  }

  // Priority 2: Unattached equipment/aura docking (equipment → creature)
  // This matches the logic in handleDragEnd: over target has cardType 'creature'
  // and the active card's typeLine contains 'equipment' or 'aura'
  if (overCardType === 'creature' && activeCardId !== overCardId) {
    const isDockable =
      /\bequipment\b/i.test(activeTypeLine) || /\baura\b/i.test(activeTypeLine);
    if (isDockable) {
      return 'equipment-dock';
    }
  }

  // Priority 3: Same-row reorder
  if (
    activeSourceZone === 'battlefield' &&
    overSourceZone === 'battlefield' &&
    activeRowId === overRowId &&
    activeCardId !== overCardId
  ) {
    return 'reorder';
  }

  // Priority 4: Cross-row move
  if (
    activeSourceZone === 'battlefield' &&
    overSourceZone === 'battlefield' &&
    activeRowId !== overRowId
  ) {
    return 'cross-row';
  }

  // Priority 5: Cross-zone
  if (activeSourceZone !== overSourceZone) {
    return 'cross-zone';
  }

  return 'no-op';
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 5: Equipment Docking Routing', () => {
  it('unattached equipment dragged onto a creature routes to equipment-dock, not reorder or cross-zone', () => {
    fc.assert(
      fc.property(
        dockableCardArb,
        creatureCardArb('creature'),
        equipmentRowArb,
        creatureRowArb,
        (equipCard: CardData, creatureCard: CardData, equipRow: RowTarget, creatureRow: RowTarget) => {
          // Set up state: equipment on battlefield (unattached), creature on battlefield
          const state = emptyGameState();

          const creatureRowCard = createRowCard(creatureCard, creatureRow, 0);
          const rowIdx = parseInt(creatureRow.replace('creature-', ''), 10) - 1;
          state.creatureArea.rows[rowIdx].elements.push(creatureRowCard);
          state.creatureArea.totalElementCount = 1;

          const equipRowCard = createRowCard(equipCard, equipRow, 0);
          if (equipRow === 'row3-artifacts') {
            state.row3.right.push(equipRowCard);
          } else {
            state.row4.right.push(equipRowCard);
          }

          // Simulate drag: active is equipment, over is creature
          const intent = detectDragIntent(
            equipCard.id,
            'battlefield',
            equipCard.cardType,
            equipRow,
            creatureCard.id,
            'battlefield',
            'creature',
            creatureRow,
            'card-drop-',
            state,
            equipCard.typeLine
          );

          // Should route to equipment-dock
          expect(intent).toBe('equipment-dock');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('equipment from hand dragged onto a creature routes to equipment-dock', () => {
    fc.assert(
      fc.property(
        dockableCardArb,
        creatureCardArb('creature'),
        creatureRowArb,
        (equipCard: CardData, creatureCard: CardData, creatureRow: RowTarget) => {
          // Set up state: creature on battlefield, equipment in hand
          const state = emptyGameState();

          const creatureRowCard = createRowCard(creatureCard, creatureRow, 0);
          const rowIdx = parseInt(creatureRow.replace('creature-', ''), 10) - 1;
          state.creatureArea.rows[rowIdx].elements.push(creatureRowCard);
          state.creatureArea.totalElementCount = 1;
          state.hand.push(equipCard);

          // Simulate drag: active is equipment from hand, over is creature
          const intent = detectDragIntent(
            equipCard.id,
            'hand',
            equipCard.cardType,
            undefined,
            creatureCard.id,
            'battlefield',
            'creature',
            creatureRow,
            'card-drop-',
            state,
            equipCard.typeLine
          );

          // Should route to equipment-dock (not cross-zone)
          expect(intent).toBe('equipment-dock');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('non-equipment/non-aura card dragged onto a creature does NOT route to equipment-dock', () => {
    fc.assert(
      fc.property(
        creatureCardArb('active-creature'),
        creatureCardArb('target-creature'),
        creatureRowArb,
        (activeCreature: CardData, targetCreature: CardData, creatureRow: RowTarget) => {
          // Set up state: two creatures on the same row
          const state = emptyGameState();

          const rowIdx = parseInt(creatureRow.replace('creature-', ''), 10) - 1;
          const activeRowCard = createRowCard(activeCreature, creatureRow, 0);
          const targetRowCard = createRowCard(targetCreature, creatureRow, 1);
          state.creatureArea.rows[rowIdx].elements.push(activeRowCard, targetRowCard);
          state.creatureArea.totalElementCount = 2;

          // Simulate drag: active is creature, over is creature (same row)
          const intent = detectDragIntent(
            activeCreature.id,
            'battlefield',
            activeCreature.cardType,
            creatureRow,
            targetCreature.id,
            'battlefield',
            'creature',
            creatureRow,
            '',
            state,
            activeCreature.typeLine
          );

          // Should NOT route to equipment-dock — should be reorder
          expect(intent).not.toBe('equipment-dock');
          expect(intent).toBe('reorder');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('equipment docking takes priority over same-row reorder when equipment and creature are in same row', () => {
    fc.assert(
      fc.property(
        equipmentCardArb('equip'),
        creatureCardArb('creature'),
        creatureRowArb,
        (equipCard: CardData, creatureCard: CardData, row: RowTarget) => {
          // Edge case: equipment placed in a creature row (unusual but possible)
          const state = emptyGameState();

          const rowIdx = parseInt(row.replace('creature-', ''), 10) - 1;
          const creatureRowCard = createRowCard(creatureCard, row, 0);
          const equipRowCard = createRowCard(equipCard, row, 1);
          state.creatureArea.rows[rowIdx].elements.push(creatureRowCard, equipRowCard);
          state.creatureArea.totalElementCount = 2;

          // Simulate drag: active is equipment in same row, over is creature
          const intent = detectDragIntent(
            equipCard.id,
            'battlefield',
            equipCard.cardType,
            row,
            creatureCard.id,
            'battlefield',
            'creature',
            row,
            '',
            state,
            equipCard.typeLine
          );

          // Equipment docking (Priority 2) should take precedence over reorder (Priority 3)
          expect(intent).toBe('equipment-dock');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('aura cards route to equipment-dock when dropped on a creature', () => {
    fc.assert(
      fc.property(
        auraCardArb('aura'),
        creatureCardArb('creature'),
        creatureRowArb,
        (auraCard: CardData, creatureCard: CardData, creatureRow: RowTarget) => {
          const state = emptyGameState();

          const rowIdx = parseInt(creatureRow.replace('creature-', ''), 10) - 1;
          const creatureRowCard = createRowCard(creatureCard, creatureRow, 0);
          state.creatureArea.rows[rowIdx].elements.push(creatureRowCard);
          state.creatureArea.totalElementCount = 1;

          const auraRowCard = createRowCard(auraCard, 'row4-enchantments', 0);
          state.row4.right.push(auraRowCard);

          // Simulate drag: active is aura, over is creature
          const intent = detectDragIntent(
            auraCard.id,
            'battlefield',
            auraCard.cardType,
            'row4-enchantments',
            creatureCard.id,
            'battlefield',
            'creature',
            creatureRow,
            'card-drop-',
            state,
            auraCard.typeLine
          );

          expect(intent).toBe('equipment-dock');
        }
      ),
      { numRuns: 200 }
    );
  });
});
