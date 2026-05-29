import type { KeywordAbility, RowCard, EffectiveStats, StatModifier } from './types';

/**
 * Regex patterns for detecting keyword abilities in oracle text.
 * Each pattern uses word boundaries and case-insensitive matching.
 */
export const KEYWORD_PATTERNS: Record<KeywordAbility, RegExp> = {
  flying: /\bflying\b/i,
  trample: /\btrample\b/i,
  haste: /\bhaste\b/i,
  vigilance: /\bvigilance\b/i,
  lifelink: /\blifelink\b/i,
  deathtouch: /\bdeathtouch\b/i,
  hexproof: /\bhexproof\b/i,
  indestructible: /\bindestructible\b/i,
  menace: /\bmenace\b/i,
  reach: /\breach\b/i,
  first_strike: /\bfirst strike\b/i,
  double_strike: /\bdouble strike\b/i,
  flash: /\bflash\b/i,
  defender: /\bdefender\b/i,
  ward: /\bward\b/i,
  shroud: /\bshroud\b/i,
  protection: /\bprotection\b/i,
};

/**
 * Parses oracle text for recognized keyword abilities.
 * Returns an array of matched KeywordAbility values.
 */
export function parseKeywords(oracleText: string): KeywordAbility[] {
  const found: KeywordAbility[] = [];
  for (const [keyword, pattern] of Object.entries(KEYWORD_PATTERNS)) {
    if (pattern.test(oracleText)) {
      found.push(keyword as KeywordAbility);
    }
  }
  return found;
}

/**
 * Regex for extracting stat modifiers from equipment/aura oracle text.
 * Matches patterns like "gets +2/+2" or "has -1/-1".
 * Uses the global and case-insensitive flags for matchAll usage.
 */
export const STAT_MODIFIER_PATTERN = /(?:gets?|has|have)\s+([+-]\d+)\/([+-]\d+)/gi;

/**
 * Parses power and toughness from a creature's type line or basePower/baseToughness fields.
 * Handles formats like "Creature — Human Wizard 3/4" or standalone "3/4".
 * Returns [0, 0] for non-numeric or missing stats (e.g., "*" power).
 */
export function parseCreatureStats(
  typeLine: string,
  basePower?: string | null,
  baseToughness?: string | null
): [number, number] {
  // Prefer explicit basePower/baseToughness if provided and numeric
  if (basePower != null && baseToughness != null) {
    const p = parseInt(basePower, 10);
    const t = parseInt(baseToughness, 10);
    if (!isNaN(p) && !isNaN(t)) {
      return [p, t];
    }
  }

  // Fall back to parsing from type line (e.g., "Creature — Human Wizard 3/4")
  const match = typeLine.match(/(\d+)\s*\/\s*(\d+)\s*$/);
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10)];
  }

  return [0, 0];
}

/**
 * Calculates effective stats for a creature considering all attached equipment/auras.
 * Parses each attachment's oracle text for stat modifier patterns and sums them.
 */
export function calculateEffectiveStats(
  creature: RowCard,
  attachments: RowCard[]
): EffectiveStats {
  const [basePower, baseToughness] = parseCreatureStats(
    creature.card.typeLine,
    creature.card.basePower,
    creature.card.baseToughness
  );
  const modifiers: StatModifier[] = [];

  for (const equip of attachments) {
    // Reset lastIndex for global regex before matchAll
    const matches = [...equip.card.oracleText.matchAll(STAT_MODIFIER_PATTERN)];
    let power = 0;
    let toughness = 0;
    for (const match of matches) {
      power += parseInt(match[1], 10);
      toughness += parseInt(match[2], 10);
    }
    if (power !== 0 || toughness !== 0) {
      modifiers.push({ power, toughness, source: equip.card.id });
    }
  }

  return {
    basePower,
    baseToughness,
    modifiedPower: basePower + modifiers.reduce((s, m) => s + m.power, 0),
    modifiedToughness: baseToughness + modifiers.reduce((s, m) => s + m.toughness, 0),
    modifiers,
  };
}
