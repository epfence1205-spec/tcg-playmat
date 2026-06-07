/**
 * Land Categorizer
 *
 * Classifies lands into recognized Scryfall/EDHRec categories using oracle text,
 * type line, produced mana, and card name heuristics.
 *
 * All 23 Scryfall `is:` land categories are covered via pure-function pattern matching.
 * No API calls at runtime — all classification is deterministic and side-effect-free.
 */

export type LandCategory =
  | 'basic'
  | 'dual'
  | 'shockland'
  | 'fetchland'
  | 'checkland'
  | 'tangoland'
  | 'fastland'
  | 'slowland'
  | 'bondland'
  | 'painland'
  | 'filterland'
  | 'bounceland'
  | 'canopyland'
  | 'shadowland'
  | 'scryland'
  | 'gainland'
  | 'surveilland'
  | 'storageland'
  | 'bikeland'
  | 'tricycleland'
  | 'triland'
  | 'creatureland'
  | 'pathway'
  | 'rainbow'
  | 'utility'
  | 'unknown';

const BASIC_LAND_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
const BASIC_SUBTYPES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

/**
 * Counts how many basic land subtypes appear in a type line.
 */
function countBasicSubtypes(typeLine: string): number {
  const lower = typeLine.toLowerCase();
  return BASIC_SUBTYPES.filter(s => lower.includes(s.toLowerCase())).length;
}

/**
 * Classifies a land card into a recognized category.
 *
 * Pure function — no side effects, no network calls.
 * Evaluated in priority order; first match wins.
 */
export function classifyLand(
  oracleText: string,
  typeLine: string,
  producedMana: string[],
  name: string
): LandCategory {
  // Guard: insufficient data
  if (!oracleText && !typeLine) return 'unknown';

  const oracle = (oracleText || '').toLowerCase();
  const type = (typeLine || '').toLowerCase();
  const cardName = (name || '');

  // --- Basic ---
  // Type line contains "Basic" and name is one of the five basic land names
  if (type.includes('basic') && BASIC_LAND_NAMES.some(b => cardName === b || cardName.startsWith(b))) {
    return 'basic';
  }

  // --- Dual (ABUR duals) ---
  // Type line has exactly 2 basic subtypes, no oracle text (or only mana abilities)
  // These have NO enters-tapped clause and no other abilities
  if (countBasicSubtypes(typeLine) === 2 && oracle.trim() === '') {
    return 'dual';
  }

  // --- Shockland ---
  // "pay 2 life" + type line has 2 basic subtypes + produces exactly 2 colors
  if (
    oracle.includes('pay 2 life') &&
    countBasicSubtypes(typeLine) === 2 &&
    producedMana.length === 2
  ) {
    return 'shockland';
  }

  // --- Fetchland ---
  // "search your library" + "sacrifice" (in oracle text)
  if (oracle.includes('search your library') && oracle.includes('sacrifice')) {
    return 'fetchland';
  }

  // --- Checkland ---
  // "unless you control a" followed by a basic land type + produces exactly 2 colors
  if (oracle.includes('unless you control a') &&
    BASIC_SUBTYPES.some(s => oracle.includes(s.toLowerCase())) &&
    producedMana.length === 2) {
    return 'checkland';
  }

  // --- Tangoland (Battleland) ---
  // Exact: "enters tapped unless you control two or more basic lands"
  if (oracle.includes('enters tapped unless you control two or more basic lands')) {
    return 'tangoland';
  }

  // --- Fastland ---
  // "enters tapped unless you control two or fewer other lands"
  if (oracle.includes('enters tapped unless you control two or fewer other lands')) {
    return 'fastland';
  }

  // --- Slowland ---
  // "enters tapped unless you control two or more other lands"
  if (oracle.includes('enters tapped unless you control two or more other lands')) {
    return 'slowland';
  }

  // --- Bondland ---
  // "enters tapped unless you have two or more opponents"
  if (oracle.includes('enters tapped unless you have two or more opponents')) {
    return 'bondland';
  }

  // --- Canopyland (Horizon land) ---
  // "pay 1 life" in mana ability + "sacrifice this land: draw a card"
  if (oracle.includes('pay 1 life') && oracle.includes('sacrifice this land: draw a card')) {
    return 'canopyland';
  }

  // --- Shadowland (Reveal land / Snarl) ---
  // "you may reveal a" + "from your hand. if you don't, this land enters tapped"
  if (oracle.includes('you may reveal a') && oracle.includes("from your hand. if you don't, this land enters tapped")) {
    return 'shadowland';
  }

  // --- Painland ---
  // "deals 1 damage to you" + produces C + 2 WUBRG colors (length 3)
  if (oracle.includes('deals 1 damage to you') && producedMana.length === 3) {
    return 'painland';
  }

  // --- Bounceland ---
  // "return a land" or "return a basic land" as ETB
  if (oracle.includes('return a land') || oracle.includes('return a basic land')) {
    return 'bounceland';
  }

  // --- Scryland ---
  // "enters tapped" + "scry 1"
  if (oracle.includes('enters tapped') && oracle.includes('scry 1')) {
    return 'scryland';
  }

  // --- Surveilland ---
  // "enters tapped" + "surveil 1"
  if (oracle.includes('enters tapped') && oracle.includes('surveil 1')) {
    return 'surveilland';
  }

  // --- Gainland ---
  // "enters tapped" + "gain 1 life"
  if (oracle.includes('enters tapped') && oracle.includes('gain 1 life')) {
    return 'gainland';
  }

  // --- Storageland ---
  // "storage counter"
  if (oracle.includes('storage counter')) {
    return 'storageland';
  }

  // --- Tricycleland (Triome) ---
  // Type line has 3 basic subtypes + "cycling" in oracle text
  if (countBasicSubtypes(typeLine) >= 3 && oracle.includes('cycling')) {
    return 'tricycleland';
  }

  // --- Bikeland (Cycling dual) ---
  // Type line has basic subtypes + "cycling" in oracle text (but not triome — caught above)
  if (countBasicSubtypes(typeLine) >= 1 && oracle.includes('cycling')) {
    return 'bikeland';
  }

  // --- Filterland ---
  // Shadowmoor cycle: hybrid mana pattern {X/Y}, {T}: Add
  const hybridFilter = /\{.\/.}, \{t\}: add/i;
  if (hybridFilter.test(oracleText || '')) {
    return 'filterland';
  }
  // Odyssey-style: "{1}, {T}: Add" followed by exactly two mana symbols
  if (/\{1\}, \{t\}: add \{[wubrgc]\}\{[wubrgc]\}/i.test(oracleText || '')) {
    return 'filterland';
  }

  // --- Creatureland (Manland) ---
  // "becomes a" + "creature" + "it's still a land"
  if (oracle.includes('becomes a') && oracle.includes('creature') && oracle.includes("it's still a land")) {
    return 'creatureland';
  }

  // --- Pathway ---
  // Card name contains "Pathway" (all 10 pathway MDFCs)
  if (cardName.includes('Pathway')) {
    return 'pathway';
  }

  // --- Triland ---
  // Produces 3+ colors, enters tapped, no cycling (already caught above)
  if (oracle.includes('enters tapped') && producedMana.length >= 3 && !oracle.includes('cycling')) {
    return 'triland';
  }

  // --- Rainbow ---
  // "one mana of any color" in oracle text
  if (oracle.includes('one mana of any color')) {
    return 'rainbow';
  }

  // --- Utility (catch-all for evaluated lands that match nothing) ---
  return 'utility';
}
