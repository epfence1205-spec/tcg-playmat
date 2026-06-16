import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveGameState,
  loadGameState,
  loadPersistedState,
  createEmptyGameState,
  STORAGE_KEY,
  persistState,
} from '../persistence';
import type { GameState, CardData, RowCard } from '../types';

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function makeCard(id: string, name: string): CardData {
    return {
      id,
      name,
      setCode: 'lea',
      collectorNumber: '1',
      imageURI: 'https://cards.scryfall.io/normal/front/a/b/ab.jpg',
      imageURILarge: 'https://cards.scryfall.io/large/front/a/b/ab.jpg',
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
      landCategory: null,
    };
  }

  function makeRowCard(id: string, name: string): RowCard {
    return {
      card: makeCard(id, name),
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
      mutateStack: [],
      powerModifier: 0,
      toughnessModifier: 0,
    };
  }

  function makeSampleState(): GameState {
    return {
      gamePhase: 'PLAYING',
      creatureArea: {
        rows: [{ id: 'creature-1', elements: [makeRowCard('card-1', 'Grizzly Bears')] }],
        totalElementCount: 1,
      },
      row3: { left: [], right: [] },
      row4: { left: [], right: [] },
      hand: [makeCard('card-2', 'Lightning Bolt')],
      commandZone: [],
      graveyard: [],
      library: [],
      exile: [],
      mulliganState: null,
      deckLoaded: true,
      lifeTotal: 40,
      turnCount: 0,
    };
  }

  function makeMulliganState(): GameState {
    return {
      gamePhase: 'MULLIGAN',
      creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
      row3: { left: [], right: [] },
      row4: { left: [], right: [] },
      hand: [],
      commandZone: [],
      graveyard: [],
      library: [makeCard('lib-1', 'Forest'), makeCard('lib-2', 'Island')],
      exile: [],
      mulliganState: {
        mulliganCount: 2,
        drawnCards: [makeCard('drawn-1', 'Sol Ring'), makeCard('drawn-2', 'Mana Crypt')],
        selectedToPutBack: new Set(['drawn-1']),
        requiredPutBacks: 1,
      },
      deckLoaded: true,
      lifeTotal: 40,
    };
  }

  describe('saveGameState + loadGameState round-trip', () => {
    it('saves state and loads it back with equality', () => {
      const state = makeSampleState();

      saveGameState(state);
      vi.advanceTimersByTime(100);

      const loaded = loadGameState();
      expect(loaded).toEqual(state);
    });

    it('correctly serializes and deserializes Set<string> in mulliganState', () => {
      const state = makeMulliganState();

      saveGameState(state);
      vi.advanceTimersByTime(100);

      const loaded = loadGameState();
      expect(loaded.mulliganState).not.toBeNull();
      expect(loaded.mulliganState!.selectedToPutBack).toBeInstanceOf(Set);
      expect(loaded.mulliganState!.selectedToPutBack.has('drawn-1')).toBe(true);
      expect(loaded.mulliganState!.selectedToPutBack.size).toBe(1);
    });

    it('handles null mulliganState correctly', () => {
      const state = makeSampleState();
      expect(state.mulliganState).toBeNull();

      saveGameState(state);
      vi.advanceTimersByTime(100);

      const loaded = loadGameState();
      expect(loaded.mulliganState).toBeNull();
    });
  });

  describe('loadGameState returns empty state when no data', () => {
    it('returns empty state when localStorage has no entry', () => {
      const result = loadGameState();
      expect(result).toEqual(createEmptyGameState());
    });
  });

  describe('loadGameState returns empty state for corrupted/invalid JSON', () => {
    it('returns empty state for malformed JSON string', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json!!!');
      const result = loadGameState();
      expect(result).toEqual(createEmptyGameState());
    });

    it('returns empty state for empty string', () => {
      localStorage.setItem(STORAGE_KEY, '');
      const result = loadGameState();
      expect(result).toEqual(createEmptyGameState());
    });
  });

  describe('loadGameState returns empty state for valid JSON but wrong shape', () => {
    it('returns empty state when required fields are missing', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hand: [], deckLoaded: true }));
      const result = loadGameState();
      expect(result).toEqual(createEmptyGameState());
    });

    it('returns empty state when gamePhase is invalid', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...createEmptyGameState(),
          mulliganState: null,
          gamePhase: 'INVALID',
        })
      );
      const result = loadGameState();
      expect(result).toEqual(createEmptyGameState());
    });

    it('returns empty state when creatureArea is missing rows', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          gamePhase: 'PLAYING',
          creatureArea: { totalElementCount: 0 },
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
        })
      );
      const result = loadGameState();
      expect(result).toEqual(createEmptyGameState());
    });

    it('returns empty state when SplitRow is malformed', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          gamePhase: 'PLAYING',
          creatureArea: { rows: [], totalElementCount: 0 },
          row3: { left: 'not-array', right: [] },
          row4: { left: [], right: [] },
          hand: [],
          commandZone: [],
          graveyard: [],
          library: [],
          exile: [],
          mulliganState: null,
          deckLoaded: false,
          lifeTotal: 40,
        })
      );
      const result = loadGameState();
      expect(result).toEqual(createEmptyGameState());
    });

    it('returns empty state when lifeTotal is not a number', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          gamePhase: 'PLAYING',
          creatureArea: { rows: [], totalElementCount: 0 },
          row3: { left: [], right: [] },
          row4: { left: [], right: [] },
          hand: [],
          commandZone: [],
          graveyard: [],
          library: [],
          exile: [],
          mulliganState: null,
          deckLoaded: false,
          lifeTotal: 'forty',
        })
      );
      const result = loadGameState();
      expect(result).toEqual(createEmptyGameState());
    });
  });

  describe('createEmptyGameState', () => {
    it('returns correct default state with all empty zones', () => {
      const state = createEmptyGameState();
      expect(state).toEqual({
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
    });

    it('has lifeTotal of 40 for Commander format', () => {
      const state = createEmptyGameState();
      expect(state.lifeTotal).toBe(40);
    });
  });

  describe('saveGameState handles QuotaExceededError gracefully', () => {
    it('does not throw when localStorage.setItem throws QuotaExceededError', () => {
      const quotaError = new DOMException('Storage quota exceeded', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      const state = makeSampleState();

      expect(() => {
        saveGameState(state);
        vi.advanceTimersByTime(100);
      }).not.toThrow();
    });

    it('logs a warning when QuotaExceededError occurs', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const quotaError = new DOMException('Storage quota exceeded', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      const state = makeSampleState();
      saveGameState(state);
      vi.advanceTimersByTime(100);

      expect(warnSpy).toHaveBeenCalledWith(
        'localStorage quota exceeded — state not persisted'
      );
    });
  });

  describe('debounce behavior', () => {
    it('only writes once when called rapidly', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const state = makeSampleState();

      saveGameState(state);
      saveGameState(state);
      saveGameState(state);

      vi.advanceTimersByTime(100);

      expect(setItemSpy).toHaveBeenCalledTimes(1);
    });

    it('does not write before debounce period elapses', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const state = makeSampleState();

      saveGameState(state);
      vi.advanceTimersByTime(50);

      expect(setItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('legacy API compatibility', () => {
    it('persistState is an alias for saveGameState', () => {
      expect(persistState).toBe(saveGameState);
    });

    it('loadPersistedState returns null when no data exists', () => {
      const result = loadPersistedState();
      expect(result).toBeNull();
    });

    it('loadPersistedState returns null for corrupted data', () => {
      localStorage.setItem(STORAGE_KEY, '{broken');
      const result = loadPersistedState();
      expect(result).toBeNull();
    });

    it('loadPersistedState returns valid state when data exists', () => {
      const state = makeSampleState();
      saveGameState(state);
      vi.advanceTimersByTime(100);

      const result = loadPersistedState();
      expect(result).toEqual(state);
    });
  });
});
