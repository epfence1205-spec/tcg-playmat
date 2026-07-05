import type { KeywordAbility, RowCard, EffectiveStats, StatModifier } from './types';
import { computeEquipmentBonus } from './oracleClassifier';

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
 * Uses the two-phase oracle classifier: classifies each line of oracle text,
 * then extracts stat bonuses only from STATIC_BONUS lines.
 * Variable, triggered, and token effects correctly return 0.
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
    const bonus = computeEquipmentBonus(equip.card.oracleText);
    if (bonus.power !== 0 || bonus.toughness !== 0) {
      modifiers.push({ power: bonus.power, toughness: bonus.toughness, source: equip.card.id });
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
