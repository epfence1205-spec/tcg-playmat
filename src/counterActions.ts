import type { GameState, CounterType, Counter } from './types';
import { updateBattlefieldCard } from './gameActions';

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Updates a RowCard's counters array anywhere on the battlefield.
 * Searches creature area rows, row3, and row4 for the card by instanceId,
 * then applies the updater function to its counters.
 * Returns the original state if the card is not found.
 */
function updateCardCounters(
  state: GameState,
  cardId: string,
  updater: (counters: Counter[]) => Counter[]
): GameState {
  return updateBattlefieldCard(state, cardId, rc => ({ ...rc, counters: updater(rc.counters) }));
}

// ─── Counter Actions ─────────────────────────────────────────────────────────

/**
 * Adds a counter of the specified type to a card on the battlefield.
 * If the card already has a counter of that type, increments its value by 1.
 * If not, adds a new Counter with value 1.
 * Returns the original state if the card is not found on the battlefield.
 *
 * Requirements: 17.1, 17.2, 17.3
 */
export function addCounter(
  state: GameState,
  cardId: string,
  counterType: CounterType
): GameState {
  return updateCardCounters(state, cardId, (counters) => {
    const existing = counters.find(c => c.type === counterType);
    if (existing) {
      return counters.map(c =>
        c.type === counterType ? { ...c, value: c.value + 1 } : c
      );
    }
    return [...counters, { type: counterType, value: 1 }];
  });
}

/**
 * Removes a counter of the specified type from a card on the battlefield.
 * If the counter value is > 1, decrements by 1.
 * If the counter value would become 0, removes the counter entirely.
 * If no counter of that type exists, this is a no-op.
 * Returns the original state if the card is not found on the battlefield.
 *
 * Requirements: 17.3
 */
export function removeCounter(
  state: GameState,
  cardId: string,
  counterType: CounterType
): GameState {
  return updateCardCounters(state, cardId, (counters) => {
    const existing = counters.find(c => c.type === counterType);
    if (!existing) return counters;

    if (existing.value > 1) {
      return counters.map(c =>
        c.type === counterType ? { ...c, value: c.value - 1 } : c
      );
    }

    // Value would become 0 — remove the counter entirely
    return counters.filter(c => c.type !== counterType);
  });
}

/**
 * Sets a custom counter on a card on the battlefield.
 * Uses the 'custom' counter type with the given value.
 * If value is 0, removes the counter.
 * The `name` parameter is stored conceptually but the Counter interface
 * uses type: 'custom' — the name is for UI display purposes.
 *
 * Requirements: 17.5, 17.6
 */
export function setCustomCounter(
  state: GameState,
  cardId: string,
  _name: string,
  value: number
): GameState {
  return updateCardCounters(state, cardId, (counters) => {
    if (value === 0) {
      // Remove the custom counter
      return counters.filter(c => c.type !== 'custom');
    }

    const existing = counters.find(c => c.type === 'custom');
    if (existing) {
      return counters.map(c =>
        c.type === 'custom' ? { ...c, value } : c
      );
    }

    return [...counters, { type: 'custom' as CounterType, value }];
  });
}
