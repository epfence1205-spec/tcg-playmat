# Battlefield Sortable + Unified Card Slot — Design Brief

## Problem Statement

The battlefield currently has two conflicting architectures:
1. `DraggableCard` owns `useDraggable` (the card art is the drag source)
2. `DroppableCardSlot` owns `useDroppable` (the outer div is the drop target for equipment)
3. Equipped and non-equipped creatures have completely different DOM structures
4. `@dnd-kit/sortable` cannot be layered on top because it conflicts with the inner `useDraggable`

This prevents:
- Drag-to-reorder within rows (cards don't shift aside)
- Unified rotation (banners/equipment don't rotate as one unit for equipped creatures)
- Clean z-index management (banners clip under neighbors)

## Solution: Unified Card Slot with Outer Sortable

### Target DOM Structure (single path for ALL battlefield cards):

```
<BattlefieldCardSlot>  <- useSortable (drag source + drop target + sort animation)
|                         Also handles: equipment docking, tap z-index, opacity on drag
|                         Provides: transform, transition, listeners, attributes
|
+-- <RotatingUnit>     <- transform: rotate(90deg) when tapped, transition 200ms
    |                     Contains EVERYTHING that rotates together
    |
    +-- <EquipmentCascade>  <- Only renders if attachments.length > 0
    |   +-- Attachment cards (absolute positioned, cascade left, sideways name labels)
    |
    +-- <CardArt>      <- Pure visual component (NO useDraggable)
    |   +-- <img> with card image, token badge, phased overlay
    |
    +-- <CounterBadges> <- Absolute positioned on card art
    |
    +-- <NamePTBanner>  <- Left edge, vertical text, only when isCompressed
        +-- P/T (yellow, flexShrink: 0, uses effectiveStats if equipped, backFace if transformed)
        +-- Name (white, flexShrink: 1, truncates, DFC-aware)
```

### Key Changes:

1. **Kill `useDraggable` inside `DraggableCard` for battlefield cards**
   - Add `disableDrag?: boolean` prop to `DraggableCard`
   - On battlefield: `disableDrag={true}` -- it becomes a pure visual component
   - In hand/sidebar: `disableDrag={false}` (unchanged, hand uses its own `useSortable`)

2. **`BattlefieldCardSlot` uses `useSortable`**
   - ID: `el.instanceId`
   - Data: `{ cardId, cardName, sourceZone: 'battlefield', cardType }`
   - This provides: drag source, drop target (for sort), AND sort animation (shift-aside)
   - Equipment docking: check `overData.cardType === 'creature'` in `handleDragEnd`

3. **Remove `EquipmentDock` rotation logic**
   - `EquipmentDock` currently applies `transform: rotate(90deg)` internally
   - Move rotation to the `<RotatingUnit>` wrapper (parent of EquipmentDock)
   - `EquipmentDock` becomes a pure layout component (cascade + creature + badges)

4. **Single code path**
   - No more `if (hasAttachments) { ... } else { ... }` branching in the slot
   - Always render: RotatingUnit > (optional EquipmentCascade) + CardArt + Banner
   - Equipment cascade is conditionally rendered inside, not a separate branch

5. **`SortableContext` wraps each row**
   - `RowTrack` wraps its children in `<SortableContext items={ids} strategy={horizontalListSortingStrategy}>`
   - Each `BattlefieldCardSlot` is a sortable item
   - Cards shift aside during drag automatically

6. **`handleDragEnd` in App.tsx**
   - When `active.sourceZone === 'battlefield'` and `over` is another sortable in same row -> `arrayMove` reorder
   - When `over` is a different zone (graveyard, exile, hand, library) -> cross-zone move
   - When `over` is a creature and active is equipment/aura -> equipment docking
   - Auto-correct logic (creatures can't go to land rows, etc.) stays the same

### Constraints:
- Hand cards keep their own `useSortable` (already working with fan effect)
- Basic land auto-sort in SplitRowTrack is render-time only (doesn't affect state order)
- `pointerWithin` collision detection in AppShell stays (works with sortables)
- DragOverlay continues to show card image following cursor

### Files to Modify:
- `src/components/DraggableCard.tsx` -- add `disableDrag` prop
- `src/components/Battlefield.tsx` -- replace `DroppableCardSlot` with unified `BattlefieldCardSlot` using `useSortable`
- `src/components/EquipmentDock.tsx` -- remove internal rotation, become pure layout
- `src/App.tsx` -- update `handleDragEnd` to handle sortable reorder + equipment docking via sortable data
- `src/components/RowTrack.tsx` -- can be deleted (unused, Battlefield.tsx has its own RowTrack)

### Test Impact:
- Existing drag/drop tests should still pass (same state mutations, different trigger mechanism)
- New tests needed: reorder within row, reorder preserves equipment attachments
- Property test: card count invariant after reorder (no cards lost or duplicated)
