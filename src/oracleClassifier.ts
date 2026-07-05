/**
 * Oracle Text Classifier — Two-Phase Equipment/Aura Effect Parser
 *
 * Phase 1: CLASSIFY each line of oracle text by its template type.
 * Phase 2: EXTRACT stat bonuses only from STATIC_BONUS lines.
 *
 * This replaces the single-regex STAT_MODIFIER_PATTERN approach which
 * false-positives on variable, triggered, and token effects.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type AbilityLineType =
  | 'STATIC_BONUS'    // "Equipped creature gets +2/+2."
  | 'STATIC_KEYWORD'  // "Equipped creature has flying."
  | 'VARIABLE_BONUS'  // "...gets +X/+Y for each..."
  | 'TRIGGERED'       // "Whenever.../At the beginning..."
  | 'ACTIVATED'       // "COST: Effect"
  | 'TOKEN_EFFECT'    // "...create a token... That token gains..."
  | 'OTHER';          // Anything else

export interface StatBonus {
  power: number;
  toughness: number;
}

export interface GrantedKeyword {
  keyword: string;
}

export interface ClassifiedLine {
  type: AbilityLineType;
  raw: string;
  statBonus: StatBonus | null;
  grantedKeywords: string[];
}

// ─── Phase 1: Classification ─────────────────────────────────────────────────

/**
 * Classifies a single line of oracle text into its template type.
 * Uses string methods (startsWith, includes) for classification,
 * NOT regex for the decision logic.
 */
export function classifyLine(line: string): AbilityLineType {
  const lower = line.toLowerCase().trim();

  if (!lower) return 'OTHER';

  // Activated abilities: contain a colon with a cost before it
  // Pattern: "{T}:" or "{2}:" or "Pay 2 life:" etc.
  if (lower.includes(': ') && (lower.includes('{') || lower.match(/^\w.*:/))) {
    // But not if it starts with "Equipped creature" (that's just a label-like start)
    if (!lower.startsWith('equipped') && !lower.startsWith('enchanted')) {
      return 'ACTIVATED';
    }
  }

  // Triggered abilities
  if (lower.startsWith('whenever') || lower.startsWith('at the beginning') || lower.startsWith('when ')) {
    return 'TRIGGERED';
  }

  // Token effects — lines referencing token creation or token gains
  if (lower.includes('that token') || lower.includes('the token') ||
      lower.includes('those tokens') || lower.includes('create a token')) {
    return 'TOKEN_EFFECT';
  }

  // Variable bonus — contains "for each", "equal to", "where x"
  if (lower.includes('for each') || lower.includes('equal to') || lower.includes('where x')) {
    return 'VARIABLE_BONUS';
  }

  // "Until end of turn" within a static-looking line = it's actually temporary
  if (lower.includes('until end of turn')) {
    return 'TRIGGERED'; // Treat as triggered/temporary
  }

  // Static bonus: "Equipped/Enchanted creature gets +X/+Y"
  if ((lower.startsWith('equipped creature gets') || lower.startsWith('enchanted creature gets')) &&
      lower.match(/[+-]\d+\/[+-]\d+/)) {
    return 'STATIC_BONUS';
  }

  // Static keyword: "Equipped/Enchanted creature has KEYWORD"
  if ((lower.startsWith('equipped creature has') || lower.startsWith('enchanted creature has') ||
       lower.startsWith('equipped creature gains') || lower.startsWith('enchanted creature gains'))) {
    return 'STATIC_KEYWORD';
  }

  return 'OTHER';
}

// ─── Phase 2: Extraction ─────────────────────────────────────────────────────

/** Tiny regex ONLY for pulling numbers from already-classified STATIC_BONUS lines. */
const STAT_EXTRACT = /([+-]\d+)\/([+-]\d+)/g;

/**
 * Extracts the stat bonus from a STATIC_BONUS classified line.
 * Handles multiple stat patterns in a single line (e.g., "gets +1/+1 and gets +2/+0").
 * Returns null if no valid pattern found.
 */
export function extractStatBonus(line: string): StatBonus | null {
  const matches = [...line.matchAll(STAT_EXTRACT)];
  if (matches.length === 0) return null;
  let power = 0;
  let toughness = 0;
  for (const match of matches) {
    power += parseInt(match[1], 10);
    toughness += parseInt(match[2], 10);
  }
  return { power, toughness };
}

/** Known keyword ability names for extraction */
const KNOWN_KEYWORDS = [
  'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
  'hexproof', 'indestructible', 'menace', 'reach', 'first strike',
  'double strike', 'flash', 'defender', 'ward', 'shroud', 'protection',
];

/**
 * Extracts granted keywords from a STATIC_KEYWORD or STATIC_BONUS line.
 * Looks for "and has KEYWORD" or "has KEYWORD" patterns.
 */
export function extractGrantedKeywords(line: string): string[] {
  const lower = line.toLowerCase();
  const found: string[] = [];
  for (const kw of KNOWN_KEYWORDS) {
    if (lower.includes(kw)) {
      found.push(kw);
    }
  }
  return found;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Classifies all lines of an oracle text and extracts relevant data.
 * This is the main entry point replacing the old STAT_MODIFIER_PATTERN approach.
 */
export function classifyOracleText(oracleText: string): ClassifiedLine[] {
  const lines = oracleText.split('\n').filter(l => l.trim().length > 0);
  return lines.map(line => {
    const type = classifyLine(line);
    let statBonus: StatBonus | null = null;
    let grantedKeywords: string[] = [];

    if (type === 'STATIC_BONUS') {
      statBonus = extractStatBonus(line);
      grantedKeywords = extractGrantedKeywords(line);
    } else if (type === 'STATIC_KEYWORD') {
      grantedKeywords = extractGrantedKeywords(line);
    }

    return { type, raw: line, statBonus, grantedKeywords };
  });
}

/**
 * Computes total equipment stat bonus from oracle text.
 * Only sums bonuses from STATIC_BONUS classified lines.
 * Returns { power: 0, toughness: 0 } for complex/variable/triggered effects.
 */
export function computeEquipmentBonus(oracleText: string): StatBonus {
  const classified = classifyOracleText(oracleText);
  let power = 0;
  let toughness = 0;

  for (const line of classified) {
    if (line.type === 'STATIC_BONUS' && line.statBonus) {
      power += line.statBonus.power;
      toughness += line.statBonus.toughness;
    }
  }

  return { power, toughness };
}

/**
 * Extracts keywords that the equipment/aura STATICALLY grants to the creature.
 * Excludes keywords from triggered abilities, token effects, or activated abilities.
 */
export function computeGrantedKeywords(oracleText: string): string[] {
  const classified = classifyOracleText(oracleText);
  const keywords: string[] = [];

  for (const line of classified) {
    if (line.type === 'STATIC_BONUS' || line.type === 'STATIC_KEYWORD') {
      for (const kw of line.grantedKeywords) {
        if (!keywords.includes(kw)) keywords.push(kw);
      }
    }
  }

  return keywords;
}
