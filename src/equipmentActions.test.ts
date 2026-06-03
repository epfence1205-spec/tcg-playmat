import { describe, it, expect } from 'vitest';
import { attachEquipment, detachEquipment } from './equipmentActions';
import { createRowCard } from './gameActions';
import type { GameState, CardData } from './types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: 'card-1',
    name: 'Test Card',
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://example.com/card.jpg',
    imageURILarge: 'https://example.com/card-large.jpg',
    backFaceImageURI: null,
    typeLine: 'Creature — Human Warrior',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: '2',
    baseToughness: '2',
    cardType: 'creature',
    isToken: false,
    isTokenCopy: false,
    ...overrides,
  };
}

function makeEquipment(overrides: Partial<CardData> = {}): CardData {
  return makeCard({
    id: 'equip-1',
    name: 'Sword of Testing',
    typeLine: 'Artifact — Equipment',
    oracleText: 'Equipped creature gets +2/+2.',
    cardType: 'artifact',
    basePower: null,
    baseToughness: null,
    ...overrides,
  });
}

function makeEmptyState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
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

// ─── attachEquipment Tests ───────────────────────────────────────────────────

describe('attachEquipment', () => {
  it('removes equipment from row3-artifacts and adds to creature attachments', () => {
    const creature = makeCard({ id: 'creature-1' });
    const equipment = makeEquipment({ id: 'equip-1' });

    const state = makeEmptyState();
    // Place creature in creature area
    state.creatureArea.rows[0].elements = [createRowCard(creature, 'creature-1', 0)];
    state.creatureArea.totalElementCount = 1;
    // Place equipment in row3 right (artifacts)
    state.row3.right = [createRowCard(equipment, 'row3-artifacts', 0)];

    const result = attachEquipment(state, 'equip-1', 'creature-1');

    // Equipment removed from row3 right
    expect(result.row3.right).toHaveLength(0);
    // Equipment added to creature's attachments
    const creatureCard = result.creatureArea.rows[0].elements[0];
    expect(creatureCard.attachments).toHaveLength(1);
    expect(creatureCard.attachments[0].instanceId).toBe('equip-1');
    expect(creatureCard.attachments[0].card.name).toBe('Sword of Testing');
    expect(creatureCard.attachments[0].isTapped).toBe(false);
  });

  it('removes equipment from creature area row and attaches to another creature', () => {
    const creature = makeCard({ id: 'creature-1' });
    // Equipment that happens to be in creature area (e.g., user placed it there)
    const equipment = makeEquipment({ id: 'equip-1' });

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [
      createRowCard(creature, 'creature-1', 0),
      createRowCard(equipment, 'creature-1', 1),
    ];
    state.creatureArea.totalElementCount = 2;

    const result = attachEquipment(state, 'equip-1', 'creature-1');

    // Equipment removed from creature row elements
    expect(result.creatureArea.rows[0].elements).toHaveLength(1);
    // Equipment attached to creature
    const creatureCard = result.creatureArea.rows[0].elements[0];
    expect(creatureCard.attachments).toHaveLength(1);
    expect(creatureCard.attachments[0].instanceId).toBe('equip-1');
  });

  it('throws when equipment is not found on battlefield', () => {
    const creature = makeCard({ id: 'creature-1' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(creature, 'creature-1', 0)];

    expect(() => attachEquipment(state, 'nonexistent', 'creature-1')).toThrow(
      'Equipment nonexistent not found on battlefield'
    );
  });

  it('throws when creature is not found on battlefield', () => {
    const equipment = makeEquipment({ id: 'equip-1' });
    const state = makeEmptyState();
    state.row3.right = [createRowCard(equipment, 'row3-artifacts', 0)];

    expect(() => attachEquipment(state, 'equip-1', 'nonexistent')).toThrow(
      'Creature nonexistent not found on battlefield'
    );
  });

  it('supports multiple attachments on the same creature', () => {
    const creature = makeCard({ id: 'creature-1' });
    const equip1 = makeEquipment({ id: 'equip-1', name: 'Sword A' });
    const equip2 = makeEquipment({ id: 'equip-2', name: 'Sword B' });

    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(creature, 'creature-1', 0)];
    state.creatureArea.totalElementCount = 1;
    state.row3.right = [
      createRowCard(equip1, 'row3-artifacts', 0),
      createRowCard(equip2, 'row3-artifacts', 1),
    ];

    const afterFirst = attachEquipment(state, 'equip-1', 'creature-1');
    const afterSecond = attachEquipment(afterFirst, 'equip-2', 'creature-1');

    const creatureCard = afterSecond.creatureArea.rows[0].elements[0];
    expect(creatureCard.attachments).toHaveLength(2);
    expect(creatureCard.attachments[0].instanceId).toBe('equip-1');
    expect(creatureCard.attachments[1].instanceId).toBe('equip-2');
  });
});

// ─── detachEquipment Tests ───────────────────────────────────────────────────

describe('detachEquipment', () => {
  it('removes equipment from creature and places it back in row3-artifacts', () => {
    const creature = makeCard({ id: 'creature-1' });
    const equipment = makeEquipment({ id: 'equip-1' });

    const state = makeEmptyState();
    const creatureRowCard = createRowCard(creature, 'creature-1', 0);
    creatureRowCard.attachments = [
      { card: equipment, instanceId: 'equip-1', isTapped: false },
    ];
    state.creatureArea.rows[0].elements = [creatureRowCard];
    state.creatureArea.totalElementCount = 1;

    const result = detachEquipment(state, 'equip-1', 'creature-1');

    // Equipment removed from creature's attachments
    const creatureCard = result.creatureArea.rows[0].elements[0];
    expect(creatureCard.attachments).toHaveLength(0);
    // Equipment placed back in row3 right (artifacts)
    expect(result.row3.right).toHaveLength(1);
    expect(result.row3.right[0].instanceId).toBe('equip-1');
    expect(result.row3.right[0].card.name).toBe('Sword of Testing');
  });

  it('places enchantment auras back in row4-enchantments', () => {
    const creature = makeCard({ id: 'creature-1' });
    const aura = makeCard({
      id: 'aura-1',
      name: 'Holy Strength',
      typeLine: 'Enchantment — Aura',
      oracleText: 'Enchanted creature gets +1/+2.',
      cardType: 'enchantment',
      basePower: null,
      baseToughness: null,
    });

    const state = makeEmptyState();
    const creatureRowCard = createRowCard(creature, 'creature-1', 0);
    creatureRowCard.attachments = [
      { card: aura, instanceId: 'aura-1', isTapped: false },
    ];
    state.creatureArea.rows[0].elements = [creatureRowCard];
    state.creatureArea.totalElementCount = 1;

    const result = detachEquipment(state, 'aura-1', 'creature-1');

    // Aura removed from creature's attachments
    const creatureCard = result.creatureArea.rows[0].elements[0];
    expect(creatureCard.attachments).toHaveLength(0);
    // Aura placed in row4 right (enchantments)
    expect(result.row4.right).toHaveLength(1);
    expect(result.row4.right[0].instanceId).toBe('aura-1');
  });

  it('throws when creature is not found', () => {
    const state = makeEmptyState();
    expect(() => detachEquipment(state, 'equip-1', 'nonexistent')).toThrow(
      'Creature nonexistent not found on battlefield'
    );
  });

  it('throws when equipment is not attached to the creature', () => {
    const creature = makeCard({ id: 'creature-1' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(creature, 'creature-1', 0)];

    expect(() => detachEquipment(state, 'equip-1', 'creature-1')).toThrow(
      'Equipment equip-1 not found attached to creature creature-1'
    );
  });

  it('preserves other attachments when detaching one', () => {
    const creature = makeCard({ id: 'creature-1' });
    const equip1 = makeEquipment({ id: 'equip-1', name: 'Sword A' });
    const equip2 = makeEquipment({ id: 'equip-2', name: 'Sword B' });

    const state = makeEmptyState();
    const creatureRowCard = createRowCard(creature, 'creature-1', 0);
    creatureRowCard.attachments = [
      { card: equip1, instanceId: 'equip-1', isTapped: false },
      { card: equip2, instanceId: 'equip-2', isTapped: false },
    ];
    state.creatureArea.rows[0].elements = [creatureRowCard];
    state.creatureArea.totalElementCount = 1;

    const result = detachEquipment(state, 'equip-1', 'creature-1');

    const creatureCard = result.creatureArea.rows[0].elements[0];
    expect(creatureCard.attachments).toHaveLength(1);
    expect(creatureCard.attachments[0].instanceId).toBe('equip-2');
    expect(result.row3.right).toHaveLength(1);
    expect(result.row3.right[0].instanceId).toBe('equip-1');
  });
});
