import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StreamHandTray } from '../StreamHandTray';
import type { CardData, CardType, KeywordAbility } from '../../types';

/**
 * Property 3: Hand card selective reveal
 *
 * For any hand card, if its ID is in `revealedHandIds` the stream view SHALL
 * select `card.imageURI` as the image source; otherwise it SHALL select the
 * card-back path.
 *
 * **Validates: Requirements 3.2, 3.3**
 *
 * Feature: obs-stream-view, Property 3: Hand card selective reveal
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const CARD_TYPES: CardType[] = ['creature', 'land', 'artifact', 'enchantment', 'planeswalker', 'instant', 'sorcery', 'battle', 'other'];
const KEYWORDS: KeywordAbility[] = ['flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 'hexproof', 'indestructible', 'menace', 'reach'];

const arbCardData: fc.Arbitrary<CardData> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  setCode: fc.string({ minLength: 3, maxLength: 5 }),
  collectorNumber: fc.nat(999).map(n => String(n + 1)),
  imageURI: fc.webUrl(),
  imageURILarge: fc.webUrl(),
  backFaceImageURI: fc.option(fc.webUrl(), { nil: null }),
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

/**
 * Generates a hand of cards and an arbitrary subset of their IDs to reveal.
 */
const arbHandWithRevealedSubset = fc.array(arbCardData, { minLength: 1, maxLength: 15 }).chain(hand => {
  // Generate an arbitrary subset of indices to mark as revealed
  const indices = hand.map((_, i) => i);
  return fc.subarray(indices, { minLength: 0 }).map(revealedIndices => ({
    hand,
    revealedIds: revealedIndices.map(i => hand[i].id),
  }));
});

// ─── Test ────────────────────────────────────────────────────────────────────

describe('Property 3: Hand card selective reveal', () => {
  it('for any hand card, if its ID is in revealedHandIds the image source is card.imageURI; otherwise it is card-back', () => {
    fc.assert(
      fc.property(
        arbHandWithRevealedSubset,
        ({ hand, revealedIds }) => {
          const { container } = render(
            <StreamHandTray hand={hand} revealedIds={revealedIds} />
          );

          const images = container.querySelectorAll('img');

          // Exactly one image per card
          expect(images.length).toBe(hand.length);

          // Each card's image source matches the reveal logic
          hand.forEach((card, index) => {
            const img = images[index];
            const expectedSrc = revealedIds.includes(card.id)
              ? card.imageURI
              : '/card-back.webp';
            expect(img.getAttribute('src')).toBe(expectedSrc);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
