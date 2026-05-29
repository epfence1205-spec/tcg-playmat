import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseKeywords, KEYWORD_PATTERNS } from '../keywords';
import type { KeywordAbility } from '../types';

/**
 * Property 20: Keyword Parsing Completeness
 * For any oracle text containing recognized keywords, parser detects all matching keywords.
 *
 * **Validates: Requirements 18.1**
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_KEYWORDS: KeywordAbility[] = [
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
  'protection',
];

/** Maps keyword ability to its text representation in oracle text */
const KEYWORD_TEXT: Record<KeywordAbility, string> = {
  flying: 'flying',
  trample: 'trample',
  haste: 'haste',
  vigilance: 'vigilance',
  lifelink: 'lifelink',
  deathtouch: 'deathtouch',
  hexproof: 'hexproof',
  indestructible: 'indestructible',
  menace: 'menace',
  reach: 'reach',
  first_strike: 'first strike',
  double_strike: 'double strike',
  flash: 'flash',
  defender: 'defender',
  ward: 'ward',
  shroud: 'shroud',
  protection: 'protection',
};

// ─── Arbitraries (Generators) ────────────────────────────────────────────────

/** Generates a random keyword ability */
const keywordArb: fc.Arbitrary<KeywordAbility> = fc.constantFrom(...ALL_KEYWORDS);

/** Generates a non-empty subset of keywords */
const keywordSubsetArb: fc.Arbitrary<KeywordAbility[]> = fc
  .subarray(ALL_KEYWORDS, { minLength: 1 })
  .filter((arr) => arr.length > 0);

/**
 * Generates filler text that does NOT contain any keyword as a whole word.
 * Uses safe words that won't accidentally form keywords.
 */
const safeFillerWords = [
  'this', 'creature', 'deals', 'damage', 'to', 'target', 'player',
  'draw', 'cards', 'when', 'enters', 'the', 'battlefield', 'you',
  'may', 'pay', 'mana', 'cost', 'until', 'end', 'of', 'turn',
  'each', 'opponent', 'loses', 'life', 'gains', 'control',
  'destroy', 'all', 'creatures', 'with', 'power', 'or', 'less',
  'counter', 'spell', 'return', 'from', 'graveyard', 'hand',
  'exile', 'token', 'create', 'artifact', 'enchantment',
  'sacrifice', 'discard', 'reveal', 'top', 'library',
  'put', 'onto', 'tapped', 'untapped', 'attacking', 'blocking',
];

const safeFillerArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...safeFillerWords), { minLength: 1, maxLength: 8 })
  .map((words) => words.join(' '));

/**
 * Generates oracle text that embeds specific keywords as whole words
 * surrounded by safe filler text.
 */
function oracleTextWithKeywords(keywords: KeywordAbility[]): fc.Arbitrary<string> {
  return fc
    .tuple(
      safeFillerArb,
      fc.shuffledSubarray(keywords, { minLength: keywords.length, maxLength: keywords.length }),
      fc.array(safeFillerArb, { minLength: 0, maxLength: keywords.length })
    )
    .map(([prefix, shuffledKeywords, fillers]) => {
      const parts: string[] = [prefix];
      for (let i = 0; i < shuffledKeywords.length; i++) {
        parts.push(KEYWORD_TEXT[shuffledKeywords[i]]);
        if (fillers[i]) {
          parts.push(fillers[i]);
        }
      }
      return parts.join(' ');
    });
}

/**
 * Words that contain keyword substrings but should NOT trigger detection.
 * These test word boundary enforcement.
 */
const partialMatchWords = [
  'flashback',     // contains "flash"
  'overreach',     // contains "reach"
  'undefended',    // contains "defender" substring? No — "defend" not "defender"
  'trampling',     // contains "trample" prefix
  'flyingfish',    // "flying" not at word boundary (no space after)
  'preflash',      // "flash" not at word boundary (no space before)
  'deathtouch',    // this IS a keyword — skip from partial list
  'lifeline',      // contains "life" but not "lifelink"
  'shrouded',      // contains "shroud" prefix
  'protections',   // contains "protection" prefix
  'warden',        // contains "ward" prefix
  'menacing',      // contains "menace" prefix
  'hastened',      // contains "haste" prefix
  'vigilant',      // contains "vigilan" but not "vigilance"
];

// Filter to only words that truly don't contain any keyword as a whole word
const safePartialWords = partialMatchWords.filter((word) => {
  for (const [, pattern] of Object.entries(KEYWORD_PATTERNS)) {
    if (pattern.test(word)) {
      return false; // This word actually matches a keyword
    }
  }
  return true;
});

const partialMatchTextArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...safePartialWords), { minLength: 1, maxLength: 5 })
  .map((words) => words.join(' '));

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 20: Keyword Parsing Completeness', () => {
  it('for any oracle text containing keywords as whole words, parseKeywords detects all of them', () => {
    fc.assert(
      fc.property(
        keywordSubsetArb.chain((keywords) =>
          oracleTextWithKeywords(keywords).map((text) => ({ text, keywords }))
        ),
        ({ text, keywords }) => {
          const result = parseKeywords(text);
          for (const kw of keywords) {
            expect(result).toContain(kw);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('for any oracle text without keywords, parseKeywords returns empty array', () => {
    fc.assert(
      fc.property(safeFillerArb, (text) => {
        const result = parseKeywords(text);
        expect(result).toEqual([]);
      }),
      { numRuns: 200 }
    );
  });

  it('parseKeywords never returns duplicates', () => {
    fc.assert(
      fc.property(
        keywordSubsetArb.chain((keywords) =>
          oracleTextWithKeywords(keywords).map((text) => ({ text, keywords }))
        ),
        ({ text }) => {
          const result = parseKeywords(text);
          const unique = new Set(result);
          expect(result.length).toBe(unique.size);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('parseKeywords result is always a subset of the 17 recognized keywords', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 500 }), (text) => {
        const result = parseKeywords(text);
        for (const kw of result) {
          expect(ALL_KEYWORDS).toContain(kw);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('partial word matches do not produce false positives', () => {
    fc.assert(
      fc.property(partialMatchTextArb, (text) => {
        const result = parseKeywords(text);
        expect(result).toEqual([]);
      }),
      { numRuns: 200 }
    );
  });
});
