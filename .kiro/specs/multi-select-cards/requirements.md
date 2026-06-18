# Requirements Document

## Introduction

Multi-select cards enables the player to select multiple battlefield cards simultaneously and perform batch actions on the entire selection. This addresses common MTG gameplay patterns such as tapping all attackers, moving multiple permanents to the graveyard (board wipes), or untapping a subset of lands after combat. The feature must integrate with the existing SortableCardWrapper/RotationDiv architecture without breaking drag-and-drop or the single-click tap toggle.

## Glossary

- **Selection_Set**: The set of card instanceIds currently marked as selected by the player
- **Multi_Select_Mode**: The UI state where click behavior switches from tap-toggle to selection-toggle
- **Batch_Action**: A game action (tap, untap, move-to-zone, etc.) applied to all cards in the Selection_Set simultaneously
- **Selection_Indicator**: A visual border or overlay applied to a card to communicate its selected state
- **Modifier_Click**: A click combined with a held modifier key (Ctrl or Shift) that toggles selection
- **Battlefield**: Zone A — the public 83.33vh area containing all played permanents across row tracks
- **Selection_Toolbar**: A floating UI element that appears when the Selection_Set is non-empty, offering batch actions
- **Lasso_Rectangle**: A rectangular selection area drawn by the player via pointer-drag on empty battlefield space, used to select all cards whose bounding boxes intersect the rectangle
- **Selection_Overlay**: A floating badge displayed when the Selection_Set is non-empty, showing total selected count, combined power, and combined toughness of all creatures in the selection

## Requirements

### Requirement 1: Ctrl+Click Individual Card Selection

**User Story:** As a player, I want to Ctrl+Click individual cards on the battlefield to select non-adjacent cards, so that I can build an arbitrary selection of cards that are not necessarily side by side.

#### Acceptance Criteria

1. WHEN the player holds Ctrl and clicks a battlefield card, THE Selection_Set SHALL toggle that card's instanceId (add if absent, remove if present), allowing the player to pick non-adjacent cards across different rows
2. WHEN the player holds Ctrl and clicks a battlefield card, THE Battlefield SHALL NOT trigger the tap/untap toggle for that card
3. WHILE the Selection_Set contains one or more cards, THE Selection_Indicator SHALL be rendered on each selected card
4. WHEN the player clicks a battlefield card WITHOUT holding Ctrl or Shift, THE Selection_Set SHALL be cleared entirely before the normal tap action executes
5. THE Multi_Select_Mode SHALL be available exclusively for cards in the battlefield zone (not hand tray, not mulligan tray)
6. WHEN the player holds Ctrl and clicks multiple cards in sequence, THE Selection_Set SHALL accumulate all clicked cards regardless of their row position or adjacency to other selected cards

### Requirement 2: Selection Overlay and Visual Feedback

**User Story:** As a player, I want a clear visual overlay showing the number of selected cards and their combined power/toughness totals, so that I can quickly assess the strength of my selected group for combat math.

#### Acceptance Criteria

1. WHILE a card is in the Selection_Set, THE Selection_Indicator SHALL render a cyan-400 colored ring (Tailwind `ring-2 ring-cyan-400`) around the SortableCardWrapper of that card
2. WHILE a card is in the Selection_Set, THE Selection_Indicator SHALL remain visible regardless of whether the card is tapped or untapped
3. WHEN both the Selection_Indicator and mutate-targeting ring highlight (indigo ring-2) apply to the same card, THE mutate-targeting ring SHALL take visual precedence over the Selection_Indicator
4. WHILE the Selection_Set is non-empty, THE Selection_Overlay SHALL display a floating badge in the top-right of Zone A (within the 83.33vh public zone) showing three values: the total number of selected cards, the combined power total of all creatures in the Selection_Set, and the combined toughness total of all creatures in the Selection_Set
5. THE Selection_Overlay SHALL format its content as: "[count] selected · [totalPower]/[totalToughness]" where totalPower is the sum of displayed power values for all creature-type cards in the Selection_Set and totalToughness is the sum of displayed toughness values for all creature-type cards in the Selection_Set
6. WHEN the Selection_Set contains zero creature-type cards, THE Selection_Overlay SHALL display only the count (e.g., "3 selected") and omit the power/toughness portion
7. THE Selection_Overlay SHALL compute power and toughness using each creature's effective displayed stats (base stats plus counter modifiers, equipment bonuses, and powerModifier/toughnessModifier values)
8. THE Selection_Overlay SHALL not overlap existing HUD elements (Player Info at bottom-left) and SHALL render within Zone A boundaries
9. THE Selection_Indicator SHALL render as box-shadow or outline so it does not alter card layout dimensions or shift adjacent cards

### Requirement 3: Selection Toolbar with Batch Actions

**User Story:** As a player, I want a toolbar that appears when cards are selected, so that I can apply actions to all selected cards at once.

#### Acceptance Criteria

1. WHEN the Selection_Set transitions from empty to non-empty, THE Selection_Toolbar SHALL appear as a floating element within Zone A within 150ms of the state change
2. THE Selection_Toolbar SHALL provide the following batch action buttons: Tap All, Untap All, Move to Graveyard, Move to Exile, Move to Hand, Move to Top of Library
3. WHEN the player clicks a batch action button on the Selection_Toolbar, THE Batch_Action SHALL be applied to every card in the Selection_Set as a single state update (all cards processed before re-render)
4. WHEN a batch action completes, THE Selection_Set SHALL be cleared and THE Selection_Toolbar SHALL be hidden
5. WHEN the Selection_Set transitions from non-empty to empty, THE Selection_Toolbar SHALL be hidden within 150ms of the state change
6. THE Selection_Toolbar SHALL be positioned in Zone A such that its bounding box does not intersect the Player Info HUD element (absolute bottom-2 left-2) — the toolbar SHALL maintain a minimum 8px gap from the HUD
7. THE Selection_Toolbar SHALL render entirely within the upper 83.33vh public zone (visible to OBS) and SHALL NOT extend below the Zone A boundary
8. IF a batch action targets cards that are already in the desired state (e.g., Tap All on cards that are all already tapped), THEN THE Batch_Action SHALL still complete without error and THE Selection_Set SHALL be cleared

### Requirement 4: Clearing the Selection

**User Story:** As a player, I want intuitive ways to deselect all cards, so that I can exit multi-select mode quickly.

#### Acceptance Criteria

1. WHEN the player presses the Escape key while the Selection_Set is non-empty, THE Selection_Set SHALL be cleared and all visual selection indicators SHALL be removed
2. WHEN the player clicks on any area of the battlefield that is not occupied by a card element or fanned group, THE Selection_Set SHALL be cleared
3. WHEN the player performs a click without any modifier key held (Ctrl, Shift, Alt, or Meta) on any battlefield card while the Selection_Set is non-empty, THE Selection_Set SHALL be cleared before the tap action is executed on the clicked card
4. WHEN a soft reset is performed, THE Selection_Set SHALL be cleared as part of the state re-initialization

### Requirement 5: Interaction with Drag-and-Drop

**User Story:** As a player, I want multi-select to coexist with drag-and-drop reordering, so that neither feature breaks the other.

#### Acceptance Criteria

1. WHILE a card is in the Selection_Set, THE SortableCardWrapper SHALL continue to expose its useSortable drag listeners on that card's wrapper div, preserving drag initiation capability
2. WHEN the player initiates a drag on a selected card (pointer moves beyond the dnd-kit activation distance threshold), THE System SHALL clear the Selection_Set and proceed with normal single-card drag behavior (ghost overlay at 0.3 opacity, sortable displacement of adjacent cards)
3. THE Multi_Select_Mode SHALL NOT add any useDroppable or useDraggable hooks inside the SortableCardWrapper component tree
4. WHILE mutateTargeting.isActive is true, THE SortableCardWrapper SHALL suppress Modifier_Click selection behavior so that clicks on valid targets invoke onMutateTargetSelect instead of toggling selection
5. WHEN the player performs a Modifier_Click (Ctrl+Click) on a battlefield card that is not in the Selection_Set, IF mutateTargeting.isActive is false, THEN THE System SHALL add that card's instanceId to the Selection_Set without initiating a drag

### Requirement 6: Batch Action State Consistency

**User Story:** As a player, I want batch actions to produce correct game state, so that undo works and all zones update properly.

#### Acceptance Criteria

1. WHEN a move action is dispatched while 2 or more cards are selected, THE useGameState hook SHALL record exactly one undo checkpoint (the state immediately before the first card is processed) and then apply all individual card moves against the resulting state sequentially without recording additional checkpoints
2. WHEN a batch move action moves cards off the battlefield, THE game state SHALL detach equipment from each moved card by placing equipment cards back into the row3-artifacts zone and moving aura cards to the graveyard zone before removing the card from the battlefield
3. WHEN a batch move action moves a card with a non-empty mutateStack off the battlefield, THE game state SHALL separate the mutate stack so that each CardData entry (top card and all mutateStack entries) is individually routed to the destination zone, excluding tokens which are discarded
4. IF a batch action targets a card whose instanceId is no longer present on the battlefield (removed as a consequence of mutate separation or attachment detachment triggered by a prior card in the same batch), THEN THE batch action SHALL skip that card without throwing an error and continue processing remaining cards, leaving the game state consistent with all previously applied moves in the batch

### Requirement 7: Keyboard Shortcut for Select All

**User Story:** As a player, I want a keyboard shortcut to select all battlefield cards, so that I can quickly set up board-wide actions like "untap all creatures".

#### Acceptance Criteria

1. WHEN the player presses Ctrl+A while focus is not in a text input, THE Selection_Set SHALL contain the instanceIds of all RowCards across the creatureArea rows, row3 (left and right), and row4 (left and right), including docked attachments, and the browser default select-all behavior SHALL be suppressed
2. IF the player presses Ctrl+A while focus is not in a text input and the Selection_Set already contains every battlefield card instanceId, THEN THE Selection_Set SHALL become empty (toggle behavior)
3. IF the player presses Ctrl+A while focus is not in a text input and no cards exist on the battlefield, THEN THE Selection_Set SHALL remain empty and no error SHALL occur


### Requirement 8: Lasso Selection (Marquee Drag-to-Select)

**User Story:** As a player, I want to drag on empty battlefield space to draw a rectangular lasso, so that I can quickly select a group of adjacent cards without clicking each one individually.

#### Acceptance Criteria

1. WHEN the player initiates a pointer-down event on empty Battlefield space (not on any card element, SortableCardWrapper, or fanned group), THE Battlefield SHALL begin tracking a Lasso_Rectangle from the pointer-down coordinates
2. WHILE the player holds the pointer down and moves the cursor after lasso initiation, THE Battlefield SHALL render a visible Lasso_Rectangle overlay (semi-transparent cyan rectangle with a 1px solid cyan border) stretching from the origin point to the current pointer position
3. WHEN the player releases the pointer after dragging a Lasso_Rectangle, THE Selection_Set SHALL contain the instanceIds of all battlefield cards whose rendered bounding boxes intersect the final Lasso_Rectangle area
4. WHEN the player releases the pointer after a lasso drag while holding Ctrl, THE Lasso_Rectangle selection SHALL be additive — newly intersected cards are added to the existing Selection_Set without clearing previously selected cards
5. WHEN the player releases the pointer after a lasso drag WITHOUT holding Ctrl, THE Selection_Set SHALL be replaced entirely with the cards intersected by the Lasso_Rectangle
6. THE Lasso_Rectangle drag SHALL only initiate when the pointer-down target is empty battlefield space — pointer-down events on any SortableCardWrapper, RotationDiv, or child card element SHALL NOT trigger lasso behavior and SHALL proceed with normal card drag via dnd-kit
7. THE Lasso_Rectangle logic SHALL be implemented at the Battlefield component level (event listeners on the Battlefield container div), not inside SortableCardWrapper or RotationDiv component trees
8. THE Lasso_Rectangle SHALL NOT interfere with dnd-kit's sortable drag behavior — card drags initiated on a SortableCardWrapper SHALL take precedence and suppress any lasso tracking
9. IF the pointer-down and pointer-up occur at the same coordinates (zero-distance drag on empty space), THEN THE Selection_Set SHALL be cleared (equivalent to clicking empty space to deselect)
10. THE Lasso_Rectangle overlay SHALL render within Zone A boundaries and SHALL be removed immediately upon pointer-up
11. WHILE mutateTargeting.isActive is true, THE Lasso_Rectangle behavior SHALL be suppressed entirely — pointer-down on empty space SHALL not initiate a lasso during mutate targeting mode
