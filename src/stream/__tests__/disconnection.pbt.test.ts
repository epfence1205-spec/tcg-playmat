import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { GameState } from '../../types';
import type { StreamSyncMessage } from '../constants';
import { useStreamState } from '../useStreamState';

/**
 * Feature: obs-stream-view, Property 8: Disconnection state retention
 *
 * For any last-received GameState, if no further messages arrive
 * (channel closed, localStorage cleared), the stream view SHALL
 * continue to hold and render that state object unchanged.
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */

// --- Arbitrary GameState generator ---

const arbCardData = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  setCode: fc.constantFrom('abc', 'def', 'ghi', 'jkl', 'mno'),
  collectorNumber: fc.constantFrom('1', '23', '100', '456'),
  imageURI: fc.constant('https://cards.scryfall.io/normal/front/a/1/test.jpg'),
  imageURILarge: fc.constant('https://cards.scryfall.io/large/front/a/1/test.jpg'),
  backFaceImageURI: fc.constant(null),
  backFaceCardType: fc.constant(null),
  backFaceName: fc.constant(null),
  backFacePower: fc.constant(null),
  backFaceToughness: fc.constant(null),
  typeLine: fc.string({ minLength: 1, maxLength: 40 }),
  oracleText: fc.string({ maxLength: 100 }),
  isCommander: fc.boolean(),
  keywords: fc.constant([] as string[]),
  basePower: fc.oneof(fc.constant(null), fc.constantFrom('1', '2', '3', '4', '5')),
  baseToughness: fc.oneof(fc.constant(null), fc.constantFrom('1', '2', '3', '4', '5')),
  cardType: fc.constantFrom('creature', 'land', 'artifact', 'enchantment', 'planeswalker', 'instant', 'sorcery'),
  cmc: fc.nat({ max: 15 }),
  manaCost: fc.string({ maxLength: 20 }),
  colorIdentity: fc.array(fc.constantFrom('W', 'U', 'B', 'R', 'G'), { maxLength: 5 }),
  producedMana: fc.array(fc.constantFrom('W', 'U', 'B', 'R', 'G', 'C'), { maxLength: 3 }),
  landCategory: fc.constant(null),
  isToken: fc.boolean(),
  isTokenCopy: fc.boolean(),
});

const arbRowCard = fc.record({
  card: arbCardData,
  instanceId: fc.uuid(),
  rowAssignment: fc.constantFrom('creature-1', 'creature-2', 'creature-3', 'row3-lands', 'row3-artifacts', 'row4-lands', 'row4-enchantments'),
  positionIndex: fc.nat({ max: 20 }),
  isTapped: fc.boolean(),
  isFaceDown: fc.boolean(),
  showingBackFace: fc.boolean(),
  isPhased: fc.boolean(),
  attachments: fc.constant([]),
  counters: fc.constant([]),
  mutateStack: fc.constant([]),
  isRevealed: fc.boolean(),
});

const arbGameState: fc.Arbitrary<GameState> = fc.record({
  gamePhase: fc.constantFrom('MULLIGAN' as const, 'PLAYING' as const),
  creatureArea: fc.record({
    rows: fc.array(
      fc.record({
        id: fc.constantFrom('creature-1', 'creature-2', 'creature-3'),
        elements: fc.array(arbRowCard, { maxLength: 4 }),
      }),
      { minLength: 1, maxLength: 3 }
    ),
    totalElementCount: fc.nat({ max: 30 }),
  }),
  row3: fc.record({ left: fc.array(arbRowCard, { maxLength: 3 }), right: fc.array(arbRowCard, { maxLength: 3 }) }),
  row4: fc.record({ left: fc.array(arbRowCard, { maxLength: 3 }), right: fc.array(arbRowCard, { maxLength: 3 }) }),
  hand: fc.array(arbCardData, { maxLength: 7 }),
  commandZone: fc.array(arbCardData, { maxLength: 2 }),
  graveyard: fc.array(arbCardData, { maxLength: 5 }),
  library: fc.array(arbCardData, { maxLength: 5 }),
  exile: fc.array(fc.record({ card: arbCardData, isFaceDown: fc.boolean() }), { maxLength: 3 }),
  mulliganState: fc.constant(null),
  deckLoaded: fc.boolean(),
  lifeTotal: fc.integer({ min: 0, max: 100 }),
  turnCount: fc.nat({ max: 50 }),
}) as fc.Arbitrary<GameState>;

// --- Mock BroadcastChannel ---

let channelInstances: MockBroadcastChannel[] = [];

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
    channelInstances.push(this);
  }

  postMessage(_msg: unknown) {}

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }
}

// --- Tests ---

describe('Feature: obs-stream-view, Property 8: Disconnection state retention', () => {
  beforeEach(() => {
    channelInstances = [];
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('retains last received state after channel closes and localStorage is cleared', () => {
    fc.assert(
      fc.property(
        arbGameState,
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        (gameState, revealedIds) => {
          const { result, unmount } = renderHook(() => useStreamState());

          // Advance past fallback timer
          act(() => { vi.advanceTimersByTime(600); });

          // Send a valid STATE_UPDATE message
          const msg: StreamSyncMessage = {
            type: 'STATE_UPDATE',
            payload: gameState,
            revealedHandIds: revealedIds,
            timestamp: Date.now(),
          };

          act(() => {
            const channel = channelInstances[channelInstances.length - 1];
            channel.simulateMessage(msg);
          });

          // Verify state was received
          expect(result.current.state).toEqual(gameState);
          expect(result.current.revealedHandIds).toEqual(revealedIds);

          // Simulate disconnection: close channel
          act(() => {
            const channel = channelInstances[channelInstances.length - 1];
            channel.close();
          });

          // Clear localStorage
          act(() => {
            localStorage.clear();
          });

          // Advance time - no new messages arrive
          act(() => { vi.advanceTimersByTime(5000); });

          // Property: state MUST still be the last received state
          expect(result.current.state).toEqual(gameState);
          expect(result.current.revealedHandIds).toEqual(revealedIds);

          // Clean up this iteration
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
