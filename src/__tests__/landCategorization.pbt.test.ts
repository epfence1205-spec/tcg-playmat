import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyLand, type LandCategory } from '../api/landCategorizer';

/**
 * Property-based tests for classifyLand
 *
 * Tests Properties 1, 4, 5, and 9 from the design document.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_CATEGORIES: LandCategory[] = [
  'basic', 'dual', 'shockland', 'fetchland', 'checkland',
  'tangoland', 'fastland', 'slowland', 'bondland', 'painland',
  'filterland', 'bounceland', 'canopyland', 'shadowland', 'scryland',
  'gainland', 'surveilland', 'storageland', 'bikeland', 'tricycleland',
  'triland', 'creatureland', 'pathway', 'rainbow', 'utility', 'unknown',
];

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const manaColorArb = fc.constantFrom('W', 'U', 'B', 'R', 'G', 'C');
const producedManaArb = fc.array(manaColorArb, { minLength: 0, maxLength: 6 });
const oracleTextArb = fc.string({ minLength: 0, maxLength: 200 });
const typeLineArb = fc.string({ minLength: 0, maxLength: 80 });
const cardNameArb = fc.string({ minLength: 0, maxLength: 50 });

// ─── Property 1: Output validity ────────────────────────────────────────────

describe('Property 1: Output validity', () => {
  /**
   * For arbitrary inputs, classifyLand always returns a valid LandCategory.
   *
   * **Validates: Requirements 1.1**
   */
  it('classifyLand always returns a valid LandCategory for arbitrary inputs', () => {
    fc.assert(
      fc.property(
        oracleTextArb,
        typeLineArb,
        producedManaArb,
        cardNameArb,
        (oracleText, typeLine, producedMana, name) => {
          const result = classifyLand(oracleText, typeLine, producedMana, name);
          expect(VALID_CATEGORIES).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Priority ordering ──────────────────────────────────────────

describe('Property 4: Priority ordering', () => {
  /**
   * When multiple rules match, the highest-priority category wins.
   * We construct inputs that match both a higher-priority rule and a lower-priority rule,
   * and verify the higher-priority result is returned.
   *
   * **Validates: Requirements 3.26**
   */

  it('fetchland beats checkland when both patterns are present', () => {
    // Fetchland: "search your library" + "sacrifice"
    // Checkland: "unless you control a" + basic subtype
    fc.assert(
      fc.property(
        fc.constantFrom('Plains', 'Island', 'Swamp', 'Mountain', 'Forest'),
        producedManaArb,
        cardNameArb,
        (basicType, mana, name) => {
          const oracle = `{T}, Pay 1 life, Sacrifice this land: Search your library for a ${basicType} card. Unless you control a ${basicType}.`;
          const result = classifyLand(oracle, 'Land', mana, name);
          // Fetchland (rule 4) has higher priority than checkland (rule 5)
          expect(result).toBe('fetchland');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shockland beats scryland when oracle contains both patterns', () => {
    // Shockland: "pay 2 life" + 2 subtypes + 2 colors
    // Scryland: "enters tapped" + "scry 1"
    fc.assert(
      fc.property(
        fc.constantFrom('W', 'U', 'B', 'R', 'G'),
        fc.constantFrom('W', 'U', 'B', 'R', 'G'),
        cardNameArb,
        (color1, color2, name) => {
          const oracle = 'As this enters, you may pay 2 life. If you don\'t, this enters tapped. Scry 1.';
          const typeLine = 'Land — Plains Island';
          const result = classifyLand(oracle, typeLine, [color1, color2], name);
          // Shockland (rule 3) has higher priority than scryland (rule 14)
          expect(result).toBe('shockland');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('bounceland beats gainland when both "return a land" and "gain 1 life" + "enters tapped" are present', () => {
    fc.assert(
      fc.property(
        producedManaArb,
        cardNameArb,
        (mana, name) => {
          const oracle = 'This land enters tapped. When it enters, return a land you control to its owner\'s hand. When it enters, gain 1 life.';
          const result = classifyLand(oracle, 'Land', mana, name);
          // Bounceland (rule 13) has higher priority than gainland (rule 16)
          expect(result).toBe('bounceland');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Case insensitivity ─────────────────────────────────────────

describe('Property 5: Case insensitivity', () => {
  /**
   * Arbitrary case transformations on oracle text and type line don't change output.
   *
   * **Validates: Requirements 3.27**
   */

  it('case transformations on oracle text do not change classification', () => {
    // Use known oracle text patterns to ensure meaningful inputs
    const knownOraclePatterns = fc.constantFrom(
      'enters tapped unless you control two or fewer other lands',
      'enters tapped unless you control two or more other lands',
      'enters tapped unless you have two or more opponents',
      '{T}, Pay 1 life, Sacrifice this land: Search your library for a Plains or Island card.',
      'deals 1 damage to you',
      'enters tapped. Scry 1.',
      'enters tapped. Surveil 1.',
      'enters tapped. Gain 1 life.',
      'storage counter',
      'one mana of any color',
    );

    fc.assert(
      fc.property(
        knownOraclePatterns,
        fc.array(fc.boolean(), { minLength: 200, maxLength: 200 }),
        producedManaArb,
        cardNameArb,
        (oracle, bools, mana, name) => {
          const typeLine = 'Land';
          // Apply random case transformation
          const transformed = oracle
            .split('')
            .map((ch, i) => (bools[i % bools.length] ? ch.toUpperCase() : ch.toLowerCase()))
            .join('');

          const original = classifyLand(oracle, typeLine, mana, name);
          const cased = classifyLand(transformed, typeLine, mana, name);
          expect(cased).toBe(original);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('case transformations on type line do not change classification', () => {
    const knownTypeLines = fc.constantFrom(
      'Basic Land — Plains',
      'Basic Land — Island',
      'Basic Land — Swamp',
      'Basic Land — Mountain',
      'Basic Land — Forest',
      'Land — Plains Island',
      'Land — Swamp Mountain Forest',
    );

    const matchingNames = fc.constantFrom(
      'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Hallowed Fountain', 'Zagoth Triome'
    );

    fc.assert(
      fc.property(
        knownTypeLines,
        fc.array(fc.boolean(), { minLength: 100, maxLength: 100 }),
        producedManaArb,
        matchingNames,
        (typeLine, bools, mana, name) => {
          const oracle = '';
          const transformed = typeLine
            .split('')
            .map((ch, i) => (bools[i % bools.length] ? ch.toUpperCase() : ch.toLowerCase()))
            .join('');

          const original = classifyLand(oracle, typeLine, mana, name);
          const cased = classifyLand(oracle, transformed, mana, name);
          expect(cased).toBe(original);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 9: Determinism ─────────────────────────────────────────────────

describe('Property 9: Determinism', () => {
  /**
   * Calling classifyLand twice with same args returns same result.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  it('classifyLand is deterministic — same inputs always yield same output', () => {
    fc.assert(
      fc.property(
        oracleTextArb,
        typeLineArb,
        producedManaArb,
        cardNameArb,
        (oracleText, typeLine, producedMana, name) => {
          const result1 = classifyLand(oracleText, typeLine, producedMana, name);
          const result2 = classifyLand(oracleText, typeLine, producedMana, name);
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
