# Requirements Document

## Introduction

TCG Playmat is a browser-based digital playmat for Magic: The Gathering designed for OBS-streamed Commander gameplay. The application renders a full-viewport interface divided into three strict zones: a continuous-flow battlefield (Zone A), a responsive-width card-stack sidebar (Zone B), and a private hand tray (Zone C, bottom 16.67vh). Cards are imported via bulk decklists and resolved against the Scryfall API, then manipulated via drag-and-drop, Archidekt-aligned hotkeys, and a right-click context menu.

## Glossary

- **Playmat**: The full browser viewport application rendering the card game interface
- **Zone_A**: The public battlefield area within the upper 83.33vh, occupying the left portion (1fr) of the upper region, visible to OBS
- **Zone_B**: The responsive-width sidebar on the right edge of the upper 83.33vh region, one card width, containing 4 vertically stacked zones
- **Zone_C**: The private hand tray occupying the bottom 16.67vh of the viewport (full width), hidden from OBS
- **Row_Track**: A full-width horizontal lane within Zone A where cards are positioned dynamically
- **Creature_Area**: The portion of Zone A (3/5 of battlefield height) dedicated to creature cards, dynamically split into 1-3 row tracks
- **Split_Row**: A Row_Track divided into left and right sections that grow toward center
- **Fanned_Group**: A horizontal stack of same-name cards with 95% overlap, counting as 1 element for row capacity calculations
- **Element**: A single card or a fanned group, used for row capacity calculations
- **PW_Battle_Column**: A conditional vertical column on the far-right of the creature area, only rendered when planeswalkers or battles are present
- **HD_Zoom_Portal**: A high-resolution card preview overlay positioned to the right of the hand tray within Zone C
- **Mulligan_Engine**: The game phase system managing opening hand selection with Commander free mulligan rules
- **OBS_Crop_Boundary**: The horizontal line at 83.33vh from the top, below which content is hidden from stream
- **Equipment_Docking**: The visual attachment of Equipment/Aura cards behind a creature with 15px cascade offset and auto stat recalculation
- **Soft_Reset**: A state reset that returns all cards to starting positions without page refresh
- **Delirium_Count**: The number of unique card types present in the graveyard (0-9)
- **Context_Menu**: Right-click menu providing card actions, movement, counters, and equip/detach options

## Requirements

### Requirement 1: Full-Viewport Lock

**User Story:** As a streamer, I want the playmat to fill my entire browser window with no scrolling, so that OBS captures a clean, consistent frame.

#### Acceptance Criteria

1. THE Playmat SHALL render with `width: 100vw`, `height: 100vh`, and `overflow: hidden` on the root element
2. WHEN the browser is resized, THE Playmat SHALL maintain the full-viewport constraint without producing scrollbars
3. THE Playmat SHALL prevent any content from overflowing the viewport boundaries

### Requirement 2: OBS Crop Invariant

**User Story:** As a streamer, I want the bottom 16.67vh to be my private zone hidden from OBS, so that my hand cards remain secret from opponents.

#### Acceptance Criteria

1. THE Playmat SHALL reserve the bottom 16.67vh of the viewport exclusively for Zone_C
2. THE Playmat SHALL render no text, counters, buttons, or interactive elements from Zone_A or Zone_B within the bottom 16.67vh region
3. WHEN a card is in Zone_C, THE Playmat SHALL render it face-up (visible to the player) but entirely below the OBS_Crop_Boundary
4. WHEN a card is dragged from Zone_C into Zone_A, THE Playmat SHALL move it into the OBS-visible area above the crop boundary
5. THE OBS_Crop_Boundary SHALL be the sole mechanism for hiding cards from viewers

### Requirement 3: Three-Zone Layout

**User Story:** As a streamer, I want the viewport divided into a battlefield, a sidebar for stack zones, and a private hand tray, so that all game zones are accessible without overlapping the stream view.

#### Acceptance Criteria

1. THE Playmat SHALL divide the upper 83.33vh into two columns: Zone_A (1fr, left) and Zone_B (one card width, right)
2. THE Playmat SHALL render Zone_C spanning the full viewport width at the bottom with height 16.67vh
3. WHEN the viewport is resized, THE Zone_B width SHALL scale proportionally to maintain one card width relative to the screen size
4. THE Playmat SHALL use CSS Grid for the outer layout: two rows (83.33vh upper region, 16.67vh Zone_C) with the upper region split into two columns (1fr + sidebar width)

### Requirement 4: Continuous Flow Row Tracks

**User Story:** As a player, I want cards on the battlefield to arrange dynamically in horizontal rows without fixed grid cells, so that the layout adapts fluidly to my board state.

#### Acceptance Criteria

1. THE Playmat SHALL render Zone_A as a set of full-width horizontal Row_Tracks with no static vertical columns or fixed grid cells
2. WHEN a card is placed within a Row_Track, THE Playmat SHALL arrange it from left to right relative to other cards in that track
3. WHEN cards enter, leave, or shift positions within a Row_Track, THE Playmat SHALL animate adjacent cards smoothly to their new positions using hardware-accelerated transitions
4. WHEN a user drags a card between existing cards within a Row_Track, THE Playmat SHALL open an animated insertion gap at the hover position to preview the drop point
5. WHEN a user drops a card at the insertion gap, THE Playmat SHALL insert the card at that position and close the gap

### Requirement 5: Dynamic Creature Row Splitting

**User Story:** As a player, I want the creature area to expand into multiple rows as my board grows, so that creatures remain visible without overflowing the screen.

#### Acceptance Criteria

1. THE Creature_Area SHALL occupy 3/5 of the Zone_A battlefield height
2. WHEN the Creature_Area contains 7 or fewer elements, THE Playmat SHALL render them in a single Row_Track
3. WHEN the Creature_Area contains more than 7 and up to 24 elements, THE Playmat SHALL split into 2 Row_Tracks
4. WHEN the Creature_Area contains more than 24 elements, THE Playmat SHALL split into 3 Row_Tracks
5. WHEN counting elements for row capacity, THE Playmat SHALL count each Fanned_Group as 1 element
6. WHEN a user drags a card between creature rows, THE Playmat SHALL move the card to the target row
7. THE Creature_Area SHALL never expand beyond its allocated 3/5 of Zone_A height

### Requirement 6: Battlefield Row Assignment

**User Story:** As a player, I want lands, artifacts, and enchantments to auto-sort into dedicated split rows, so that my board is organized by card type.

#### Acceptance Criteria

1. THE Playmat SHALL render Row 4 (1/5 of Zone_A height) as a Split_Row with basic/mana-only lands on the left building left-to-right and artifacts on the right building right-to-left
2. THE Playmat SHALL render Row 5 (1/5 of Zone_A height) as a Split_Row with utility lands on the left building left-to-right and enchantments on the right building right-to-left
3. WHEN a land card is placed on the battlefield, THE Playmat SHALL assign it to Row 4 left (basic/mana-only) or Row 5 left (utility) based on its type
4. WHEN an artifact card is placed on the battlefield, THE Playmat SHALL assign it to Row 4 right
5. WHEN an enchantment card is placed on the battlefield, THE Playmat SHALL assign it to Row 5 right
6. WHEN both sides of a Split_Row grow toward center, THE Playmat SHALL allow the split to be soft so that one side can expand if it needs more space

### Requirement 7: Planeswalker and Battle Column

**User Story:** As a player, I want planeswalkers and battles to appear in a dedicated column on the far-right of the creature area, so that they are visually distinct from creatures.

#### Acceptance Criteria

1. WHEN at least one planeswalker or battle is on the battlefield, THE Playmat SHALL render a PW_Battle_Column on the far-right of the Creature_Area (adjacent to Zone_B)
2. THE PW_Battle_Column SHALL stack planeswalkers and battles vertically, justified with creature rows
3. WHEN no planeswalkers or battles are present, THE Playmat SHALL hide the PW_Battle_Column and give creatures the full width
4. WHEN a planeswalker or battle is removed from the battlefield and none remain, THE Playmat SHALL collapse the PW_Battle_Column

### Requirement 8: Horizontal Card Fanning

**User Story:** As a player, I want duplicate cards (e.g., 4x Forest) to stack horizontally with minimal overlap, so that my board stays compact while cards remain identifiable.

#### Acceptance Criteria

1. WHEN multiple cards with the same name exist in the same Row_Track, THE Playmat SHALL group them into a Fanned_Group
2. WHEN rendering a Fanned_Group, THE Playmat SHALL overlay each subsequent card with 95% horizontal overlap, exposing 5% of each underlying card
3. THE Playmat SHALL ensure the exposed 5% of underlying cards shows the art banner for visual identification
4. WHEN rendering a Fanned_Group, THE Playmat SHALL increment z-index sequentially per card so the newest card is fully visible on top
5. THE Playmat SHALL count a Fanned_Group as 1 element for Row_Track capacity calculations
6. THE Playmat SHALL only fan cards with identical names (not by card type or other grouping)
7. WHEN a card is dragged between two different-named cards or groups, THE Playmat SHALL open an animated insertion gap at the hover position
8. WHEN a card is dropped next to a same-name card, THE Playmat SHALL add it to that existing Fanned_Group rather than inserting independently

### Requirement 9: Equipment and Aura Docking

**User Story:** As a player, I want Equipment and Auras to visually attach behind creatures with automatic stat recalculation, so that I can see which permanents are equipped and their effects at a glance.

#### Acceptance Criteria

1. WHEN an Equipment or Aura is docked to a creature, THE Playmat SHALL remove it from the standard Row_Track flow
2. WHEN rendering a docked Equipment or Aura, THE Playmat SHALL position it behind the parent creature with a 15px cascade offset per attachment
3. WHEN rendering a docked Equipment or Aura, THE Playmat SHALL display the card name as white text on a dark grey background, rendered sideways
4. WHEN a user drags an Equipment card onto a creature, THE Playmat SHALL trigger equipment docking
5. WHEN a user presses Ctrl+E with an Equipment selected, THE Playmat SHALL enter equip mode to dock it to a target creature
6. WHEN a user right-clicks an Equipment card, THE Playmat SHALL display a context menu option to equip it to a creature
7. WHEN the parent creature is moved or tapped, THE Playmat SHALL translate the docked equipment seamlessly with it
8. WHEN equipment is docked, THE Playmat SHALL parse the equipment oracle text for stat modifiers and recalculate the creature effective power and toughness
9. WHEN equipment is undocked, THE Playmat SHALL remove its stat modifier and recalculate the creature stats
10. THE Playmat SHALL support undocking via right-click "Detach", drag-away from creature, or Ctrl+E toggle on hovered attachment
11. WHEN a user clicks a creature's docked stack, THE Playmat SHALL fan out all attachments temporarily for individual selection and interaction

### Requirement 10: HD Zoom Portal

**User Story:** As a player, I want to see a high-resolution preview of any card I hover over, so that I can read oracle text and art details clearly.

#### Acceptance Criteria

1. WHEN a user hovers over any card on the battlefield or in Zone_C, THE HD_Zoom_Portal SHALL display a high-resolution render of that card
2. THE HD_Zoom_Portal SHALL be positioned to the right of the hand tray within Zone_C
3. THE HD_Zoom_Portal SHALL render entirely within the bottom 16.67vh private zone, hidden from OBS
4. THE HD_Zoom_Portal SHALL never overflow above the OBS_Crop_Boundary
5. WHEN the user stops hovering, THE HD_Zoom_Portal SHALL hide immediately
6. WHEN a user selects "View card notes/details" from the Context_Menu, THE Playmat SHALL display the card in the HD_Zoom_Portal
7. THE HD_Zoom_Portal SHALL display parsed keyword abilities as visual badges alongside the card image

### Requirement 11: Mulligan Engine

**User Story:** As a Commander player, I want a private mulligan interface that handles free mulligans and put-back selection, so that I can manage my opening hand without revealing information to opponents.

#### Acceptance Criteria

1. WHEN a new game initializes or a soft reset occurs, THE Mulligan_Engine SHALL enter the MULLIGAN game phase
2. WHILE in the MULLIGAN game phase, THE Playmat SHALL render the entire mulligan UI exclusively within Zone_C (bottom 16.67vh)
3. WHILE in the MULLIGAN game phase, THE Playmat SHALL keep the upper 83.33vh battlefield completely blank
4. THE Mulligan_Engine SHALL draw 7 cards from the library and display them fanned horizontally in Zone_C
5. THE Mulligan_Engine SHALL provide "Keep" and "Mulligan" action buttons within Zone_C
6. WHEN the player chooses to mulligan, THE Mulligan_Engine SHALL shuffle the hand back into the library and draw 7 new cards
7. THE Mulligan_Engine SHALL grant the first mulligan as free (no cards put back) per Commander rules
8. WHEN the player keeps after mulliganing N times (N > 1), THE Mulligan_Engine SHALL require the player to put back N-1 cards
9. WHEN a card is selected for put-back, THE Playmat SHALL indicate selection with 50% opacity and a red border
10. WHILE the player has not selected the required number of put-back cards, THE Playmat SHALL disable the "Confirm Keep" button
11. WHEN the player confirms keep, THE Mulligan_Engine SHALL shuffle put-back cards to the bottom of the library and transition to the PLAYING game phase

### Requirement 12: Zone B Sidebar

**User Story:** As a player, I want Library, Graveyard, Exile, and Command Zone displayed in a persistent sidebar, so that I can always see my stack zone counts and interact with them without overlays blocking the battlefield.

#### Acceptance Criteria

1. THE Playmat SHALL render Zone_B as a responsive-width sidebar on the right edge of the upper region, one card width, scaling with viewport size
2. THE Zone_B sidebar SHALL contain exactly 4 stacks arranged vertically: Command Zone (top), Library, Graveyard, Exile (bottom)
3. THE Zone_B sidebar SHALL span from the top of the viewport to the OBS_Crop_Boundary (83.33vh total height)
4. EACH stack in Zone_B SHALL occupy exactly 1/4 of the sidebar height (one card height per stack)
5. THE Playmat SHALL display the Library as a face-down card back with a count badge
6. THE Playmat SHALL display the Graveyard with the top card face-up, a count badge, and the Delirium_Count
7. THE Playmat SHALL display Exile cards with the top card visible (face-up or face-down as appropriate) and a count badge
8. THE Playmat SHALL display Command Zone cards face-up, stacked if multiple commanders
9. EACH stack in Zone_B SHALL be a valid drop target for drag-and-drop card movement
10. THE Zone_B sidebar SHALL provide Draw and Shuffle actions for the Library (via right-click or button)

### Requirement 13: Delirium Tracking

**User Story:** As a player, I want the graveyard to show my delirium count, so that I can track how many unique card types are in my graveyard for delirium-related abilities.

#### Acceptance Criteria

1. THE Playmat SHALL calculate the Delirium_Count as the number of unique card types present in the graveyard
2. THE Playmat SHALL recognize the following card types for delirium: creature, instant, sorcery, artifact, enchantment, planeswalker, land, tribal, battle
3. THE Delirium_Count SHALL range from 0 to 9
4. WHEN a card enters or leaves the graveyard, THE Playmat SHALL recalculate and update the Delirium_Count immediately
5. THE Playmat SHALL display the Delirium_Count on the Graveyard stack in Zone_B alongside the card count

### Requirement 14: Hand Tray Display

**User Story:** As a player, I want my hand cards displayed in a fan layout below the OBS crop line with horizontal scrolling for large hands, so that I can see my cards while keeping them hidden from opponents.

#### Acceptance Criteria

1. THE Playmat SHALL render Zone_C spanning the full viewport width at the bottom with height 16.67vh
2. THE Playmat SHALL display hand cards face-up in a fan/arc arrangement within Zone_C
3. WHEN a user hovers near cards in Zone_C, THE Playmat SHALL spread adjacent cards apart so the hovered card is fully readable
4. THE Playmat SHALL animate the spread smoothly following cursor position
5. WHEN the hand contains approximately 15 or fewer cards, THE Playmat SHALL compress or expand the fan to fit without scrolling
6. WHEN the hand card count exceeds the readable threshold (approximately 15+), THE Playmat SHALL enable horizontal scrolling via mouse scroll wheel
7. THE Playmat SHALL hide the scrollbar visually while maintaining scroll functionality to keep Zone_C appearance clean
8. THE Playmat SHALL host the HD_Zoom_Portal to the right of the hand cards within Zone_C

### Requirement 15: Keybind System (Archidekt-Aligned)

**User Story:** As a streamer, I want comprehensive Archidekt-style keyboard shortcuts for all common game actions, so that I can play quickly without relying solely on mouse interactions.

#### Acceptance Criteria

1. WHEN the user presses N, THE Playmat SHALL execute "Next turn" (untap all + draw a card)
2. WHEN the user presses U, THE Playmat SHALL untap all cards on the battlefield
3. WHEN the user presses D, THE Playmat SHALL draw a card from the library to the hand
4. WHEN the user presses T with a card hovered, THE Playmat SHALL toggle the tap/untap state of that card
5. WHEN the user presses F with a card hovered, THE Playmat SHALL flip or transform that card (DFC toggle)
6. WHEN the user presses M with a card hovered, THE Playmat SHALL toggle morph (face-down) state
7. WHEN the user presses P with a card hovered, THE Playmat SHALL toggle phase out (dim/undim)
8. WHEN the user presses C with a card hovered, THE Playmat SHALL create a token copy of that card
9. WHEN the user presses + with a card hovered, THE Playmat SHALL add a +1/+1 counter
10. WHEN the user presses - with a card hovered, THE Playmat SHALL remove a counter
11. WHEN the user presses B with a card hovered, THE Playmat SHALL move it to the battlefield
12. WHEN the user presses H with a card hovered, THE Playmat SHALL move it to the hand
13. WHEN the user presses G with a card hovered, THE Playmat SHALL move it to the graveyard
14. WHEN the user presses E with a card hovered, THE Playmat SHALL move it to exile
15. WHEN the user presses Z with a card hovered, THE Playmat SHALL move it to the command zone
16. WHEN the user presses Y with a card hovered, THE Playmat SHALL move it to the top of the library
17. WHEN the user presses L with a card hovered, THE Playmat SHALL move it to the bottom of the library
18. WHEN the user presses Ctrl+S, THE Playmat SHALL shuffle the library
19. WHEN the user presses Ctrl+G, THE Playmat SHALL initiate a new game (soft reset with confirmation)
20. WHEN the user presses Ctrl+F, THE Playmat SHALL open the library for searching/browsing
21. WHEN the user presses Ctrl+Z, THE Playmat SHALL undo the last action
22. WHEN the user presses Ctrl+E, THE Playmat SHALL enter equip/attach mode for the hovered equipment
23. WHEN the user presses Alt+1 through Alt+9, THE Playmat SHALL peek at the top N cards from the library
24. WHEN the user presses Spacebar with a hand card hovered, THE Playmat SHALL toggle the revealed state of that card
25. WHEN the user presses ?, THE Playmat SHALL show or hide the keybind overlay
26. WHILE focus is in a text input, textarea, or contenteditable element, THE Playmat SHALL suppress all game keybinds

### Requirement 16: Right-Click Context Menu

**User Story:** As a player, I want a right-click context menu with all card actions organized like Archidekt, so that I can perform any game action without memorizing every keybind.

#### Acceptance Criteria

1. WHEN a user right-clicks a card on the battlefield, THE Playmat SHALL display a Context_Menu at the cursor position
2. THE Context_Menu for battlefield cards SHALL include: Tap (T), Move to submenu (Hand/Graveyard/Exile/Command Zone/Top of library/Bottom of library/X of library/Shuffle into library), Card actions submenu (Flip/Transform/Morph face-down/Phase out), Add counters submenu, Add/subtract power, Add/subtract toughness, Add/subtract +X/+X, Equip/Attach (if equipment or aura), Detach (if docked), View card notes/details, Create token copy with quantity selector, and Delete card
3. WHEN a user right-clicks a card in Zone_C (hand), THE Context_Menu SHALL include: Play to Battlefield (B), Move to submenu (Graveyard/Exile/Top of Library/Bottom of Library/Shuffle into library), and Reveal/Hide
4. WHEN a user right-clicks a card in Zone_B (stack zone), THE Context_Menu SHALL include: Move to submenu (Hand/Battlefield/other stack zones) and Flip face-down (Exile only)
5. THE Context_Menu SHALL display keyboard shortcut hints next to applicable items
6. WHEN the user clicks away or presses Escape, THE Playmat SHALL dismiss the Context_Menu
7. THE Context_Menu SHALL adapt available options based on the card zone and card type

### Requirement 17: Counter System

**User Story:** As a player, I want to add various counter types to my cards, so that I can track all game-relevant counters and abilities.

#### Acceptance Criteria

1. THE Playmat SHALL support the following counter types: +1/+1, -1/-1, Lifelink, Hexproof, Indestructible, Shroud, Time, Charge, Generic, Loyalty, Flying, Deathtouch, Menace, Trample, First Strike, Double Strike, Reach, Vigilance, Token, Lore, Shield, Haste, and Custom
2. WHEN a user adds a counter to a card, THE Playmat SHALL display the counter type and value visually on the card
3. WHEN a counter is modified via +/- keys or context menu, THE Playmat SHALL update the visual indicator immediately
4. THE Context_Menu counter submenu SHALL display all counter types in a grid layout
5. WHEN a user selects "Custom" counter, THE Playmat SHALL allow the user to name a new counter type
6. THE Playmat SHALL persist counter values across state saves

### Requirement 18: Keyword and Stat Auto-Parsing

**User Story:** As a player, I want the app to automatically detect keyword abilities from card text, so that I can see visual indicators without manual tracking.

#### Acceptance Criteria

1. WHEN a card is loaded from Scryfall, THE Playmat SHALL parse its oracle text for recognized keyword abilities (flying, trample, lifelink, deathtouch, hexproof, indestructible, menace, reach, first strike, double strike, haste, vigilance, flash, defender, ward, shroud, protection)
2. WHEN keyword abilities are detected, THE Playmat SHALL store them in the card data and display visual indicators on the card
3. THE Playmat SHALL parse keywords once on import and cache them in the CardData object

### Requirement 19: Deck Import Methods

**User Story:** As a player, I want to import my decklist from multiple sources, so that I can quickly load any deck I own.

#### Acceptance Criteria

1. WHEN a user pastes a CSV containing card names, THE Playmat SHALL parse and import the decklist
2. WHEN a user pastes a plain-text list (one card per line, optional quantity prefix), THE Playmat SHALL parse and import the decklist
3. WHEN a user pastes a Moxfield deck URL, THE Playmat SHALL fetch and import the decklist
4. WHEN a user pastes an Archidekt deck URL, THE Playmat SHALL fetch and import the decklist
5. WHEN import completes, THE Playmat SHALL place mainboard cards in the Library and commander cards in the Command Zone
6. THE Playmat SHALL resolve each card name against the Scryfall API to populate the full card data schema

### Requirement 20: Card Data Schema Conformance

**User Story:** As a developer, I want every card object to conform to a strict schema, so that rendering and state management are predictable.

#### Acceptance Criteria

1. THE Playmat SHALL assign each card instance a unique UUID v4 as its `id`
2. THE Playmat SHALL populate `name`, `setCode`, `collectorNumber`, `imageURI`, `typeLine`, and `oracleText` for every card from Scryfall data
3. WHEN a card is double-faced, THE Playmat SHALL populate `backFaceImageURI` from `card_faces[1].image_uris.normal`
4. WHEN a quantity prefix is specified in import, THE Playmat SHALL create that many separate card instances each with a unique `id`
5. THE Playmat SHALL enforce that `setCode` is lowercase and 3-5 characters
6. THE Playmat SHALL allow `oracleText` to be an empty string for lands and tokens

### Requirement 21: Scryfall Rate Limit Compliance

**User Story:** As a responsible API consumer, I want the app to respect Scryfall's rate limits, so that we don't get blocked or degrade their service.

#### Acceptance Criteria

1. THE Playmat SHALL enforce a minimum 50ms delay between consecutive Scryfall API requests
2. THE Playmat SHALL use Scryfall's `/cards/collection` endpoint with batches of up to 75 cards to minimize total requests
3. WHEN a bulk import is in progress, THE Playmat SHALL display a progress indicator
4. WHEN card lookups fail, THE Playmat SHALL report failed cards to the user without blocking successful imports

### Requirement 22: Cross-Zone Drag-and-Drop

**User Story:** As a player, I want to drag cards freely between the battlefield, hand, sidebar zones, and stack zones, so that I can manage my board state intuitively.

#### Acceptance Criteria

1. WHEN a card is dragged from Zone_C to Zone_A, THE Playmat SHALL move it to the target Row_Track at the drop position
2. WHEN a card is dragged from Zone_A to a Zone_B stack, THE Playmat SHALL move it to that stack zone
3. WHEN a card is dragged from Zone_B to Zone_A, THE Playmat SHALL place it in the target Row_Track
4. THE Playmat SHALL ensure a card exists in exactly one zone at all times — moves are atomic
5. IF a card is dropped outside any valid zone, THEN THE Playmat SHALL snap it back to its source position with no state change
6. WHEN dragging, THE Playmat SHALL render the card image following the cursor seamlessly throughout the drag

### Requirement 23: State Persistence

**User Story:** As a player, I want my game state saved automatically, so that I can resume if I accidentally close the tab.

#### Acceptance Criteria

1. THE Playmat SHALL persist all zone contents, card positions, tap states, counter values, and docking relationships to localStorage
2. WHEN the app loads, THE Playmat SHALL restore persisted state automatically
3. THE Playmat SHALL save state after every state-changing action, debounced at 100ms
4. IF persisted state is corrupted or invalid, THEN THE Playmat SHALL initialize with empty state without crashing
5. IF localStorage write fails with QuotaExceededError, THEN THE Playmat SHALL display a warning toast and continue in-memory

### Requirement 24: No Full-Page Refresh

**User Story:** As a streamer, I want the app to never trigger a page refresh, so that my OBS window capture remains uninterrupted.

#### Acceptance Criteria

1. THE Playmat SHALL never call `window.location.reload()` or trigger navigation events during gameplay
2. THE Playmat SHALL perform all state transitions via React state updates only
3. THE Playmat SHALL handle all error states with in-app UI (toasts, modals) without page reload
4. WHEN a soft reset occurs, THE Playmat SHALL keep the React component tree mounted and OBS capture uninterrupted

### Requirement 25: Soft Reset

**User Story:** As a player, I want to reset the game between matches without breaking my stream, so that I can start a new game seamlessly.

#### Acceptance Criteria

1. WHEN a soft reset is triggered, THE Playmat SHALL move all mainboard cards to the Library and all commanders to the Command Zone
2. WHEN a soft reset completes, THE Playmat SHALL clear all tap states, counter values, and docking relationships
3. WHEN a soft reset completes, THE Playmat SHALL empty the Hand, Battlefield, Graveyard, and Exile zones
4. WHEN a soft reset completes, THE Mulligan_Engine SHALL transition to the MULLIGAN game phase
5. THE Playmat SHALL require confirmation before executing a soft reset
6. THE Playmat SHALL preserve total card count after soft reset (no cards created or destroyed)

### Requirement 26: Tap/Untap

**User Story:** As a player, I want to tap and untap cards on the battlefield, so that I can track which permanents I've used this turn.

#### Acceptance Criteria

1. WHEN a user presses T with a card hovered on the battlefield, THE Playmat SHALL toggle its tapped state
2. WHEN a card is tapped, THE Playmat SHALL render it rotated 90° clockwise
3. WHEN a card is untapped, THE Playmat SHALL render it at 0° rotation
4. WHEN the user presses U, THE Playmat SHALL untap all cards on the battlefield simultaneously including all attachments
5. THE Playmat SHALL persist tap states across state saves

### Requirement 27: Card Flip and Double-Faced Cards

**User Story:** As a player, I want to flip cards face-down and transform double-faced cards, so that I can represent all game states accurately.

#### Acceptance Criteria

1. WHEN a card on the battlefield is flipped face-down, THE Playmat SHALL display a generic card back image
2. WHEN a double-faced card is transformed, THE Playmat SHALL switch between front and back face images
3. THE Playmat SHALL support face-down cards in Exile as a valid game state
4. THE Playmat SHALL persist face-down and transform states across state saves

### Requirement 28: Draw and Shuffle Actions

**User Story:** As a player, I want to draw cards and shuffle my library with quick actions, so that gameplay flows smoothly.

#### Acceptance Criteria

1. WHEN the user triggers a draw action, THE Playmat SHALL move the top card from Library to Hand
2. IF the Library is empty when draw is triggered, THEN THE Playmat SHALL perform no action (no error)
3. WHEN the user triggers a shuffle action, THE Playmat SHALL randomize Library order using Fisher-Yates algorithm
4. WHEN shuffle completes, THE Playmat SHALL preserve the same cards in the Library (no cards added or removed)

### Requirement 29: Error Handling

**User Story:** As a player, I want the app to handle errors gracefully, so that my game is never interrupted by crashes.

#### Acceptance Criteria

1. IF Scryfall is unreachable during deck import, THEN THE Playmat SHALL display an error toast with a retry option
2. IF a card is dropped outside any valid zone, THEN THE Playmat SHALL snap it back to source with smooth animation
3. IF localStorage write fails, THEN THE Playmat SHALL display a warning and continue in-memory
4. IF a Moxfield or Archidekt URL is invalid or private, THEN THE Playmat SHALL display a clear error message with timeout after 10 seconds
5. THE Playmat SHALL never clear or corrupt existing game state due to API errors

### Requirement 30: Hand Count HUD

**User Story:** As a streamer, I want my hand count visible to viewers above the crop line, so that opponents can verify my hand size.

#### Acceptance Criteria

1. THE Playmat SHALL display the number of cards in Zone_C at the bottom-left of Zone_A, immediately above the OBS_Crop_Boundary
2. WHEN cards move to or from Zone_C, THE Playmat SHALL update the hand count immediately
3. THE Hand Count HUD SHALL be visible to OBS (rendered above the crop line within Zone_A)
