import { describe, it, expect } from 'vitest';
import { moveCard, removeCardFromZone, addToBattlefield, findColorGroupInsertionIndex, getManaGroupKey } from '../gameActions';
import type { CardData, GameState, RowCard, ExileCard } from '../types';
import type { LandCategory } from '../api/landCategorizer';

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
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: 'Creature — Test',
    oracleText: 'Test card',
    isCommander: false,
    keywords: [],
    basePower: '2',
    baseToughness: '2',
    cardType: 'creature',
    cmc: 0,
    manaCost: '',
    colorIdentity: [],
    producedMana: [],
    landCategory: null,
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
    state.row3.left.length +
    state.row3.right.length +
    state.row4.left.length +
    state.row4.right.length;
  return (
    state.hand.length +
    battlefieldCount +
    state.commandZone.length +
    state.graveyard.length +
    state.library.length +
    state.exile.length
  );
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
    turnCount: 0,
    gameLog: [],
  };
}

/** Helper to get all RowCards from creature area */
function getCreatureCards(state: GameState): RowCard[] {
  return state.creatureArea.rows.flatMap(r => r.elements);
}

describe('removeCardFromZone', () => {
  it('removes a card from hand', () => {
    const card = makeCard('a');
    const state = createTestState({ hand: [card, makeCard('b')] });
    const { card: removed, newState } = removeCardFromZone(state, 'hand', 'a');
    expect(removed.id).toBe('a');
    expect(newState.hand).toHaveLength(1);
    expect(newState.hand[0].id).toBe('b');
  });

  it('removes a card from battlefield (creature area)', () => {
    const rc = makeRowCard('a');
    const state = createTestState({ creatureCards: [rc] });
    const { card: removed, newState } = removeCardFromZone(state, 'battlefield', 'a');
    expect(removed.id).toBe('a');
    expect(getCreatureCards(newState)).toHaveLength(0);
  });

  it('removes a card from exile', () => {
    const ec = makeExileCard('a');
    const state = createTestState({ exile: [ec] });
    const { card: removed, newState } = removeCardFromZone(state, 'exile', 'a');
    expect(removed.id).toBe('a');
    expect(newState.exile).toHaveLength(0);
  });

  it('throws if card not found in zone', () => {
    const state = createTestState({ hand: [makeCard('a')] });
    expect(() => removeCardFromZone(state, 'hand', 'nonexistent')).toThrow('not found');
  });
});

describe('moveCard', () => {
  describe('hand to battlefield', () => {
    it('moves a card from hand to battlefield with target row', () => {
      const card = makeCard('a');
      const state = createTestState({ hand: [card] });
      const result = moveCard(state, 'a', 'hand', 'battlefield', 'creature-1');

      expect(result.hand).toHaveLength(0);
      const cards = getCreatureCards(result);
      expect(cards).toHaveLength(1);
      expect(cards[0].card.id).toBe('a');
      expect(cards[0].isTapped).toBe(false);
      expect(cards[0].isFaceDown).toBe(false);
      expect(cards[0].showingBackFace).toBe(false);
    });
  });

  describe('battlefield to graveyard', () => {
    it('moves a card from battlefield to graveyard', () => {
      const rc = makeRowCard('a');
      const state = createTestState({ creatureCards: [rc] });
      const result = moveCard(state, 'a', 'battlefield', 'graveyard');

      expect(getCreatureCards(result)).toHaveLength(0);
      expect(result.graveyard).toHaveLength(1);
      expect(result.graveyard[0].id).toBe('a');
    });
  });

  describe('hand to exile', () => {
    it('moves a card from hand to exile with isFaceDown: false', () => {
      const card = makeCard('a');
      const state = createTestState({ hand: [card] });
      const result = moveCard(state, 'a', 'hand', 'exile');

      expect(result.hand).toHaveLength(0);
      expect(result.exile).toHaveLength(1);
      expect(result.exile[0].card.id).toBe('a');
      expect(result.exile[0].isFaceDown).toBe(false);
    });
  });

  describe('exile to hand', () => {
    it('moves a card from exile back to hand', () => {
      const ec = makeExileCard('a');
      const state = createTestState({ exile: [ec] });
      const result = moveCard(state, 'a', 'exile', 'hand');

      expect(result.exile).toHaveLength(0);
      expect(result.hand).toHaveLength(1);
      expect(result.hand[0].id).toBe('a');
    });
  });

  describe('battlefield to hand (return to hand)', () => {
    it('moves a card from battlefield back to hand', () => {
      const rc = makeRowCard('a');
      const state = createTestState({ creatureCards: [rc] });
      const result = moveCard(state, 'a', 'battlefield', 'hand');

      expect(getCreatureCards(result)).toHaveLength(0);
      expect(result.hand).toHaveLength(1);
      expect(result.hand[0].id).toBe('a');
    });
  });

  describe('moving to library', () => {
    it('moves a card from hand to library', () => {
      const card = makeCard('a');
      const state = createTestState({ hand: [card] });
      const result = moveCard(state, 'a', 'hand', 'library');

      expect(result.hand).toHaveLength(0);
      expect(result.library).toHaveLength(1);
      expect(result.library[0].id).toBe('a');
    });

    it('moves a card from battlefield to library', () => {
      const rc = makeRowCard('a');
      const state = createTestState({ creatureCards: [rc] });
      const result = moveCard(state, 'a', 'battlefield', 'library');

      expect(getCreatureCards(result)).toHaveLength(0);
      expect(result.library).toHaveLength(1);
      expect(result.library[0].id).toBe('a');
    });
  });

  describe('moving to commandZone', () => {
    it('moves a card from battlefield to commandZone', () => {
      const rc = makeRowCard('a');
      const state = createTestState({ creatureCards: [rc] });
      const result = moveCard(state, 'a', 'battlefield', 'commandZone');

      expect(getCreatureCards(result)).toHaveLength(0);
      expect(result.commandZone).toHaveLength(1);
      expect(result.commandZone[0].id).toBe('a');
    });

    it('moves a card from graveyard to commandZone', () => {
      const card = makeCard('a', { isCommander: true });
      const state = createTestState({ graveyard: [card] });
      const result = moveCard(state, 'a', 'graveyard', 'commandZone');

      expect(result.graveyard).toHaveLength(0);
      expect(result.commandZone).toHaveLength(1);
      expect(result.commandZone[0].id).toBe('a');
    });
  });

  describe('invalid moves', () => {
    it('throws when card is not in source zone', () => {
      const state = createTestState({ hand: [makeCard('a')] });
      expect(() => moveCard(state, 'nonexistent', 'hand', 'battlefield', 'creature-1')).toThrow('not found');
    });

    it('throws when from and to are the same zone', () => {
      const card = makeCard('a');
      const state = createTestState({ hand: [card] });
      expect(() => moveCard(state, 'a', 'hand', 'hand')).toThrow('Cannot move card to the same zone');
    });
  });

  describe('card count conservation', () => {
    it('preserves total card count when moving hand to battlefield', () => {
      const state = createTestState({
        hand: [makeCard('a'), makeCard('b')],
        library: [makeCard('c')],
      });
      const before = totalCardCount(state);
      const result = moveCard(state, 'a', 'hand', 'battlefield', 'creature-1');
      expect(totalCardCount(result)).toBe(before);
    });

    it('preserves total card count when moving battlefield to graveyard', () => {
      const state = createTestState({
        creatureCards: [makeRowCard('a')],
        hand: [makeCard('b')],
      });
      const before = totalCardCount(state);
      const result = moveCard(state, 'a', 'battlefield', 'graveyard');
      expect(totalCardCount(result)).toBe(before);
    });

    it('preserves total card count when moving to exile', () => {
      const state = createTestState({
        hand: [makeCard('a'), makeCard('b'), makeCard('c')],
      });
      const before = totalCardCount(state);
      const result = moveCard(state, 'b', 'hand', 'exile');
      expect(totalCardCount(result)).toBe(before);
    });

    it('preserves total card count when moving exile to hand', () => {
      const state = createTestState({
        exile: [makeExileCard('a')],
        hand: [makeCard('b')],
      });
      const before = totalCardCount(state);
      const result = moveCard(state, 'a', 'exile', 'hand');
      expect(totalCardCount(result)).toBe(before);
    });

    it('preserves total card count across multiple moves', () => {
      let state = createTestState({
        hand: [makeCard('a'), makeCard('b')],
        library: [makeCard('c'), makeCard('d')],
      });
      const initialCount = totalCardCount(state);

      state = moveCard(state, 'a', 'hand', 'battlefield', 'creature-1');
      expect(totalCardCount(state)).toBe(initialCount);

      state = moveCard(state, 'b', 'hand', 'exile');
      expect(totalCardCount(state)).toBe(initialCount);

      state = moveCard(state, 'a', 'battlefield', 'graveyard');
      expect(totalCardCount(state)).toBe(initialCount);

      state = moveCard(state, 'c', 'library', 'commandZone');
      expect(totalCardCount(state)).toBe(initialCount);
    });
  });

  describe('auto-assignment based on cardType', () => {
    it('auto-assigns creature to creature area when no targetRow specified', () => {
      const card = makeCard('a', { cardType: 'creature' });
      const state = createTestState({ hand: [card] });
      const result = moveCard(state, 'a', 'hand', 'battlefield');

      expect(getCreatureCards(result)).toHaveLength(1);
    });

    it('auto-assigns land to row3 left when no targetRow specified', () => {
      const card = makeCard('a', { cardType: 'land', typeLine: 'Basic Land — Forest', landCategory: 'basic' });
      const state = createTestState({ hand: [card] });
      const result = moveCard(state, 'a', 'hand', 'battlefield');

      expect(result.row3.left).toHaveLength(1);
      expect(result.row3.left[0].card.id).toBe('a');
    });

    it('auto-assigns artifact to row3 right when no targetRow specified', () => {
      const card = makeCard('a', { cardType: 'artifact', typeLine: 'Artifact' });
      const state = createTestState({ hand: [card] });
      const result = moveCard(state, 'a', 'hand', 'battlefield');

      expect(result.row3.right).toHaveLength(1);
      expect(result.row3.right[0].card.id).toBe('a');
    });

    it('auto-assigns enchantment to row4 right when no targetRow specified', () => {
      const card = makeCard('a', { cardType: 'enchantment', typeLine: 'Enchantment' });
      const state = createTestState({ hand: [card] });
      const result = moveCard(state, 'a', 'hand', 'battlefield');

      expect(result.row4.right).toHaveLength(1);
      expect(result.row4.right[0].card.id).toBe('a');
    });
  });
});


// ─── getDefaultRowTarget routing (via addToBattlefield) ──────────────────────
// Validates Requirements 4.1, 4.2

describe('getDefaultRowTarget land routing', () => {
  function makeLand(id: string, landCategory: LandCategory | null): CardData {
    return makeCard(id, {
      cardType: 'land',
      typeLine: 'Land',
      oracleText: '',
      basePower: null,
      baseToughness: null,
      landCategory,
      producedMana: ['W'],
    });
  }

  const emptyState = createTestState();

  it('routes "basic" lands to row3-lands', () => {
    const card = makeLand('land-1', 'basic');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
    expect(result.row3.left[0].card.id).toBe('land-1');
  });

  it('routes "dual" lands to row3-lands', () => {
    const card = makeLand('land-1', 'dual');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
  });

  it('routes "shockland" to row3-lands', () => {
    const card = makeLand('land-1', 'shockland');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
  });

  it('routes "fetchland" to row3-lands', () => {
    const card = makeLand('land-1', 'fetchland');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
  });

  it('routes "checkland" to row3-lands', () => {
    const card = makeLand('land-1', 'checkland');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
  });

  it('routes "painland" to row3-lands', () => {
    const card = makeLand('land-1', 'painland');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
  });

  it('routes "rainbow" to row3-lands', () => {
    const card = makeLand('land-1', 'rainbow');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
  });

  it('routes "utility" lands to row4-lands', () => {
    const card = makeLand('land-1', 'utility');
    const result = addToBattlefield(emptyState, card);
    expect(result.row4.left).toHaveLength(1);
    expect(result.row4.left[0].card.id).toBe('land-1');
  });

  it('routes "creatureland" to row4-lands', () => {
    const card = makeLand('land-1', 'creatureland');
    const result = addToBattlefield(emptyState, card);
    expect(result.row4.left).toHaveLength(1);
    expect(result.row4.left[0].card.id).toBe('land-1');
  });

  it('routes null landCategory to row4-lands', () => {
    const card = makeLand('land-1', null);
    const result = addToBattlefield(emptyState, card);
    expect(result.row4.left).toHaveLength(1);
    expect(result.row4.left[0].card.id).toBe('land-1');
  });

  it('routes "unknown" landCategory to row3-lands', () => {
    const card = makeLand('land-1', 'unknown');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
    expect(result.row3.left[0].card.id).toBe('land-1');
  });

  it('routes "scryland" to row3-lands', () => {
    const card = makeLand('land-1', 'scryland');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
  });

  it('routes "triland" to row3-lands', () => {
    const card = makeLand('land-1', 'triland');
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
  });

  // Validates Requirements 4.1, 4.2 — remaining mana-producing categories
  it.each([
    'tangoland', 'fastland', 'slowland', 'bondland',
    'filterland', 'bounceland', 'canopyland', 'shadowland',
    'gainland', 'surveilland', 'storageland', 'bikeland',
    'tricycleland', 'pathway',
  ] as LandCategory[])('routes "%s" to row3-lands', (category) => {
    const card = makeLand('land-1', category);
    const result = addToBattlefield(emptyState, card);
    expect(result.row3.left).toHaveLength(1);
    expect(result.row3.left[0].rowAssignment).toBe('row3-lands');
  });
});


// ─── findColorGroupInsertionIndex ────────────────────────────────────────────
// Validates Requirements 4.1, 4.2, 4.4, 4.5

describe('findColorGroupInsertionIndex', () => {
  function makeLandRowCard(id: string, producedMana: string[]): RowCard {
    return makeRowCard(id, {
      card: makeCard(id, {
        cardType: 'land',
        typeLine: 'Land',
        producedMana,
        landCategory: 'basic',
      }),
      rowAssignment: 'row3-lands',
    });
  }

  it('returns 0 for an empty row', () => {
    expect(findColorGroupInsertionIndex([], 'W')).toBe(0);
  });

  it('inserts after the last card in the same group', () => {
    const lands = [
      makeLandRowCard('1', ['W']),
      makeLandRowCard('2', ['W']),
    ];
    // Insert another W land → should go after index 1
    expect(findColorGroupInsertionIndex(lands, 'W')).toBe(2);
  });

  it('inserts after same group when other groups exist', () => {
    const lands = [
      makeLandRowCard('1', ['W']),
      makeLandRowCard('2', ['W']),
      makeLandRowCard('3', ['U']),
    ];
    // Insert another W land → after the W group (index 2)
    expect(findColorGroupInsertionIndex(lands, 'W')).toBe(2);
  });

  it('new group inserts at end when no rainbow section exists', () => {
    const lands = [
      makeLandRowCard('1', ['W']),
      makeLandRowCard('2', ['U']),
    ];
    // New group "B" → appends at end (no rainbow to insert before)
    expect(findColorGroupInsertionIndex(lands, 'B')).toBe(2);
  });

  it('new group inserts before rainbow section', () => {
    const lands = [
      makeLandRowCard('1', ['W']),
      makeLandRowCard('2', ['W', 'U', 'B', 'R', 'G']), // rainbow
    ];
    // New group "U" → insert before rainbow (index 1)
    expect(findColorGroupInsertionIndex(lands, 'U')).toBe(1);
  });

  it('rainbow lands always append at end', () => {
    const lands = [
      makeLandRowCard('1', ['W']),
      makeLandRowCard('2', ['U']),
      makeLandRowCard('3', ['W', 'U', 'B', 'R', 'G']), // rainbow
    ];
    // Rainbow key → always append
    expect(findColorGroupInsertionIndex(lands, 'rainbow')).toBe(3);
  });

  it('rainbow lands append even to empty row', () => {
    expect(findColorGroupInsertionIndex([], 'rainbow')).toBe(0);
  });

  it('finds correct position for multi-color group key', () => {
    const lands = [
      makeLandRowCard('1', ['W']),
      makeLandRowCard('2', ['B', 'W']), // key = "B,W"
      makeLandRowCard('3', ['U']),
    ];
    // Insert another B,W land → after index 1
    expect(findColorGroupInsertionIndex(lands, 'B,W')).toBe(2);
  });

  it('stops scanning at rainbow boundary when looking for same-group', () => {
    const lands = [
      makeLandRowCard('1', ['W']),
      makeLandRowCard('2', ['W', 'U', 'B', 'R', 'G']), // rainbow
    ];
    // Looking for W group — found at index 0, so insert after it
    expect(findColorGroupInsertionIndex(lands, 'W')).toBe(1);
  });

  it('handles colorless group key (empty producedMana)', () => {
    const lands = [
      makeLandRowCard('1', []),  // key = ""
      makeLandRowCard('2', ['W']),
    ];
    // Insert another colorless land → after index 0
    expect(findColorGroupInsertionIndex(lands, '')).toBe(1);
  });
});
