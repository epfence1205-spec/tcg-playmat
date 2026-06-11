import type { LandCategory } from './api/landCategorizer';

/**
 * Zone identifiers for all card locations in the game.
 */
export type Zone = 'hand' | 'battlefield' | 'commandZone' | 'graveyard' | 'library' | 'exile';

/**
 * Stack zone identifiers for Zone B sidebar.
 */
export type StackZone = 'commandZone' | 'graveyard' | 'library' | 'exile';

// ─── Card Type System ────────────────────────────────────────────────────────

/**
 * Discriminated card type derived from typeLine for row assignment logic.
 */
export type CardType =
  | 'creature'
  | 'land'
  | 'artifact'
  | 'enchantment'
  | 'planeswalker'
  | 'instant'
  | 'sorcery'
  | 'battle'
  | 'other';

/**
 * Recognized keyword abilities parsed from oracle text on import.
 */
export type KeywordAbility =
  | 'flying'
  | 'trample'
  | 'haste'
  | 'vigilance'
  | 'lifelink'
  | 'deathtouch'
  | 'hexproof'
  | 'indestructible'
  | 'menace'
  | 'reach'
  | 'first_strike'
  | 'double_strike'
  | 'flash'
  | 'defender'
  | 'ward'
  | 'shroud'
  | 'protection';

// ─── Core Card Data ──────────────────────────────────────────────────────────

/**
 * Core card data resolved from Scryfall API.
 * Each instance has a unique ID even if the same card appears multiple times.
 */
export interface CardData {
  /** Unique instance ID (UUID v4) */
  id: string;
  /** Card name as returned by Scryfall */
  name: string;
  /** Set code (lowercase, 3-5 characters) */
  setCode: string;
  /** Collector number within the set */
  collectorNumber: string;
  /** Front face image URL (Scryfall CDN, normal size) */
  imageURI: string;
  /** High-res image for HD Zoom Portal (Scryfall CDN, large size) */
  imageURILarge: string;
  /** Back face image for double-faced cards, null otherwise */
  backFaceImageURI: string | null;
  /** Back face card type for DFCs (e.g., 'land' for MDFC lands), null for non-DFCs */
  backFaceCardType: CardType | null;
  /** Back face name for DFCs, null for non-DFCs */
  backFaceName: string | null;
  /** Back face power for DFC creatures, null for non-DFCs or non-creatures */
  backFacePower: string | null;
  /** Back face toughness for DFC creatures, null for non-DFCs or non-creatures */
  backFaceToughness: string | null;
  /** Full type line (e.g. "Creature — Human Wizard") */
  typeLine: string;
  /** Oracle text (may be empty for lands/tokens) */
  oracleText: string;
  /** True if this card is designated as a commander */
  isCommander: boolean;
  /** Parsed keyword abilities from oracle text */
  keywords: KeywordAbility[];
  /** Base power for creatures (e.g. "3" or "*"), null for non-creatures */
  basePower: string | null;
  /** Base toughness for creatures (e.g. "4" or "*"), null for non-creatures */
  baseToughness: string | null;
  /** Derived from typeLine for row assignment logic */
  cardType: CardType;
  /** Converted mana cost (mana value) */
  cmc: number;
  /** Mana cost string (e.g., "{2}{B}{B}") */
  manaCost: string;
  /** Color identity for commander validation */
  colorIdentity: string[];
  /** Colors of mana this card can produce (lands) */
  producedMana: string[];
  /** Land classification category, null for non-land cards */
  landCategory: LandCategory | null;
  /** True if this card is a token (created via Token Panel or token copy) */
  isToken: boolean;
  /** True if this card is a token copy of a non-token card (triggers TOKEN badge) */
  isTokenCopy: boolean;
}

// ─── Battlefield Row System ──────────────────────────────────────────────────

/**
 * Target row identifiers for card placement on the battlefield.
 */
export type RowTarget =
  | 'creature-1'
  | 'creature-2'
  | 'creature-3'
  | 'row3-lands'
  | 'row3-artifacts'
  | 'row4-lands'
  | 'row4-enchantments'
  | 'pw-battle-column';

/**
 * Game phase controlling UI rendering and available actions.
 */
export type GamePhase = 'MULLIGAN' | 'PLAYING';

// ─── Counter System ──────────────────────────────────────────────────────────

/**
 * All supported counter types for battlefield cards.
 */
export type CounterType =
  | '+1/+1'
  | '-1/-1'
  | 'lifelink'
  | 'hexproof'
  | 'indestructible'
  | 'shroud'
  | 'time'
  | 'charge'
  | 'generic'
  | 'loyalty'
  | 'flying'
  | 'deathtouch'
  | 'menace'
  | 'trample'
  | 'first_strike'
  | 'double_strike'
  | 'reach'
  | 'vigilance'
  | 'token'
  | 'lore'
  | 'shield'
  | 'haste'
  | 'custom';

/**
 * A counter placed on a battlefield card.
 */
export interface Counter {
  type: CounterType;
  value: number;
}

// ─── Attachment System ───────────────────────────────────────────────────────

/**
 * An equipment or aura docked to a creature.
 */
export interface Attachment {
  card: CardData;
  instanceId: string;
  /** Inherits tap state from parent creature */
  isTapped: boolean;
}

// ─── Stat Calculation ────────────────────────────────────────────────────────

/**
 * A single stat modifier from a docked equipment/aura.
 */
export interface StatModifier {
  power: number;
  toughness: number;
  /** Equipment card ID that provides this modifier */
  source: string;
}

/**
 * Calculated effective stats for a creature with equipment.
 */
export interface EffectiveStats {
  basePower: number;
  baseToughness: number;
  modifiedPower: number;
  modifiedToughness: number;
  modifiers: StatModifier[];
}

// ─── Battlefield Card ────────────────────────────────────────────────────────

/**
 * A card placed on the battlefield within a row track.
 * Replaces the old BattlefieldCard + GridPosition model.
 */
export interface RowCard {
  /** The underlying card data */
  card: CardData;
  /** Same as card.id — unique instance identifier */
  instanceId: string;
  /** Which row this card is assigned to */
  rowAssignment: RowTarget;
  /** Order within the row (left-to-right, 0-indexed) */
  positionIndex: number;
  /** Whether the card is tapped (rotated 90°) */
  isTapped: boolean;
  /** Whether the card is face-down (showing generic card back) */
  isFaceDown: boolean;
  /** For DFCs: true shows back face, false shows front face */
  showingBackFace: boolean;
  /** Whether the card is phased out (dimmed visually) */
  isPhased: boolean;
  /** Equipment/Auras docked to this card */
  attachments: Attachment[];
  /** Counters placed on this card */
  counters: Counter[];
  /** Whether this card is revealed (spacebar toggle for hand cards) */
  isRevealed: boolean;
}

// ─── Creature Area ───────────────────────────────────────────────────────────

/**
 * A single creature row within the creature area.
 */
export interface CreatureRow {
  /** Row identifier: 'creature-1', 'creature-2', or 'creature-3' */
  id: string;
  /** Cards in this row */
  elements: RowCard[];
}

/**
 * The creature area containing 1-3 dynamic rows.
 * Occupies 3/5 of the battlefield height.
 */
export interface CreatureArea {
  /** 1-3 rows, dynamically managed based on element count */
  rows: CreatureRow[];
  /** Cached count for split decisions (unique card names = independent elements) */
  totalElementCount: number;
}

// ─── Split Row ───────────────────────────────────────────────────────────────

/**
 * A row divided into left and right sections that grow toward center.
 * Used for Row 3 (lands + artifacts) and Row 4 (lands + enchantments).
 */
export interface SplitRow {
  /** Left side — lands building left-to-right */
  left: RowCard[];
  /** Right side — artifacts (Row 3) or enchantments (Row 4) building right-to-left */
  right: RowCard[];
}

// ─── Mulligan State ──────────────────────────────────────────────────────────

/**
 * State tracking for the mulligan engine.
 * Null when not in MULLIGAN phase.
 */
export interface MulliganState {
  /** Number of times the player has mulliganed */
  mulliganCount: number;
  /** Cards drawn for the current mulligan hand */
  drawnCards: CardData[];
  /** Card IDs selected to put back on bottom of library */
  selectedToPutBack: Set<string>;
  /** Required number of cards to put back: max(0, mulliganCount - 1) — first is free */
  requiredPutBacks: number;
}

// ─── Exile ───────────────────────────────────────────────────────────────────

/**
 * A card in the exile zone, which may be face-down.
 */
export interface ExileCard {
  /** The underlying card data */
  card: CardData;
  /** Whether the card is face-down in exile */
  isFaceDown: boolean;
}

// ─── Fan Group ───────────────────────────────────────────────────────────────

/**
 * Layout data for a group of same-name cards fanned with 95% overlap.
 */
export interface FanGroup {
  /** Card name shared by all cards in this group */
  name: string;
  /** Cards in the fanned group */
  cards: RowCard[];
  /** X position where this group starts (px) */
  startX: number;
  /** Total width of the fanned group (px) */
  totalWidth: number;
  /** Base z-index for this group (increments per card) */
  zIndexBase: number;
}

// ─── HD Zoom Portal ──────────────────────────────────────────────────────────

/**
 * Props for the HD Zoom Portal component (high-res card preview in Zone C).
 */
export interface HDZoomPortalProps {
  /** Card to display, or null when nothing is hovered */
  card: CardData | null;
  /** Parsed keyword abilities for badge display */
  keywords: KeywordAbility[];
  /** Counters on the hovered card */
  counters: Counter[];
  /** Cards attached to the hovered card */
  attachments: CardData[];
}

// ─── Game State ──────────────────────────────────────────────────────────────

/**
 * Complete game state representing all zones and their contents.
 * Replaces the old GameState with continuous-flow battlefield architecture.
 */
export interface GameState {
  /** Current game phase (MULLIGAN or PLAYING) */
  gamePhase: GamePhase;

  // Battlefield — continuous flow rows
  /** Creature area with 1-3 dynamic rows (3/5 of battlefield height) */
  creatureArea: CreatureArea;
  /** Row 3: basic/mana-only lands (left) + artifacts (right) */
  row3: SplitRow;
  /** Row 4: utility lands (left) + enchantments (right) */
  row4: SplitRow;

  // Off-battlefield zones
  /** Cards in the player's hand (hidden from OBS in Zone C) */
  hand: CardData[];
  /** Commander cards in the command zone */
  commandZone: CardData[];
  /** Cards in the graveyard (top card visible) */
  graveyard: CardData[];
  /** Cards in the library (face-down stack) */
  library: CardData[];
  /** Cards in exile (may be face-down) */
  exile: ExileCard[];

  /** Mulligan state (null when not in MULLIGAN phase) */
  mulliganState: MulliganState | null;

  // Metadata
  /** True after first successful deck import */
  deckLoaded: boolean;
  /** Player life total (Commander: 40) */
  lifeTotal: number;
  /** Current turn number (starts at 0, increments on Next Turn) */
  turnCount: number;
}

// ─── Drag State ──────────────────────────────────────────────────────────────

/**
 * Tracks the current drag-and-drop operation state.
 */
export interface DragState {
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** ID of the card being dragged, or null */
  cardId: string | null;
  /** Zone the card is being dragged from, or null */
  sourceZone: Zone | null;
  /** Current cursor position during drag, or null */
  currentPosition: { x: number; y: number } | null;
}
