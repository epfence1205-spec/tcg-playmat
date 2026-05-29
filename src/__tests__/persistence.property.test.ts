import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  saveGameState,
  loadGameState,
  createEmptyGameState,
  STORAGE_KEY,
} from '../persistence';
import type {
  GameState,
  CardData,
  RowCard,
  CreatureArea,
  SplitRow,
  MulliganState,
  CardType,
  KeywordAbility,
  CounterType,
  Counter,
  Attachment,
  ExileCard,
  RowTarget,
} from '../types';

/**
 * Property 4: State Persistence Round-Trip
 * deserialize(serialize(s)) ≡ s
 * For any valid GameState, saving to localStorage and loading back produces an equivalent state.
 * This must handle Set<string> → Array → Set conversion correctly.
 *
 * Property 32: Corrupted State Recovery
 * For any invalid/corrupted JSON string stored in localStorage, loadGameState() returns
 * createEmptyGameState() without throwing.
 *
 * **Validates: Requirements 23.1, 23.2, 23.4**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const cardTypeArb: fc.Arbitrary<CardType> = fc.constantFrom(
  'creature', 'land', 'artifact', 'enchantment',
  'planeswalker', 'instant', 'sorcery', 'battle', 'other'
);

const keywordAbilityArb: fc.Arbitrary<KeywordAbility> = fc.constantFrom(
  'flying', 'trample', 'haste', 'vigilance', 'lifelink',
  'deathtouch', 'hexproof', 'indestructible', 'menace',
  'reach', 'first_strike', 'double_strike', 'flash',
  'defender', 'ward', 'shroud', 'protection'
);

const counterTypeArb: fc.Arbitrary<CounterType> = fc.constantFrom(
  '+1/+1', '-1/-1', 'lifelink', 'hexproof', 'indestructible', 'shroud',
  'time', 'charge', 'generic', 'loyalty', 'flying', 'deathtouch',
  'menace', 'trample', 'first_strike', 'double_strike', 'reach',
  'vigilance', 'token', 'lore', 'shield', 'haste', 'custom'
);

const rowTargetArb: fc.Arbitrary<RowTarget> = fc.constantFrom(
  'creature-1', 'creature-2', 'creature-3',
  'row4-lands', 'row4-artifacts',
  'row5-lands', 'row5-enchantments',
  'pw-battle-column'
);

/** Generates a valid CardData */
const cardDataArb: fc.Arbitrary<CardData> = fc
  .record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    setCode: fc.stringMatching(/^[a-z0-9]{3,5}$/),
    collectorNumber: fc.stringMatching(/^[0-9]{1,4}$/),
    imageURI: fc.constant('https://cards.scryfall.io/normal/front/a/b/ab.jpg'),
    imageURILarge: fc.constant('https://cards.scryfall.io/large/front/a/b/ab.jpg'),
    backFaceImageURI: fc.option(
      fc.constant('https://cards.scryfall.io/normal/back/a/b/ab.jpg'),
      { nil: null }
    ),
    typeLine: fc.string({ minLength: 1, maxLength: 40 }),
    oracleText: fc.string({ minLength: 0, maxLength: 100 }),
    isCommander: fc.boolean(),
    keywords: fc.array(keywordAbilityArb, { minLength: 0, maxLength: 4 }),
    basePower: fc.option(fc.stringMatching(/^[0-9*]{1,2}$/), { nil: null }),
    baseToughness: fc.option(fc.stringMatching(/^[0-9*]{1,2}$/), { nil: null }),
    cardType: cardTypeArb,
    isToken: fc.boolean(),
    isTokenCopy: fc.boolean(),
  });

/** Generates a Counter */
const counterArb: fc.Arbitrary<Counter> = fc.record({
  type: counterTypeArb,
  value: fc.integer({ min: 0, max: 20 }),
});

/** Generates an Attachment */
const attachmentArb: fc.Arbitrary<Attachment> = fc.record({
  card: cardDataArb,
  instanceId: fc.uuid(),
  isTapped: fc.boolean(),
});

/** Generates a RowCard */
const rowCardArb: fc.Arbitrary<RowCard> = fc.record({
  card: cardDataArb,
  instanceId: fc.uuid(),
  rowAssignment: rowTargetArb,
  positionIndex: fc.nat({ max: 50 }),
  isTapped: fc.boolean(),
  isFaceDown: fc.boolean(),
  showingBackFace: fc.boolean(),
  isPhased: fc.boolean(),
  attachments: fc.array(attachmentArb, { minLength: 0, maxLength: 3 }),
  counters: fc.array(counterArb, { minLength: 0, maxLength: 5 }),
  isRevealed: fc.boolean(),
});

/** Generates a CreatureArea with 1-3 rows */
const creatureAreaArb: fc.Arbitrary<CreatureArea> = fc
  .integer({ min: 1, max: 3 })
  .chain((rowCount) =>
    fc.tuple(
      ...Array.from({ length: rowCount }, (_, i) =>
        fc.array(rowCardArb, { minLength: 0, maxLength: 4 }).map((elements) => ({
          id: `creature-${i + 1}`,
          elements,
        }))
      )
    ).map((rows) => ({
      rows,
      totalElementCount: rows.reduce((sum, r) => sum + r.elements.length, 0),
    }))
  );

/** Generates a SplitRow */
const splitRowArb: fc.Arbitrary<SplitRow> = fc.record({
  left: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
  right: fc.array(rowCardArb, { minLength: 0, maxLength: 3 }),
});

/** Generates an ExileCard */
const exileCardArb: fc.Arbitrary<ExileCard> = fc.record({
  card: cardDataArb,
  isFaceDown: fc.boolean(),
});

/** Generates a MulliganState with a Set<string> for selectedToPutBack */
const mulliganStateArb: fc.Arbitrary<MulliganState> = fc
  .record({
    mulliganCount: fc.integer({ min: 0, max: 5 }),
    drawnCards: fc.array(cardDataArb, { minLength: 0, maxLength: 7 }),
    selectedIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
    requiredPutBacks: fc.integer({ min: 0, max: 4 }),
  })
  .map(({ mulliganCount, drawnCards, selectedIds, requiredPutBacks }) => ({
    mulliganCount,
    drawnCards,
    selectedToPutBack: new Set(selectedIds),
    requiredPutBacks,
  }));

/** Generates a complete valid GameState */
const gameStateArb: fc.Arbitrary<GameState> = fc.record({
  gamePhase: fc.constantFrom('MULLIGAN' as const, 'PLAYING' as const),
  creatureArea: creatureAreaArb,
  row4: splitRowArb,
  row5: splitRowArb,
  hand: fc.array(cardDataArb, { minLength: 0, maxLength: 7 }),
  commandZone: fc.array(cardDataArb, { minLength: 0, maxLength: 2 }),
  graveyard: fc.array(cardDataArb, { minLength: 0, maxLength: 5 }),
  library: fc.array(cardDataArb, { minLength: 0, maxLength: 10 }),
  exile: fc.array(exileCardArb, { minLength: 0, maxLength: 3 }),
  mulliganState: fc.option(mulliganStateArb, { nil: null }),
  deckLoaded: fc.boolean(),
  lifeTotal: fc.integer({ min: 0, max: 100 }),
});

// ─── Helper: Deep equality that handles Set<string> ──────────────────────────

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function gameStatesEqual(original: GameState, loaded: GameState): boolean {
  // Check mulliganState.selectedToPutBack (Set) separately
  if (original.mulliganState !== null && loaded.mulliganState !== null) {
    if (!setsEqual(original.mulliganState.selectedToPutBack, loaded.mulliganState.selectedToPutBack)) {
      return false;
    }
    // Compare the rest of mulliganState without selectedToPutBack
    const { selectedToPutBack: _origSet, ...origRest } = original.mulliganState;
    const { selectedToPutBack: _loadSet, ...loadRest } = loaded.mulliganState;
    if (JSON.stringify(origRest) !== JSON.stringify(loadRest)) {
      return false;
    }
    // Compare the rest of GameState without mulliganState
    const { mulliganState: _origMs, ...origState } = original;
    const { mulliganState: _loadMs, ...loadState } = loaded;
    return JSON.stringify(origState) === JSON.stringify(loadState);
  }

  // Both null or one null — use JSON comparison for the whole thing
  // (if both null, Sets aren't involved)
  if (original.mulliganState === null && loaded.mulliganState === null) {
    return JSON.stringify(original) === JSON.stringify(loaded);
  }

  // One is null and the other isn't
  return false;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 4: State Persistence Round-Trip', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deserialize(serialize(s)) ≡ s for any valid GameState', () => {
    fc.assert(
      fc.property(gameStateArb, (state: GameState) => {
        localStorage.clear();

        saveGameState(state);
        vi.advanceTimersByTime(100);

        const loaded = loadGameState();

        // Verify structural equality including Set<string> handling
        expect(gameStatesEqual(state, loaded)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('mulliganState.selectedToPutBack is restored as a Set<string>', () => {
    fc.assert(
      fc.property(mulliganStateArb, (ms: MulliganState) => {
        localStorage.clear();

        const state: GameState = {
          ...createEmptyGameState(),
          gamePhase: 'MULLIGAN',
          mulliganState: ms,
        };

        saveGameState(state);
        vi.advanceTimersByTime(100);

        const loaded = loadGameState();

        expect(loaded.mulliganState).not.toBeNull();
        expect(loaded.mulliganState!.selectedToPutBack).toBeInstanceOf(Set);
        expect(loaded.mulliganState!.selectedToPutBack.size).toBe(ms.selectedToPutBack.size);

        for (const id of ms.selectedToPutBack) {
          expect(loaded.mulliganState!.selectedToPutBack.has(id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('null mulliganState round-trips correctly', () => {
    fc.assert(
      fc.property(
        gameStateArb.filter((s) => s.mulliganState === null),
        (state: GameState) => {
          localStorage.clear();

          saveGameState(state);
          vi.advanceTimersByTime(100);

          const loaded = loadGameState();
          expect(loaded.mulliganState).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('cards in all zones survive round-trip with full fidelity', () => {
    fc.assert(
      fc.property(gameStateArb, (state: GameState) => {
        localStorage.clear();

        saveGameState(state);
        vi.advanceTimersByTime(100);

        const loaded = loadGameState();

        // Verify zone lengths match
        expect(loaded.hand.length).toBe(state.hand.length);
        expect(loaded.commandZone.length).toBe(state.commandZone.length);
        expect(loaded.graveyard.length).toBe(state.graveyard.length);
        expect(loaded.library.length).toBe(state.library.length);
        expect(loaded.exile.length).toBe(state.exile.length);
        expect(loaded.creatureArea.rows.length).toBe(state.creatureArea.rows.length);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 32: Corrupted State Recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('any invalid/corrupted JSON string returns createEmptyGameState() without throwing', () => {
    const emptyState = createEmptyGameState();

    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 500 }), (corruptedData: string) => {
        localStorage.clear();
        localStorage.setItem(STORAGE_KEY, corruptedData);

        let result: GameState;
        expect(() => {
          result = loadGameState();
        }).not.toThrow();

        result = loadGameState();

        // If the corrupted data happens to be valid JSON matching our schema,
        // it may load successfully. Otherwise it must return empty state.
        // We verify it never throws and always returns a valid GameState shape.
        expect(result.gamePhase).toBeDefined();
        expect(result.creatureArea).toBeDefined();
        expect(result.row4).toBeDefined();
        expect(result.row5).toBeDefined();
        expect(Array.isArray(result.hand)).toBe(true);
        expect(Array.isArray(result.library)).toBe(true);
        expect(typeof result.deckLoaded).toBe('boolean');
        expect(typeof result.lifeTotal).toBe('number');
      }),
      { numRuns: 200 }
    );
  });

  it('malformed JSON always returns empty state', () => {
    const emptyState = createEmptyGameState();

    // Generate strings that are definitely NOT valid JSON
    const malformedJsonArb = fc.oneof(
      fc.constant('{not valid json'),
      fc.constant('undefined'),
      fc.constant('[[['),
      fc.constant('{{{'),
      fc.constant('null null'),
      fc.string({ minLength: 1, maxLength: 100 }).filter((s) => {
        try { JSON.parse(s); return false; } catch { return true; }
      })
    );

    fc.assert(
      fc.property(malformedJsonArb, (corruptedData: string) => {
        localStorage.clear();
        localStorage.setItem(STORAGE_KEY, corruptedData);

        const result = loadGameState();
        expect(result).toEqual(emptyState);
      }),
      { numRuns: 100 }
    );
  });

  it('valid JSON with wrong shape returns empty state', () => {
    const emptyState = createEmptyGameState();

    // Generate valid JSON objects that don't match GameState schema
    const wrongShapeArb = fc.oneof(
      fc.record({ foo: fc.string(), bar: fc.integer() }).map((o) => JSON.stringify(o)),
      fc.array(fc.integer()).map((a) => JSON.stringify(a)),
      fc.constant(JSON.stringify(null)),
      fc.constant(JSON.stringify(42)),
      fc.constant(JSON.stringify("hello")),
      fc.constant(JSON.stringify({ gamePhase: 'INVALID', hand: [] })),
      fc.constant(JSON.stringify({ gamePhase: 'PLAYING' })), // missing fields
      fc.constant(JSON.stringify({
        gamePhase: 'PLAYING',
        creatureArea: { rows: 'not-array', totalElementCount: 0 },
        row4: { left: [], right: [] },
        row5: { left: [], right: [] },
        hand: [], commandZone: [], graveyard: [], library: [], exile: [],
        mulliganState: null, deckLoaded: false, lifeTotal: 40,
      })),
    );

    fc.assert(
      fc.property(wrongShapeArb, (corruptedJson: string) => {
        localStorage.clear();
        localStorage.setItem(STORAGE_KEY, corruptedJson);

        const result = loadGameState();
        expect(result).toEqual(emptyState);
      }),
      { numRuns: 100 }
    );
  });

  it('empty string in localStorage returns empty state without crash', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(() => loadGameState()).not.toThrow();
    expect(loadGameState()).toEqual(createEmptyGameState());
  });
});
