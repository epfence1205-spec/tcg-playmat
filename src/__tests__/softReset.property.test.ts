import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  CardData,
  CardType,
  KeywordAbility,
  GameState,
  RowCard,
  RowTarget,
  Counter,
  CounterType,
  Attachment,
  ExileCard,
} from '../types';
import { softReset } from '../gameActions';

/**
 * Property 5: Soft Reset Correctness
 * After reset: commanders in CZ, mainboard in library, all other zones empty, gamePhase = MULLIGAN
 *
 * **Validates: Requirements 25.1, 25.2, 25.3, 25.4**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const cardTypeArb: fc.Arbitrary<CardType> = fc.constantFrom(
  'creature',
  'land',
  'artifact',
  'enchantment',
  'planeswalker',
  'instant',
  'sorcery',
  'battle',
  'other'
);

const keywordAbilityArb: fc.Arbitrary<KeywordAbility> = fc.constantFrom(
  'flying',
  'trample',
  'haste',
  'vigilance',
  'lifelink',
  'deathtouch',
  'hexproof',
  'indestructible',
  'menace',
  'reach',
  'first_strike',
  'double_strike',
  'flash',
  'defender',
  'ward',
  'shroud',
  'protection'
);

const counterTypeArb: fc.Arbitrary<CounterType> = fc.constantFrom(
  '+1/+1',
  '-1/-1',
  'lifelink',
  'hexproof',
  'indestructible',
  'shroud',
  'time',
  'charge',
  'generic',
  'loyalty',
  'flying',
  'deathtouch',
  'menace',
  'trample',
  'first_strike',
  'double_strike',
  'reach',
  'vigilance',
  'token',
  'lore',
  'shield',
  'haste',
  'custom'
);

const counterArb: fc.Arbitrary<Counter> = fc.record({
  type: counterTypeArb,
  value: fc.integer({ min: 1, max: 10 }),
});

/** Generates a valid CardData with a unique ID */
function cardDataArb(idSuffix: number): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      cardTypeArb,
      fc.boolean(),
      fc.array(keywordAbilityArb, { minLength: 0, maxLength: 3 })
    )
    .map(([name, cardType, isCommander, keywords]) => ({
      id: `card-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
      name,
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      typeLine: cardType === 'creature' ? 'Creature — Human' : 'Land',
      oracleText: '',
      isCommander,
      keywords,
      basePower: cardType === 'creature' ? '2' : null,
      baseToughness: cardType === 'creature' ? '2' : null,
      cardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates a CardData that is explicitly a commander */
function commanderCardArb(idSuffix: number): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      cardTypeArb,
      fc.array(keywordAbilityArb, { minLength: 0, maxLength: 3 })
    )
    .map(([name, cardType, keywords]) => ({
      id: `cmd-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
      name,
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      typeLine: cardType === 'creature' ? 'Legendary Creature — Human' : 'Legendary Planeswalker',
      oracleText: '',
      isCommander: true,
      keywords,
      basePower: cardType === 'creature' ? '4' : null,
      baseToughness: cardType === 'creature' ? '4' : null,
      cardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Generates a CardData that is explicitly NOT a commander */
function nonCommanderCardArb(idSuffix: number): fc.Arbitrary<CardData> {
  return fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      cardTypeArb,
      fc.array(keywordAbilityArb, { minLength: 0, maxLength: 3 })
    )
    .map(([name, cardType, keywords]) => ({
      id: `main-${idSuffix}-${Math.random().toString(36).slice(2, 10)}`,
      name,
      setCode: 'abc',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
      backFaceImageURI: null,
      typeLine: cardType === 'creature' ? 'Creature — Human' : 'Land',
      oracleText: '',
      isCommander: false,
      keywords,
      basePower: cardType === 'creature' ? '2' : null,
      baseToughness: cardType === 'creature' ? '2' : null,
      cardType,
      isToken: false,
      isTokenCopy: false,
    }));
}

/** Creates a RowCard with optional tap/counter/attachment state */
function makeRowCard(
  card: CardData,
  rowTarget: RowTarget,
  positionIndex: number,
  options?: { isTapped?: boolean; counters?: Counter[]; attachments?: Attachment[] }
): RowCard {
  return {
    card,
    instanceId: card.id,
    rowAssignment: rowTarget,
    positionIndex,
    isTapped: options?.isTapped ?? false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: options?.attachments ?? [],
    counters: options?.counters ?? [],
    isRevealed: false,
  };
}

/** Creates an empty GameState */
function emptyGameState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row4: { left: [], right: [] },
    row5: { left: [], right: [] },
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

/**
 * Generates a game state with commanders and non-commanders distributed
 * across all zones, including battlefield cards with tap states, counters,
 * and attachments.
 */
const gameStateWithCommandersArb: fc.Arbitrary<GameState> = fc
  .tuple(
    fc.integer({ min: 1, max: 3 }),   // number of commanders
    fc.integer({ min: 5, max: 25 })   // number of mainboard cards
  )
  .chain(([numCommanders, numMainboard]) => {
    const commanderArbs = Array.from({ length: numCommanders }, (_, i) => commanderCardArb(i));
    const mainboardArbs = Array.from({ length: numMainboard }, (_, i) => nonCommanderCardArb(i + numCommanders));

    return fc.tuple(
      fc.tuple(...(commanderArbs as [fc.Arbitrary<CardData>, ...fc.Arbitrary<CardData>[]])),
      fc.tuple(...(mainboardArbs as [fc.Arbitrary<CardData>, ...fc.Arbitrary<CardData>[]])),
      // Zone assignments for commanders (0-7)
      fc.array(fc.integer({ min: 0, max: 7 }), { minLength: numCommanders, maxLength: numCommanders }),
      // Zone assignments for mainboard (0-7)
      fc.array(fc.integer({ min: 0, max: 7 }), { minLength: numMainboard, maxLength: numMainboard }),
      // Tap states for battlefield cards
      fc.array(fc.boolean(), { minLength: numCommanders + numMainboard, maxLength: numCommanders + numMainboard }),
      // Counters for battlefield cards
      fc.array(fc.array(counterArb, { minLength: 0, maxLength: 3 }), { minLength: numCommanders + numMainboard, maxLength: numCommanders + numMainboard })
    );
  })
  .map(([commanders, mainboard, cmdZones, mainZones, tapStates, counterSets]) => {
    const state = emptyGameState();
    const commanderArray = Array.isArray(commanders) ? commanders : [commanders];
    const mainboardArray = Array.isArray(mainboard) ? mainboard : [mainboard];

    let tapIdx = 0;

    // Distribute commanders across zones
    for (let i = 0; i < commanderArray.length; i++) {
      const card = commanderArray[i];
      const zone = cmdZones[i];
      distributeCard(state, card, zone, tapStates[tapIdx], counterSets[tapIdx]);
      tapIdx++;
    }

    // Distribute mainboard cards across zones
    for (let i = 0; i < mainboardArray.length; i++) {
      const card = mainboardArray[i];
      const zone = mainZones[i];
      distributeCard(state, card, zone, tapStates[tapIdx], counterSets[tapIdx]);
      tapIdx++;
    }

    return state;
  });

/** Helper to distribute a card into a zone of the game state */
function distributeCard(
  state: GameState,
  card: CardData,
  zone: number,
  isTapped: boolean,
  counters: Counter[]
): void {
  switch (zone) {
    case 0: // hand
      state.hand.push(card);
      break;
    case 1: // library
      state.library.push(card);
      break;
    case 2: // graveyard
      state.graveyard.push(card);
      break;
    case 3: // commandZone
      state.commandZone.push(card);
      break;
    case 4: // exile
      state.exile.push({ card, isFaceDown: false });
      break;
    case 5: // creature area
      {
        const rowCard = makeRowCard(card, 'creature-1', state.creatureArea.rows[0].elements.length, {
          isTapped,
          counters,
        });
        state.creatureArea.rows[0].elements.push(rowCard);
        state.creatureArea.totalElementCount++;
      }
      break;
    case 6: // row4
      {
        const rowCard = makeRowCard(card, 'row4-lands', state.row4.left.length, {
          isTapped,
          counters,
        });
        state.row4.left.push(rowCard);
      }
      break;
    case 7: // row5
      {
        const rowCard = makeRowCard(card, 'row5-enchantments', state.row5.right.length, {
          isTapped,
          counters,
        });
        state.row5.right.push(rowCard);
      }
      break;
  }
}

/**
 * Generates a game state that includes battlefield cards with attachments
 * to test that attachments are properly cleared on reset.
 */
const gameStateWithAttachmentsArb: fc.Arbitrary<GameState> = fc
  .tuple(
    fc.integer({ min: 1, max: 2 }),   // commanders
    fc.integer({ min: 3, max: 10 }),  // creatures on battlefield
    fc.integer({ min: 1, max: 4 })    // equipment to attach
  )
  .chain(([numCmd, numCreatures, numEquipment]) => {
    const cmdArbs = Array.from({ length: numCmd }, (_, i) => commanderCardArb(i));
    const creatureArbs = Array.from({ length: numCreatures }, (_, i) => nonCommanderCardArb(i + numCmd));
    const equipArbs = Array.from({ length: numEquipment }, (_, i) => nonCommanderCardArb(i + numCmd + numCreatures));

    return fc.tuple(
      fc.tuple(...(cmdArbs as [fc.Arbitrary<CardData>, ...fc.Arbitrary<CardData>[]])),
      fc.tuple(...(creatureArbs as [fc.Arbitrary<CardData>, ...fc.Arbitrary<CardData>[]])),
      fc.tuple(...(equipArbs as [fc.Arbitrary<CardData>, ...fc.Arbitrary<CardData>[]])),
      fc.array(fc.boolean(), { minLength: numCreatures, maxLength: numCreatures })
    );
  })
  .map(([commanders, creatures, equipment, tapStates]) => {
    const state = emptyGameState();
    const cmdArray = Array.isArray(commanders) ? commanders : [commanders];
    const creatureArray = Array.isArray(creatures) ? creatures : [creatures];
    const equipArray = Array.isArray(equipment) ? equipment : [equipment];

    // Put commanders in command zone
    for (const cmd of cmdArray) {
      state.commandZone.push(cmd);
    }

    // Put creatures on battlefield with equipment attached
    for (let i = 0; i < creatureArray.length; i++) {
      const creature = creatureArray[i];
      const attachments: Attachment[] = [];

      // Attach equipment to the first creature
      if (i === 0) {
        for (const equip of equipArray) {
          attachments.push({
            card: equip,
            instanceId: equip.id,
            isTapped: false,
          });
        }
      }

      const rowCard = makeRowCard(creature, 'creature-1', i, {
        isTapped: tapStates[i],
        counters: [{ type: '+1/+1', value: 2 }],
        attachments,
      });
      state.creatureArea.rows[0].elements.push(rowCard);
    }

    state.creatureArea.totalElementCount = creatureArray.length;
    return state;
  });

// ─── Helper: Collect all CardData from a GameState ───────────────────────────

function collectAllCards(state: GameState): CardData[] {
  const cards: CardData[] = [];

  cards.push(...state.hand);
  cards.push(...state.library);
  cards.push(...state.graveyard);
  cards.push(...state.commandZone);
  cards.push(...state.exile.map(ec => ec.card));

  // Battlefield: creature area
  for (const row of state.creatureArea.rows) {
    for (const rc of row.elements) {
      cards.push(rc.card);
      for (const att of rc.attachments) {
        cards.push(att.card);
      }
    }
  }

  // Battlefield: row4
  for (const rc of state.row4.left) {
    cards.push(rc.card);
    for (const att of rc.attachments) {
      cards.push(att.card);
    }
  }
  for (const rc of state.row4.right) {
    cards.push(rc.card);
    for (const att of rc.attachments) {
      cards.push(att.card);
    }
  }

  // Battlefield: row5
  for (const rc of state.row5.left) {
    cards.push(rc.card);
    for (const att of rc.attachments) {
      cards.push(att.card);
    }
  }
  for (const rc of state.row5.right) {
    cards.push(rc.card);
    for (const att of rc.attachments) {
      cards.push(att.card);
    }
  }

  return cards;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 5: Soft Reset Correctness', () => {
  it('after softReset, all cards with isCommander=true are in commandZone', () => {
    fc.assert(
      fc.property(gameStateWithCommandersArb, (state: GameState) => {
        const result = softReset(state);

        // All commanders from the original state should be in commandZone
        const allOriginalCards = collectAllCards(state);
        const originalCommanders = allOriginalCards.filter(c => c.isCommander);

        expect(result.commandZone.length).toBe(originalCommanders.length);
        expect(result.commandZone.every(c => c.isCommander)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('after softReset, all cards with isCommander=false are in library', () => {
    fc.assert(
      fc.property(gameStateWithCommandersArb, (state: GameState) => {
        const result = softReset(state);

        // All non-commanders from the original state should be in library
        const allOriginalCards = collectAllCards(state);
        const originalMainboard = allOriginalCards.filter(c => !c.isCommander);

        expect(result.library.length).toBe(originalMainboard.length);
        expect(result.library.every(c => !c.isCommander)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('after softReset, hand, battlefield (creatureArea, row4, row5), graveyard, exile are all empty', () => {
    fc.assert(
      fc.property(gameStateWithCommandersArb, (state: GameState) => {
        const result = softReset(state);

        // Hand is empty
        expect(result.hand).toHaveLength(0);

        // Creature area is empty
        for (const row of result.creatureArea.rows) {
          expect(row.elements).toHaveLength(0);
        }

        // Row4 is empty
        expect(result.row4.left).toHaveLength(0);
        expect(result.row4.right).toHaveLength(0);

        // Row5 is empty
        expect(result.row5.left).toHaveLength(0);
        expect(result.row5.right).toHaveLength(0);

        // Graveyard is empty
        expect(result.graveyard).toHaveLength(0);

        // Exile is empty
        expect(result.exile).toHaveLength(0);
      }),
      { numRuns: 200 }
    );
  });

  it('after softReset, gamePhase = MULLIGAN', () => {
    fc.assert(
      fc.property(gameStateWithCommandersArb, (state: GameState) => {
        const result = softReset(state);
        expect(result.gamePhase).toBe('MULLIGAN');
      }),
      { numRuns: 200 }
    );
  });

  it('after softReset, total card count is preserved (no cards created or destroyed)', () => {
    fc.assert(
      fc.property(gameStateWithCommandersArb, (state: GameState) => {
        const before = collectAllCards(state).length;
        const result = softReset(state);
        const after = collectAllCards(result).length;

        expect(after).toBe(before);
      }),
      { numRuns: 200 }
    );
  });

  it('after softReset, all tap states, counters, and attachments are cleared (cards are plain CardData in library/CZ)', () => {
    fc.assert(
      fc.property(gameStateWithAttachmentsArb, (state: GameState) => {
        const result = softReset(state);

        // After reset, no battlefield cards exist — so no tap states, counters, or attachments
        // All cards are in library (as CardData[]) or commandZone (as CardData[])
        // These zones store plain CardData without RowCard wrappers, so no tap/counter/attachment state exists

        // Verify battlefield is completely empty (no RowCards with state)
        for (const row of result.creatureArea.rows) {
          expect(row.elements).toHaveLength(0);
        }
        expect(result.row4.left).toHaveLength(0);
        expect(result.row4.right).toHaveLength(0);
        expect(result.row5.left).toHaveLength(0);
        expect(result.row5.right).toHaveLength(0);

        // Verify total card count is preserved (attachments are collected too)
        const allOriginalCards = collectAllCards(state);
        const allResultCards = collectAllCards(result);
        expect(allResultCards.length).toBe(allOriginalCards.length);
      }),
      { numRuns: 200 }
    );
  });

  it('after softReset with cards in every zone, commanders end up in CZ and mainboard in library', () => {
    fc.assert(
      fc.property(gameStateWithCommandersArb, (state: GameState) => {
        const allOriginalCards = collectAllCards(state);
        const result = softReset(state);

        // Verify exact card identity preservation
        const originalIds = new Set(allOriginalCards.map(c => c.id));
        const resultIds = new Set(collectAllCards(result).map(c => c.id));

        expect(resultIds.size).toBe(originalIds.size);
        for (const id of originalIds) {
          expect(resultIds.has(id)).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });
});
