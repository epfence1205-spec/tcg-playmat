import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StreamCard } from '../StreamCard';
import type { CardData, CardType, KeywordAbility, RowCard, RowTarget, CounterType } from '../../types';

/**
 * Property 4: Tap state rendering fidelity
 *
 * For any RowCard on the battlefield, the stream view SHALL apply a 90° CSS
 * rotation if and only if `isTapped === true`.
 *
 * **Validates: Requirements 8.1**
 *
 * Feature: obs-stream-view, Property 4: Tap state rendering fidelity
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const CARD_TYPES: CardType[] = ['creature', 'land', 'artifact', 'enchantment', 'planeswalker', 'instant', 'sorcery', 'battle', 'other'];
const KEYWORDS: KeywordAbility[] = ['flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 'hexproof', 'indestructible', 'menace', 'reach'];
const ROW_TARGETS: RowTarget[] = ['creature-1', 'creature-2', 'creature-3', 'row3-lands', 'row3-artifacts', 'row4-lands', 'row4-enchantments', 'pw-battle-column'];
const COUNTER_TYPES: CounterType[] = ['+1/+1', '-1/-1', 'loyalty', 'charge', 'generic'];

const arbCardData: fc.Arbitrary<CardData> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  setCode: fc.string({ minLength: 3, maxLength: 5 }),
  collectorNumber: fc.nat(999).map(n => String(n + 1)),
  imageURI: fc.constant('https://cards.scryfall.io/normal/front/a/1/test.jpg'),
  imageURILarge: fc.constant('https://cards.scryfall.io/large/front/a/1/test.jpg'),
  backFaceImageURI: fc.option(fc.constant('https://cards.scryfall.io/normal/back/a/1/test.jpg'), { nil: null }),
  backFaceCardType: fc.option(fc.constantFrom(...CARD_TYPES), { nil: null }),
  backFaceName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  backFacePower: fc.option(fc.constantFrom('0', '1', '2', '3', '*'), { nil: null }),
  backFaceToughness: fc.option(fc.constantFrom('0', '1', '2', '3', '*'), { nil: null }),
  typeLine: fc.string({ minLength: 1, maxLength: 50 }),
  oracleText: fc.string({ maxLength: 100 }),
  isCommander: fc.boolean(),
  keywords: fc.array(fc.constantFrom(...KEYWORDS), { maxLength: 4 }),
  basePower: fc.option(fc.constantFrom('0', '1', '2', '3', '4', '5', '*'), { nil: null }),
  baseToughness: fc.option(fc.constantFrom('0', '1', '2', '3', '4', '5', '*'), { nil: null }),
  cardType: fc.constantFrom(...CARD_TYPES),
  cmc: fc.integer({ min: 0, max: 16 }),
  manaCost: fc.string({ maxLength: 20 }),
  colorIdentity: fc.array(fc.constantFrom('W', 'U', 'B', 'R', 'G'), { maxLength: 5 }),
  producedMana: fc.array(fc.constantFrom('W', 'U', 'B', 'R', 'G', 'C'), { maxLength: 5 }),
  landCategory: fc.constant(null),
  isToken: fc.boolean(),
  isTokenCopy: fc.boolean(),
});

const arbRowCard: fc.Arbitrary<RowCard> = fc.record({
  card: arbCardData,
  instanceId: fc.uuid(),
  rowAssignment: fc.constantFrom(...ROW_TARGETS),
  positionIndex: fc.nat(20),
  isTapped: fc.boolean(),
  isFaceDown: fc.boolean(),
  showingBackFace: fc.boolean(),
  isPhased: fc.boolean(),
  attachments: fc.constant([]),
  counters: fc.array(
    fc.record({ type: fc.constantFrom(...COUNTER_TYPES), value: fc.integer({ min: -5, max: 10 }) }),
    { maxLength: 3 }
  ),
  mutateStack: fc.constant([]),
  isRevealed: fc.boolean(),
});

// ─── Test ────────────────────────────────────────────────────────────────────

describe('Property 4: Tap state rendering fidelity', () => {
  it('applies rotate(90deg) if and only if isTapped === true', () => {
    fc.assert(
      fc.property(arbRowCard, (rowCard) => {
        const { container } = render(<StreamCard rowCard={rowCard} />);

        // Rotation is applied on the root wrapper div
        const rootDiv = container.firstElementChild as HTMLElement;
        const transformStyle = rootDiv.style.transform;

        if (rowCard.isTapped) {
          expect(transformStyle).toBe('rotate(90deg)');
        } else {
          // When not tapped, transform should be empty or not set
          expect(transformStyle).toBe('');
        }
      }),
      { numRuns: 100 }
    );
  });
});
