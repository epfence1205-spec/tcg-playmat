import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBroadcastPublisher } from './useBroadcastPublisher';
import type { GameState } from '../types';

// Minimal valid GameState for testing
function createMinimalState(): GameState {
  return {
    gamePhase: 'PLAYING',
    library: [],
    hand: [],
    graveyard: [],
    exile: [],
    commandZone: [],
    creatureRow1: [],
    creatureRow2: [],
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    lifeTotal: 40,
    counters: { poison: 0, energy: 0, experience: 0, rad: 0 },
    mulliganCount: 0,
    putBackSelections: [],
  } as unknown as GameState;
}

describe('useBroadcastPublisher', () => {
  let mockPostMessage: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    mockClose = vi.fn();

    class MockBroadcastChannel {
      name: string;
      postMessage = mockPostMessage;
      close = mockClose;
      constructor(name: string) {
        this.name = name;
      }
    }

    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens BroadcastChannel and posts message on mount', () => {
    const state = createMinimalState();
    renderHook(() => useBroadcastPublisher(state, []));

    // Channel was opened and postMessage was called (proving construction succeeded)
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it('posts STATE_UPDATE message on mount', () => {
    const state = createMinimalState();
    renderHook(() => useBroadcastPublisher(state, ['card-1']));

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATE_UPDATE',
        payload: state,
        revealedHandIds: ['card-1'],
        timestamp: expect.any(Number),
      })
    );
  });

  it('posts new message when state changes', () => {
    const state1 = createMinimalState();
    const state2 = { ...createMinimalState(), lifeTotal: 35 };

    const { rerender } = renderHook(
      ({ state, revealed }) => useBroadcastPublisher(state, revealed),
      { initialProps: { state: state1, revealed: [] as string[] } }
    );

    mockPostMessage.mockClear();
    rerender({ state: state2, revealed: [] });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATE_UPDATE',
        payload: state2,
      })
    );
  });

  it('posts new message when revealedHandIds changes', () => {
    const state = createMinimalState();

    const { rerender } = renderHook(
      ({ state, revealed }) => useBroadcastPublisher(state, revealed),
      { initialProps: { state, revealed: [] as string[] } }
    );

    mockPostMessage.mockClear();
    rerender({ state, revealed: ['card-2'] });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATE_UPDATE',
        revealedHandIds: ['card-2'],
      })
    );
  });

  it('closes channel on unmount', () => {
    const state = createMinimalState();
    const { unmount } = renderHook(() => useBroadcastPublisher(state, []));

    unmount();

    expect(mockClose).toHaveBeenCalled();
  });
});
