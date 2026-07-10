import { useEffect } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  pointerWithin,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';

interface AppShellProps {
  children?: React.ReactNode;
  /** Overlay content rendered inside DndContext but outside the grid (e.g., DragOverlay) */
  overlay?: React.ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
}

/**
 * AppShell — Root layout enforcing the three-zone nested CSS Grid.
 *
 * Layout: Nested CSS Grid
 * Outer grid: 2 rows
 *   Row 1: 83.33vh (upper region)
 *   Row 2: 16.67vh (Zone C — Hand Tray)
 *
 * Upper region inner grid: 2 columns
 *   Col 1: 1fr (Zone A — Battlefield)
 *   Col 2: ~10vw (Zone B — Sidebar, one card width, responsive)
 *
 * Zone C spans full width at bottom.
 *
 * OBS Crop Invariant:
 * The crop line sits at 83.33vh from the top.
 * Zone A and Zone B are confined to the upper region.
 * Zone C is entirely below the crop line and invisible to OBS.
 *
 * Provides:
 * - DndContext wrapper for cross-zone drag interactions
 * - Global keybind event listener (placeholder, wired in task 11.1)
 * - overflow: hidden on root to prevent scrollbars
 */
export function AppShell({ children, overlay, onDragStart, onDragOver, onDragEnd }: AppShellProps) {
  // Configure dnd-kit sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5, // 5px movement before drag starts
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  // Global keybind listener (placeholder — fully implemented in task 11.1)
  useEffect(() => {
    function handleKeyDown(_event: KeyboardEvent) {
      // Keybind routing will be implemented in task 11.1
      // This placeholder ensures the listener is mounted at root level
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    onDragEnd?.(event);
  };

  const handleDragStart = (event: DragStartEvent) => {
    onDragStart?.(event);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={(event) => onDragOver?.(event)}
      onDragEnd={handleDragEnd}
    >
      <div
        className="w-screen h-screen overflow-hidden grid"
        style={{
          gridTemplateRows: '80vh 20vh',
        }}
        role="application"
        aria-label="TCG Playmat"
      >
        {/* Upper region: Zone A (Battlefield) + Zone B (Sidebar) */}
        <div
          className="grid overflow-hidden"
          style={{
            gridTemplateColumns: '1fr calc(11.43vh + 16px)',
            gridTemplateRows: 'minmax(0, 1fr)',
            height: '80vh',
          }}
        >
          {/* Zone A and Zone B are rendered as children[0] and children[1] */}
          {Array.isArray(children) ? children[0] : children}
          {Array.isArray(children) ? children[1] : null}
        </div>

        {/* Zone C: Full-width bottom section for HandTray */}
        <div className="overflow-hidden w-full h-full relative z-[80]">
          {Array.isArray(children) ? children[2] : null}
        </div>
      </div>

      {/* Overlay content (DragOverlay, modals, etc.) rendered inside DndContext
          but outside the grid to avoid overflow:hidden clipping */}
      {overlay}
    </DndContext>
  );
}
