# Implementation Plan: TCG Playmat — Continuous Flow Architecture Refactor

## Overview

This is a major architectural refactor of the existing TCG Playmat codebase. The old 4-row CSS Grid battlefield layout is replaced with a continuous-flow dynamic row system. The refactor updates data models, game state management, layout components, and adds new features (mulligan engine, equipment docking, fanning, keybinds, context menu, counters, HD Zoom Portal). All changes are incremental — existing parsers, API layer, and import logic are preserved and extended.

## Tasks

- [x] 1. Refactor data models and type definitions
  - [x] 1.1 Rewrite `src/types.ts` with new data models
    - Replace `BattlefieldCard` and `GridPosition` with `RowCard`, `RowTarget`, `SplitRow`, `CreatureArea`, `CreatureRow`
    - Add `GamePhase`, `MulliganState`, `Counter`, `CounterType`, `Attachment`, `EffectiveStats`, `StatModifier`
    - Add `KeywordAbility` type and `CardType` discriminator
    - Extend `CardData` with `imageURILarge`, `keywords`, `basePower`, `baseToughness`, `cardType`
    - Add `ExileCard` (already exists, keep), `FanGroup`, `HDZoomPortalProps`
    - Update `GameState` interface: replace `battlefield: BattlefieldCard[]` with `creatureArea`, `row3`, `row4`, add `gamePhase`, `mulliganState`, `lifeTotal`
    - _Requirements: 20.1, 20.2, 20.3, 4.1, 5.1, 6.1, 9.1, 11.1, 17.1_

  - [x] 1.2 Write property tests for data model invariants
    - **Property 14: Schema Conformance** — validate CardData shape constraints (UUID id, lowercase setCode 3-5 chars, HTTPS imageURI, non-empty typeLine)
    - **Validates: Requirements 20.1, 20.2, 20.4, 20.5**

  - [x] 1.3 Add keyword parsing module `src/keywords.ts`
    - Implement `KEYWORD_PATTERNS` dictionary with regex for all 17 keyword abilities
    - Implement `parseKeywords(oracleText: string): KeywordAbility[]` function
    - Implement `STAT_MODIFIER_PATTERN` regex and `calculateEffectiveStats()` function
    - Implement `parseCreatureStats(typeLine: string): [number, number]` helper
    - _Requirements: 18.1, 18.2, 18.3, 9.8_

  - [x] 1.4 Write property tests for keyword parsing
    - **Property 20: Keyword Parsing Completeness** — for any oracle text containing recognized keywords, parser detects all matching keywords
    - **Validates: Requirements 18.1**

- [x] 2. Refactor game state management and core actions
  - [x] 2.1 Rewrite `src/gameActions.ts` for new state shape
    - Update `drawCard`, `shuffleLibrary`, `softReset`, `tapCard`, `flipCard`, `transformDFC` to work with new `GameState` (creatureArea, row3, row4)
    - Add `untapAll()` that untaps all battlefield cards including attachments
    - Add `moveCard()` updated for `RowTarget` destinations instead of `GridPosition`
    - Add `removeCardFromZone()` updated to search creature rows, row3, row4, and attachment slots
    - Add `addToBattlefield(card, targetRow)` with auto-assignment logic based on `cardType`
    - Add `isGameInProgress()` updated for new zone structure
    - _Requirements: 26.1, 26.4, 28.1, 28.3, 25.1, 25.2, 25.3, 6.3, 6.4, 6.5, 22.4_

  - [x] 2.2 Write property tests for zone exclusivity and card conservation
    - **Property 1: Zone Exclusivity** — for any game state, each card ID appears in exactly one location
    - **Property 2: Card Count Conservation** — for any state transition, total card count remains constant
    - **Validates: Requirements 22.4, 25.6, 28.4**

  - [x] 2.3 Implement creature row splitting logic
    - Implement `recalculateCreatureRows(creatureArea): CreatureArea` with thresholds (≤7 → 1 row, ≤24 → 2 rows, >24 → 3 rows)
    - Implement `countIndependentElements(elements): number` counting fanned groups as 1
    - Integrate row recalculation into all battlefield mutations
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.7_

  - [x] 2.4 Write property tests for creature row capacity
    - **Property 6: Creature Row Capacity** — row count matches thresholds based on element count
    - **Property 7: Fanned Group Invariant** — same-name cards form exactly one group, each counts as 1 element
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 8.1, 8.5, 8.6**

  - [x] 2.5 Implement equipment docking actions
    - Implement `attachEquipment(state, equipmentId, creatureId): GameState`
    - Implement `detachEquipment(state, equipmentId, creatureId): GameState`
    - Equipment removed from row flow when attached, returned to row when detached
    - Auto-calculate effective P/T using `calculateEffectiveStats()`
    - _Requirements: 9.1, 9.4, 9.7, 9.8, 9.9, 9.10_

  - [x] 2.6 Write property tests for equipment docking
    - **Property 9: Equipment Docking Isolation** — docked equipment not in any row flow
    - **Property 10: Equipment Stat Modifier Additivity** — effective stats = base + sum of modifiers
    - **Validates: Requirements 9.1, 9.7, 9.8, 9.9**

  - [x] 2.7 Implement mulligan engine
    - Implement `initializeMulligan(state): GameState` — draw 7, set phase to MULLIGAN
    - Implement `mulliganAgain(state): GameState` — shuffle back, redraw 7, increment count
    - Implement `confirmKeep(state): GameState` — put back selected cards, transition to PLAYING
    - Implement `togglePutBack(state, cardId): GameState` — toggle card selection
    - First mulligan is free (requiredPutBacks = max(0, mulliganCount - 1))
    - _Requirements: 11.4, 11.6, 11.7, 11.8, 11.11_

  - [x] 2.8 Write property tests for mulligan engine
    - **Property 11: Mulligan Put-Back Formula** — requiredPutBacks = max(0, N-1)
    - **Property 12: Mulligan Card Conservation** — total cards constant through mulligan actions
    - **Property 13: Mulligan Privacy Invariant** — during MULLIGAN phase, all battlefield zones empty
    - **Validates: Requirements 11.7, 11.8, 11.10, 11.6, 11.11, 11.2, 11.3**

  - [x] 2.9 Implement counter system actions
    - Implement `addCounter(state, cardId, counterType): GameState`
    - Implement `removeCounter(state, cardId, counterType): GameState`
    - Implement `setCustomCounter(state, cardId, name, value): GameState`
    - Support all 24 counter types defined in `CounterType`
    - _Requirements: 17.1, 17.2, 17.3, 17.5, 17.6_

  - [x] 2.10 Write property tests for counter arithmetic
    - **Property 21: Counter Arithmetic** — increment produces V+1, decrement produces V-1
    - **Validates: Requirements 17.3**

- [x] 3. Checkpoint — Core logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Refactor persistence layer
  - [x] 4.1 Update `src/persistence.ts` for new GameState shape
    - Serialize/deserialize new state structure (creatureArea, row3, row4, mulliganState, counters, attachments)
    - Handle `Set<string>` → Array conversion for `selectedToPutBack`
    - Add corrupted state recovery (return empty state on parse failure)
    - Maintain 100ms debounced writes
    - Handle QuotaExceededError with warning toast
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [x] 4.2 Write property tests for persistence round-trip
    - **Property 4: State Persistence Round-Trip** — deserialize(serialize(s)) ≡ s
    - **Property 32: Corrupted State Recovery** — invalid JSON initializes empty state without crash
    - **Validates: Requirements 23.1, 23.2, 23.4**

  - [x] 4.3 Write property tests for soft reset correctness
    - **Property 5: Soft Reset Correctness** — after reset: commanders in CZ, mainboard in library, all other zones empty, gamePhase = MULLIGAN
    - **Validates: Requirements 25.1, 25.2, 25.3, 25.4**

- [x] 5. Refactor API layer and deck import
  - [x] 5.1 Extend `src/api/mapToCardData.ts` for enriched CardData
    - Add `imageURILarge` mapping from Scryfall `image_uris.large`
    - Add `basePower` and `baseToughness` extraction
    - Add `cardType` derivation from `typeLine`
    - Integrate keyword parsing on import (call `parseKeywords`)
    - Handle DFC `card_faces` for both faces
    - _Requirements: 20.2, 20.3, 18.1, 18.3_

  - [x] 5.2 Update `src/api/scryfallResolver.ts` rate limiting
    - Ensure minimum 50ms delay between consecutive requests
    - Batch via `/cards/collection` endpoint (max 75 per batch)
    - Add progress callback for bulk imports
    - Report failed cards without blocking successful imports
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

  - [x] 5.3 Write property tests for rate limit compliance
    - **Property 15: Rate Limit Compliance** — time between consecutive requests ≥ 50ms, batch size ≤ 75
    - **Validates: Requirements 21.1, 21.2**

  - [x] 5.4 Update deck import to initialize mulligan phase
    - After import completes, call `initializeMulligan()` to set gamePhase = MULLIGAN
    - Commanders → commandZone, mainboard → library, then draw 7 for mulligan
    - _Requirements: 11.1, 19.5_

- [x] 6. Checkpoint — Data layer and import tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Refactor layout shell and zone structure
  - [x] 7.1 Refactor `src/components/AppShell.tsx` for new grid layout
    - Outer grid: 2 rows (83.33vh upper, 16.67vh Zone C)
    - Upper region inner grid: 2 columns (1fr Zone A, responsive sidebar Zone B)
    - Zone C spans full width at bottom
    - Add DndContext wrapper (install @dnd-kit/core + @dnd-kit/sortable)
    - Mount global keybind listener at root
    - Enforce `overflow: hidden` on root
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 3.2, 3.4_

  - [x] 7.2 Refactor `src/components/Battlefield.tsx` for continuous flow
    - Remove old 4-row CSS Grid layout entirely
    - Implement creature area (3/5 height) with 1-3 dynamic RowTrack components
    - Implement Row 3 (1/5 height) as SplitRow: lands left L→R, artifacts right R→L
    - Implement Row 4 (1/5 height) as SplitRow: utility lands left L→R, enchantments right R→L
    - Add conditional PW/Battle column on far-right of creature area
    - Add Hand Count HUD at bottom-left above crop line
    - Render blank during MULLIGAN phase
    - Apply `transition-all duration-300 ease-in-out` for card animations
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 6.1, 6.2, 7.1, 7.3, 30.1, 30.3, 11.3_

  - [x] 7.3 Create `src/components/RowTrack.tsx` component
    - Render cards in flex-row layout with continuous flow
    - Group same-name cards into FannedGroup components
    - Provide drop zones between cards for insertion with animated gap preview
    - Support drag-between-rows for reordering
    - Z-index management: sequential increment per card in fan
    - _Requirements: 4.2, 4.4, 4.5, 8.1, 8.7, 8.8_

  - [x] 7.4 Create `src/components/FannedGroup.tsx` component
    - Stack same-name cards with 95% horizontal overlap (5% exposed showing art banner)
    - Sequential z-index (newest on top, fully visible)
    - Entire group counts as 1 element for capacity
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 7.5 Write property tests for fanning z-index ordering
    - **Property 8: Fanning Z-Index Ordering** — z-index of card[i] < z-index of card[i+1] for all cards in a fan
    - **Validates: Requirements 8.4**

- [x] 8. Refactor sidebar and hand tray
  - [x] 8.1 Refactor `src/components/PublicStack.tsx` (Zone B) for responsive width
    - Change from fixed 280px to responsive one-card-width (viewport-relative units)
    - Reorder stacks: Command Zone → Library → Graveyard → Exile (top to bottom)
    - Each stack occupies 1/4 of sidebar height
    - Add delirium count display on Graveyard stack
    - Implement `calculateDelirium()` function
    - Add Draw and Shuffle actions for Library
    - All stacks are valid drop targets
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.9, 12.10, 13.1, 13.5_

  - [x] 8.2 Write property tests for delirium tracking
    - **Property 24: Delirium Count Accuracy** — count equals unique MTG card types in graveyard, range 0-9
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4**

  - [x] 8.3 Refactor `src/components/HandTray.tsx` (Zone C) for new features
    - Render hand cards in fan/arc arrangement during PLAYING phase
    - Add horizontal scroll for large hands (>15 cards) with hidden scrollbar
    - Spread cards on hover for readability
    - Host MulliganTray during MULLIGAN phase
    - Host HDZoomPortal to the right of hand cards
    - Full viewport width, 16.67vh height
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

  - [x] 8.4 Create `src/components/HDZoomPortal.tsx` component
    - Show high-res card image on hover (any card on battlefield or hand)
    - Position: absolute, right side of Zone C
    - Display parsed keyword abilities as visual badges
    - Display counter values and attachment list
    - Must NEVER render above OBS crop line
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7_

- [x] 9. Checkpoint — Layout refactor renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement mulligan UI and equipment dock components
  - [x] 10.1 Create `src/components/MulliganTray.tsx` component
    - Fan drawn cards horizontally in Zone C
    - Click cards to toggle `selectedToPutBack` (50% opacity + red border)
    - "Confirm Keep" disabled until exact put-back count selected
    - "Mulligan Again" button
    - Entire UI renders ONLY within bottom 16.67vh
    - _Requirements: 11.2, 11.4, 11.5, 11.9, 11.10_

  - [x] 10.2 Create `src/components/EquipmentDock.tsx` component
    - Render attached equipment behind creature with 15px cascade offset
    - Display equipment name as white text on dark grey, sideways
    - Show modified P/T on creature (e.g., "3/4 → 5/6")
    - Moving/tapping creature moves all attachments in sync
    - Ctrl+click to fan out attachments for individual selection
    - _Requirements: 9.2, 9.3, 9.7, 9.8, 9.11_

- [x] 11. Implement keybind engine
  - [x] 11.1 Create `src/components/KeybindEngine.tsx` (or hook `src/hooks/useKeybinds.ts`)
    - Register global `keydown` listener
    - Implement all page actions: N (next turn), U (untap all), D (draw), Ctrl+G (new game), Ctrl+S (shuffle), Ctrl+F (browse library), Ctrl+Z (undo), ? (keybind overlay)
    - Implement card movement keys: B, H, G, E, Z, Y, L (move hovered card)
    - Implement battlefield actions: T (tap), F (flip), M (morph), P (phase), C (token copy), + (add counter), - (remove counter), Delete
    - Implement Ctrl+E (equip mode), Spacebar (reveal toggle), 1-9 (quick play from hand), Alt+1-9 (peek)
    - Suppress keybinds when text input is focused
    - Apply actions to hovered card or all selected cards (multi-select)
    - _Requirements: 15.1–15.26_

  - [x] 11.2 Write property tests for keybind input isolation
    - **Property 25: Keybind Input Isolation** — no game action triggered when focus is in text input
    - **Validates: Requirements 15.26**

- [x] 12. Implement context menu
  - [x] 12.1 Create `src/components/ContextMenu.tsx` component
    - Render on right-click at cursor position
    - Battlefield card menu: Tap, Move to submenu, Card actions submenu, Add counters grid, Power/Toughness +/-, Equip/Detach, View details, Create token copy, Delete
    - Hand card menu: Play to Battlefield, Move to submenu, Reveal/Hide
    - Stack zone card menu: Move to submenu, Flip face-down (Exile only)
    - Display keyboard shortcut hints next to items
    - Dismiss on click-away or Escape
    - Adapt options based on card zone and card type
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

- [x] 13. Checkpoint — Interaction systems functional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement drag-and-drop with @dnd-kit
  - [x] 14.1 Install and configure @dnd-kit
    - Install `@dnd-kit/core` and `@dnd-kit/sortable` packages
    - Configure DndContext in AppShell with sensors (pointer, keyboard)
    - Define droppable zones for all Row_Tracks, Zone B stacks, and Zone C
    - _Requirements: 22.1, 22.2, 22.3_

  - [x] 14.2 Refactor `src/components/DraggableCard.tsx` for @dnd-kit
    - Replace existing drag implementation with @dnd-kit useDraggable
    - Card image follows cursor during drag (CSS transform, no DOM cloning)
    - Support cross-zone drag (hand → battlefield, battlefield → sidebar, etc.)
    - Snap back on invalid drop with no state change
    - _Requirements: 22.4, 22.5, 22.6_

  - [x] 14.3 Write property tests for invalid drop no-op
    - **Property 16: Invalid Drop No-Op** — card dropped outside valid zone results in no state change
    - **Validates: Requirements 22.5, 29.2**

  - [x] 14.4 Implement equipment docking via drag
    - Detect drag of equipment onto creature → trigger `attachEquipment`
    - Detect drag of equipment away from creature → trigger `detachEquipment`
    - _Requirements: 9.4, 9.10_

- [x] 15. Wire remaining game actions and state hooks
  - [x] 15.1 Refactor `src/hooks/useGameState.ts` for new architecture
    - Replace useReducer/useState to handle new GameState shape
    - Integrate mulligan actions (initializeMulligan, mulliganAgain, confirmKeep)
    - Integrate equipment actions (attach, detach)
    - Integrate counter actions (add, remove, custom)
    - Integrate row recalculation on every battlefield mutation
    - Integrate delirium recalculation on graveyard changes
    - Wire persistence (debounced 100ms localStorage writes)
    - _Requirements: 23.3, 5.2, 9.8, 13.4, 17.6_

  - [x] 15.2 Update `src/hooks/useHoveredCard.ts` for HD Zoom Portal
    - Track hovered card across all zones (battlefield, hand, sidebar)
    - Provide `hoveredCard` data including keywords, counters, attachments to HDZoomPortal
    - _Requirements: 10.1, 10.5_

  - [x] 15.3 Write property tests for untap all and tap toggle
    - **Property 22: Untap All Completeness** — after untapAll, no card has isTapped === true
    - **Property 23: Tap Toggle Idempotence** — tap(tap(s)) === s
    - **Validates: Requirements 26.4, 26.1**

  - [x] 15.4 Write property tests for draw and shuffle
    - **Property 18: Draw Correctness** — draw moves top card to hand, lengths change by 1, empty library is no-op
    - **Property 19: Shuffle Preservation** — shuffle produces permutation of same cards, no cards added/removed
    - **Validates: Requirements 28.1, 28.2, 28.3, 28.4**

  - [x] 15.5 Write property tests for DFC transform and row assignment
    - **Property 28: DFC Transform Toggle** — transform twice returns to original face
    - **Property 29: Card Type Row Assignment** — card type determines correct row assignment
    - **Property 30: Planeswalker/Battle Column Visibility** — column rendered iff at least one PW/battle exists
    - **Validates: Requirements 27.1, 27.2, 6.1–6.5, 7.1, 7.3, 7.4**

- [x] 16. Checkpoint — Full integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Error handling, edge cases, and final wiring
  - [x] 17.1 Implement error handling across the app
    - Scryfall unavailable: error toast + retry option
    - Invalid drop: snap back with animation, no state change
    - localStorage quota: warning toast, continue in-memory
    - Moxfield/Archidekt URL invalid: error message with 10s timeout
    - API errors never corrupt existing game state
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5_

  - [x] 17.2 Ensure no-page-refresh invariant
    - Verify no `window.location.reload()` calls exist in codebase
    - All state transitions via React state updates only
    - Error states handled with in-app UI (toasts, modals)
    - Soft reset keeps React tree mounted
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

  - [x] 17.3 Write property tests for error state isolation and no-refresh
    - **Property 27: API Error State Isolation** — API errors leave game state unchanged
    - **Property 17: No Page Refresh Invariant** — no reload or navigation event fires
    - **Validates: Requirements 29.5, 24.1, 24.4**

  - [x] 17.4 Wire hand count HUD updates
    - Display hand.length at bottom-left of Zone A, above OBS crop line
    - Update immediately on any card movement involving hand
    - _Requirements: 30.1, 30.2, 30.3_

  - [x] 17.5 Write property test for hand count HUD accuracy
    - **Property 31: Hand Count HUD Accuracy** — displayed count equals hand.length after any movement
    - **Validates: Requirements 30.1, 30.2**

- [x] 18. Final checkpoint — All tests pass, full integration verified
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- This is a REFACTOR — existing parsers (moxfield, archidekt, csv, plainText), toast system, and confirm dialog are preserved
- Install `@dnd-kit/core`, `@dnd-kit/sortable`, and `fast-check` as new dependencies
- Existing tests in `src/__tests__/` will need updating as data models change — update them alongside the relevant task

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.5", "2.7", "2.9"] },
    { "id": 4, "tasks": ["2.4", "2.6", "2.8", "2.10", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "5.1", "5.2"] },
    { "id": 6, "tasks": ["5.3", "5.4"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2", "8.1"] },
    { "id": 9, "tasks": ["7.3", "7.4", "8.3", "8.4"] },
    { "id": 10, "tasks": ["7.5", "8.2", "10.1", "10.2"] },
    { "id": 11, "tasks": ["11.1", "12.1"] },
    { "id": 12, "tasks": ["11.2", "14.1"] },
    { "id": 13, "tasks": ["14.2", "14.4"] },
    { "id": 14, "tasks": ["14.3", "15.1", "15.2"] },
    { "id": 15, "tasks": ["15.3", "15.4", "15.5"] },
    { "id": 16, "tasks": ["17.1", "17.2", "17.4"] },
    { "id": 17, "tasks": ["17.3", "17.5"] }
  ]
}
```
