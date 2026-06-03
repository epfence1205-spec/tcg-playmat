import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { untapAll, tapCard, getAllBattlefieldCards } from '../gameActions';
import type { GameState, RowCard, CardData, Attachment, RowTarget } from '../types';

/**
 * Property 22: Untap All Completeness
 * - After untapAll, no card on the battlefield has isTapped === true
 * - This includes all attachments on all cards
 *
 * Property 23: Tap Toggle Idempotence
 * - tap(tap(s)) === s (tapping twice returns to original tap state)
 *
 * **Validates: Requirements 26.4, 26.1**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const ROW_TARGETS: RowTarget[] = [
  'creature-1', 'creature-2', 'creature-3',
  'row3-lands', 'row3-artifacts',
  'row4-lands', 'row4-enchantments',
];

function makeCard(id: string): CardData {
  return {
    id,
    name: `Card ${id}`,
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

function makeAttachment(id: string, isTapped: boolean): Attachment {
  return {
    card: makeCard(id),
    instanceId: id,
    isTapped,
  };
}

function makeRowCard(
  id: string,
  rowAssignment: RowTarget,
  positionIndex: number,
  isTapped: boolean,
  attachments: Attachment[] = []
): RowCard {
  return {
    card: makeCard(id),
    instanceId: id,
    rowAssignment,
    positionIndex,
    isTapped,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments,
    counters: [],
    isRevealed: false,
  };
}

/** Arbitrary for a random tap state */
const tapStateArb: fc.Arbitrary<boolean> = fc.boolean();

/** Arbitrary for a random attachment with random tap state */
const attachmentArb: fc.Arbitrary<Attachment> = fc.record({
  id: fc.uuid(),
  isTapped: fc.boolean(),
}).map(({ id, isTapped }) => makeAttachment(id, isTapped));

/** Arbitrary for a RowCard with random tap state and random attachments */
const rowCardArb: fc.Arbitrary<{ id: string; rowTarget: RowTarget; isTapped: boolean; attachments: Attachment[] }> =
  fc.record({
    id: fc.uuid(),
    rowTarget: fc.constantFrom(...ROW_TARGETS),
    isTapped: tapStateArb,
    attachments: fc.array(attachmentArb, { minLength: 0, maxLength: 3 }),
  });

/** Generates a game state with cards distributed across battlefield zones */
const gameStateWithBattlefieldCardsArb: fc.Arbitrary<GameState> = fc.record({
  creatureCards: fc.array(rowCardArb, { minLength: 0, maxLength: 5 }),
  row3LeftCards: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
  row3RightCards: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
  row4LeftCards: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
  row4RightCards: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
}).map(({ creatureCards, row3LeftCards, row3RightCards, row4LeftCards, row4RightCards }) => {
  const creatureElements = creatureCards.map((c, i) =>
    makeRowCard(c.id, 'creature-1', i, c.isTapped, c.attachments)
  );
  const r4Left = row3LeftCards.map((c, i) =>
    makeRowCard(c.id, 'row3-lands', i, c.isTapped, c.attachments)
  );
  const r4Right = row3RightCards.map((c, i) =>
    makeRowCard(c.id, 'row3-artifacts', i, c.isTapped, c.attachments)
  );
  const r5Left = row4LeftCards.map((c, i) =>
    makeRowCard(c.id, 'row4-lands', i, c.isTapped, c.attachments)
  );
  const r5Right = row4RightCards.map((c, i) =>
    makeRowCard(c.id, 'row4-enchantments', i, c.isTapped, c.attachments)
  );

  return {
    gamePhase: 'PLAYING' as const,
    creatureArea: {
      rows: [{ id: 'creature-1', elements: creatureElements }],
      totalElementCount: creatureElements.length,
    },
    row3: { left: r4Left, right: r4Right },
    row4: { left: r5Left, right: r5Right },
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
  };
});

/** Generates a game state that has at least one card on the battlefield */
const gameStateWithAtLeastOneCardArb: fc.Arbitrary<GameState> = fc.record({
  creatureCards: fc.array(rowCardArb, { minLength: 1, maxLength: 5 }),
  row3LeftCards: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
  row3RightCards: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
  row4LeftCards: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
  row4RightCards: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
}).map(({ creatureCards, row3LeftCards, row3RightCards, row4LeftCards, row4RightCards }) => {
  const creatureElements = creatureCards.map((c, i) =>
    makeRowCard(c.id, 'creature-1', i, c.isTapped, c.attachments)
  );
  const r4Left = row3LeftCards.map((c, i) =>
    makeRowCard(c.id, 'row3-lands', i, c.isTapped, c.attachments)
  );
  const r4Right = row3RightCards.map((c, i) =>
    makeRowCard(c.id, 'row3-artifacts', i, c.isTapped, c.attachments)
  );
  const r5Left = row4LeftCards.map((c, i) =>
    makeRowCard(c.id, 'row4-lands', i, c.isTapped, c.attachments)
  );
  const r5Right = row4RightCards.map((c, i) =>
    makeRowCard(c.id, 'row4-enchantments', i, c.isTapped, c.attachments)
  );

  return {
    gamePhase: 'PLAYING' as const,
    creatureArea: {
      rows: [{ id: 'creature-1', elements: creatureElements }],
      totalElementCount: creatureElements.length,
    },
    row3: { left: r4Left, right: r4Right },
    row4: { left: r5Left, right: r5Right },
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
  };
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 22: Untap All Completeness', () => {
  it('after untapAll, no card on the battlefield has isTapped === true', () => {
    fc.assert(
      fc.property(
        gameStateWithBattlefieldCardsArb,
        (state: GameState) => {
          const result = untapAll(state);
          const allCards = getAllBattlefieldCards(result);

          for (const card of allCards) {
            expect(card.isTapped).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('after untapAll, no attachment on any battlefield card has isTapped === true', () => {
    fc.assert(
      fc.property(
        gameStateWithBattlefieldCardsArb,
        (state: GameState) => {
          const result = untapAll(state);
          const allCards = getAllBattlefieldCards(result);

          for (const card of allCards) {
            for (const attachment of card.attachments) {
              expect(attachment.isTapped).toBe(false);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('untapAll on an already fully untapped state is idempotent', () => {
    fc.assert(
      fc.property(
        gameStateWithBattlefieldCardsArb,
        (state: GameState) => {
          const once = untapAll(state);
          const twice = untapAll(once);
          const cardsOnce = getAllBattlefieldCards(once);
          const cardsTwice = getAllBattlefieldCards(twice);

          expect(cardsOnce.length).toBe(cardsTwice.length);
          for (let i = 0; i < cardsOnce.length; i++) {
            expect(cardsOnce[i].isTapped).toBe(cardsTwice[i].isTapped);
            expect(cardsOnce[i].isTapped).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property 23: Tap Toggle Idempotence', () => {
  it('tapping a card twice returns it to its original tap state', () => {
    fc.assert(
      fc.property(
        gameStateWithAtLeastOneCardArb,
        (state: GameState) => {
          const allCards = getAllBattlefieldCards(state);
          // Pick the first card for the tap toggle test
          const targetCard = allCards[0];
          const originalTapState = targetCard.isTapped;

          const afterFirstTap = tapCard(state, targetCard.instanceId);
          const afterSecondTap = tapCard(afterFirstTap, targetCard.instanceId);

          const resultCards = getAllBattlefieldCards(afterSecondTap);
          const resultCard = resultCards.find(c => c.instanceId === targetCard.instanceId);

          expect(resultCard).toBeDefined();
          expect(resultCard!.isTapped).toBe(originalTapState);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('tap toggles the isTapped state (true becomes false, false becomes true)', () => {
    fc.assert(
      fc.property(
        gameStateWithAtLeastOneCardArb,
        (state: GameState) => {
          const allCards = getAllBattlefieldCards(state);
          const targetCard = allCards[0];
          const originalTapState = targetCard.isTapped;

          const afterTap = tapCard(state, targetCard.instanceId);
          const resultCards = getAllBattlefieldCards(afterTap);
          const resultCard = resultCards.find(c => c.instanceId === targetCard.instanceId);

          expect(resultCard).toBeDefined();
          expect(resultCard!.isTapped).toBe(!originalTapState);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('tap(tap(s)) === s for any card in any battlefield zone', () => {
    fc.assert(
      fc.property(
        gameStateWithAtLeastOneCardArb,
        fc.nat(),
        (state: GameState, cardIndexSeed: number) => {
          const allCards = getAllBattlefieldCards(state);
          // Pick a random card from the battlefield
          const targetCard = allCards[cardIndexSeed % allCards.length];
          const originalTapState = targetCard.isTapped;

          const afterFirstTap = tapCard(state, targetCard.instanceId);
          const afterSecondTap = tapCard(afterFirstTap, targetCard.instanceId);

          const resultCards = getAllBattlefieldCards(afterSecondTap);
          const resultCard = resultCards.find(c => c.instanceId === targetCard.instanceId);

          expect(resultCard).toBeDefined();
          expect(resultCard!.isTapped).toBe(originalTapState);
        }
      ),
      { numRuns: 200 }
    );
  });
});
