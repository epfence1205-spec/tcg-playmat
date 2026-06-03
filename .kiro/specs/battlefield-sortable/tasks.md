# Implementation Plan: Battlefield Sortable

## Overview

Add drag-to-reorder within battlefield rows using `@dnd-kit/sortable`. A thin `SortableCardWrapper` wraps existing components. Equipment cards stay independently draggable. handleDragEnd routes by priority.

## Tasks

- [ ] 1. Create SortableCardWrapper component
  - [ ] 1.1 Create `src/components/SortableCardWrapper.tsx`
    - Calls `useSortable({ id, data: { cardId, cardName, sourceZone: 'battlefield', cardType, rowId } })`
    - Outer div: `ref={setNodeRef}`, spreads `{...attributes, ...listeners}`
    - Applies `transform: CSS.Transform.toString(transform)`, `transition`
    - `opacity: isDragging ? 0.3 : 1`
    - Width: `isTapped ? '16vh' : \`${11.43 + attachmentCount * 2}vh\``
    - Height: `16vh`, `flex-shrink: 0`
    - Merges incoming `style` prop (for compression margins)
    - Renders `children` inside
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [ ] 1.2 Write unit test for SortableCardWrapper
    - Test width = 16vh when tapped
    - Test width = 11.43vh with 0 attachments untapped
    - Test width = 15.43vh with 2 attachments untapped
    - Test opacity = 0.3 when isDragging
    - Test style prop merges (compression margin passthrough)
    - _Requirements: 1.5, 8.2_

- [ ] 2. Wire SortableContext into RowTrack
  - [ ] 2.1 Add SortableContext to creature RowTrack in Battlefield.tsx
    - Import `SortableContext`, `horizontalListSortingStrategy` from `@dnd-kit/sortable`
    - Wrap element rendering in `<SortableContext items={instanceIds} strategy={horizontalListSortingStrategy}>`
    - Keep existing `useDroppable` on the row container (cross-zone drops still work)
    - _Requirements: 1.4, 8.5_

  - [ ] 2.2 Replace bare CreatureOuterDiv with SortableCardWrapper > CreatureOuterDiv
    - Each `CreatureOuterDiv` gets wrapped: `<SortableCardWrapper id={el.instanceId} ...><CreatureOuterDiv .../></SortableCardWrapper>`
    - Pass compression margin via `style` prop on wrapper
    - Pass `isCompressed` to CreatureOuterDiv as before
    - _Requirements: 1.1, 1.3, 8.2, 8.3_

- [ ] 3. Wire SortableContext into SplitRowTrack
  - [ ] 3.1 Add SortableContext to left and right sections of SplitRowTrack
    - Each side gets own `<SortableContext items={ids} strategy={horizontalListSortingStrategy}>`
    - Keep existing `useDroppable` on each side container
    - _Requirements: 2.1, 2.2_

  - [ ] 3.2 Wrap DroppableCardSlot with SortableCardWrapper
    - Same pattern: `<SortableCardWrapper ...><DroppableCardSlot .../></SortableCardWrapper>`
    - Pass overlap margins via `style` prop
    - Preserve same-name land aggressive overlap logic
    - _Requirements: 2.1, 2.3_

- [ ] 4. Update DragOverlay for equipped creatures
  - [ ] 4.1 Enhance DragOverlay rendering in App.tsx
    - When active drag card is a battlefield creature with attachments → render full `CreatureOuterDiv` in DragOverlay
    - When active drag card is an attached equipment → render just the equipment card image
    - When active drag card is unequipped → render simple card image (existing)
    - _Requirements: 1.6, 8.4_

- [ ] 5. Update handleDragEnd routing
  - [ ] 5.1 Add attached-equipment-drag detection (Priority 1)
    - Check if active card exists in any creature's attachments array
    - If dropped on different creature → re-equip (detach from source, attach to target)
    - If dropped on battlefield row → detach to standalone in that row
    - If dropped on hand/graveyard/exile → detach + move to zone
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ] 5.2 Add same-row reorder logic (Priority 3)
    - Detect: both active and over have `sourceZone: 'battlefield'` and same `rowId` and different `id`
    - Find old/new indices in the row's elements array
    - Guard: if either `findIndex` returns -1, return early (no-op)
    - Call `arrayMove(elements, oldIndex, newIndex)` and update state
    - _Requirements: 4.1, 4.8, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [ ] 5.3 Add cross-row move logic (Priority 4)
    - Detect: both active and over are battlefield sortables but different `rowId`
    - Remove card from source row, insert at over position in target row
    - Update card's `rowAssignment`
    - _Requirements: 4.4_

  - [x] 5.4 Ensure existing equipment docking still works (Priority 2)
    - Existing logic: active is unattached equipment/aura, over is a creature droppable → attach
    - Verify this still triggers correctly with sortable wrappers present
    - _Requirements: 4.2, 8.5_

  - [x] 5.5 Ensure cross-zone moves still work (Priority 5)
    - Existing logic: hand → battlefield, battlefield → zone drops
    - Verify no regression from sortable wrappers
    - _Requirements: 4.3, 8.5_

- [ ] 6. Add reorder action to useGameState
  - [ ] 6.1 Create `reorderWithinRow` action
    - Takes `rowId: RowTarget` and `oldIndex: number, newIndex: number`
    - Applies `arrayMove` to the specified row's elements
    - Goes through `setGameStateWithHistory` so it recalculates creature rows and supports undo
    - _Requirements: 5.1, 5.3, 6.1_

  - [ ] 6.2 Create helper functions `getRowCards` and `setRowCards`
    - `getRowCards(state, rowId)` → returns the RowCard[] for any RowTarget
    - `setRowCards(state, rowId, cards)` → returns new state with that row updated
    - Used by reorder, cross-row move, and equipment detach logic
    - _Requirements: 4.1, 4.4_

- [ ] 7. Verify equipment drag isolation
  - [x] 7.1 Confirm equipment stopPropagation prevents sortable capture
    - Equipment cards in CreatureOuterDiv already have `onPointerDown={stopPropagation}`
    - Verify: dragging equipment does NOT trigger parent SortableCardWrapper
    - Verify: equipment still triggers its own `useDraggable` independently
    - _Requirements: 3.1_

  - [x] 7.2 Confirm Alt+click fan-out works through sortable wrapper
    - Alt+click on the outer div should not be captured by sortable listeners
    - Fan-out panel should open/close as before
    - _Requirements: 8.7_

- [ ] 8. Verify existing functionality preservation
  - [x] 8.1 Verify tap toggle works on sortable-wrapped cards
    - Click on card → tap state toggles (not consumed by sortable activation)
    - `useSortable` uses activation distance/delay to distinguish click from drag
    - Verified: AppShell.tsx PointerSensor has `activationConstraint: { distance: 5 }`
    - _Requirements: 8.1_

  - [x] 8.2 Verify hand independence
    - HandTray's own SortableContext is unaffected by battlefield sortable
    - Hand reorder and hand→battlefield drag still work
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 8.3 Verify row splitting/merging still works
    - Adding/removing creatures still triggers recalculateCreatureRows with real container width
    - Split/merge is unaffected by sortable wrappers
    - _Requirements: 8.6_

- [x] 9. Property tests
  - [x] 9.1 Card count invariant (Property 1)
    - Generate random state, perform arrayMove reorder, assert card count unchanged
    - _Requirements: 5.1, 5.4_

  - [x] 9.2 No duplicate instance IDs (Property 2)
    - After reorder/detach/re-equip, collect all IDs, assert no duplicates
    - _Requirements: 5.2, 5.5_

  - [x] 9.3 Attachment preservation during reorder (Property 3)
    - Reorder card with attachments, deep-compare attachments before/after
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.4 Null drop no-op (Property 6)
    - Simulate handleDragEnd with over=null, assert state unchanged
    - _Requirements: 3.5, 4.7_

## Notes

- `@dnd-kit/sortable` is already a dependency (used by HandTray)
- `arrayMove` is exported from `@dnd-kit/sortable` — no new utility needed
- The activation constraint (distance or delay) should match what HandTray uses to distinguish click from drag
- Compression margins are applied to `SortableCardWrapper` via style prop — no CSS changes inside CreatureOuterDiv
- `useSortable` internally composes `useDraggable` + `useDroppable` — the wrapper's `useDroppable` for the row container is separate and coexists

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "6.2"] },
    { "id": 1, "tasks": ["1.2", "6.1"] },
    { "id": 2, "tasks": ["2.1", "2.2", "3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["5.4", "5.5", "7.1", "7.2"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4"] }
  ]
}
```
