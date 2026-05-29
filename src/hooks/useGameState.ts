import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { GameState, CardData, Zone, RowTarget, CounterType } from '../types';
import {
  drawCard as drawCardAction,
  shuffleLibrary as shuffleLibraryAction,
  softReset as softResetAction,
  tapCard as tapCardAction,
  flipCard as flipCardAction,
  transformDFC as transformDFCAction,
  untapAll as untapAllAction,
  moveCard as moveCardAction,
  addToBattlefield as addToBattlefieldAction,
  isGameInProgress as isGameInProgressFn,
} from '../gameActions';
import {
  initializeMulligan as initializeMulliganAction,
  mulliganAgain as mulliganAgainAction,
  confirmKeep as confirmKeepAction,
  togglePutBack as togglePutBackAction,
} from '../mulliganEngine';
import {
  attachEquipment as attachEquipmentAction,
  detachEquipment as detachEquipmentAction,
} from '../equipmentActions';
import {
  addCounter as addCounterAction,
  removeCounter as removeCounterAction,
  setCustomCounter as setCustomCounterAction,
} from '../counterActions';
import { recalculateCreatureRows } from '../creatureRows';
import { loadGameState, saveGameState, setQuotaExceededHandler } from '../persistence';
import { calculateDelirium } from '../components/PublicStack';

/**
 * Custom hook that manages the complete game state with all action functions.
 * Persists state to localStorage via debounced writes (100ms).
 * Recalculates creature rows on every battlefield mutation.
 * Computes delirium count from graveyard on every state change.
 *
 * Requirements: 23.3, 5.2, 9.8, 13.4, 17.6
 *
 * @param onQuotaExceeded - Optional callback invoked when localStorage quota is exceeded
 */
export function useGameState(onQuotaExceeded?: () => void) {
  const [state, setState] = useState<GameState>(() => {
    const loaded = loadGameState();
    // Fix inconsistent state: MULLIGAN phase but no mulliganState
    if (loaded.gamePhase === 'MULLIGAN' && !loaded.mulliganState) {
      if (loaded.library.length > 0) {
        return initializeMulliganAction(loaded);
      }
      // No library cards — just switch to PLAYING
      return { ...loaded, gamePhase: 'PLAYING' };
    }
    return loaded;
  });

  // ─── Undo History ─────────────────────────────────────────────────────────

  const MAX_HISTORY = 50;
  const historyRef = useRef<GameState[]>([]);

  /**
   * Wraps setState to push the current state onto the undo stack before mutating.
   * Skips history during MULLIGAN phase (no undo during setup).
   */
  const setGameStateWithHistory = useCallback(
    (updater: GameState | ((prev: GameState) => GameState)) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        // Don't record history during mulligan or if state didn't change
        if (prev.gamePhase === 'PLAYING' && next.gamePhase === 'PLAYING' && next !== prev) {
          historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), prev];
        }
        return next;
      });
    },
    []
  );

  /**
   * Undo: pops the last state from history and restores it.
   * Returns true if undo was performed, false if history is empty.
   */
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return false;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setState(previous);
    return true;
  }, []);

  // Register the quota exceeded handler
  useEffect(() => {
    setQuotaExceededHandler(onQuotaExceeded ?? null);
    return () => setQuotaExceededHandler(null);
  }, [onQuotaExceeded]);

  // Persist state on every change (debounce is built into saveGameState)
  useEffect(() => {
    saveGameState(state);
  }, [state]);

  // ─── Helper: apply state update with creature row recalculation ──────────

  /**
   * Wraps a state transformation that mutates the battlefield,
   * ensuring creature rows are recalculated after the mutation.
   */
  const updateWithCreatureRecalc = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setGameStateWithHistory((prev) => {
        const next = updater(prev);
        const recalculated = recalculateCreatureRows(next.creatureArea);
        if (recalculated !== next.creatureArea) {
          return { ...next, creatureArea: recalculated };
        }
        return next;
      });
    },
    [setGameStateWithHistory]
  );

  // ─── Core Game Actions ───────────────────────────────────────────────────

  const drawCard = useCallback(() => {
    setState((prev) => drawCardAction(prev));
  }, []);

  const shuffleLibrary = useCallback(() => {
    setState((prev) => shuffleLibraryAction(prev));
  }, []);

  const softReset = useCallback(() => {
    setState((prev) => softResetAction(prev));
  }, []);

  const tapCard = useCallback((cardId: string) => {
    setState((prev) => tapCardAction(prev, cardId));
  }, []);

  const flipCard = useCallback((cardId: string, zone: Zone) => {
    setState((prev) => flipCardAction(prev, cardId, zone));
  }, []);

  const transformDFC = useCallback((cardId: string) => {
    setState((prev) => transformDFCAction(prev, cardId));
  }, []);

  const untapAll = useCallback(() => {
    setState((prev) => untapAllAction(prev));
  }, []);

  // ─── Movement Actions (battlefield mutations → recalculate rows) ─────────

  const moveCard = useCallback(
    (cardId: string, from: Zone, to: Zone, targetRow?: RowTarget) => {
      updateWithCreatureRecalc((prev) => moveCardAction(prev, cardId, from, to, targetRow));
    },
    [updateWithCreatureRecalc]
  );

  const addToBattlefield = useCallback(
    (card: CardData, targetRow?: RowTarget) => {
      updateWithCreatureRecalc((prev) => addToBattlefieldAction(prev, card, targetRow));
    },
    [updateWithCreatureRecalc]
  );

  // ─── Mulligan Actions ────────────────────────────────────────────────────

  const initializeMulligan = useCallback(() => {
    setState((prev) => initializeMulliganAction(prev));
  }, []);

  const mulliganAgain = useCallback(() => {
    setState((prev) => mulliganAgainAction(prev));
  }, []);

  const confirmKeep = useCallback(() => {
    setState((prev) => confirmKeepAction(prev));
  }, []);

  const togglePutBack = useCallback((cardId: string) => {
    setState((prev) => togglePutBackAction(prev, cardId));
  }, []);

  // ─── Equipment Actions (battlefield mutations → recalculate rows) ────────

  const attachEquipment = useCallback(
    (equipmentId: string, creatureId: string) => {
      updateWithCreatureRecalc((prev) => attachEquipmentAction(prev, equipmentId, creatureId));
    },
    [updateWithCreatureRecalc]
  );

  const detachEquipment = useCallback(
    (equipmentId: string, creatureId: string) => {
      updateWithCreatureRecalc((prev) => detachEquipmentAction(prev, equipmentId, creatureId));
    },
    [updateWithCreatureRecalc]
  );

  // ─── Counter Actions ─────────────────────────────────────────────────────

  const addCounter = useCallback((cardId: string, counterType: CounterType) => {
    setState((prev) => addCounterAction(prev, cardId, counterType));
  }, []);

  const removeCounter = useCallback((cardId: string, counterType: CounterType) => {
    setState((prev) => removeCounterAction(prev, cardId, counterType));
  }, []);

  const setCustomCounter = useCallback((cardId: string, name: string, value: number) => {
    setState((prev) => setCustomCounterAction(prev, cardId, name, value));
  }, []);

  // ─── Computed Values ─────────────────────────────────────────────────────

  const deliriumCount = useMemo(() => calculateDelirium(state.graveyard), [state.graveyard]);

  const isGameInProgress = useMemo(() => isGameInProgressFn(state), [state]);

  // ─── Return ──────────────────────────────────────────────────────────────

  return {
    state,
    setState: setGameStateWithHistory,

    // Undo
    undo,

    // Core actions
    drawCard,
    shuffleLibrary,
    softReset,
    tapCard,
    flipCard,
    transformDFC,
    untapAll,

    // Movement actions
    moveCard,
    addToBattlefield,

    // Mulligan actions
    initializeMulligan,
    mulliganAgain,
    confirmKeep,
    togglePutBack,

    // Equipment actions
    attachEquipment,
    detachEquipment,

    // Counter actions
    addCounter,
    removeCounter,
    setCustomCounter,

    // Computed values
    deliriumCount,
    isGameInProgress,
  };
}
