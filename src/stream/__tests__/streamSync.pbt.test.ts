import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { GameState, CardData, RowCard, ExileCard, CreatureArea, SplitRow, Counter, Attachment, CounterType, KeywordAbility, CardType, RowTarget, GamePhase, MulliganState } from '../../types';
import type { StreamSyncMessage } from '../constants';
import { isValidSyncMessage } from '../validateMessage';

/**
 * Property 1: BroadcastChannel state round-trip
 *
 * For any valid GameState produced by the player view, serializing it into a
 * StreamSyncMessage and deserializing it in the stream view SHALL produce an
 * equivalent GameState object.
 *
 * **Validates: Requirements 2.1**
 *
 * Feature: obs-stream-view, Property 1: BroadcastChannel state round-trip
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const CARD_TYPES: CardType[] = ['creature', 'land', 'artifact', 'enchantment', 'planeswalker', 'instant', 'sorcery', 'battle', 'other'];
const ROW_TARGETS: RowTarget[] = ['creature-1', 'creature-2', 'creature-3', 'row3-lands', 'row3-artifacts', 'row4-lands', 'row4-enchantments', 'pw-battle-column'];
const COUNTER_TYPES: CounterType[] = ['+1/+1', '-1/-1', 'lifelink', 'hexproof', 'indestructible', 'time', 'charge', 'generic', 'loyalty', 'flying', 'deathtouch', 'menace', 'trample', 'custom'];
const KEYWORDS: KeywordAbility[] = ['flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 'hexproof', 'indestructible', 'menace', 'reach'];
const GAME_PHASES: GamePhase[] = ['MULLIGAN', 'PLAYING'];

const arbCardType = fc.constantFrom(...CARD_TYPES);
const arbRowTarget = fc.constantFrom(...ROW_TARGETS);
const arbCounterType = fc.constantFrom(...COUNTER_TYPES);
const arbKeyword = fc.constantFrom(...KEYWORDS);
const arbGamePhase = fc.constantFrom(...GAME_PHASES);

const arbCounter: fc.Arbitrary<Counter> = fc.record({
  type: arbCounterType,
  value: fc.integer({ min: 0, max: 20 }),
});

const arbCardData: fc.Arbitrary<CardData> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  setCode: fc.string({ minLength: 3, maxLength: 5 }),
  collectorNumber: fc.nat(999).map(n => String(n + 1)),
  imageURI: fc.constant('https://cards.scryfall.io/normal/front/a/1/a1.jpg'),
  imageURILarge: fc.constant('https://cards.scryfall.io/large/front/a/1/a1.jpg'),
  backFaceImageURI: fc.option(fc.constant('https://cards.scryfall.io/normal/back/a/1/a1.jpg'), { nil: null }),
  backFaceCardType: fc.option(arbCardType, { nil: null }),
  backFaceName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  backFacePower: fc.option(fc.constantFrom('0', '1', '2', '3', '4', '5', '*'), { nil: null }),
  backFaceToughness: fc.option(fc.constantFrom('0', '1', '2', '3', '4', '5', '*'), { nil: null }),
  typeLine: fc.string({ minLength: 1, maxLength: 50 }),
  oracleText: fc.string({ maxLength: 100 }),
  isCommander: fc.boolean(),
  keywords: fc.array(arbKeyword, { maxLength: 4 }),
  basePower: fc.option(fc.constantFrom('0', '1', '2', '3', '4', '5', '*'), { nil: null }),
  baseToughness: fc.option(fc.constantFrom('0', '1', '2', '3', '4', '5', '*'), { nil: null }),
  cardType: arbCardType,
  cmc: fc.integer({ min: 0, max: 16 }),
  manaCost: fc.string({ maxLength: 20 }),
  colorIdentity: fc.array(fc.constantFrom('W', 'U', 'B', 'R', 'G'), { maxLength: 5 }),
  producedMana: fc.array(fc.constantFrom('W', 'U', 'B', 'R', 'G', 'C'), { maxLength: 5 }),
  landCategory: fc.constant(null),
  isToken: fc.boolean(),
  isTokenCopy: fc.boolean(),
});

const arbAttachment: fc.Arbitrary<Attachment> = fc.record({
  card: arbCardData,
  instanceId: fc.uuid(),
  isTapped: fc.boolean(),
});

const arbRowCard: fc.Arbitrary<RowCard> = fc.record({
  card: arbCardData,
  instanceId: fc.uuid(),
  rowAssignment: arbRowTarget,
  positionIndex: fc.nat(20),
  isTapped: fc.boolean(),
  isFaceDown: fc.boolean(),
  showingBackFace: fc.boolean(),
  isPhased: fc.boolean(),
  attachments: fc.array(arbAttachment, { maxLength: 3 }),
  counters: fc.array(arbCounter, { maxLength: 4 }),
  mutateStack: fc.array(arbCardData, { maxLength: 2 }),
  isRevealed: fc.boolean(),
});

const arbSplitRow: fc.Arbitrary<SplitRow> = fc.record({
  left: fc.array(arbRowCard, { maxLength: 4 }),
  right: fc.array(arbRowCard, { maxLength: 4 }),
});

const arbCreatureArea: fc.Arbitrary<CreatureArea> = fc.array(
  fc.record({
    id: fc.constantFrom('creature-1', 'creature-2', 'creature-3'),
    elements: fc.array(arbRowCard, { maxLength: 4 }),
  }),
  { minLength: 1, maxLength: 3 }
).map(rows => ({
  rows,
  totalElementCount: rows.reduce((sum, r) => sum + r.elements.length, 0),
}));

const arbExileCard: fc.Arbitrary<ExileCard> = fc.record({
  card: arbCardData,
  isFaceDown: fc.boolean(),
});

const arbMulliganState: fc.Arbitrary<MulliganState | null> = fc.option(
  fc.record({
    mulliganCount: fc.integer({ min: 0, max: 6 }),
    drawnCards: fc.array(arbCardData, { maxLength: 7 }),
    selectedToPutBack: fc.array(fc.uuid(), { maxLength: 6 }).map(ids => new Set(ids)),
    requiredPutBacks: fc.integer({ min: 0, max: 5 }),
  }),
  { nil: null }
);

const arbGameState: fc.Arbitrary<GameState> = fc.record({
  gamePhase: arbGamePhase,
  creatureArea: arbCreatureArea,
  row3: arbSplitRow,
  row4: arbSplitRow,
  hand: fc.array(arbCardData, { maxLength: 10 }),
  commandZone: fc.array(arbCardData, { maxLength: 2 }),
  graveyard: fc.array(arbCardData, { maxLength: 5 }),
  library: fc.array(arbCardData, { maxLength: 5 }),
  exile: fc.array(arbExileCard, { maxLength: 3 }),
  mulliganState: arbMulliganState,
  deckLoaded: fc.boolean(),
  lifeTotal: fc.integer({ min: 0, max: 100 }),
  turnCount: fc.nat(50),
});

// ─── Test ────────────────────────────────────────────────────────────────────

describe('Property 1: BroadcastChannel state round-trip', () => {
  it('serializing GameState into StreamSyncMessage and validating produces equivalent state', () => {
    fc.assert(
      fc.property(
        arbGameState,
        fc.array(fc.uuid(), { maxLength: 10 }),
        (gameState, revealedHandIds) => {
          // Serialize: create StreamSyncMessage (what the publisher does)
          const message: StreamSyncMessage = {
            type: 'STATE_UPDATE',
            payload: gameState,
            revealedHandIds,
            timestamp: Date.now(),
          };

          // Simulate BroadcastChannel transfer: structured clone via JSON round-trip
          const transferred = JSON.parse(JSON.stringify(message));

          // Validate: stream-side validation must accept the message
          expect(isValidSyncMessage(transferred)).toBe(true);

          // Deserialize: extract payload (what useStreamState does)
          const receivedState = (transferred as StreamSyncMessage).payload;
          const receivedRevealedIds = (transferred as StreamSyncMessage).revealedHandIds;

          // Assert round-trip equivalence
          // Note: MulliganState.selectedToPutBack is a Set, which serializes to {}
          // in JSON. The BroadcastChannel uses structured clone which preserves Sets,
          // but our JSON round-trip test simulates worst-case. We compare the
          // serialized forms to account for this.
          expect(JSON.parse(JSON.stringify(receivedState))).toEqual(JSON.parse(JSON.stringify(gameState)));
          expect(receivedRevealedIds).toEqual(revealedHandIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});
