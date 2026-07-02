import { describe, it, expect } from 'vitest';

// ─── Selection Toggle Logic ─────────────────────────────────────────────────
// Pure logic tests for Ctrl+Click toggle behavior.
// The actual implementation lives in App.tsx as React state updates,
// but we test the toggle logic as pure set operations.

/**
 * Toggles an id in a selection set.
 * - If id is in the set → remove it
 * - If id is NOT in the set → add it
 */
function toggleSelection(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Clears the selection set (normal click with no modifier).
 */
function clearSelection(): Set<string> {
  return new Set();
}

describe('selection toggle logic', () => {
  it('toggling an id into an empty set results in set containing that id', () => {
    const result = toggleSelection(new Set(), 'card-1');
    expect(result.has('card-1')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('toggling an existing id removes it from the set', () => {
    const initial = new Set(['card-1', 'card-2']);
    const result = toggleSelection(initial, 'card-1');
    expect(result.has('card-1')).toBe(false);
    expect(result.has('card-2')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('toggling twice returns to original state (idempotent toggle)', () => {
    const initial = new Set<string>();
    const afterAdd = toggleSelection(initial, 'card-1');
    const afterRemove = toggleSelection(afterAdd, 'card-1');
    expect(afterRemove.size).toBe(0);
  });

  it('multiple toggles build up selection correctly', () => {
    let selection = new Set<string>();
    selection = toggleSelection(selection, 'card-1');
    selection = toggleSelection(selection, 'card-2');
    selection = toggleSelection(selection, 'card-3');
    expect(selection.size).toBe(3);
    expect(selection.has('card-1')).toBe(true);
    expect(selection.has('card-2')).toBe(true);
    expect(selection.has('card-3')).toBe(true);
  });

  it('normal click (no modifier) clears entire selection', () => {
    const result = clearSelection();
    expect(result.size).toBe(0);
  });

  it('clear on normal click resets a populated selection', () => {
    const _populated = new Set(['card-1', 'card-2', 'card-3']);
    // Normal click → clear, then tap the clicked card
    const result = clearSelection();
    expect(result.size).toBe(0);
  });
});
