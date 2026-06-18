import type { GameState, GameLogEntry } from './types';

/** Maximum log entries to keep (prevents unbounded growth) */
const MAX_LOG_ENTRIES = 200;

/** Appends a log entry to the game state, capping at MAX_LOG_ENTRIES. */
export function logAction(state: GameState, message: string): GameState {
  const entry: GameLogEntry = {
    turn: state.turnCount,
    timestamp: Date.now(),
    message,
  };
  const gameLog = [...state.gameLog, entry].slice(-MAX_LOG_ENTRIES);
  return { ...state, gameLog };
}
