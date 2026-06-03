import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from '../hooks/useGameState';
import type { GameState, CardData } from '../types';

function makeCard(id: string, name: string): CardData {
  return {
    id, name, setCode: 'tst', collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
    backFaceImageURI: null, backFaceCardType: null,
    typeLine: 'Creature - Test', oracleText: '',
    isCommander: false, keywords: [],
    basePower: '1', baseToughness: '1', cardType: 'creature',
    isToken: false, isTokenCopy: false,
  };
}

describe('Undo System', () => {
  beforeEach(() => { localStorage.clear(); });

  it('undo returns false when history is empty', () => {
    const { result } = renderHook(() => useGameState());
    let r: boolean | undefined;
    act(() => { r = result.current.undo(); });
    expect(r).toBe(false);
  });

  it('undo restores previous state after a mutation', () => {
    const { result } = renderHook(() => useGameState());
    // Setup: put a card in library (this records history but we drain it)
    act(() => {
      result.current.setState((prev: GameState) => ({
        ...prev, gamePhase: 'PLAYING' as const,
        library: [makeCard('t1', 'Test')], hand: [],
      }));
    });
    // Drain history from setup
    act(() => { result.current.undo(); });
    // Re-setup cleanly
    act(() => {
      result.current.setState((prev: GameState) => ({
        ...prev, library: [makeCard('t1', 'Test')], hand: [],
      }));
    });
    // Now draw
    act(() => {
      result.current.setState((prev: GameState) => {
        const [top, ...rest] = prev.library;
        return { ...prev, library: rest, hand: [...prev.hand, top] };
      });
    });
    expect(result.current.state.hand.length).toBe(1);
    act(() => { result.current.undo(); });
    expect(result.current.state.hand.length).toBe(0);
    expect(result.current.state.library.length).toBe(1);
  });

  it('multiple undos restore states in order', () => {
    const { result } = renderHook(() => useGameState());
    act(() => {
      result.current.setState((prev: GameState) => ({
        ...prev, gamePhase: 'PLAYING' as const,
        library: [makeCard('c1','C1'), makeCard('c2','C2'), makeCard('c3','C3')], hand: [],
      }));
    });
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.setState((prev: GameState) => {
          const [top, ...rest] = prev.library;
          return { ...prev, library: rest, hand: [...prev.hand, top] };
        });
      });
    }
    expect(result.current.state.hand.length).toBe(3);
    act(() => { result.current.undo(); });
    expect(result.current.state.hand.length).toBe(2);
    act(() => { result.current.undo(); });
    expect(result.current.state.hand.length).toBe(1);
    act(() => { result.current.undo(); });
    expect(result.current.state.hand.length).toBe(0);
  });

  it('does not record during MULLIGAN phase', () => {
    // Persist a MULLIGAN state so the hook loads into MULLIGAN directly
    localStorage.setItem('tcg-playmat-state', JSON.stringify({
      gamePhase: 'MULLIGAN',
      creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
      row3: { left: [], right: [] }, row4: { left: [], right: [] },
      hand: [], commandZone: [], graveyard: [],
      library: [{ id: 'lib1', name: 'Lib', setCode: 'tst', collectorNumber: '1', imageURI: 'https://t.com/1.jpg', imageURILarge: 'https://t.com/1.jpg', backFaceImageURI: null, backFaceCardType: null, typeLine: 'Creature', oracleText: '', isCommander: false, keywords: [], basePower: '1', baseToughness: '1', cardType: 'creature', isToken: false, isTokenCopy: false }],
      exile: [],
      mulliganState: { mulliganCount: 0, drawnCards: [], selectedToPutBack: [], requiredPutBacks: 0 },
      deckLoaded: true, lifeTotal: 40,
    }));
    const { result } = renderHook(() => useGameState());
    // Verify we're in MULLIGAN
    expect(result.current.state.gamePhase).toBe('MULLIGAN');
    // Mutate during mulligan
    act(() => {
      result.current.setState((prev: GameState) => ({ ...prev, hand: [makeCard('m1','M')] }));
    });
    // Undo should fail — nothing recorded
    let r: boolean | undefined;
    act(() => { r = result.current.undo(); });
    expect(r).toBe(false);
  });

  it('history is capped at 50 entries', () => {
    const { result } = renderHook(() => useGameState());
    // Setup into PLAYING with empty hand — this itself records 1 history entry
    act(() => {
      result.current.setState((prev: GameState) => ({ ...prev, gamePhase: 'PLAYING' as const, hand: [] }));
    });
    // Perform 55 more mutations (total 56 including setup, but cap is 50)
    for (let i = 0; i < 55; i++) {
      act(() => {
        result.current.setState((prev: GameState) => ({
          ...prev, hand: [...prev.hand, makeCard('c' + i, 'Card ' + i)],
        }));
      });
    }
    // Undo as many times as possible
    let count = 0;
    for (let i = 0; i < 60; i++) {
      let r: boolean | undefined;
      act(() => { r = result.current.undo(); });
      if (r) count++;
    }
    // Capped at 50
    expect(count).toBe(50);
  });
});
