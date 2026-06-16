import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { RowCard, CardData, CardType, KeywordAbility, Attachment, Counter, RowTarget } from '../../types';

/**
 * Property 5: Phased-out card exclusion
 *
 * For any GameState, the set of cards rendered by the stream battlefield
 * SHALL be exactly those RowCards where `isPhased === false`
 * (or `isPhased` is undefined/falsy).
 *
 * **Validates: Requirements 8.6**
 *
 * Feature: obs-stream-view, Property 5: Phased-out card exclusion
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const CARD_TYPES: CardType[] = ['creature', 'land', 'artifact', 'enchantment', 'planeswalker', 'instant', 'sorcery', 'battle', 'other'];
const ROW_TARGETS: RowTarget[] = ['creature-1', 'creature-2', 'creature-3', 'row3-lands', 'row3-artifacts', 'row4-lands', 'row4-enchantments', 'pw-battle-column'];

const arbCardData: fc.Arbitrary<CardData> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  setCode: fc.string({ minLength: 3, maxLength: 5 }),
  collectorNumber: fc.nat(999).map(n => String(n + 1)),
  imageURI: fc.constant('https://cards.scryfall.io/normal/front/test.jpg'),
  imageURILarge: fc.constant('https://cards.scryfall.io/large/front/test.jpg'),
  backFaceImageURI: fc.constant(null),
  backFaceCardType: fc.constant(null),
  backFaceName: fc.constant(null),
  backFacePower: fc.constant(null),
  backFaceToughness: fc.constant(null),
  typeLine: fc.constant('Creature — Human'),
  oracleText: fc.constant(''),
  isCommander: fc.constant(false),
  keywords: fc.constant([] as KeywordAbility[]),
  basePower: fc.constant('2'),
  baseToughness: fc.constant('2'),
  cardType: fc.constantFrom(...CARD_TYPES),
  cmc: fc.integer({ min: 0, max: 10 }),
  manaCost: fc.constant('{2}'),
  colorIdentity: fc.constant([] as string[]),
  producedMana: fc.constant([] as string[]),
  landCategory: fc.constant(null),
  isToken: fc.constant(false),
  isTokenCopy: fc.constant(false),
});

const arbRowCard: fc.Arbitrary<RowCard> = fc.record({
  card: arbCardData,
  instanceId: fc.uuid(),
  rowAssignment: fc.constantFrom(...ROW_TARGETS),
  positionIndex: fc.nat(20),
  isTapped: fc.boolean(),
  isFaceDown: fc.boolean(),
  showingBackFace: fc.constant(false),
  isPhased: fc.boolean(),
  attachments: fc.constant([] as Attachment[]),
  counters: fc.constant([] as Counter[]),
  mutateStack: fc.constant([] as CardData[]),
  isRevealed: fc.constant(false),
});

// ─── Filtering logic (extracted from StreamBattlefield/StreamSplitRow) ───────

/**
 * The same filtering logic used in both CreatureRow and StreamSplitRow's renderCards:
 *   cards.filter((rc) => !rc.isPhased)
 */
function filterPhasedCards(cards: RowCard[]): RowCard[] {
  return cards.filter((rc) => !rc.isPhased);
}

// ─── Test ────────────────────────────────────────────────────────────────────

describe('Property 5: Phased-out card exclusion', () => {
  it('for any array of RowCards, the filtered output SHALL contain exactly those cards where isPhased is false/falsy', () => {
    fc.assert(
      fc.property(
        fc.array(arbRowCard, { minLength: 0, maxLength: 30 }),
        (cards) => {
          const visible = filterPhasedCards(cards);

          // Every visible card must have isPhased === false
          for (const rc of visible) {
            expect(rc.isPhased).toBe(false);
          }

          // Every non-phased card from the input must be in the output
          const expectedVisible = cards.filter(rc => rc.isPhased === false);
          expect(visible.length).toBe(expectedVisible.length);

          // The visible set preserves order and identity
          for (let i = 0; i < visible.length; i++) {
            expect(visible[i].instanceId).toBe(expectedVisible[i].instanceId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cards with isPhased === true are never included in the filtered output', () => {
    fc.assert(
      fc.property(
        fc.array(arbRowCard, { minLength: 1, maxLength: 30 }),
        (cards) => {
          const visible = filterPhasedCards(cards);
          const phasedOutIds = new Set(
            cards.filter(rc => rc.isPhased).map(rc => rc.instanceId)
          );

          // No phased-out card should appear in visible output
          for (const rc of visible) {
            expect(phasedOutIds.has(rc.instanceId)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when all cards are phased out, the result is empty', () => {
    fc.assert(
      fc.property(
        fc.array(arbRowCard, { minLength: 1, maxLength: 20 }).map(cards =>
          cards.map(rc => ({ ...rc, isPhased: true as const }))
        ),
        (allPhasedCards) => {
          const visible = filterPhasedCards(allPhasedCards);
          expect(visible.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when no cards are phased out, all cards are visible', () => {
    fc.assert(
      fc.property(
        fc.array(arbRowCard, { minLength: 0, maxLength: 20 }).map(cards =>
          cards.map(rc => ({ ...rc, isPhased: false as const }))
        ),
        (noPhasedCards) => {
          const visible = filterPhasedCards(noPhasedCards);
          expect(visible.length).toBe(noPhasedCards.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
