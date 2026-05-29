import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  CardData,
  CardType,
  KeywordAbility,
  GameState,
  RowCard,
  RowTarget,
} from '../types';
import { attachEquipment } from '../equipmentActions';
import { calculateEffectiveStats } from '../keywords';
import { createRowCard } from '../gameActions';

/**
 * Property 9: Equipment Docking Isolation
 * After attachEquipment, the equipment card ID does NOT appear in any row flow
 * (creature area elements, row4.left, row4.right, row5.left, row5.right) —
 * it only exists in the creature's attachments array.
 *
 * Property 10: Equipment Stat Modifier Additivity
 * For any creature with N attached equipment, each providing stat modifiers:
 * - effectiveStats.modifiedPower = basePower + sum of all modifier.power values
 * - effectiveStats.modifiedToughness = baseToughness + sum of all modifier.toughness values
 * - This is additive (order doesn't matter)
 *
 * **Validates: Requirements 9.1, 9.7, 9.8, 9.9**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const cardTypeArb: fc.Arbitrary<CardType> = fc.constantFrom(
  'creature',
  'land',
  'artifact',
  'enchantment',
  'planeswalker',
  'instant',
  'sorcery',
  'battle',
  'other'
);

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

/** Generates a creature CardData with numeric base power/toughness */
function creatureCardArb(idPrefix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.integer({ min: 0, max: 15 }),
      fc.integer({ min: 0, max: 15 }),
      fc.array(keywordAbilityArb, { minLength: 0, maxLength: 3 })
    )
    .map(([name, power, toughness, keywords]) => ({
      id: `${idPrefix}-${Math.random().toString(36).slice(2, 10)}`,
      name: name || 'Creature',
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      typeLine: `Creature — Human ${power}/${toughness}`,
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

/** Stat modifier pattern: "+X/+Y", "-X/-Y", "+X/-Y", etc. */
const statModifierArb: fc.Arbitrary<{ power: number; toughness: number; text: string }> = fc
  .tuple(
    fc.integer({ min: -5, max: 5 }),
    fc.integer({ min: -5, max: 5 })
  )
  .map(([power, toughness]) => ({
    power,
    toughness,
    text: `Equipped creature gets ${power >= 0 ? '+' : ''}${power}/${toughness >= 0 ? '+' : ''}${toughness}`,
  }));

/** Generates an equipment CardData with a stat modifier oracle text */
function equipmentCardArb(idPrefix: string): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      statModifierArb
    )
    .map(([name, modifier]) => ({
      id: `${idPrefix}-${Math.random().toString(36).slice(2, 10)}`,
      name: name || 'Equipment',
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      typeLine: 'Artifact — Equipment',
      oracleText: modifier.text,
      isCommander: false,
      keywords: [],
      basePower: null,
      baseToughness: null,
      cardType: 'artifact' as CardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Creates an empty GameState */
function emptyGameState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row4: { left: [], right: [] },
    row5: { left: [], right: [] },
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
 * Collects all card IDs from the row flow (not including attachments).
 * This is the set of IDs that appear as standalone RowCards in any row.
 */
function collectRowFlowIds(state: GameState): string[] {
  const ids: string[] = [];

  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      ids.push(rc.instanceId);
    }
  }

  for (const rc of state.row4.left) ids.push(rc.instanceId);
  for (const rc of state.row4.right) ids.push(rc.instanceId);
  for (const rc of state.row5.left) ids.push(rc.instanceId);
  for (const rc of state.row5.right) ids.push(rc.instanceId);

  return ids;
}

/**
 * Collects all attachment IDs from all creatures on the battlefield.
 */
function collectAllAttachmentIds(state: GameState): string[] {
  const ids: string[] = [];

  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      for (const att of rc.attachments) {
        ids.push(att.instanceId);
      }
    }
  }

  for (const rc of state.row4.left) {
    for (const att of rc.attachments) ids.push(att.instanceId);
  }
  for (const rc of state.row4.right) {
    for (const att of rc.attachments) ids.push(att.instanceId);
  }
  for (const rc of state.row5.left) {
    for (const att of rc.attachments) ids.push(att.instanceId);
  }
  for (const rc of state.row5.right) {
    for (const att of rc.attachments) ids.push(att.instanceId);
  }

  return ids;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 9: Equipment Docking Isolation', () => {
  it('after attachEquipment, equipment ID does NOT appear in any row flow — only in attachments', () => {
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        equipmentCardArb('equip'),
        (creatureCard: CardData, equipmentCard: CardData) => {
          // Set up state: creature in creature area, equipment in row4.right (artifacts)
          let state = emptyGameState();

          const creatureRowCard = createRowCard(creatureCard, 'creature-1', 0);
          state.creatureArea.rows[0].elements.push(creatureRowCard);
          state.creatureArea.totalElementCount = 1;

          const equipRowCard = createRowCard(equipmentCard, 'row4-artifacts', 0);
          state.row4.right.push(equipRowCard);

          // Perform attach
          const newState = attachEquipment(state, equipmentCard.id, creatureCard.id);

          // Equipment ID should NOT be in any row flow
          const rowFlowIds = collectRowFlowIds(newState);
          expect(rowFlowIds).not.toContain(equipmentCard.id);

          // Equipment ID SHOULD be in attachments
          const attachmentIds = collectAllAttachmentIds(newState);
          expect(attachmentIds).toContain(equipmentCard.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after attaching multiple equipment, none appear in row flow', () => {
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        equipmentCardArb('equip-1'),
        equipmentCardArb('equip-2'),
        (creatureCard: CardData, equip1: CardData, equip2: CardData) => {
          // Set up state with creature and two equipment cards
          let state = emptyGameState();

          const creatureRowCard = createRowCard(creatureCard, 'creature-1', 0);
          state.creatureArea.rows[0].elements.push(creatureRowCard);
          state.creatureArea.totalElementCount = 1;

          const equipRowCard1 = createRowCard(equip1, 'row4-artifacts', 0);
          const equipRowCard2 = createRowCard(equip2, 'row4-artifacts', 1);
          state.row4.right.push(equipRowCard1, equipRowCard2);

          // Attach both equipment
          let newState = attachEquipment(state, equip1.id, creatureCard.id);
          newState = attachEquipment(newState, equip2.id, creatureCard.id);

          // Neither equipment should be in row flow
          const rowFlowIds = collectRowFlowIds(newState);
          expect(rowFlowIds).not.toContain(equip1.id);
          expect(rowFlowIds).not.toContain(equip2.id);

          // Both should be in attachments
          const attachmentIds = collectAllAttachmentIds(newState);
          expect(attachmentIds).toContain(equip1.id);
          expect(attachmentIds).toContain(equip2.id);

          // Creature should still be in row flow
          expect(rowFlowIds).toContain(creatureCard.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('equipment from any row location is removed from flow when docked', () => {
    // Test equipment starting in different row locations
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        equipmentCardArb('equip'),
        fc.constantFrom('row4-left', 'row4-right', 'row5-left', 'row5-right') as fc.Arbitrary<string>,
        (creatureCard: CardData, equipmentCard: CardData, startLocation: string) => {
          let state = emptyGameState();

          const creatureRowCard = createRowCard(creatureCard, 'creature-1', 0);
          state.creatureArea.rows[0].elements.push(creatureRowCard);
          state.creatureArea.totalElementCount = 1;

          // Place equipment in the specified location
          const equipRowCard = createRowCard(equipmentCard, 'row4-artifacts', 0);
          switch (startLocation) {
            case 'row4-left':
              state.row4.left.push(equipRowCard);
              break;
            case 'row4-right':
              state.row4.right.push(equipRowCard);
              break;
            case 'row5-left':
              state.row5.left.push(equipRowCard);
              break;
            case 'row5-right':
              state.row5.right.push(equipRowCard);
              break;
          }

          // Attach equipment
          const newState = attachEquipment(state, equipmentCard.id, creatureCard.id);

          // Equipment should not be in any row flow
          const rowFlowIds = collectRowFlowIds(newState);
          expect(rowFlowIds).not.toContain(equipmentCard.id);

          // Equipment should be in attachments
          const attachmentIds = collectAllAttachmentIds(newState);
          expect(attachmentIds).toContain(equipmentCard.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 10: Equipment Stat Modifier Additivity', () => {
  it('effective stats = base + sum of all modifier values', () => {
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        fc.array(statModifierArb, { minLength: 1, maxLength: 5 }),
        (creatureCard: CardData, modifiers) => {
          // Create creature RowCard
          const creature = createRowCard(creatureCard, 'creature-1', 0);

          // Create equipment RowCards with the generated stat modifiers
          const equipmentRowCards: RowCard[] = modifiers.map((mod, i) => {
            const equipCard: CardData = {
              id: `equip-${i}-${Math.random().toString(36).slice(2, 10)}`,
              name: `Equipment ${i}`,
              setCode: 'abc',
              collectorNumber: '1',
              imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
              imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
              backFaceImageURI: null,
              typeLine: 'Artifact — Equipment',
              oracleText: mod.text,
              isCommander: false,
              keywords: [],
              basePower: null,
              baseToughness: null,
              cardType: 'artifact',
              isToken: false,
              isTokenCopy: false,
            };
            return createRowCard(equipCard, 'row4-artifacts', i);
          });

          // Calculate effective stats
          const stats = calculateEffectiveStats(creature, equipmentRowCards);

          // Base stats should match creature
          const basePower = parseInt(creatureCard.basePower!, 10);
          const baseToughness = parseInt(creatureCard.baseToughness!, 10);
          expect(stats.basePower).toBe(basePower);
          expect(stats.baseToughness).toBe(baseToughness);

          // Sum of modifiers
          const totalPowerMod = modifiers.reduce((sum, m) => sum + m.power, 0);
          const totalToughnessMod = modifiers.reduce((sum, m) => sum + m.toughness, 0);

          // Modified stats = base + sum of modifiers
          expect(stats.modifiedPower).toBe(basePower + totalPowerMod);
          expect(stats.modifiedToughness).toBe(baseToughness + totalToughnessMod);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('stat modifier additivity is order-independent (commutative)', () => {
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        fc.array(statModifierArb, { minLength: 2, maxLength: 5 }),
        (creatureCard: CardData, modifiers) => {
          const creature = createRowCard(creatureCard, 'creature-1', 0);

          // Create equipment in original order
          const makeEquipCards = (mods: typeof modifiers): RowCard[] =>
            mods.map((mod, i) => {
              const equipCard: CardData = {
                id: `equip-order-${i}-${Math.random().toString(36).slice(2, 10)}`,
                name: `Equipment ${i}`,
                setCode: 'abc',
                collectorNumber: '1',
                imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
                imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
                backFaceImageURI: null,
                typeLine: 'Artifact — Equipment',
                oracleText: mod.text,
                isCommander: false,
                keywords: [],
                basePower: null,
                baseToughness: null,
                cardType: 'artifact',
                isToken: false,
                isTokenCopy: false,
              };
              return createRowCard(equipCard, 'row4-artifacts', i);
            });

          const originalOrder = makeEquipCards(modifiers);
          const reversedOrder = makeEquipCards([...modifiers].reverse());

          const statsOriginal = calculateEffectiveStats(creature, originalOrder);
          const statsReversed = calculateEffectiveStats(creature, reversedOrder);

          // Order should not matter — same final stats
          expect(statsOriginal.modifiedPower).toBe(statsReversed.modifiedPower);
          expect(statsOriginal.modifiedToughness).toBe(statsReversed.modifiedToughness);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('creature with no equipment has modifiedStats equal to base stats', () => {
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        (creatureCard: CardData) => {
          const creature = createRowCard(creatureCard, 'creature-1', 0);

          const stats = calculateEffectiveStats(creature, []);

          const basePower = parseInt(creatureCard.basePower!, 10);
          const baseToughness = parseInt(creatureCard.baseToughness!, 10);

          expect(stats.modifiedPower).toBe(basePower);
          expect(stats.modifiedToughness).toBe(baseToughness);
          expect(stats.modifiers).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('equipment with zero stat modifiers does not change effective stats', () => {
    fc.assert(
      fc.property(
        creatureCardArb('creature'),
        (creatureCard: CardData) => {
          const creature = createRowCard(creatureCard, 'creature-1', 0);

          // Equipment with no stat modifier text
          const noModEquipCard: CardData = {
            id: `equip-nomod-${Math.random().toString(36).slice(2, 10)}`,
            name: 'Swiftfoot Boots',
            setCode: 'abc',
            collectorNumber: '1',
            imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
            imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
            backFaceImageURI: null,
            typeLine: 'Artifact — Equipment',
            oracleText: 'Equipped creature has hexproof and haste.',
            isCommander: false,
            keywords: ['hexproof', 'haste'],
            basePower: null,
            baseToughness: null,
            cardType: 'artifact',
            isToken: false,
            isTokenCopy: false,
          };
          const equipRowCard = createRowCard(noModEquipCard, 'row4-artifacts', 0);

          const stats = calculateEffectiveStats(creature, [equipRowCard]);

          const basePower = parseInt(creatureCard.basePower!, 10);
          const baseToughness = parseInt(creatureCard.baseToughness!, 10);

          // No stat change since equipment has no P/T modifier
          expect(stats.modifiedPower).toBe(basePower);
          expect(stats.modifiedToughness).toBe(baseToughness);
          expect(stats.modifiers).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
