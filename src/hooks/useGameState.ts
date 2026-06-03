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
import { reorderWithinRow as reorderWithinRowAction } from '../sortableHelpers';
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
   * Always recalculates creature rows with the current container width.
   * Skips history during MULLIGAN phase (no undo during setup).
   */
  // Ref to track current creature area container width in px (updated by Battlefield via ResizeObserver)
  const containerWidthPxRef = useRef<number>(0);
  const setCreatureAreaContainerWidthPx = useCallback((widthPx: number) => {
    const changed = widthPx !== containerWidthPxRef.current;
    containerWidthPxRef.current = widthPx;
    // When width changes (e.g. first report from ResizeObserver), recalculate rows
    if (changed) {
      setState((prev) => {
        const recalculated = recalculateCreatureRows(
          prev.creatureArea,
          widthPx,
          window.innerHeight / 100,
          4
        );
        if (recalculated !== prev.creatureArea) {
          return { ...prev, creatureArea: recalculated };
        }
        return prev;
      });
    }
  }, []);

  const setGameStateWithHistory = useCallback(
    (updater: GameState | ((prev: GameState) => GameState)) => {
      setState((prev) => {
        let next = typeof updater === 'function' ? updater(prev) : updater;
        // Always recalculate creature rows with real container width
        if (containerWidthPxRef.current > 0) {
          const recalculated = recalculateCreatureRows(
            next.creatureArea,
            containerWidthPxRef.current,
            window.innerHeight / 100,
            4
          );
          if (recalculated !== next.creatureArea) {
            next = { ...next, creatureArea: recalculated };
          }
        }
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
        const recalculated = recalculateCreatureRows(
          next.creatureArea,
          containerWidthPxRef.current,
          window.innerHeight / 100,
          4
        );
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
    setGameStateWithHistory((prev) => drawCardAction(prev));
  }, [setGameStateWithHistory]);

  const shuffleLibrary = useCallback(() => {
    setGameStateWithHistory((prev) => shuffleLibraryAction(prev));
  }, [setGameStateWithHistory]);

  const softReset = useCallback(() => {
    setGameStateWithHistory((prev) => softResetAction(prev));
  }, [setGameStateWithHistory]);

  const tapCard = useCallback((cardId: string) => {
    setGameStateWithHistory((prev) => tapCardAction(prev, cardId));
  }, [setGameStateWithHistory]);

  const flipCard = useCallback((cardId: string, zone: Zone) => {
    setGameStateWithHistory((prev) => flipCardAction(prev, cardId, zone));
  }, [setGameStateWithHistory]);

  const transformDFC = useCallback((cardId: string) => {
    setGameStateWithHistory((prev) => transformDFCAction(prev, cardId));
  }, [setGameStateWithHistory]);

  const untapAll = useCallback(() => {
    setGameStateWithHistory((prev) => untapAllAction(prev));
  }, [setGameStateWithHistory]);

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

  // ─── Sortable Actions ─────────────────────────────────────────────────────

  const reorderInRow = useCallback(
    (rowId: RowTarget, oldIndex: number, newIndex: number) => {
      setGameStateWithHistory((prev) => reorderWithinRowAction(prev, rowId, oldIndex, newIndex));
    },
    [setGameStateWithHistory]
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

    // Sortable actions
    reorderInRow,

    // Counter actions
    addCounter,
    removeCounter,
    setCustomCounter,

    // Computed values
    deliriumCount,
    isGameInProgress,

    // Container width setter for width-based row splitting
    setCreatureAreaContainerWidthPx,
  };
}
