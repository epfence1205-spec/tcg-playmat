import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { reorderWithinRow, getRowCards, setRowCards } from '../sortableHelpers';
import type { GameState, RowCard, CardData, CreatureArea, SplitRow } from '../types';

// ─── Helper: Create a minimal valid GameState with N creatures in creature-1 ─

function makeGameState(creatureCount: number): GameState {
  const elements: RowCard[] = Array.from({ length: creatureCount }, (_, i) => ({
    card: {
      id: `card-${i}`,
      name: `Creature ${i}`,
      setCode: 'tst',
      collectorNumber: '1',
      imageURI: '',
      imageURILarge: '',
      backFaceImageURI: null,
      backFaceCardType: null,
      backFaceName: null,
      backFacePower: null,
      backFaceToughness: null,
      typeLine: 'Creature',
      oracleText: '',
      isCommander: false,
      keywords: [],
      basePower: '2',
      baseToughness: '2',
      cardType: 'creature',
      isToken: false,
      isTokenCopy: false,
    } as CardData,
    instanceId: `card-${i}`,
    rowAssignment: 'creature-1' as const,
    positionIndex: i,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters: [],
    isRevealed: false,
  }));

  return {
    gamePhase: 'PLAYING',
    creatureArea: {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: creatureCount,
    } as CreatureArea,
    row3: { left: [], right: [] } as SplitRow,
    row4: { left: [], right: [] } as SplitRow,
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: true,
    lifeTotal: 40,
  } as GameState;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 9: Battlefield Sortable Invariants', () => {
  it('9.1 reorder preserves total card count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 0, max: 19 }),
        (count, oldIdx, newIdx) => {
          const state = makeGameState(count);
          const old = oldIdx % count;
          const newI = newIdx % count;
          const result = reorderWithinRow(state, 'creature-1', old, newI);
          const resultCards = getRowCards(result, 'creature-1');
          expect(resultCards.length).toBe(count);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('9.2 reorder produces no duplicate instanceIds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 0, max: 19 }),
        (count, oldIdx, newIdx) => {
          const state = makeGameState(count);
          const old = oldIdx % count;
          const newI = newIdx % count;
          const result = reorderWithinRow(state, 'creature-1', old, newI);
          const ids = getRowCards(result, 'creature-1').map(rc => rc.instanceId);
          expect(new Set(ids).size).toBe(ids.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('9.3 reorder preserves attachments on all cards', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (count, oldIdx, newIdx) => {
          const state = makeGameState(count);
          // Add an attachment to the first card
          const cards = getRowCards(state, 'creature-1');
          cards[0] = {
            ...cards[0],
            attachments: [
              {
                card: { ...cards[0].card, id: 'equip-1', name: 'Sword' },
                instanceId: 'equip-1',
                isTapped: false,
              },
            ],
          };
          const stateWithEquip = setRowCards(state, 'creature-1', cards);

          const old = oldIdx % count;
          const newI = newIdx % count;
          const result = reorderWithinRow(stateWithEquip, 'creature-1', old, newI);
          const resultCards = getRowCards(result, 'creature-1');
          // Find the card that had the attachment
          const cardWithEquip = resultCards.find(rc => rc.instanceId === 'card-0');
          expect(cardWithEquip?.attachments.length).toBe(1);
          expect(cardWithEquip?.attachments[0].instanceId).toBe('equip-1');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('9.4 invalid indices return same state reference (no-op)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          const state = makeGameState(count);
          // Out of bounds indices — all should be no-ops returning same reference
          const result1 = reorderWithinRow(state, 'creature-1', -1, 0);
          expect(result1).toBe(state);
          const result2 = reorderWithinRow(state, 'creature-1', 0, count);
          expect(result2).toBe(state);
          const result3 = reorderWithinRow(state, 'creature-1', count, 0);
          expect(result3).toBe(state);
        }
      ),
      { numRuns: 100 }
    );
  });
});
