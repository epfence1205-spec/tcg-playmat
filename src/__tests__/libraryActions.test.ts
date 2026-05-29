import { describe, it, expect } from 'vitest';
import { drawCard, shuffleLibrary } from '../gameActions';
import type { CardData, GameState } from '../types';

/** Helper to create a CardData with a given id */
function makeCard(id: string, overrides?: Partial<CardData>): CardData {
  return {
    id,
    name: `Card ${id}`,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front.jpg',
    backFaceImageURI: null,
    typeLine: 'Creature — Test',
    oracleText: 'Test card',
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

/** Helper to create a base game state */
function createTestState(overrides?: Partial<GameState>): GameState {
  return {
    hand: [],
    battlefield: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    deckLoaded: true,
    ...overrides,
  };
}

/** Helper to count total cards across all zones */
function totalCardCount(state: GameState): number {
  return (
    state.hand.length +
    state.battlefield.length +
    state.commandZone.length +
    state.graveyard.length +
    state.library.length +
    state.exile.length
  );
}

describe('drawCard', () => {
  it('moves the top card from library to hand', () => {
    const state = createTestState({
      library: [makeCard('a'), makeCard('b'), makeCard('c')],
    });

    const result = drawCard(state);

    expect(result.library).toHaveLength(2);
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe('a');
    expect(result.library[0].id).toBe('b');
    expect(result.library[1].id).toBe('c');
  });

  it('returns unchanged state when library is empty', () => {
    const state = createTestState({ library: [], hand: [makeCard('x')] });

    const result = drawCard(state);

    expect(result).toBe(state);
    expect(result.hand).toHaveLength(1);
    expect(result.library).toHaveLength(0);
  });

  it('preserves total card count', () => {
    const state = createTestState({
      library: [makeCard('a'), makeCard('b')],
      hand: [makeCard('c')],
    });
    const before = totalCardCount(state);

    const result = drawCard(state);

    expect(totalCardCount(result)).toBe(before);
  });

  it('appends drawn card to end of hand', () => {
    const state = createTestState({
      library: [makeCard('new')],
      hand: [makeCard('existing1'), makeCard('existing2')],
    });

    const result = drawCard(state);

    expect(result.hand).toHaveLength(3);
    expect(result.hand[2].id).toBe('new');
  });

  it('handles drawing the last card from library', () => {
    const state = createTestState({
      library: [makeCard('last')],
    });

    const result = drawCard(state);

    expect(result.library).toHaveLength(0);
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe('last');
  });

  it('does not mutate the original state', () => {
    const state = createTestState({
      library: [makeCard('a'), makeCard('b')],
      hand: [makeCard('c')],
    });

    drawCard(state);

    expect(state.library).toHaveLength(2);
    expect(state.hand).toHaveLength(1);
  });
});

describe('shuffleLibrary', () => {
  it('preserves all cards in the library', () => {
    const cards = [makeCard('a'), makeCard('b'), makeCard('c'), makeCard('d'), makeCard('e')];
    const state = createTestState({ library: cards });

    const result = shuffleLibrary(state);

    expect(result.library).toHaveLength(5);
    const resultIds = result.library.map((c) => c.id).sort();
    expect(resultIds).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('preserves library length', () => {
    const cards = Array.from({ length: 60 }, (_, i) => makeCard(`card-${i}`));
    const state = createTestState({ library: cards });

    const result = shuffleLibrary(state);

    expect(result.library).toHaveLength(60);
  });

  it('does not add or remove cards from other zones', () => {
    const state = createTestState({
      library: [makeCard('a'), makeCard('b'), makeCard('c')],
      hand: [makeCard('h1')],
      graveyard: [makeCard('g1')],
    });
    const before = totalCardCount(state);

    const result = shuffleLibrary(state);

    expect(totalCardCount(result)).toBe(before);
    expect(result.hand).toHaveLength(1);
    expect(result.graveyard).toHaveLength(1);
  });

  it('handles empty library without error', () => {
    const state = createTestState({ library: [] });

    const result = shuffleLibrary(state);

    expect(result.library).toHaveLength(0);
  });

  it('handles single-card library', () => {
    const state = createTestState({ library: [makeCard('only')] });

    const result = shuffleLibrary(state);

    expect(result.library).toHaveLength(1);
    expect(result.library[0].id).toBe('only');
  });

  it('does not mutate the original state', () => {
    const cards = [makeCard('a'), makeCard('b'), makeCard('c')];
    const state = createTestState({ library: cards });
    const originalOrder = state.library.map((c) => c.id);

    shuffleLibrary(state);

    expect(state.library.map((c) => c.id)).toEqual(originalOrder);
  });

  it('produces a different order (statistical — may rarely fail)', () => {
    // With 10 cards, the probability of the same order is 1/10! ≈ 0.000028%
    const cards = Array.from({ length: 10 }, (_, i) => makeCard(`card-${i}`));
    const state = createTestState({ library: cards });
    const originalOrder = state.library.map((c) => c.id);

    // Try multiple times to account for the astronomically unlikely same-order result
    let differentOrderFound = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = shuffleLibrary(state);
      const newOrder = result.library.map((c) => c.id);
      if (JSON.stringify(newOrder) !== JSON.stringify(originalOrder)) {
        differentOrderFound = true;
        break;
      }
    }

    expect(differentOrderFound).toBe(true);
  });
});
