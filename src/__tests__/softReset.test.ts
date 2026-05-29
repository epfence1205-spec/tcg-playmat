import { describe, it, expect } from 'vitest';
import { softReset, isGameInProgress } from '../gameActions';
import type { CardData, GameState, RowCard, ExileCard } from '../types';

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

/** Helper to create a RowCard for the creature area */
function makeRowCard(id: string, overrides?: Partial<RowCard>): RowCard {
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
    counters: [],
    isRevealed: false,
    ...overrides,
  };
}

/** Helper to create an ExileCard */
function makeExileCard(id: string, isFaceDown = false): ExileCard {
  return {
    card: makeCard(id),
    isFaceDown,
  };
}

/** Helper to count total cards across all zones */
function totalCardCount(state: GameState): number {
  const battlefieldCount =
    state.creatureArea.rows.reduce((sum, r) => sum + r.elements.length, 0) +
    state.row4.left.length +
    state.row4.right.length +
    state.row5.left.length +
    state.row5.right.length;
  return (
    state.hand.length +
    battlefieldCount +
    state.commandZone.length +
    state.graveyard.length +
    state.library.length +
    state.exile.length
  );
}

/** Helper to get all battlefield cards count */
function battlefieldCardCount(state: GameState): number {
  return (
    state.creatureArea.rows.reduce((sum, r) => sum + r.elements.length, 0) +
    state.row4.left.length +
    state.row4.right.length +
    state.row5.left.length +
    state.row5.right.length
  );
}

/** Helper to create a base game state with the new structure */
function createTestState(overrides?: {
  creatureCards?: RowCard[];
  row4Left?: RowCard[];
  row4Right?: RowCard[];
  row5Left?: RowCard[];
  row5Right?: RowCard[];
  hand?: CardData[];
  commandZone?: CardData[];
  graveyard?: CardData[];
  library?: CardData[];
  exile?: ExileCard[];
  deckLoaded?: boolean;
}): GameState {
  const creatureCards = overrides?.creatureCards ?? [];
  return {
    gamePhase: 'PLAYING',
    creatureArea: {
      rows: [{ id: 'creature-1', elements: creatureCards }],
      totalElementCount: creatureCards.length,
    },
    row4: { left: overrides?.row4Left ?? [], right: overrides?.row4Right ?? [] },
    row5: { left: overrides?.row5Left ?? [], right: overrides?.row5Right ?? [] },
    hand: overrides?.hand ?? [],
    commandZone: overrides?.commandZone ?? [],
    graveyard: overrides?.graveyard ?? [],
    library: overrides?.library ?? [],
    exile: overrides?.exile ?? [],
    mulliganState: null,
    deckLoaded: overrides?.deckLoaded ?? true,
    lifeTotal: 40,
  };
}

describe('softReset', () => {
  it('preserves total card count after reset', () => {
    const state = createTestState({
      hand: [makeCard('a'), makeCard('b')],
      creatureCards: [makeRowCard('c'), makeRowCard('d', { positionIndex: 1 })],
      commandZone: [makeCard('e', { isCommander: true })],
      graveyard: [makeCard('f')],
      library: [makeCard('g'), makeCard('h')],
      exile: [makeExileCard('i')],
    });

    const before = totalCardCount(state);
    const result = softReset(state);
    expect(totalCardCount(result)).toBe(before);
  });

  it('separates commanders into Command Zone', () => {
    const commander1 = makeCard('cmd1', { isCommander: true, name: 'Commander 1' });
    const commander2 = makeCard('cmd2', { isCommander: true, name: 'Commander 2' });
    const regular = makeCard('reg1', { isCommander: false });

    const state = createTestState({
      hand: [commander1],
      creatureCards: [makeRowCard('reg1', { card: regular })],
      graveyard: [commander2],
    });

    const result = softReset(state);
    expect(result.commandZone).toHaveLength(2);
    expect(result.commandZone.every(c => c.isCommander)).toBe(true);
    expect(result.library).toHaveLength(1);
    expect(result.library[0].isCommander).toBe(false);
  });

  it('empties hand, battlefield, graveyard, and exile', () => {
    const state = createTestState({
      hand: [makeCard('a'), makeCard('b')],
      creatureCards: [makeRowCard('c')],
      graveyard: [makeCard('d')],
      exile: [makeExileCard('e')],
      library: [makeCard('f')],
      commandZone: [makeCard('g', { isCommander: true })],
    });

    const result = softReset(state);
    expect(result.hand).toHaveLength(0);
    expect(battlefieldCardCount(result)).toBe(0);
    expect(result.graveyard).toHaveLength(0);
    expect(result.exile).toHaveLength(0);
  });

  it('clears all tap states (cards on battlefield were tapped)', () => {
    const tappedCard = makeRowCard('a', { isTapped: true });
    const state = createTestState({
      creatureCards: [tappedCard],
    });

    const result = softReset(state);
    // After reset, card is in library — no tap state exists
    expect(battlefieldCardCount(result)).toBe(0);
    expect(result.library).toHaveLength(1);
  });

  it('resets face-down states (cards were face-down on battlefield)', () => {
    const faceDownCard = makeRowCard('a', { isFaceDown: true });
    const state = createTestState({
      creatureCards: [faceDownCard],
    });

    const result = softReset(state);
    // After reset, card is in library — no face-down state
    expect(battlefieldCardCount(result)).toBe(0);
    expect(result.library).toHaveLength(1);
  });

  it('resets face-down exile cards', () => {
    const faceDownExile = makeExileCard('a', true);
    const state = createTestState({
      exile: [faceDownExile],
    });

    const result = softReset(state);
    expect(result.exile).toHaveLength(0);
    expect(result.library).toHaveLength(1);
  });

  it('sets deckLoaded to true', () => {
    const state = createTestState({
      library: [makeCard('a')],
    });

    const result = softReset(state);
    expect(result.deckLoaded).toBe(true);
  });

  it('handles empty state (no cards anywhere)', () => {
    const state = createTestState();
    const result = softReset(state);

    expect(result.hand).toHaveLength(0);
    expect(battlefieldCardCount(result)).toBe(0);
    expect(result.commandZone).toHaveLength(0);
    expect(result.graveyard).toHaveLength(0);
    expect(result.library).toHaveLength(0);
    expect(result.exile).toHaveLength(0);
    expect(result.deckLoaded).toBe(true);
  });

  it('is idempotent — softReset(softReset(state)) === softReset(state)', () => {
    const state = createTestState({
      hand: [makeCard('a'), makeCard('b')],
      creatureCards: [makeRowCard('c')],
      commandZone: [makeCard('d', { isCommander: true })],
      graveyard: [makeCard('e')],
      library: [makeCard('f')],
      exile: [makeExileCard('g')],
    });

    const once = softReset(state);
    const twice = softReset(once);

    expect(twice.hand).toEqual(once.hand);
    expect(twice.creatureArea).toEqual(once.creatureArea);
    expect(twice.row4).toEqual(once.row4);
    expect(twice.row5).toEqual(once.row5);
    expect(twice.commandZone).toEqual(once.commandZone);
    expect(twice.graveyard).toEqual(once.graveyard);
    expect(twice.library).toEqual(once.library);
    expect(twice.exile).toEqual(once.exile);
    expect(twice.deckLoaded).toEqual(once.deckLoaded);
  });

  it('preserves card count with many cards spread across all zones', () => {
    const cards = Array.from({ length: 100 }, (_, i) => makeCard(`card-${i}`));
    const commanders = Array.from({ length: 2 }, (_, i) =>
      makeCard(`cmd-${i}`, { isCommander: true })
    );

    const creatureCards = cards.slice(7, 15).map((c, idx) =>
      makeRowCard(c.id, {
        card: c,
        positionIndex: idx,
        isTapped: Math.random() > 0.5,
        isFaceDown: Math.random() > 0.8,
      })
    );

    const state = createTestState({
      hand: cards.slice(0, 7),
      creatureCards,
      commandZone: commanders,
      graveyard: cards.slice(15, 20),
      library: cards.slice(20, 95),
      exile: cards.slice(95, 100).map(c => ({ card: c, isFaceDown: false })),
    });

    const before = totalCardCount(state);
    const result = softReset(state);
    expect(totalCardCount(result)).toBe(before);
  });
});

describe('isGameInProgress', () => {
  it('returns false when all cards are in library and command zone', () => {
    const state = createTestState({
      library: [makeCard('a'), makeCard('b')],
      commandZone: [makeCard('c', { isCommander: true })],
    });
    expect(isGameInProgress(state)).toBe(false);
  });

  it('returns true when cards are in hand', () => {
    const state = createTestState({
      hand: [makeCard('a')],
      library: [makeCard('b')],
    });
    expect(isGameInProgress(state)).toBe(true);
  });

  it('returns true when cards are on battlefield', () => {
    const state = createTestState({
      creatureCards: [makeRowCard('a')],
      library: [makeCard('b')],
    });
    expect(isGameInProgress(state)).toBe(true);
  });

  it('returns true when cards are in graveyard', () => {
    const state = createTestState({
      graveyard: [makeCard('a')],
      library: [makeCard('b')],
    });
    expect(isGameInProgress(state)).toBe(true);
  });

  it('returns true when cards are in exile', () => {
    const state = createTestState({
      exile: [makeExileCard('a')],
      library: [makeCard('b')],
    });
    expect(isGameInProgress(state)).toBe(true);
  });

  it('returns false for empty state', () => {
    const state = createTestState();
    expect(isGameInProgress(state)).toBe(false);
  });
});
