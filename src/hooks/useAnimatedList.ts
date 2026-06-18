import { useState, useEffect, useRef } from 'react';

/**
 * Tracks items with exit animations. When an item is removed from the source list,
 * it remains in the output list with `isLeaving: true` for the specified duration,
 * allowing a CSS transition to animate it out before removal.
 */
export function useAnimatedList<T extends { instanceId: string }>(
  items: T[],
  exitDurationMs: number = 200
): Array<T & { isLeaving: boolean }> {
  const prevItemsRef = useRef<T[]>(items);
  const [leavingItems, setLeavingItems] = useState<Map<string, T>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const currentIds = new Set(items.map(i => i.instanceId));

    // Find removed items
    for (const prev of prevItemsRef.current) {
      if (!currentIds.has(prev.instanceId) && !leavingItems.has(prev.instanceId)) {
        setLeavingItems(m => new Map(m).set(prev.instanceId, prev));
        const timer = setTimeout(() => {
          timersRef.current.delete(prev.instanceId);
          setLeavingItems(m => { const n = new Map(m); n.delete(prev.instanceId); return n; });
        }, exitDurationMs);
        timersRef.current.set(prev.instanceId, timer);
      }
    }

    prevItemsRef.current = items;
  }, [items, exitDurationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build output: current items + leaving items at their original positions
  const result: Array<T & { isLeaving: boolean }> = items.map(i => ({ ...i, isLeaving: false }));

  // Insert leaving items (they appear as collapsing placeholders)
  for (const [, item] of leavingItems) {
    if (!items.some(i => i.instanceId === item.instanceId)) {
      result.push({ ...item, isLeaving: true });
    }
  }

  return result;
}
