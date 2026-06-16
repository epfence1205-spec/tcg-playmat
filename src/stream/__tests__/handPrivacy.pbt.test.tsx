import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StreamHandTray } from '../StreamHandTray';
import type { CardData, CardType, KeywordAbility } from '../../types';

/**
 * Property 2: Hand card privacy — default card backs
 *
 * For any hand of N cards where none are in the `revealedHandIds` set,
 * the stream hand tray render logic SHALL produce exactly N card-back
 * image sources and zero face-up image sources.
 *
 * **Validates: Requirements 3.1, 3.4**
 *
 * Feature: obs-stream-view, Property 2: Hand card privacy — default card backs
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

// ─── Test ────────────────────────────────────────────────────────────────────

describe('Property 2: Hand card privacy — default card backs', () => {
  it('for any hand of N cards with empty revealedIds, renders exactly N card-back images and zero face-up images', () => {
    fc.assert(
      fc.property(
        fc.array(arbCardData, { minLength: 0, maxLength: 20 }),
        (hand) => {
          const { container } = render(
            <StreamHandTray hand={hand} revealedIds={[]} />
          );

          const images = container.querySelectorAll('img');

          // Exactly N images rendered (one per card)
          expect(images.length).toBe(hand.length);

          // Every image shows card-back, none show a face-up card
          images.forEach(img => {
            expect(img.getAttribute('src')).toBe('/card-back.webp');
          });

          // Zero face-up image sources (no img has a non-card-back src)
          const faceUpImages = Array.from(images).filter(
            img => img.getAttribute('src') !== '/card-back.webp'
          );
          expect(faceUpImages.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
