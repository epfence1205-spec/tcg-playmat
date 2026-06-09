# Requirements Document

## Introduction

Upgrade the existing read-only PeekModal into an interactive card manipulation modal that supports the full range of MTG "look at top N" mechanics: Scry, Surveil, Select/Impulse, and plain Peek. The upgraded modal allows players to reorder peeked cards, assign them to destination zones (top of library, bottom of library, hand, graveyard), and confirm changes atomically via the existing undo-able game state architecture.

## Glossary

- **Peek_Modal**: The modal overlay component that displays the top N cards of the library and allows interaction based on the active mode.
- **Peek_Mode**: One of four operational modes the Peek_Modal can operate in: Scry, Surveil, Select, or Peek.
- **Card_Assignment**: The association of a peeked card with a destination zone within the modal before confirmation.
- **Destination_Zone**: A target location where a card will be placed upon confirmation (top of library, bottom of library, hand, or graveyard).
- **Confirmation_Action**: The atomic game state mutation that applies all Card_Assignments simultaneously with undo history support.
- **Mode_Selector**: The UI mechanism (sub-menu) that allows the player to choose which Peek_Mode to activate before the modal opens.
- **Card_Slot**: A visual position within the modal representing a single card that can be reordered via drag interaction.
- **Game_State_Hook**: The `useGameState` hook managing all zone arrays with history-based undo support.
- **OBS_Privacy_Boundary**: The 83.33vh/16.67vh viewport split where the upper portion is publicly broadcast.

## Requirements

### Requirement 1: Mode Selection

**User Story:** As a player, I want to choose which peek mode to activate (Scry, Surveil, Select, or Peek), so that the modal behavior matches the spell or ability I am resolving.

#### Acceptance Criteria

1. WHEN the player triggers a peek action (Alt+1-9), THE Mode_Selector SHALL present the available modes: Scry, Surveil, Select, and Peek, and SHALL retain the triggered card count (N) for use when opening the Peek_Modal.
2. WHEN the player selects a mode from the Mode_Selector, THE Peek_Modal SHALL open in the selected Peek_Mode displaying the top N cards from the library, where N is the digit from the original Alt+N keystroke.
3. WHEN the player selects Peek mode, THE Peek_Modal SHALL display cards in read-only presentation with no assignment controls, no reorder controls, and no Confirm button.
4. THE Mode_Selector SHALL be dismissable without opening the Peek_Modal by pressing Escape or clicking outside.
5. IF the player triggers a peek action while a Peek_Modal is already open, THEN THE Peek_Modal SHALL ignore the duplicate trigger and maintain its current state.
6. IF the player triggers a peek action (Alt+1-9) while the Mode_Selector is already open, THEN THE Mode_Selector SHALL update its retained card count to the new N value without opening a second instance.
7. THE Mode_Selector SHALL render entirely within the upper 83.33vh of the viewport (OBS_Privacy_Boundary public zone).

### Requirement 2: Card Display and Reordering

**User Story:** As a player, I want to reorder peeked cards within the modal, so that I can arrange them in my desired order before placing them back.

#### Acceptance Criteria

1. THE Peek_Modal SHALL display all peeked cards face-up in a horizontal row with visible position indicators (1-indexed from left) showing each card's order within its assigned Destination_Zone group.
2. WHEN a card is dragged to a new position within the same Destination_Zone group, THE Peek_Modal SHALL update the visual order and position indicators within that group before the next animation frame.
3. THE Peek_Modal SHALL support reordering via @dnd-kit/sortable drag-and-drop interaction on each Card_Slot, constrained to movement within the card's currently assigned Destination_Zone group.
4. WHILE in Peek mode, THE Peek_Modal SHALL NOT display reorder controls or allow drag-and-drop interaction.
5. THE Peek_Modal SHALL preserve the original library order until the Confirmation_Action is executed.
6. WHEN a card's Destination_Zone assignment changes, THE Peek_Modal SHALL append that card to the end of the target Destination_Zone group and update position indicators for both the source and target groups.

### Requirement 3: Scry Mode

**User Story:** As a player, I want to scry N cards by reordering them and choosing which go to the bottom of my library, so that I can set up future draws.

#### Acceptance Criteria

1. WHILE in Scry mode, THE Peek_Modal SHALL allow the player to assign each card to either "top of library" or "bottom of library" as its Destination_Zone.
2. WHEN Scry mode opens, THE Peek_Modal SHALL default all cards to "top of library" assignment.
3. WHEN the player clicks a card's Destination_Zone toggle, THE Peek_Modal SHALL move that card between the "top of library" group and the "bottom of library" group, and SHALL visually distinguish the two groups using a color-coded indicator on each card and spatial separation between groups.
4. THE Peek_Modal SHALL allow the player to reorder cards via drag-and-drop within each Destination_Zone group independently, without allowing cards to be dragged between groups.
5. WHEN the Confirmation_Action is executed in Scry mode, THE Game_State_Hook SHALL place "top of library" cards at the front of the library array (index 0 = leftmost card in the top group) in left-to-right visual order, and append "bottom of library" cards at the end of the library array in left-to-right visual order.
6. IF all peeked cards are assigned to the same Destination_Zone, THEN THE Peek_Modal SHALL allow confirmation without requiring at least one card in each group.

### Requirement 4: Surveil Mode

**User Story:** As a player, I want to surveil N cards by choosing which go to my graveyard and which stay on top, so that I can fuel graveyard strategies.

#### Acceptance Criteria

1. WHILE in Surveil mode, THE Peek_Modal SHALL allow the player to toggle each card's Destination_Zone between "top of library" and "graveyard" via a click or tap interaction on the card.
2. WHEN Surveil mode opens, THE Peek_Modal SHALL default all cards to "top of library" assignment.
3. WHEN the player assigns a card to "graveyard", THE Peek_Modal SHALL visually distinguish that card with a graveyard indicator.
4. WHILE in Surveil mode, THE Peek_Modal SHALL allow the player to reorder cards assigned to "top of library" via drag-and-drop and SHALL NOT allow reordering of cards assigned to "graveyard".
5. WHEN the Confirmation_Action is executed in Surveil mode, THE Game_State_Hook SHALL place "top of library" cards on top of the library in the player's chosen order (leftmost position = library index 0) and prepend "graveyard" cards to the graveyard array in their left-to-right visual order with the last card in visual order placed at graveyard index 0.

### Requirement 5: Select Mode (Impulse/Dig)

**User Story:** As a player, I want to select K cards from the top N to put into my hand (or another zone), with the rest going to the bottom of my library, so that I can resolve effects like Impulse or Dig Through Time.

#### Acceptance Criteria

1. WHILE in Select mode, THE Peek_Modal SHALL allow the player to toggle each card's Destination_Zone between "hand" and "bottom of library" by clicking on the card.
2. WHEN Select mode opens, THE Peek_Modal SHALL default all cards to "bottom of library" assignment.
3. WHEN the player assigns a card to "hand", THE Peek_Modal SHALL visually distinguish that card with a hand indicator badge.
4. THE Peek_Modal SHALL allow the player to reorder cards assigned to "bottom of library" via drag-and-drop independently of cards assigned to "hand".
5. WHEN the Confirmation_Action is executed in Select mode, THE Game_State_Hook SHALL append "hand" cards to the end of the player's hand array and place "bottom of library" cards at the end of the library array (bottom of library) in the player's chosen order.
6. THE Peek_Modal SHALL display a running count of cards currently assigned to "hand" in the format "{K} selected" where K is the number of cards assigned to "hand".
7. IF the player executes the Confirmation_Action with zero cards assigned to "hand", THEN THE Game_State_Hook SHALL place all cards on the bottom of the library in the player's chosen order and close the modal.

### Requirement 6: Confirmation and Cancellation

**User Story:** As a player, I want to confirm my card arrangements atomically or cancel without changes, so that I can safely resolve peek effects with undo support.

#### Acceptance Criteria

1. THE Peek_Modal SHALL display a "Confirm" button and a "Cancel" button in a footer area below the card display.
2. WHEN the Confirm button is activated, THE Game_State_Hook SHALL apply all Card_Assignments as a single undo-able state mutation via `setGameStateWithHistory`.
3. WHEN the Confirm button is activated, THE Peek_Modal SHALL close on the next render frame after the state mutation completes.
4. WHEN the Cancel button is activated, THE Peek_Modal SHALL close and discard all in-progress Card_Assignments without modifying game state.
5. WHEN the player presses Escape or clicks the backdrop while the Peek_Modal is open, THE Peek_Modal SHALL close and discard all in-progress Card_Assignments without modifying game state.
6. WHILE in Peek mode (read-only), THE Peek_Modal SHALL NOT display a Confirm button.
7. IF any peeked card has no valid Destination_Zone assigned, THEN THE Peek_Modal SHALL disable the Confirm button until every card has exactly one Destination_Zone assignment.

### Requirement 7: Visual Feedback and Layout

**User Story:** As a player, I want clear visual feedback on card assignments and ordering within the modal, so that I can confidently confirm my choices.

#### Acceptance Criteria

1. THE Peek_Modal SHALL render entirely within the upper 83.33vh of the viewport (OBS_Privacy_Boundary public zone).
2. THE Peek_Modal SHALL display a header indicating the active Peek_Mode and card count using the format "{Mode} {N}" (e.g., "Scry 3", "Surveil 2").
3. WHEN a card is assigned to a Destination_Zone, THE Peek_Modal SHALL display a color-coded badge or border on that card where each Destination_Zone uses a unique, visually distinct color: one color for "top of library", a different color for "bottom of library", a different color for "hand", and a different color for "graveyard".
4. THE Peek_Modal SHALL visually group cards by their assigned Destination_Zone using labeled section headers that display the Destination_Zone name, with each group rendered in a spatially separated region with a minimum of 16px gap between groups.
5. THE Peek_Modal SHALL display 1-indexed position numbers within each Destination_Zone group, restarting at 1 for each group, to indicate the final ordering of cards within that destination.
6. WHEN all cards in a mode are assigned to the same Destination_Zone, THE Peek_Modal SHALL display a single group with that zone's label and sequential position numbers starting at 1.

### Requirement 8: Keybind Integration

**User Story:** As a player, I want the peek trigger system to integrate with mode selection without breaking existing keybinds, so that the workflow remains fast and keyboard-driven.

#### Acceptance Criteria

1. WHEN Alt+1-9 is pressed, THE keybind system SHALL dispatch a PEEK action with the corresponding card count (1-9), causing the Mode_Selector to appear.
2. WHILE the Mode_Selector is displayed, THE Mode_Selector SHALL allow the player to highlight modes using Arrow Up/Arrow Down keys and confirm the highlighted mode by pressing Enter, or select a mode directly via single-letter shortcut (S for Scry, V for Surveil, E for Select, P for Peek).
3. WHEN a mode is selected via keyboard in the Mode_Selector, THE Peek_Modal SHALL open in the selected mode without requiring any additional user action.
4. WHILE the Peek_Modal is open, THE Peek_Modal SHALL allow the player to cycle focus between cards using Arrow Left/Arrow Right keys and toggle the focused card's Destination_Zone assignment by pressing Space.
5. IF the library contains fewer cards than the requested count and at least 1 card remains, THEN THE Peek_Modal SHALL open with only the available cards and display the actual count in the header.
6. IF the library contains 0 cards when Alt+1-9 is pressed, THEN THE keybind system SHALL ignore the peek trigger and not open the Mode_Selector.
7. WHILE the Mode_Selector or Peek_Modal is open, THE keybind system SHALL suppress all other global keyboard shortcuts to prevent unintended game actions.
