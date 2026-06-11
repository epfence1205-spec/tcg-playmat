import type { CardData, GameState, MulliganState, RowCard } from './types';

export const STORAGE_KEY = 'tcg-playmat-state';
const DEBOUNCE_MS = 100;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Callback invoked when localStorage quota is exceeded */
export type QuotaExceededCallback = () => void;

let onQuotaExceeded: QuotaExceededCallback | null = null;

/**
 * Registers a callback to be invoked when localStorage quota is exceeded.
 * Used by the toast system to show a warning.
 */
export function setQuotaExceededHandler(handler: QuotaExceededCallback | null): void {
  onQuotaExceeded = handler;
}

// ─── Serialization Helpers ───────────────────────────────────────────────────

/**
 * Serializable version of MulliganState where Set<string> is replaced with string[].
 */
interface SerializedMulliganState {
  mulliganCount: number;
  drawnCards: MulliganState['drawnCards'];
  selectedToPutBack: string[];
  requiredPutBacks: number;
}

/**
 * Serializable version of GameState for JSON storage.
 */
interface SerializedGameState extends Omit<GameState, 'mulliganState'> {
  mulliganState: SerializedMulliganState | null;
}

/**
 * Converts GameState to a JSON-serializable form.
 * Transforms Set<string> in mulliganState.selectedToPutBack to an array.
 */
function serializeState(state: GameState): SerializedGameState {
  return {
    ...state,
    mulliganState: state.mulliganState
      ? {
          ...state.mulliganState,
          selectedToPutBack: Array.from(state.mulliganState.selectedToPutBack),
        }
      : null,
  };
}

/**
 * Patches a deserialized CardData object to include missing fields
 * introduced in later versions. Defaults `landCategory` to `null`
 * when not present in persisted data (backward compatibility).
 */
export function patchCardData(card: CardData): CardData {
  return { ...card, landCategory: (card as Record<string, unknown>).landCategory ?? null };
}

/**
 * Patches a RowCard and all its attachments' CardData.
 */
function patchRowCard(rc: RowCard): RowCard {
  return {
    ...rc,
    card: patchCardData(rc.card),
    attachments: rc.attachments.map(att => ({
      ...att,
      card: patchCardData(att.card),
    })),
  };
}

/**
 * Converts a deserialized JSON object back to a proper GameState.
 * Transforms the selectedToPutBack array back into a Set<string>.
 * Patches all CardData to include fields added in later versions.
 */
function deserializeState(data: SerializedGameState): GameState {
  return {
    ...data,
    turnCount: (data as any).turnCount ?? 0,
    hand: data.hand.map(patchCardData),
    library: data.library.map(patchCardData),
    graveyard: data.graveyard.map(patchCardData),
    exile: data.exile.map(e => ({ ...e, card: patchCardData(e.card) })),
    commandZone: data.commandZone.map(patchCardData),
    creatureArea: {
      ...data.creatureArea,
      rows: data.creatureArea.rows.map(row => ({
        ...row,
        elements: row.elements.map(patchRowCard),
      })),
    },
    row3: {
      left: data.row3.left.map(patchRowCard),
      right: data.row3.right.map(patchRowCard),
    },
    row4: {
      left: data.row4.left.map(patchRowCard),
      right: data.row4.right.map(patchRowCard),
    },
    mulliganState: data.mulliganState
      ? {
          ...data.mulliganState,
          drawnCards: data.mulliganState.drawnCards.map(patchCardData),
          selectedToPutBack: new Set(data.mulliganState.selectedToPutBack),
        }
      : null,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates that a parsed object has the expected new GameState shape.
 * Checks required fields, types, and nested structures.
 */
function isValidSerializedGameState(data: unknown): data is SerializedGameState {
  if (data === null || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Check gamePhase
  if (obj.gamePhase !== 'MULLIGAN' && obj.gamePhase !== 'PLAYING') return false;

  // Check creatureArea structure
  if (obj.creatureArea === null || typeof obj.creatureArea !== 'object') return false;
  const creatureArea = obj.creatureArea as Record<string, unknown>;
  if (!Array.isArray(creatureArea.rows)) return false;
  if (typeof creatureArea.totalElementCount !== 'number') return false;

  // Check row3 and row4 (SplitRow)
  if (!isValidSplitRow(obj.row3)) return false;
  if (!isValidSplitRow(obj.row4)) return false;

  // Check off-battlefield zone arrays
  const requiredArrays = ['hand', 'commandZone', 'graveyard', 'library', 'exile'] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(obj[key])) return false;
  }

  // Check mulliganState (null or valid object)
  if (obj.mulliganState !== null) {
    if (typeof obj.mulliganState !== 'object') return false;
    const ms = obj.mulliganState as Record<string, unknown>;
    if (typeof ms.mulliganCount !== 'number') return false;
    if (!Array.isArray(ms.drawnCards)) return false;
    if (!Array.isArray(ms.selectedToPutBack)) return false;
    if (typeof ms.requiredPutBacks !== 'number') return false;
  }

  // Check metadata
  if (typeof obj.deckLoaded !== 'boolean') return false;
  if (typeof obj.lifeTotal !== 'number') return false;

  return true;
}

/**
 * Validates a SplitRow structure (left and right arrays).
 */
function isValidSplitRow(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return Array.isArray(row.left) && Array.isArray(row.right);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Creates a default empty GameState with all zones empty and default metadata.
 * Used as fallback when persisted state is corrupted or missing.
 */
export function createEmptyGameState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: false,
    lifeTotal: 40,
    turnCount: 0,
  };
}

/**
 * Persists the game state to localStorage with a 100ms debounce
 * to avoid excessive writes during rapid state changes.
 * Handles Set<string> → Array conversion for mulliganState.selectedToPutBack.
 * If QuotaExceededError occurs, invokes the registered handler
 * and the game continues in-memory without persistence.
 */
export function saveGameState(state: GameState): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      const serialized = serializeState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded — state not persisted');
        onQuotaExceeded?.();
      }
    }
  }, DEBOUNCE_MS);
}

/**
 * Loads persisted game state from localStorage.
 * Returns a default empty state if no data exists, JSON parsing fails,
 * or the data is corrupted/invalid.
 * Converts serialized selectedToPutBack array back to Set<string>.
 */
export function loadGameState(): GameState {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw === null) return createEmptyGameState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('Failed to parse persisted state — returning empty state');
    return createEmptyGameState();
  }

  if (!isValidSerializedGameState(parsed)) {
    console.warn('Persisted state failed validation (corrupted) — returning empty state');
    return createEmptyGameState();
  }

  return deserializeState(parsed);
}

// ─── Legacy API (backwards compatibility) ────────────────────────────────────

/**
 * @deprecated Use saveGameState instead. Kept for backwards compatibility.
 */
export const persistState = saveGameState;

/**
 * @deprecated Use loadGameState instead. Kept for backwards compatibility.
 */
export function loadPersistedState(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('Failed to parse persisted state — returning null');
    return null;
  }

  if (!isValidSerializedGameState(parsed)) {
    console.warn('Persisted state failed validation (corrupted) — returning null');
    return null;
  }

  return deserializeState(parsed);
}
