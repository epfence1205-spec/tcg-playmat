import { describe, it, expect } from 'vitest';
import { batchTap, batchUntap, batchMoveToZone } from './batchActions';
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

function makeAura(overrides: Partial<CardData> = {}): CardData {
  return makeCard({
    id: 'aura-1',
    name: 'Holy Strength',
    typeLine: 'Enchantment — Aura',
    oracleText: 'Enchanted creature gets +1/+2.',
    cardType: 'enchantment',
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

// ─── batchTap Tests ──────────────────────────────────────────────────────────

describe('batchTap', () => {
  it('taps multiple cards on the battlefield', () => {
    const card1 = makeCard({ id: 'c1' });
    const card2 = makeCard({ id: 'c2' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [
      createRowCard(card1, 'creature-1', 0),
      createRowCard(card2, 'creature-1', 1),
    ];

    const result = batchTap(state, ['c1', 'c2']);

    expect(result.creatureArea.rows[0].elements[0].isTapped).toBe(true);
    expect(result.creatureArea.rows[0].elements[1].isTapped).toBe(true);
  });

  it('skips missing cards gracefully', () => {
    const card1 = makeCard({ id: 'c1' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(card1, 'creature-1', 0)];

    const result = batchTap(state, ['c1', 'nonexistent']);

    expect(result.creatureArea.rows[0].elements[0].isTapped).toBe(true);
  });

  it('is idempotent — already tapped cards stay tapped', () => {
    const card1 = makeCard({ id: 'c1' });
    const state = makeEmptyState();
    const rc = createRowCard(card1, 'creature-1', 0);
    rc.isTapped = true;
    state.creatureArea.rows[0].elements = [rc];

    const result = batchTap(state, ['c1']);

    expect(result.creatureArea.rows[0].elements[0].isTapped).toBe(true);
  });
});

// ─── batchUntap Tests ────────────────────────────────────────────────────────

describe('batchUntap', () => {
  it('untaps multiple cards on the battlefield', () => {
    const card1 = makeCard({ id: 'c1' });
    const card2 = makeCard({ id: 'c2' });
    const state = makeEmptyState();
    const rc1 = createRowCard(card1, 'creature-1', 0);
    rc1.isTapped = true;
    const rc2 = createRowCard(card2, 'creature-1', 1);
    rc2.isTapped = true;
    state.creatureArea.rows[0].elements = [rc1, rc2];

    const result = batchUntap(state, ['c1', 'c2']);

    expect(result.creatureArea.rows[0].elements[0].isTapped).toBe(false);
    expect(result.creatureArea.rows[0].elements[1].isTapped).toBe(false);
  });

  it('skips missing cards gracefully', () => {
    const card1 = makeCard({ id: 'c1' });
    const state = makeEmptyState();
    const rc = createRowCard(card1, 'creature-1', 0);
    rc.isTapped = true;
    state.creatureArea.rows[0].elements = [rc];

    const result = batchUntap(state, ['c1', 'missing']);

    expect(result.creatureArea.rows[0].elements[0].isTapped).toBe(false);
  });

  it('is idempotent — already untapped cards stay untapped', () => {
    const card1 = makeCard({ id: 'c1' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(card1, 'creature-1', 0)];

    const result = batchUntap(state, ['c1']);

    expect(result.creatureArea.rows[0].elements[0].isTapped).toBe(false);
  });
});

// ─── batchMoveToZone Tests ───────────────────────────────────────────────────

describe('batchMoveToZone', () => {
  it('moves cards to graveyard', () => {
    const card1 = makeCard({ id: 'c1', name: 'Bear' });
    const card2 = makeCard({ id: 'c2', name: 'Wolf' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [
      createRowCard(card1, 'creature-1', 0),
      createRowCard(card2, 'creature-1', 1),
    ];
    state.creatureArea.totalElementCount = 2;

    const result = batchMoveToZone(state, ['c1', 'c2'], 'graveyard');

    expect(result.creatureArea.rows[0].elements).toHaveLength(0);
    expect(result.graveyard).toHaveLength(2);
    expect(result.graveyard[0].name).toBe('Bear');
    expect(result.graveyard[1].name).toBe('Wolf');
  });

  it('moves cards to exile (creates ExileCard wrappers)', () => {
    const card1 = makeCard({ id: 'c1', name: 'Bear' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(card1, 'creature-1', 0)];
    state.creatureArea.totalElementCount = 1;

    const result = batchMoveToZone(state, ['c1'], 'exile');

    expect(result.creatureArea.rows[0].elements).toHaveLength(0);
    expect(result.exile).toHaveLength(1);
    expect(result.exile[0].card.name).toBe('Bear');
    expect(result.exile[0].isFaceDown).toBe(false);
  });

  it('moves cards to hand', () => {
    const card1 = makeCard({ id: 'c1', name: 'Bear' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(card1, 'creature-1', 0)];
    state.creatureArea.totalElementCount = 1;

    const result = batchMoveToZone(state, ['c1'], 'hand');

    expect(result.creatureArea.rows[0].elements).toHaveLength(0);
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].name).toBe('Bear');
  });

  it('moves cards to top-library (placed at front of library array)', () => {
    const card1 = makeCard({ id: 'c1', name: 'Bear' });
    const existingLibCard = makeCard({ id: 'lib-1', name: 'Existing' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(card1, 'creature-1', 0)];
    state.creatureArea.totalElementCount = 1;
    state.library = [existingLibCard];

    const result = batchMoveToZone(state, ['c1'], 'top-library');

    expect(result.creatureArea.rows[0].elements).toHaveLength(0);
    expect(result.library).toHaveLength(2);
    expect(result.library[0].name).toBe('Bear');
    expect(result.library[1].name).toBe('Existing');
  });

  it('detaches equipment to row3.right when card has equipment attachments', () => {
    const creature = makeCard({ id: 'c1', name: 'Knight' });
    const equipment = makeEquipment({ id: 'equip-1', name: 'Longsword' });
    const state = makeEmptyState();
    const rc = createRowCard(creature, 'creature-1', 0);
    rc.attachments = [{ card: equipment, instanceId: 'equip-1', isTapped: false }];
    state.creatureArea.rows[0].elements = [rc];
    state.creatureArea.totalElementCount = 1;

    const result = batchMoveToZone(state, ['c1'], 'graveyard');

    // Equipment stays on battlefield in row3.right
    expect(result.row3.right).toHaveLength(1);
    expect(result.row3.right[0].card.name).toBe('Longsword');
    // Creature went to graveyard
    expect(result.graveyard).toHaveLength(1);
    expect(result.graveyard[0].name).toBe('Knight');
  });

  it('detaches auras to graveyard when card has aura attachments', () => {
    const creature = makeCard({ id: 'c1', name: 'Knight' });
    const aura = makeAura({ id: 'aura-1', name: 'Pacifism' });
    const state = makeEmptyState();
    const rc = createRowCard(creature, 'creature-1', 0);
    rc.attachments = [{ card: aura, instanceId: 'aura-1', isTapped: false }];
    state.creatureArea.rows[0].elements = [rc];
    state.creatureArea.totalElementCount = 1;

    const result = batchMoveToZone(state, ['c1'], 'exile');

    // Aura goes to graveyard (state-based action)
    expect(result.graveyard).toHaveLength(1);
    expect(result.graveyard[0].name).toBe('Pacifism');
    // Creature went to exile
    expect(result.exile).toHaveLength(1);
    expect(result.exile[0].card.name).toBe('Knight');
  });

  it('skips missing cards gracefully', () => {
    const card1 = makeCard({ id: 'c1', name: 'Bear' });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(card1, 'creature-1', 0)];
    state.creatureArea.totalElementCount = 1;

    const result = batchMoveToZone(state, ['c1', 'nonexistent'], 'graveyard');

    expect(result.graveyard).toHaveLength(1);
    expect(result.graveyard[0].name).toBe('Bear');
  });

  it('tokens moving off battlefield are discarded (not added to destination)', () => {
    const token = makeCard({ id: 'token-1', name: 'Soldier Token', isToken: true });
    const state = makeEmptyState();
    state.creatureArea.rows[0].elements = [createRowCard(token, 'creature-1', 0)];
    state.creatureArea.totalElementCount = 1;

    const result = batchMoveToZone(state, ['token-1'], 'graveyard');

    expect(result.creatureArea.rows[0].elements).toHaveLength(0);
    expect(result.graveyard).toHaveLength(0);
  });
});
