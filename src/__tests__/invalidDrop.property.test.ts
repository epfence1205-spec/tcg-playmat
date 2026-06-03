import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { moveCard } from '../gameActions';
import type { CardData, GameState, Zone, CardType, KeywordAbility } from '../types';

/**
 * Property 16: Invalid Drop No-Op
 * Card dropped outside valid zone results in no state change.
 *
 * **Validates: Requirements 22.5, 29.2**
 *
 * Key invariants:
 * - Moving a card to the same zone (non-battlefield) throws without corrupting state
 * - Moving a non-existent card throws without corrupting state
 * - After any failed operation, the original state is preserved exactly
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

/** Generates a valid CardData instance */
const cardDataArb: fc.Arbitrary<CardData> = fc
  .tuple(
    fc.uuid(),
    fc.string({ minLength: 1, maxLength: 30 }),
    fc.stringMatching(/^[a-z]{3,5}$/),
    fc.stringMatching(/^[0-9]{1,3}$/),
    cardTypeArb,
    fc.boolean(),
    fc.array(keywordAbilityArb, { minLength: 0, maxLength: 3 }),
  )
  .map(([id, name, setCode, collectorNumber, cardType, isCommander, keywords]) => ({
    id,
    name,
    setCode,
    collectorNumber,
    imageURI: `https://cards.scryfall.io/normal/${id}.jpg`,
    imageURILarge: `https://cards.scryfall.io/large/${id}.jpg`,
    backFaceImageURI: null,
    typeLine: `${cardType.charAt(0).toUpperCase() + cardType.slice(1)} — Test`,
    oracleText: '',
    isCommander,
    keywords,
    basePower: cardType === 'creature' ? '2' : null,
    baseToughness: cardType === 'creature' ? '2' : null,
    cardType,
    isToken: false,
    isTokenCopy: false,
  }));

/** Generates a list of unique CardData (unique IDs) */
const cardListArb = (minLen: number, maxLen: number): fc.Arbitrary<CardData[]> =>
  fc.array(cardDataArb, { minLength: minLen, maxLength: maxLen })
    .map(cards => {
      // Ensure unique IDs
      const seen = new Set<string>();
      return cards.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    });

/** Generates a valid GameState with cards distributed across zones */
const gameStateArb: fc.Arbitrary<GameState> = fc
  .tuple(
    cardListArb(0, 5), // hand
    cardListArb(0, 3), // commandZone
    cardListArb(0, 4), // graveyard
    cardListArb(1, 8), // library (at least 1 card)
    cardListArb(0, 3), // exile
  )
  .map(([hand, commandZone, graveyard, library, exile]) => ({
    gamePhase: 'PLAYING' as const,
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand,
    commandZone,
    graveyard,
    library,
    exile: exile.map(c => ({ card: c, isFaceDown: false })),
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
  }));

/** Non-battlefield zones for same-zone move tests */
const nonBattlefieldZoneArb: fc.Arbitrary<Zone> = fc.constantFrom(
  'hand', 'commandZone', 'graveyard', 'library', 'exile'
);

// ─── Deep equality helper ────────────────────────────────────────────────────

function deepCloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 16: Invalid Drop No-Op', () => {
  it('moving a card to the same non-battlefield zone throws and preserves state', () => {
    fc.assert(
      fc.property(
        gameStateArb,
        nonBattlefieldZoneArb,
        (state, zone) => {
          const zoneCards = zone === 'exile'
            ? state.exile.map(ec => ec.card)
            : (state[zone] as CardData[]);

          // Skip if zone is empty (no card to move)
          if (zoneCards.length === 0) return;

          const cardId = zoneCards[0].id;
          const stateBefore = deepCloneState(state);

          // Attempting to move a card to the same zone should throw
          expect(() => {
            moveCard(state, cardId, zone, zone);
          }).toThrow();

          // Original state must be preserved (moveCard is pure — doesn't mutate input)
          expect(deepCloneState(state)).toEqual(stateBefore);
        }
      ),
      { numRuns: 150 }
    );
  });

  it('moving a non-existent card throws without corrupting state', () => {
    fc.assert(
      fc.property(
        gameStateArb,
        nonBattlefieldZoneArb,
        fc.constantFrom('hand', 'battlefield', 'graveyard', 'exile', 'library', 'commandZone') as fc.Arbitrary<Zone>,
        (state, fromZone, toZone) => {
          const stateBefore = deepCloneState(state);
          const fakeCardId = 'nonexistent-card-id-' + Math.random().toString(36);

          // Attempting to move a card that doesn't exist should throw
          expect(() => {
            moveCard(state, fakeCardId, fromZone, toZone);
          }).toThrow();

          // Original state must be preserved
          expect(deepCloneState(state)).toEqual(stateBefore);
        }
      ),
      { numRuns: 150 }
    );
  });

  it('after any failed moveCard operation, all zone lengths remain unchanged', () => {
    fc.assert(
      fc.property(
        gameStateArb,
        nonBattlefieldZoneArb,
        (state, zone) => {
          const handLen = state.hand.length;
          const cmdLen = state.commandZone.length;
          const gyLen = state.graveyard.length;
          const libLen = state.library.length;
          const exileLen = state.exile.length;
          const creatureRowCount = state.creatureArea.rows.length;

          // Try an invalid operation (non-existent card)
          try {
            moveCard(state, 'does-not-exist-xyz', zone, zone);
          } catch {
            // Expected to throw
          }

          // All zone sizes must remain unchanged
          expect(state.hand.length).toBe(handLen);
          expect(state.commandZone.length).toBe(cmdLen);
          expect(state.graveyard.length).toBe(gyLen);
          expect(state.library.length).toBe(libLen);
          expect(state.exile.length).toBe(exileLen);
          expect(state.creatureArea.rows.length).toBe(creatureRowCount);
        }
      ),
      { numRuns: 150 }
    );
  });

  it('dropping a card from hand back to hand (same zone) is a no-op — state unchanged', () => {
    fc.assert(
      fc.property(
        gameStateArb.filter(s => s.hand.length > 0),
        (state) => {
          const cardId = state.hand[0].id;
          const stateBefore = deepCloneState(state);

          // Same-zone move should throw
          expect(() => {
            moveCard(state, cardId, 'hand', 'hand');
          }).toThrow(`Cannot move card to the same zone: hand`);

          // State is unchanged
          expect(deepCloneState(state)).toEqual(stateBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid operations never create or destroy cards across all zones', () => {
    fc.assert(
      fc.property(
        gameStateArb,
        (state) => {
          // Count total cards before
          const totalBefore =
            state.hand.length +
            state.commandZone.length +
            state.graveyard.length +
            state.library.length +
            state.exile.length +
            state.creatureArea.rows.reduce((sum, r) => sum + r.elements.length, 0) +
            state.row3.left.length +
            state.row3.right.length +
            state.row4.left.length +
            state.row4.right.length;

          // Attempt multiple invalid operations
          const invalidOps = [
            () => moveCard(state, 'fake-id-1', 'hand', 'graveyard'),
            () => moveCard(state, 'fake-id-2', 'battlefield', 'exile'),
            () => moveCard(state, 'fake-id-3', 'library', 'library'),
          ];

          for (const op of invalidOps) {
            try { op(); } catch { /* expected */ }
          }

          // Count total cards after
          const totalAfter =
            state.hand.length +
            state.commandZone.length +
            state.graveyard.length +
            state.library.length +
            state.exile.length +
            state.creatureArea.rows.reduce((sum, r) => sum + r.elements.length, 0) +
            state.row3.left.length +
            state.row3.right.length +
            state.row4.left.length +
            state.row4.right.length;

          expect(totalAfter).toBe(totalBefore);
        }
      ),
      { numRuns: 100 }
    );
  });
});
