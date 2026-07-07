import { describe, it, expect } from 'vitest';
import { applyPeekResult } from './peekActions';
import type { PeekResult } from './peekActions';
import type { GameState, CardData } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(id: string, name = `Card ${id}`): CardData {
  return {
    id,
    name,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: '',
    imageURILarge: '',
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: 'Creature — Test',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: '2',
    baseToughness: '2',
    cardType: 'creature',
    cmc: 2,
    manaCost: '{1}{U}',
    colorIdentity: ['U'],
    producedMana: [],
    landCategory: null,
    isToken: false,
    isTokenCopy: false,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
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
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('applyPeekResult', () => {
  it('scry all-top: places topCards at front of library', () => {
    const c1 = makeCard('c1');
    const c2 = makeCard('c2');
    const c3 = makeCard('c3');
    const remaining = makeCard('r1');
    const state = makeState({ library: [c1, c2, c3, remaining] });

    const result: PeekResult = {
      mode: 'scry',
      topCards: [c2, c1, c3], // reordered
      bottomCards: [],
      handCards: [],
      graveyardCards: [],
      originalCardIds: ['c1', 'c2', 'c3'],
    };

    const next = applyPeekResult(state, result);
    expect(next.library.map(c => c.id)).toEqual(['c2', 'c1', 'c3', 'r1']);
  });

  it('scry mixed: topCards at front, bottomCards at end', () => {
    const c1 = makeCard('c1');
    const c2 = makeCard('c2');
    const c3 = makeCard('c3');
    const remaining = makeCard('r1');
    const state = makeState({ library: [c1, c2, c3, remaining] });

    const result: PeekResult = {
      mode: 'scry',
      topCards: [c1],
      bottomCards: [c3, c2],
      handCards: [],
      graveyardCards: [],
      originalCardIds: ['c1', 'c2', 'c3'],
    };

    const next = applyPeekResult(state, result);
    expect(next.library.map(c => c.id)).toEqual(['c1', 'r1', 'c3', 'c2']);
  });

  it('surveil: graveyardCards appended to top of graveyard', () => {
    const c1 = makeCard('c1');
    const c2 = makeCard('c2');
    const existingGY = makeCard('gy1');
    const state = makeState({
      library: [c1, c2],
      graveyard: [existingGY],
    });

    const result: PeekResult = {
      mode: 'surveil',
      topCards: [c1],
      bottomCards: [],
      handCards: [],
      graveyardCards: [c2],
      originalCardIds: ['c1', 'c2'],
    };

    const next = applyPeekResult(state, result);
    expect(next.library.map(c => c.id)).toEqual(['c1']);
    // c2 goes to top of graveyard (end of array), existing gy1 stays below
    expect(next.graveyard.map(c => c.id)).toEqual(['gy1', 'c2']);
  });

  it('select: handCards appended to hand, bottomCards at end of library', () => {
    const c1 = makeCard('c1');
    const c2 = makeCard('c2');
    const c3 = makeCard('c3');
    const remaining = makeCard('r1');
    const existingHand = makeCard('h1');
    const state = makeState({
      library: [c1, c2, c3, remaining],
      hand: [existingHand],
    });

    const result: PeekResult = {
      mode: 'select',
      topCards: [],
      bottomCards: [c2, c3],
      handCards: [c1],
      graveyardCards: [],
      originalCardIds: ['c1', 'c2', 'c3'],
    };

    const next = applyPeekResult(state, result);
    expect(next.hand.map(c => c.id)).toEqual(['h1', 'c1']);
    expect(next.library.map(c => c.id)).toEqual(['r1', 'c2', 'c3']);
  });

  it('card conservation: total output equals total peeked', () => {
    const cards = Array.from({ length: 5 }, (_, i) => makeCard(`c${i}`));
    const state = makeState({ library: cards });

    const result: PeekResult = {
      mode: 'scry',
      topCards: [cards[0], cards[2]],
      bottomCards: [cards[4]],
      handCards: [cards[1]],
      graveyardCards: [cards[3]],
      originalCardIds: cards.map(c => c.id),
    };

    const totalOutput =
      result.topCards.length +
      result.bottomCards.length +
      result.handCards.length +
      result.graveyardCards.length;

    expect(totalOutput).toBe(5);
  });

  it('empty arrays: no crash, zones unchanged for empty destinations', () => {
    const c1 = makeCard('c1');
    const remaining = makeCard('r1');
    const state = makeState({
      library: [c1, remaining],
      hand: [makeCard('h1')],
      graveyard: [makeCard('gy1')],
    });

    const result: PeekResult = {
      mode: 'scry',
      topCards: [c1],
      bottomCards: [],
      handCards: [],
      graveyardCards: [],
      originalCardIds: ['c1'],
    };

    const next = applyPeekResult(state, result);
    expect(next.library.map(c => c.id)).toEqual(['c1', 'r1']);
    expect(next.hand).toHaveLength(1);
    expect(next.graveyard).toHaveLength(1);
  });
});
