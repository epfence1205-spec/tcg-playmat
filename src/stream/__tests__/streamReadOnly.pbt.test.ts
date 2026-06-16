import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act, cleanup } from '@testing-library/react';
import { STORAGE_KEY } from '../../persistence';
import { CHANNEL_NAME } from '../constants';
import { useStreamState } from '../useStreamState';

/**
 * Feature: obs-stream-view, Property 7: Stream view never writes state
 *
 * For any sequence of operations performed by the stream view
 * (mount, receive messages, unmount), it SHALL never invoke
 * localStorage.setItem with the game state key or call postMessage
 * on the sync BroadcastChannel.
 *
 * **Validates: Requirements 2.4**
 */

// --- Mock Infrastructure ---

interface MockChannelInstance {
  name: string;
  postMessage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  triggerMessage: (data: unknown) => void;
}

const channelInstances: MockChannelInstance[] = [];

class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;

  constructor(name: string) {
    this.name = name;
    this.postMessage = vi.fn();
    this.close = vi.fn();
    const self = this;
    channelInstances.push({
      name,
      postMessage: this.postMessage,
      close: this.close,
      triggerMessage: (data: unknown) => {
        if (self.onmessage) {
          self.onmessage(new MessageEvent('message', { data }));
        }
      },
    });
  }
}

// --- Arbitraries ---

const validSyncMessageArb = fc.record({
  type: fc.constant('STATE_UPDATE' as const),
  payload: fc.record({
    gamePhase: fc.constantFrom('MULLIGAN' as const, 'PLAYING' as const),
    creatureArea: fc.constant({
      rows: [{ id: 'creature-1', elements: [] }],
      totalElementCount: 0,
    }),
    row3: fc.constant({ left: [], right: [] }),
    row4: fc.constant({ left: [], right: [] }),
    hand: fc.constant([]),
    commandZone: fc.constant([]),
    graveyard: fc.constant([]),
    library: fc.constant([]),
    exile: fc.constant([]),
    mulliganState: fc.constant(null),
    deckLoaded: fc.boolean(),
    lifeTotal: fc.nat({ max: 100 }),
    turnCount: fc.nat({ max: 50 }),
  }),
  revealedHandIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
  timestamp: fc.nat(),
});

const invalidMessageArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.nat(),
  fc.record({ type: fc.string(), payload: fc.anything() }),
  fc.record({ type: fc.constant('WRONG_TYPE'), payload: fc.constant({}) }),
  fc.array(fc.anything()),
);

const messageSequenceArb = fc.array(
  fc.oneof(
    validSyncMessageArb.map((msg) => msg as unknown),
    invalidMessageArb,
  ),
  { minLength: 0, maxLength: 20 },
);

// --- Test Setup ---

const SEED_STATE = JSON.stringify({
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
  deckLoaded: false,
  lifeTotal: 40,
  turnCount: 0,
});

describe('Feature: obs-stream-view, Property 7: Stream view never writes state', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    channelInstances.length = 0;
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;
    // Seed localStorage so loadGameState() finds valid data on init
    localStorage.setItem(STORAGE_KEY, SEED_STATE);
    // Spy on setItem AFTER seeding to track only hook-initiated writes
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    setItemSpy.mockRestore();
    localStorage.clear();
    cleanup();
    delete (globalThis as any).BroadcastChannel;
  });

  it('never calls localStorage.setItem with game state key for any message sequence', () => {
    fc.assert(
      fc.property(messageSequenceArb, (messages) => {
        // Clear from previous iteration
        setItemSpy.mockClear();
        channelInstances.length = 0;

        const { unmount } = renderHook(() => useStreamState());

        // Find the channel opened by the hook
        const streamChannel = channelInstances.find((c) => c.name === CHANNEL_NAME);

        // Deliver all messages in the sequence
        if (streamChannel) {
          for (const msg of messages) {
            act(() => {
              streamChannel.triggerMessage(msg);
            });
          }
        }

        // Unmount to trigger cleanup
        unmount();

        // ASSERT: localStorage.setItem was never called with game state key
        const stateWrites = setItemSpy.mock.calls.filter(
          (call) => call[0] === STORAGE_KEY,
        );
        expect(stateWrites).toHaveLength(0);

        // ASSERT: no postMessage called on any sync channel
        for (const ch of channelInstances) {
          if (ch.name === CHANNEL_NAME) {
            expect(ch.postMessage).not.toHaveBeenCalled();
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('never calls postMessage even with only valid messages', () => {
    fc.assert(
      fc.property(
        fc.array(validSyncMessageArb, { minLength: 1, maxLength: 15 }),
        (messages) => {
          setItemSpy.mockClear();
          channelInstances.length = 0;

          const { unmount } = renderHook(() => useStreamState());

          const streamChannel = channelInstances.find((c) => c.name === CHANNEL_NAME);

          if (streamChannel) {
            for (const msg of messages) {
              act(() => {
                streamChannel.triggerMessage(msg);
              });
            }
          }

          unmount();

          // ASSERT: no writes to game state key
          const stateWrites = setItemSpy.mock.calls.filter(
            (call) => call[0] === STORAGE_KEY,
          );
          expect(stateWrites).toHaveLength(0);

          // ASSERT: no postMessage on sync channel
          for (const ch of channelInstances) {
            if (ch.name === CHANNEL_NAME) {
              expect(ch.postMessage).not.toHaveBeenCalled();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
