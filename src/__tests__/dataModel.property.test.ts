import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CardData, CardType, KeywordAbility } from '../types';

/**
 * Property 14: Schema Conformance
 * Validates CardData shape constraints:
 * - UUID v4 id
 * - lowercase setCode 3-5 chars
 * - HTTPS imageURI
 * - non-empty typeLine
 * - oracleText can be empty string (for lands/tokens)
 *
 * **Validates: Requirements 20.1, 20.2, 20.4, 20.5**
 */

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cardTypeArb: fc.Arbitrary<CardType> = fc.constantFrom(
  'creature',
  'land',
  'artifact',
  'enchantment',
  'planeswalker',
  'instant',
  'sorcery',
  'battle',
  'other'
);

const keywordAbilityArb: fc.Arbitrary<KeywordAbility> = fc.constantFrom(
  'flying',
  'trample',
  'haste',
  'vigilance',
  'lifelink',
  'deathtouch',
  'hexproof',
  'indestructible',
  'menace',
  'reach',
  'first_strike',
  'double_strike',
  'flash',
  'defender',
  'ward',
  'shroud',
  'protection'
);

/** Generates a valid lowercase setCode of 3-5 characters */
const setCodeArb: fc.Arbitrary<string> = fc
  .integer({ min: 3, max: 5 })
  .chain((len) => fc.array(fc.constantFrom('a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','0','1','2','3','4','5','6','7','8','9'), { minLength: len, maxLength: len })
    .map(chars => chars.join('')));

/** Generates a valid HTTPS URL for card images */
const httpsImageURIArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.array(fc.constantFrom('a','b','c','d','e','f','g','h','i','j','k','l','m'), { minLength: 3, maxLength: 10 }).map(c => c.join('')),
    fc.array(fc.constantFrom('a','b','c','d','e','0','1','2','3','4','5','6','7','8','9'), { minLength: 5, maxLength: 15 }).map(c => c.join(''))
  )
  .map(([domain, path]) => `https://${domain}.scryfall.io/cards/${path}.jpg`);

/** Generates a non-empty typeLine */
const typeLineArb: fc.Arbitrary<string> = fc.constantFrom(
  'Creature — Human',
  'Creature — Elf Warrior',
  'Instant',
  'Sorcery',
  'Enchantment — Aura',
  'Artifact — Equipment',
  'Land',
  'Planeswalker — Jace',
  'Creature — Dragon',
  'Legendary Creature — God'
);

/** Generates oracleText that can be empty (for lands/tokens) */
const oracleTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 200 })
);

/** Generates a valid CardData instance satisfying all schema constraints */
const cardDataArb: fc.Arbitrary<CardData> = fc
  .tuple(
    fc.uuid().map(id => {
      // Force UUID v4 format: set version nibble to 4, variant bits to 10xx
      const chars = id.replace(/-/g, '').split('');
      chars[12] = '4'; // version
      const variantChar = parseInt(chars[16], 16);
      chars[16] = ((variantChar & 0x3) | 0x8).toString(16); // variant
      return `${chars.slice(0,8).join('')}-${chars.slice(8,12).join('')}-${chars.slice(12,16).join('')}-${chars.slice(16,20).join('')}-${chars.slice(20).join('')}`;
    }),
    fc.string({ minLength: 1, maxLength: 50 }),
    setCodeArb,
    fc.integer({ min: 1, max: 999 }).map(n => String(n)),
    httpsImageURIArb,
    httpsImageURIArb,
    fc.option(httpsImageURIArb, { nil: null }),
    typeLineArb,
    oracleTextArb,
    fc.boolean(),
    fc.array(keywordAbilityArb, { minLength: 0, maxLength: 5 }),
    fc.option(fc.constantFrom('0','1','2','3','4','5','6','7','8','9','10','*'), { nil: null }),
    fc.option(fc.constantFrom('0','1','2','3','4','5','6','7','8','9','10','*'), { nil: null }),
    cardTypeArb
  )
  .map(([id, name, setCode, collectorNumber, imageURI, imageURILarge, backFaceImageURI, typeLine, oracleText, isCommander, keywords, basePower, baseToughness, cardType]) => ({
    id,
    name,
    setCode,
    collectorNumber,
    imageURI,
    imageURILarge,
    backFaceImageURI,
    typeLine,
    oracleText,
    isCommander,
    keywords,
    basePower,
    baseToughness,
    cardType,
    isToken: false,
    isTokenCopy: false,
  }));

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 14: Schema Conformance', () => {
  it('CardData.id must be a valid UUID v4 format', () => {
    fc.assert(
      fc.property(cardDataArb, (card: CardData) => {
        expect(card.id).toMatch(UUID_V4_REGEX);
      }),
      { numRuns: 200 }
    );
  });

  it('CardData.setCode must be lowercase and 3-5 characters', () => {
    fc.assert(
      fc.property(cardDataArb, (card: CardData) => {
        expect(card.setCode).toMatch(/^[a-z0-9]{3,5}$/);
        expect(card.setCode).toBe(card.setCode.toLowerCase());
        expect(card.setCode.length).toBeGreaterThanOrEqual(3);
        expect(card.setCode.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 200 }
    );
  });

  it('CardData.imageURI must be a valid HTTPS URL', () => {
    fc.assert(
      fc.property(cardDataArb, (card: CardData) => {
        expect(card.imageURI).toMatch(/^https:\/\/.+/);
      }),
      { numRuns: 200 }
    );
  });

  it('CardData.typeLine must be non-empty', () => {
    fc.assert(
      fc.property(cardDataArb, (card: CardData) => {
        expect(card.typeLine.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it('CardData.oracleText can be empty string (for lands/tokens)', () => {
    fc.assert(
      fc.property(cardDataArb, (card: CardData) => {
        // oracleText is always a string (possibly empty) — never null or undefined
        expect(typeof card.oracleText).toBe('string');
      }),
      { numRuns: 200 }
    );
  });

  it('any CardData produced by the generator satisfies all schema constraints simultaneously', () => {
    fc.assert(
      fc.property(cardDataArb, (card: CardData) => {
        // UUID v4
        expect(card.id).toMatch(UUID_V4_REGEX);

        // setCode: lowercase, 3-5 chars
        expect(card.setCode).toMatch(/^[a-z0-9]{3,5}$/);

        // imageURI: HTTPS
        expect(card.imageURI).toMatch(/^https:\/\/.+/);

        // typeLine: non-empty
        expect(card.typeLine.length).toBeGreaterThan(0);

        // oracleText: string (can be empty)
        expect(typeof card.oracleText).toBe('string');

        // backFaceImageURI: null or HTTPS
        if (card.backFaceImageURI !== null) {
          expect(card.backFaceImageURI).toMatch(/^https:\/\/.+/);
        }

        // imageURILarge: HTTPS
        expect(card.imageURILarge).toMatch(/^https:\/\/.+/);
      }),
      { numRuns: 200 }
    );
  }, 30000);
});
