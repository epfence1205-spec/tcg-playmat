import { describe, it, expect } from 'vitest';
import { tapCard, flipCard, transformDFC } from '../gameActions';
import type { CardData, GameState, RowCard, ExileCard, CreatureArea, SplitRow } from '../types';

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

/** Helper to create a base game state with the new structure */
function createTestState(overrides?: {
  creatureCards?: RowCard[];
  row3Left?: RowCard[];
  row3Right?: RowCard[];
  row4Left?: RowCard[];
  row4Right?: RowCard[];
  hand?: CardData[];
  commandZone?: CardData[];
  graveyard?: CardData[];
  library?: CardData[];
  exile?: ExileCard[];
}): GameState {
  const creatureCards = overrides?.creatureCards ?? [];
  return {
    gamePhase: 'PLAYING',
    creatureArea: {
      rows: [{ id: 'creature-1', elements: creatureCards }],
      totalElementCount: creatureCards.length,
    },
    row3: { left: overrides?.row3Left ?? [], right: overrides?.row3Right ?? [] },
    row4: { left: overrides?.row4Left ?? [], right: overrides?.row4Right ?? [] },
    hand: overrides?.hand ?? [],
    commandZone: overrides?.commandZone ?? [],
    graveyard: overrides?.graveyard ?? [],
    library: overrides?.library ?? [],
    exile: overrides?.exile ?? [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
  };
}

/** Helper to get all RowCards from creature area */
function getCreatureCards(state: GameState): RowCard[] {
  return state.creatureArea.rows.flatMap(r => r.elements);
}

describe('tapCard', () => {
  it('taps an untapped card (isTapped: false → true)', () => {
    const rc = makeRowCard('a');
    const state = createTestState({ creatureCards: [rc] });

    const result = tapCard(state, 'a');

    expect(getCreatureCards(result)[0].isTapped).toBe(true);
  });

  it('untaps a tapped card (isTapped: true → false)', () => {
    const rc = makeRowCard('a', { isTapped: true });
    const state = createTestState({ creatureCards: [rc] });

    const result = tapCard(state, 'a');

    expect(getCreatureCards(result)[0].isTapped).toBe(false);
  });

  it('only affects the targeted card, not others', () => {
    const rc1 = makeRowCard('a', { positionIndex: 0 });
    const rc2 = makeRowCard('b', { positionIndex: 1 });
    const state = createTestState({ creatureCards: [rc1, rc2] });

    const result = tapCard(state, 'a');

    const cards = getCreatureCards(result);
    expect(cards.find(c => c.instanceId === 'a')!.isTapped).toBe(true);
    expect(cards.find(c => c.instanceId === 'b')!.isTapped).toBe(false);
  });

  it('does not change other card properties when tapping', () => {
    const rc = makeRowCard('a', { isFaceDown: true, showingBackFace: false });
    const state = createTestState({ creatureCards: [rc] });

    const result = tapCard(state, 'a');

    const card = getCreatureCards(result)[0];
    expect(card.isTapped).toBe(true);
    expect(card.isFaceDown).toBe(true);
    expect(card.showingBackFace).toBe(false);
  });

  it('throws if card is not on the battlefield', () => {
    const state = createTestState({ creatureCards: [] });

    expect(() => tapCard(state, 'nonexistent')).toThrow('not found on battlefield');
  });

  it('toggling tap twice returns to original state', () => {
    const rc = makeRowCard('a');
    const state = createTestState({ creatureCards: [rc] });

    const tapped = tapCard(state, 'a');
    const untapped = tapCard(tapped, 'a');

    expect(getCreatureCards(untapped)[0].isTapped).toBe(false);
  });
});

describe('flipCard', () => {
  describe('battlefield zone', () => {
    it('flips a face-up card to face-down', () => {
      const rc = makeRowCard('a');
      const state = createTestState({ creatureCards: [rc] });

      const result = flipCard(state, 'a', 'battlefield');

      expect(getCreatureCards(result)[0].isFaceDown).toBe(true);
    });

    it('flips a face-down card to face-up', () => {
      const rc = makeRowCard('a', { isFaceDown: true });
      const state = createTestState({ creatureCards: [rc] });

      const result = flipCard(state, 'a', 'battlefield');

      expect(getCreatureCards(result)[0].isFaceDown).toBe(false);
    });

    it('only affects the targeted card', () => {
      const rc1 = makeRowCard('a', { positionIndex: 0 });
      const rc2 = makeRowCard('b', { isFaceDown: true, positionIndex: 1 });
      const state = createTestState({ creatureCards: [rc1, rc2] });

      const result = flipCard(state, 'a', 'battlefield');

      const cards = getCreatureCards(result);
      expect(cards.find(c => c.instanceId === 'a')!.isFaceDown).toBe(true);
      expect(cards.find(c => c.instanceId === 'b')!.isFaceDown).toBe(true);
    });

    it('does not change tap state when flipping', () => {
      const rc = makeRowCard('a', { isTapped: true });
      const state = createTestState({ creatureCards: [rc] });

      const result = flipCard(state, 'a', 'battlefield');

      const card = getCreatureCards(result)[0];
      expect(card.isFaceDown).toBe(true);
      expect(card.isTapped).toBe(true);
    });

    it('throws if card is not found on battlefield', () => {
      const state = createTestState({ creatureCards: [] });

      expect(() => flipCard(state, 'nonexistent', 'battlefield')).toThrow(
        'not found on battlefield'
      );
    });
  });

  describe('exile zone', () => {
    it('flips a face-up exile card to face-down', () => {
      const ec: ExileCard = { card: makeCard('a'), isFaceDown: false };
      const state = createTestState({ exile: [ec] });

      const result = flipCard(state, 'a', 'exile');

      expect(result.exile[0].isFaceDown).toBe(true);
    });

    it('flips a face-down exile card to face-up', () => {
      const ec: ExileCard = { card: makeCard('a'), isFaceDown: true };
      const state = createTestState({ exile: [ec] });

      const result = flipCard(state, 'a', 'exile');

      expect(result.exile[0].isFaceDown).toBe(false);
    });

    it('throws if card is not found in exile', () => {
      const state = createTestState({ exile: [] });

      expect(() => flipCard(state, 'nonexistent', 'exile')).toThrow(
        'not found in exile'
      );
    });
  });

  describe('other zones (no-op)', () => {
    it('returns unchanged state for hand zone', () => {
      const card = makeCard('a');
      const state = createTestState({ hand: [card] });

      const result = flipCard(state, 'a', 'hand');

      expect(result).toBe(state);
    });

    it('returns unchanged state for graveyard zone', () => {
      const card = makeCard('a');
      const state = createTestState({ graveyard: [card] });

      const result = flipCard(state, 'a', 'graveyard');

      expect(result).toBe(state);
    });

    it('returns unchanged state for library zone', () => {
      const card = makeCard('a');
      const state = createTestState({ library: [card] });

      const result = flipCard(state, 'a', 'library');

      expect(result).toBe(state);
    });
  });

  describe('flip toggle round-trip', () => {
    it('flipping twice returns to original state', () => {
      const rc = makeRowCard('a');
      const state = createTestState({ creatureCards: [rc] });

      const flipped = flipCard(state, 'a', 'battlefield');
      const unflipped = flipCard(flipped, 'a', 'battlefield');

      expect(getCreatureCards(unflipped)[0].isFaceDown).toBe(false);
    });
  });
});

describe('transformDFC', () => {
  it('transforms a DFC card (showingBackFace: false → true)', () => {
    const dfcCard = makeCard('a', {
      backFaceImageURI: 'https://cards.scryfall.io/normal/back.jpg',
    });
    const rc = makeRowCard('a', { card: dfcCard });
    const state = createTestState({ creatureCards: [rc] });

    const result = transformDFC(state, 'a');

    expect(getCreatureCards(result)[0].showingBackFace).toBe(true);
  });

  it('transforms back (showingBackFace: true → false)', () => {
    const dfcCard = makeCard('a', {
      backFaceImageURI: 'https://cards.scryfall.io/normal/back.jpg',
    });
    const rc = makeRowCard('a', { card: dfcCard, showingBackFace: true });
    const state = createTestState({ creatureCards: [rc] });

    const result = transformDFC(state, 'a');

    expect(getCreatureCards(result)[0].showingBackFace).toBe(false);
  });

  it('is a no-op for non-DFC cards (backFaceImageURI is null)', () => {
    const rc = makeRowCard('a'); // backFaceImageURI is null by default
    const state = createTestState({ creatureCards: [rc] });

    const result = transformDFC(state, 'a');

    expect(getCreatureCards(result)[0].showingBackFace).toBe(false);
    expect(result).toBe(state); // Same reference — no mutation
  });

  it('only affects the targeted card', () => {
    const dfcCard = makeCard('a', {
      backFaceImageURI: 'https://cards.scryfall.io/normal/back.jpg',
    });
    const rc1 = makeRowCard('a', { card: dfcCard, positionIndex: 0 });
    const rc2 = makeRowCard('b', { positionIndex: 1 });
    const state = createTestState({ creatureCards: [rc1, rc2] });

    const result = transformDFC(state, 'a');

    const cards = getCreatureCards(result);
    expect(cards.find(c => c.instanceId === 'a')!.showingBackFace).toBe(true);
    expect(cards.find(c => c.instanceId === 'b')!.showingBackFace).toBe(false);
  });

  it('does not change tap or face-down state', () => {
    const dfcCard = makeCard('a', {
      backFaceImageURI: 'https://cards.scryfall.io/normal/back.jpg',
    });
    const rc = makeRowCard('a', { card: dfcCard, isTapped: true, isFaceDown: true });
    const state = createTestState({ creatureCards: [rc] });

    const result = transformDFC(state, 'a');

    const card = getCreatureCards(result)[0];
    expect(card.isTapped).toBe(true);
    expect(card.isFaceDown).toBe(true);
    expect(card.showingBackFace).toBe(true);
  });

  it('throws if card is not on the battlefield', () => {
    const state = createTestState({ creatureCards: [] });

    expect(() => transformDFC(state, 'nonexistent')).toThrow(
      'not found on battlefield'
    );
  });

  it('toggling transform twice returns to original state for DFC', () => {
    const dfcCard = makeCard('a', {
      backFaceImageURI: 'https://cards.scryfall.io/normal/back.jpg',
    });
    const rc = makeRowCard('a', { card: dfcCard });
    const state = createTestState({ creatureCards: [rc] });

    const transformed = transformDFC(state, 'a');
    const restored = transformDFC(transformed, 'a');

    expect(getCreatureCards(restored)[0].showingBackFace).toBe(false);
  });
});
