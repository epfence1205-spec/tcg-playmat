# Requirements Document

## Introduction

This document defines the requirements for the Battlefield Sortable feature. The feature adds drag-to-reorder within battlefield rows using `@dnd-kit/sortable`, enables equipment detach via drag, and preserves all existing interactions (tap, compression, cross-zone drag, equipment docking).

## Glossary

- **CreatureOuterDiv**: The unified component for creature-row cards. Renders the equipment cascade, card art, overlays, and rotation as a single unit. Already handles tap rotation, compression labels, and Alt+click fan-out.
- **DroppableCardSlot**: The component used in SplitRowTrack (rows 4/5) for lands, artifacts, and enchantments. Handles tap rotation and attachment rendering via EquipmentDock.
- **EquipmentDock**: A layout component that renders equipment cascade behind a creature with rotation, fan-out, and modified P/T overlay.
- **DraggableCard**: The card visual component. Supports `disableDrag` prop to skip `useDraggable` activation.
- **SortableContext**: A `@dnd-kit/sortable` context wrapper enabling drag-to-reorder for items within it.
- **RowTrack**: The creature-area row component in Battlefield.tsx. Currently uses `useDroppable` for cross-zone drops and renders `CreatureOuterDiv` instances.
- **SplitRowTrack**: The row component for rows 4/5 (lands/artifacts/enchantments). Uses `DroppableCardSlot`.
- **handleDragEnd**: The central drag-end handler in App.tsx that routes drag operations.
- **RowCard**: The data model for a battlefield card (attachments, counters, tap state, position).
- **GameState**: The complete game state across all zones.
- **Card_Count**: Total unique card instances across all zones.

## Requirements

### Requirement 1: Sortable Creature Row Cards

**User Story:** As a player, I want to drag cards to reorder them within a creature row with smooth shift-aside animations.

#### Acceptance Criteria

1. Each `CreatureOuterDiv` in a RowTrack SHALL be wrapped with `useSortable` using `instanceId` as the sortable ID.
2. The sortable data payload SHALL include `cardId`, `cardName`, `sourceZone: 'battlefield'`, `cardType`, and `rowId`.
3. WHEN a CreatureOuterDiv is the active drag item, it SHALL set opacity to 0.3.
4. WHEN a drag is in progress within the same row, neighboring cards SHALL shift aside via `horizontalListSortingStrategy`.
5. The sortable wrapper SHALL resize its width when a card is tapped/untapped: untapped = `11.43 + N*2` vh, tapped = `16` vh (card height becomes horizontal footprint), so that shift-aside animations account for the correct space.
6. WHEN a creature with attachments is dragged, the DragOverlay SHALL render the entire CreatureOuterDiv (equipment cascade + card art + overlays) so that attachments move with the card live during drag, not after drop.

### Requirement 2: Sortable Land/Artifact/Enchantment Rows

**User Story:** As a player, I want to reorder cards within the land and artifact/enchantment rows too.

#### Acceptance Criteria

1. Each `DroppableCardSlot` in a SplitRowTrack SHALL be wrapped with `useSortable` using `instanceId` as the sortable ID.
2. The same shift-aside animation SHALL apply to SplitRowTrack rows.
3. Same-name land overlap (aggressive overlap for basics) SHALL be preserved during and after reorder.

### Requirement 3: Equipment Detach via Drag

**User Story:** As a player, I want to drag equipment off a creature to unequip it naturally.

#### Acceptance Criteria

1. Equipment cards rendered inside CreatureOuterDiv's cascade SHALL remain independently draggable (NOT disabled by sortable wrapper).
2. WHEN an attached equipment is dragged to a battlefield row, it SHALL be detached and placed as a standalone card in that row.
3. WHEN an attached equipment is dragged to graveyard, exile, or hand, it SHALL be detached and moved to that zone.
4. WHEN an attached equipment is dropped on a different creature, it SHALL be detached from the current creature and immediately attached to the target.
5. IF an equipment drag ends with no valid target, it SHALL snap back with no state change.

### Requirement 4: handleDragEnd Routing

**User Story:** As a player, I want drag operations correctly routed (reorder, equip, detach, cross-zone) so my intent is respected.

#### Acceptance Criteria

1. Same-row reorder: active and over are both sortables in the same row with different IDs → `arrayMove` reorder.
2. Equipment docking: active is an unattached equipment/aura, over target is a creature → attach.
3. Cross-zone move: active source zone differs from over target zone → move card between zones.
4. Cross-row move: active and over are sortables in different battlefield rows → move card to new row at the over position.
5. Equipment detach to row: active is an attached equipment, over is a row → detach and place standalone.
6. Equipment re-equip: active is an attached equipment, over is a different creature → detach and re-attach.
7. No valid target: drag ends with null over → no state change, snap back.
8. Invalid index: if `findIndex` returns -1, return early with no state change.

### Requirement 5: Card Count Invariant

**User Story:** As a player, I want to never lose or duplicate cards during any drag operation.

#### Acceptance Criteria

1. After any reorder, Card_Count SHALL be unchanged.
2. After any reorder, no duplicate `instanceId` values SHALL exist across all zones.
3. After any reorder, the row SHALL have the same element count.
4. After any equipment detach/re-equip, Card_Count SHALL be unchanged.
5. After equipment detach, the equipment SHALL appear exactly once in its new location and zero times in the old creature's attachments.

### Requirement 6: Attachment Preservation During Reorder

**User Story:** As a player, I want equipment to stay with its creature when I reorder.

#### Acceptance Criteria

1. Reordering a card with attachments SHALL preserve its `attachments` array unchanged.
2. Reordering SHALL not modify any properties of attached cards.
3. Other cards' attachments in the same row SHALL be unaffected.

### Requirement 7: Hand Independence

**User Story:** As a player, I want hand drag-to-reorder to work independently of battlefield sortable.

#### Acceptance Criteria

1. HandTray SHALL keep its own SortableContext independent of battlefield.
2. Battlefield reorder SHALL not affect hand state.
3. Hand card drag SHALL not interfere with battlefield sortable items.

### Requirement 8: Existing Functionality Preservation

**User Story:** As a player, I want all existing interactions to keep working after adding sortable.

#### Acceptance Criteria

1. Click on battlefield card SHALL still toggle tap state.
2. Row compression (negative margins) SHALL continue working when cards overflow.
3. Compression labels (NamePTBanner) SHALL still appear when compressed.
4. DragOverlay SHALL continue rendering card image following cursor during drag.
5. Cross-zone drag (hand → battlefield) SHALL still auto-assign row based on cardType.
6. Row splitting/merging based on container width SHALL be unaffected.
7. Alt+click fan-out on CreatureOuterDiv SHALL continue working.
8. Ctrl+click fan-out on EquipmentDock (in SplitRowTrack) SHALL continue working.
