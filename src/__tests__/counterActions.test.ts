import { describe, it, expect } from 'vitest';
import { addCounter, removeCounter, setCustomCounter } from '../counterActions';
import type { GameState, CardData, RowCard, CounterType } from '../types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeCard(id: string): CardData {
  return {
    id,
    name: 'Test Card',
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
    backFaceImageURI: null,
    typeLine: 'Creature — Human',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: '2',
    baseToughness: '2',
    cardType: 'creature',
    isToken: false,
    isTokenCopy: false,
  };
}

function makeRowCard(id: string, counters: { type: CounterType; value: number }[] = []): RowCard {
  return {
    card: makeCard(id),
    instanceId: id,
    rowAssignment: 'creature-1',
    positionIndex: 0,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters,
    isRevealed: false,
  };
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

function stateWithCardInCreatureArea(cardId: string, counters: { type: CounterType; value: number }[] = []): GameState {
  const state = makeEmptyState();
  state.creatureArea.rows[0].elements = [makeRowCard(cardId, counters)];
  state.creatureArea.totalElementCount = 1;
  return state;
}

function stateWithCardInrow3Left(cardId: string, counters: { type: CounterType; value: number }[] = []): GameState {
  const state = makeEmptyState();
  const rc = makeRowCard(cardId, counters);
  rc.rowAssignment = 'row3-lands';
  state.row3.left = [rc];
  return state;
}

function stateWithCardInrow4Right(cardId: string, counters: { type: CounterType; value: number }[] = []): GameState {
  const state = makeEmptyState();
  const rc = makeRowCard(cardId, counters);
  rc.rowAssignment = 'row4-enchantments';
  state.row4.right = [rc];
  return state;
}

// ─── addCounter Tests ────────────────────────────────────────────────────────

describe('addCounter', () => {
  it('adds a new counter with value 1 when card has no counters', () => {
    const state = stateWithCardInCreatureArea('card-1');
    const result = addCounter(state, 'card-1', '+1/+1');
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(1);
    expect(card.counters[0]).toEqual({ type: '+1/+1', value: 1 });
  });

  it('increments existing counter value by 1', () => {
    const state = stateWithCardInCreatureArea('card-1', [{ type: '+1/+1', value: 3 }]);
    const result = addCounter(state, 'card-1', '+1/+1');
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(1);
    expect(card.counters[0]).toEqual({ type: '+1/+1', value: 4 });
  });

  it('adds a different counter type without affecting existing counters', () => {
    const state = stateWithCardInCreatureArea('card-1', [{ type: '+1/+1', value: 2 }]);
    const result = addCounter(state, 'card-1', 'loyalty');
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(2);
    expect(card.counters[0]).toEqual({ type: '+1/+1', value: 2 });
    expect(card.counters[1]).toEqual({ type: 'loyalty', value: 1 });
  });

  it('works for cards in row3 left', () => {
    const state = stateWithCardInrow3Left('land-1');
    const result = addCounter(state, 'land-1', 'charge');
    const card = result.row3.left[0];
    expect(card.counters).toHaveLength(1);
    expect(card.counters[0]).toEqual({ type: 'charge', value: 1 });
  });

  it('works for cards in row4 right', () => {
    const state = stateWithCardInrow4Right('ench-1');
    const result = addCounter(state, 'ench-1', 'lore');
    const card = result.row4.right[0];
    expect(card.counters).toHaveLength(1);
    expect(card.counters[0]).toEqual({ type: 'lore', value: 1 });
  });

  it('returns original state if card not found', () => {
    const state = stateWithCardInCreatureArea('card-1');
    const result = addCounter(state, 'nonexistent', '+1/+1');
    expect(result).toBe(state);
  });

  it('supports all 24 counter types', () => {
    const allTypes: CounterType[] = [
      '+1/+1', '-1/-1', 'lifelink', 'hexproof', 'indestructible', 'shroud',
      'time', 'charge', 'generic', 'loyalty', 'flying', 'deathtouch',
      'menace', 'trample', 'first_strike', 'double_strike', 'reach',
      'vigilance', 'token', 'lore', 'shield', 'haste', 'custom',
    ];
    let state = stateWithCardInCreatureArea('card-1');
    for (const type of allTypes) {
      state = addCounter(state, 'card-1', type);
    }
    const card = state.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(allTypes.length);
    for (const type of allTypes) {
      expect(card.counters.find(c => c.type === type)?.value).toBe(1);
    }
  });
});

// ─── removeCounter Tests ─────────────────────────────────────────────────────

describe('removeCounter', () => {
  it('decrements counter value by 1 when value > 1', () => {
    const state = stateWithCardInCreatureArea('card-1', [{ type: '+1/+1', value: 3 }]);
    const result = removeCounter(state, 'card-1', '+1/+1');
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(1);
    expect(card.counters[0]).toEqual({ type: '+1/+1', value: 2 });
  });

  it('removes counter entirely when value would become 0', () => {
    const state = stateWithCardInCreatureArea('card-1', [{ type: '+1/+1', value: 1 }]);
    const result = removeCounter(state, 'card-1', '+1/+1');
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(0);
  });

  it('is a no-op when counter type does not exist', () => {
    const state = stateWithCardInCreatureArea('card-1', [{ type: '+1/+1', value: 2 }]);
    const result = removeCounter(state, 'card-1', 'loyalty');
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(1);
    expect(card.counters[0]).toEqual({ type: '+1/+1', value: 2 });
  });

  it('returns original state if card not found', () => {
    const state = stateWithCardInCreatureArea('card-1');
    const result = removeCounter(state, 'nonexistent', '+1/+1');
    expect(result).toBe(state);
  });

  it('does not affect other counters when removing one type', () => {
    const state = stateWithCardInCreatureArea('card-1', [
      { type: '+1/+1', value: 2 },
      { type: 'loyalty', value: 5 },
    ]);
    const result = removeCounter(state, 'card-1', '+1/+1');
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(2);
    expect(card.counters[0]).toEqual({ type: '+1/+1', value: 1 });
    expect(card.counters[1]).toEqual({ type: 'loyalty', value: 5 });
  });
});

// ─── setCustomCounter Tests ──────────────────────────────────────────────────

describe('setCustomCounter', () => {
  it('sets a custom counter with the given value', () => {
    const state = stateWithCardInCreatureArea('card-1');
    const result = setCustomCounter(state, 'card-1', 'Experience', 3);
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(1);
    expect(card.counters[0]).toEqual({ type: 'custom', value: 3 });
  });

  it('updates existing custom counter value', () => {
    const state = stateWithCardInCreatureArea('card-1', [{ type: 'custom', value: 2 }]);
    const result = setCustomCounter(state, 'card-1', 'Experience', 5);
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(1);
    expect(card.counters[0]).toEqual({ type: 'custom', value: 5 });
  });

  it('removes custom counter when value is 0', () => {
    const state = stateWithCardInCreatureArea('card-1', [{ type: 'custom', value: 3 }]);
    const result = setCustomCounter(state, 'card-1', 'Experience', 0);
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(0);
  });

  it('does not affect other counters', () => {
    const state = stateWithCardInCreatureArea('card-1', [{ type: '+1/+1', value: 2 }]);
    const result = setCustomCounter(state, 'card-1', 'Poison', 4);
    const card = result.creatureArea.rows[0].elements[0];
    expect(card.counters).toHaveLength(2);
    expect(card.counters[0]).toEqual({ type: '+1/+1', value: 2 });
    expect(card.counters[1]).toEqual({ type: 'custom', value: 4 });
  });

  it('returns original state if card not found', () => {
    const state = stateWithCardInCreatureArea('card-1');
    const result = setCustomCounter(state, 'nonexistent', 'Test', 1);
    expect(result).toBe(state);
  });
});
