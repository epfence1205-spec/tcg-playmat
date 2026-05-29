import { describe, it, expect } from 'vitest';
import {
  KEYWORD_PATTERNS,
  parseKeywords,
  STAT_MODIFIER_PATTERN,
  parseCreatureStats,
  calculateEffectiveStats,
} from './keywords';
import type { RowCard, CardData } from './types';

describe('KEYWORD_PATTERNS', () => {
  it('contains all 17 keyword abilities', () => {
    expect(Object.keys(KEYWORD_PATTERNS)).toHaveLength(17);
  });

  it('matches keywords case-insensitively', () => {
    expect(KEYWORD_PATTERNS.flying.test('Flying')).toBe(true);
    expect(KEYWORD_PATTERNS.flying.test('FLYING')).toBe(true);
    expect(KEYWORD_PATTERNS.flying.test('flying')).toBe(true);
  });

  it('uses word boundaries to avoid partial matches', () => {
    expect(KEYWORD_PATTERNS.reach.test('reaching')).toBe(false);
    expect(KEYWORD_PATTERNS.flash.test('flashback')).toBe(false);
  });

  it('matches multi-word keywords', () => {
    expect(KEYWORD_PATTERNS.first_strike.test('First strike')).toBe(true);
    expect(KEYWORD_PATTERNS.double_strike.test('double strike')).toBe(true);
  });
});

describe('parseKeywords', () => {
  it('returns empty array for text with no keywords', () => {
    expect(parseKeywords('Draw two cards.')).toEqual([]);
  });

  it('detects a single keyword', () => {
    expect(parseKeywords('Flying')).toEqual(['flying']);
  });

  it('detects multiple keywords', () => {
    const result = parseKeywords('Flying, trample, haste');
    expect(result).toContain('flying');
    expect(result).toContain('trample');
    expect(result).toContain('haste');
    expect(result).toHaveLength(3);
  });

  it('detects keywords embedded in oracle text', () => {
    const oracleText = 'This creature has flying and lifelink. When it enters the battlefield, draw a card.';
    const result = parseKeywords(oracleText);
    expect(result).toContain('flying');
    expect(result).toContain('lifelink');
  });

  it('detects first strike and double strike', () => {
    const result = parseKeywords('First strike, double strike');
    expect(result).toContain('first_strike');
    expect(result).toContain('double_strike');
  });

  it('does not match partial words', () => {
    const result = parseKeywords('flashback, overreach');
    expect(result).not.toContain('flash');
    expect(result).not.toContain('reach');
  });
});

describe('STAT_MODIFIER_PATTERN', () => {
  it('matches "gets +2/+2" pattern', () => {
    const text = 'Equipped creature gets +2/+2.';
    const matches = [...text.matchAll(STAT_MODIFIER_PATTERN)];
    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('+2');
    expect(matches[0][2]).toBe('+2');
  });

  it('matches "get +1/+0" pattern', () => {
    const text = 'Creatures you control get +1/+0.';
    const matches = [...text.matchAll(STAT_MODIFIER_PATTERN)];
    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('+1');
    expect(matches[0][2]).toBe('+0');
  });

  it('matches negative modifiers', () => {
    const text = 'Target creature gets -2/-2 until end of turn.';
    const matches = [...text.matchAll(STAT_MODIFIER_PATTERN)];
    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('-2');
    expect(matches[0][2]).toBe('-2');
  });

  it('matches "has +1/+1" pattern', () => {
    const text = 'Equipped creature has +1/+1.';
    const matches = [...text.matchAll(STAT_MODIFIER_PATTERN)];
    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('+1');
    expect(matches[0][2]).toBe('+1');
  });

  it('matches multiple modifiers in one text', () => {
    const text = 'Equipped creature gets +1/+1 and gets +2/+0.';
    const matches = [...text.matchAll(STAT_MODIFIER_PATTERN)];
    expect(matches).toHaveLength(2);
  });
});

describe('parseCreatureStats', () => {
  it('parses from basePower and baseToughness when provided', () => {
    expect(parseCreatureStats('Creature — Human Wizard', '3', '4')).toEqual([3, 4]);
  });

  it('falls back to type line parsing when basePower/baseToughness are null', () => {
    expect(parseCreatureStats('Creature — Human Wizard 3/4', null, null)).toEqual([3, 4]);
  });

  it('returns [0, 0] for non-numeric power/toughness like "*"', () => {
    expect(parseCreatureStats('Creature — Elemental', '*', '*')).toEqual([0, 0]);
  });

  it('returns [0, 0] when no stats are available', () => {
    expect(parseCreatureStats('Enchantment', null, null)).toEqual([0, 0]);
  });

  it('handles type line with trailing whitespace gracefully', () => {
    // The regex uses \s*$ so trailing whitespace is tolerated
    expect(parseCreatureStats('Creature — Elf Warrior 2/2 ', null, null)).toEqual([2, 2]);
  });

  it('prefers basePower/baseToughness over type line', () => {
    expect(parseCreatureStats('Creature — Human 1/1', '5', '5')).toEqual([5, 5]);
  });
});

describe('calculateEffectiveStats', () => {
  function makeCard(overrides: Partial<CardData> = {}): CardData {
    return {
      id: 'card-1',
      name: 'Test Creature',
      setCode: 'tst',
      collectorNumber: '1',
      imageURI: '',
      imageURILarge: '',
      backFaceImageURI: null,
      typeLine: 'Creature — Human',
      oracleText: '',
      isCommander: false,
      keywords: [],
      basePower: '3',
      baseToughness: '4',
      cardType: 'creature',
      ...overrides,
    };
  }

  function makeRowCard(overrides: Partial<RowCard> = {}): RowCard {
    return {
      card: makeCard(),
      instanceId: 'card-1',
      rowAssignment: 'creature-1',
      positionIndex: 0,
      isTapped: false,
      isFaceDown: false,
      showingBackFace: false,
      isPhased: false,
      attachments: [],
      counters: [],
      isRevealed: false,
      ...overrides,
    };
  }

  function makeEquipment(id: string, oracleText: string): RowCard {
    return makeRowCard({
      card: makeCard({ id, name: 'Equipment', oracleText, cardType: 'artifact' }),
      instanceId: id,
    });
  }

  it('returns base stats with no attachments', () => {
    const creature = makeRowCard();
    const result = calculateEffectiveStats(creature, []);
    expect(result.basePower).toBe(3);
    expect(result.baseToughness).toBe(4);
    expect(result.modifiedPower).toBe(3);
    expect(result.modifiedToughness).toBe(4);
    expect(result.modifiers).toEqual([]);
  });

  it('applies a single equipment modifier', () => {
    const creature = makeRowCard();
    const sword = makeEquipment('eq-1', 'Equipped creature gets +2/+2.');
    const result = calculateEffectiveStats(creature, [sword]);
    expect(result.modifiedPower).toBe(5);
    expect(result.modifiedToughness).toBe(6);
    expect(result.modifiers).toHaveLength(1);
    expect(result.modifiers[0]).toEqual({ power: 2, toughness: 2, source: 'eq-1' });
  });

  it('applies multiple equipment modifiers', () => {
    const creature = makeRowCard();
    const sword = makeEquipment('eq-1', 'Equipped creature gets +2/+2.');
    const boots = makeEquipment('eq-2', 'Equipped creature gets +1/+0.');
    const result = calculateEffectiveStats(creature, [sword, boots]);
    expect(result.modifiedPower).toBe(6);
    expect(result.modifiedToughness).toBe(6);
    expect(result.modifiers).toHaveLength(2);
  });

  it('handles equipment with no stat modifiers', () => {
    const creature = makeRowCard();
    const cloak = makeEquipment('eq-3', 'Equipped creature has hexproof.');
    const result = calculateEffectiveStats(creature, [cloak]);
    expect(result.modifiedPower).toBe(3);
    expect(result.modifiedToughness).toBe(4);
    expect(result.modifiers).toEqual([]);
  });

  it('sums multiple modifiers from a single equipment', () => {
    const creature = makeRowCard();
    const complex = makeEquipment('eq-4', 'Equipped creature gets +1/+1 and gets +2/+0.');
    const result = calculateEffectiveStats(creature, [complex]);
    expect(result.modifiedPower).toBe(6);
    expect(result.modifiedToughness).toBe(5);
    expect(result.modifiers[0]).toEqual({ power: 3, toughness: 1, source: 'eq-4' });
  });
});
