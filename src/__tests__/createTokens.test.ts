import { describe, it, expect } from 'vitest';
import { createTokens } from '../gameActions';
import type { GameState } from '../types';
import type { TokenDefinition } from '../api/tokenResolver';

// ─── Test Helpers ────────────────────────────────────────────────────────────

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

function makeCreatureToken(): TokenDefinition {
  return {
    scryfallId: 'token-creature-id',
    name: 'Soldier',
    typeLine: 'Token Creature — Human Soldier',
    power: '1',
    toughness: '1',
    imageURI: 'https://example.com/soldier.jpg',
    imageURILarge: 'https://example.com/soldier-large.jpg',
    setCode: 'test',
    collectorNumber: 'T1',
    oracleText: '',
    cardType: 'creature',
    keywords: [],
  };
}

function makeArtifactToken(): TokenDefinition {
  return {
    scryfallId: 'token-artifact-id',
    name: 'Treasure',
    typeLine: 'Token Artifact — Treasure',
    power: null,
    toughness: null,
    imageURI: 'https://example.com/treasure.jpg',
    imageURILarge: 'https://example.com/treasure-large.jpg',
    setCode: 'test',
    collectorNumber: 'T2',
    oracleText: '{T}, Sacrifice this artifact: Add one mana of any color.',
    cardType: 'artifact',
    keywords: [],
  };
}

function makeEnchantmentToken(): TokenDefinition {
  return {
    scryfallId: 'token-enchantment-id',
    name: 'Shard',
    typeLine: 'Token Enchantment',
    power: null,
    toughness: null,
    imageURI: 'https://example.com/shard.jpg',
    imageURILarge: 'https://example.com/shard-large.jpg',
    setCode: 'test',
    collectorNumber: 'T3',
    oracleText: '',
    cardType: 'enchantment',
    keywords: [],
  };
}

// ─── Helper to count all battlefield cards ───────────────────────────────────

function countBattlefieldCards(state: GameState): number {
  let count = 0;
  for (const row of state.creatureArea.rows) {
    count += row.elements.length;
  }
  count += state.row3.left.length;
  count += state.row3.right.length;
  count += state.row4.left.length;
  count += state.row4.right.length;
  return count;
}

function getAllBattlefieldCardData(state: GameState) {
  const cards = [];
  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      cards.push(rc.card);
    }
  }
  for (const rc of state.row3.left) cards.push(rc.card);
  for (const rc of state.row3.right) cards.push(rc.card);
  for (const rc of state.row4.left) cards.push(rc.card);
  for (const rc of state.row4.right) cards.push(rc.card);
  return cards;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createTokens', () => {
  it('creates the correct quantity of tokens', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, 3);
    expect(countBattlefieldCards(result)).toBe(3);
  });

  it('all created tokens have isToken=true and isTokenCopy=false', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, 4);
    const cards = getAllBattlefieldCardData(result);

    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.isToken).toBe(true);
      expect(card.isTokenCopy).toBe(false);
    }
  });

  it('each token has a unique UUID', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, 5);
    const cards = getAllBattlefieldCardData(result);
    const ids = cards.map(c => c.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(5);
  });

  it('creature tokens are placed in the creature area', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, 2);

    // Creature tokens go to creature area rows
    const creatureCount = result.creatureArea.rows.reduce(
      (sum, row) => sum + row.elements.length, 0
    );
    expect(creatureCount).toBe(2);
    expect(result.row3.left.length).toBe(0);
    expect(result.row3.right.length).toBe(0);
    expect(result.row4.left.length).toBe(0);
    expect(result.row4.right.length).toBe(0);
  });

  it('artifact tokens are placed in row3 right (artifacts)', () => {
    const state = makeEmptyState();
    const token = makeArtifactToken();

    const result = createTokens(state, token, 3);

    expect(result.row3.right.length).toBe(3);
    const creatureCount = result.creatureArea.rows.reduce(
      (sum, row) => sum + row.elements.length, 0
    );
    expect(creatureCount).toBe(0);
  });

  it('enchantment tokens are placed in row4 right (enchantments)', () => {
    const state = makeEmptyState();
    const token = makeEnchantmentToken();

    const result = createTokens(state, token, 2);

    expect(result.row4.right.length).toBe(2);
  });

  it('returns state unchanged when quantity is 0', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, 0);
    expect(result).toBe(state);
  });

  it('returns state unchanged when quantity is negative', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, -1);
    expect(result).toBe(state);
  });

  it('returns state unchanged when quantity exceeds 10', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, 11);
    expect(result).toBe(state);
  });

  it('tokens have correct name, typeLine, and stats from TokenDefinition', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, 1);
    const cards = getAllBattlefieldCardData(result);

    expect(cards[0].name).toBe('Soldier');
    expect(cards[0].typeLine).toBe('Token Creature — Human Soldier');
    expect(cards[0].basePower).toBe('1');
    expect(cards[0].baseToughness).toBe('1');
    expect(cards[0].imageURI).toBe('https://example.com/soldier.jpg');
    expect(cards[0].setCode).toBe('test');
    expect(cards[0].collectorNumber).toBe('T1');
    expect(cards[0].cardType).toBe('creature');
    expect(cards[0].isCommander).toBe(false);
  });

  it('handles maximum valid quantity (10)', () => {
    const state = makeEmptyState();
    const token = makeCreatureToken();

    const result = createTokens(state, token, 10);
    expect(countBattlefieldCards(result)).toBe(10);
  });
});
