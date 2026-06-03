import { describe, it, expect } from 'vitest';
import {
  isEquipmentCard,
  isAuraCard,
  isDockableCard,
  findAttachedCreatureId,
} from './useEquipmentDocking';
import type { GameState, CardData, RowCard } from '../types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeCardData(overrides: Partial<CardData> = {}): CardData {
  return {
    id: 'card-1',
    name: 'Test Card',
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://example.com/card.jpg',
    imageURILarge: 'https://example.com/card-large.jpg',
    backFaceImageURI: null,
    typeLine: 'Artifact — Equipment',
    oracleText: 'Equipped creature gets +2/+2.',
    isCommander: false,
    keywords: [],
    basePower: null,
    baseToughness: null,
    cardType: 'artifact',
    isToken: false,
    isTokenCopy: false,
    ...overrides,
  };
}

function makeRowCard(overrides: Partial<RowCard> = {}): RowCard {
  const card = makeCardData(overrides.card ? overrides.card as Partial<CardData> : {});
  return {
    card,
    instanceId: card.id,
    rowAssignment: 'row3-artifacts',
    positionIndex: 0,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters: [],
    isRevealed: false,
    ...overrides,
  };
}

function makeEmptyGameState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: {
      rows: [{ id: 'creature-1', elements: [] }],
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('isEquipmentCard', () => {
  it('returns true for "Artifact — Equipment"', () => {
    expect(isEquipmentCard('Artifact — Equipment')).toBe(true);
  });

  it('returns true for "Legendary Artifact — Equipment"', () => {
    expect(isEquipmentCard('Legendary Artifact — Equipment')).toBe(true);
  });

  it('returns false for plain "Artifact"', () => {
    expect(isEquipmentCard('Artifact')).toBe(false);
  });

  it('returns false for "Creature — Human"', () => {
    expect(isEquipmentCard('Creature — Human')).toBe(false);
  });
});

describe('isAuraCard', () => {
  it('returns true for "Enchantment — Aura"', () => {
    expect(isAuraCard('Enchantment — Aura')).toBe(true);
  });

  it('returns false for plain "Enchantment"', () => {
    expect(isAuraCard('Enchantment')).toBe(false);
  });
});

describe('isDockableCard', () => {
  it('returns true for artifact equipment', () => {
    expect(isDockableCard('Artifact — Equipment', 'artifact')).toBe(true);
  });

  it('returns true for enchantment aura', () => {
    expect(isDockableCard('Enchantment — Aura', 'enchantment')).toBe(true);
  });

  it('returns false for plain artifact', () => {
    expect(isDockableCard('Artifact', 'artifact')).toBe(false);
  });

  it('returns false for creature', () => {
    expect(isDockableCard('Creature — Human', 'creature')).toBe(false);
  });
});

describe('findAttachedCreatureId', () => {
  it('returns null when equipment is not attached to any creature', () => {
    const state = makeEmptyGameState();
    state.row3.right = [makeRowCard()];
    expect(findAttachedCreatureId(state, 'card-1')).toBeNull();
  });

  it('returns creature instanceId when equipment is attached in creature area', () => {
    const equipCard = makeCardData({ id: 'equip-1', name: 'Sword' });
    const creatureCard = makeCardData({
      id: 'creature-1',
      name: 'Bear',
      typeLine: 'Creature — Bear',
      cardType: 'creature',
      basePower: '2',
      baseToughness: '2',
    });

    const creature = makeRowCard({
      card: creatureCard,
      instanceId: 'creature-1',
      rowAssignment: 'creature-1',
      attachments: [
        { card: equipCard, instanceId: 'equip-1', isTapped: false },
      ],
    });

    const state = makeEmptyGameState();
    state.creatureArea.rows[0].elements = [creature];

    expect(findAttachedCreatureId(state, 'equip-1')).toBe('creature-1');
  });

  it('returns null for a non-existent equipment id', () => {
    const state = makeEmptyGameState();
    expect(findAttachedCreatureId(state, 'nonexistent')).toBeNull();
  });

  it('finds attachment in row3', () => {
    const equipCard = makeCardData({ id: 'equip-2', name: 'Shield' });
    const hostCard = makeCardData({
      id: 'host-1',
      name: 'Golem',
      typeLine: 'Artifact Creature — Golem',
      cardType: 'artifact',
    });

    const host = makeRowCard({
      card: hostCard,
      instanceId: 'host-1',
      rowAssignment: 'row3-artifacts',
      attachments: [
        { card: equipCard, instanceId: 'equip-2', isTapped: false },
      ],
    });

    const state = makeEmptyGameState();
    state.row3.right = [host];

    expect(findAttachedCreatureId(state, 'equip-2')).toBe('host-1');
  });
});
