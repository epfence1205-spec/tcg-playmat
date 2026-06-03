import type { GameState, CounterType, Counter } from './types';

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
  // Search creature area rows
  for (let i = 0; i < state.creatureArea.rows.length; i++) {
    const row = state.creatureArea.rows[i];
    const idx = row.elements.findIndex(rc => rc.instanceId === cardId);
    if (idx !== -1) {
      const newElements = row.elements.map(rc =>
        rc.instanceId === cardId
          ? { ...rc, counters: updater(rc.counters) }
          : rc
      );
      const newRows = state.creatureArea.rows.map((r, ri) =>
        ri === i ? { ...r, elements: newElements } : r
      );
      return { ...state, creatureArea: { ...state.creatureArea, rows: newRows } };
    }
  }

  // Search row3 left
  if (state.row3.left.some(rc => rc.instanceId === cardId)) {
    const newLeft = state.row3.left.map(rc =>
      rc.instanceId === cardId
        ? { ...rc, counters: updater(rc.counters) }
        : rc
    );
    return { ...state, row3: { ...state.row3, left: newLeft } };
  }

  // Search row3 right
  if (state.row3.right.some(rc => rc.instanceId === cardId)) {
    const newRight = state.row3.right.map(rc =>
      rc.instanceId === cardId
        ? { ...rc, counters: updater(rc.counters) }
        : rc
    );
    return { ...state, row3: { ...state.row3, right: newRight } };
  }

  // Search row4 left
  if (state.row4.left.some(rc => rc.instanceId === cardId)) {
    const newLeft = state.row4.left.map(rc =>
      rc.instanceId === cardId
        ? { ...rc, counters: updater(rc.counters) }
        : rc
    );
    return { ...state, row4: { ...state.row4, left: newLeft } };
  }

  // Search row4 right
  if (state.row4.right.some(rc => rc.instanceId === cardId)) {
    const newRight = state.row4.right.map(rc =>
      rc.instanceId === cardId
        ? { ...rc, counters: updater(rc.counters) }
        : rc
    );
    return { ...state, row4: { ...state.row4, right: newRight } };
  }

  // Card not found on battlefield — no-op
  return state;
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
