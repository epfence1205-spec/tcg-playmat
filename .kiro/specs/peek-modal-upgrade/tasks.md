# Implementation Tasks

## Task 1: Create peekActions.ts with types and pure state transform
- [x] Create `src/peekActions.ts` with `PeekMode` type, `PeekResult` interface, and `applyPeekResult` function
- [x] `PeekMode = 'scry' | 'surveil' | 'select' | 'peek'`
- [x] `applyPeekResult` removes peeked cards from library, places topCards at front, bottomCards at end, handCards appended to hand, graveyardCards prepended to graveyard
- [x] Export all types for consumer use

**Requirements:** 3.5, 4.5, 5.5, 6.2
**Design:** applyPeekResult section

## Task 2: Create peekActions.test.ts with unit tests
- [x] Test `applyPeekResult` — scry all-top: library order = topCards + remaining
- [x] Test `applyPeekResult` — scry mixed: topCards at front, bottomCards at end
- [x] Test `applyPeekResult` — surveil: graveyardCards prepended to graveyard
- [x] Test `applyPeekResult` — select: handCards appended to hand, bottomCards at end of library
- [x] Test card conservation: sum of all result arrays === original peeked count
- [x] Test empty arrays: no crash, state unchanged for empty destinations

**Requirements:** Property 1, Property 2
**Design:** Testing Strategy section

## Task 3: Create PeekModeSelector component
- [ ] Create `src/components/PeekModeSelector.tsx`
- [ ] Render 4 mode options (Scry, Surveil, Select, Peek) in a small centered popup
- [ ] Display count in header ("Peek 3 — Choose Mode")
- [ ] Support Arrow Up/Down keyboard navigation with highlighted state
- [ ] Support Enter to confirm highlighted mode
- [ ] Support single-letter shortcuts: S=Scry, V=Surveil, E=Select, P=Peek
- [ ] Escape or backdrop click calls `onClose`
- [ ] Render within upper 83.33vh (max-h-[83.33vh], centered)
- [ ] Suppress global keybinds while open (stopPropagation on keydown)

**Requirements:** 1.1, 1.4, 1.7, 8.2, 8.7
**Design:** PeekModeSelector component section

## Task 4: Create PeekModeSelector.test.tsx
- [ ] Test renders 4 mode options with correct labels
- [ ] Test keyboard: ArrowDown moves highlight, Enter selects
- [ ] Test keyboard shortcuts: S/V/E/P select correct mode
- [ ] Test Escape calls onClose
- [ ] Test backdrop click calls onClose
- [ ] Test onSelectMode called with correct PeekMode value

**Requirements:** 1.1, 1.4, 8.2
**Design:** Testing Strategy section

## Task 5: Rewrite PeekModal with mode-aware interactive UI
- [ ] Update `PeekModalProps` to include `mode: PeekMode` and `onConfirm: (result: PeekResult) => void`
- [ ] Internal state: `assignments: PeekCardAssignment[]` with card + destination
- [ ] Initialize assignments based on mode defaults (scry/surveil: all "top", select: all "bottom")
- [ ] Render header with mode name + count (e.g., "Scry 3")
- [ ] Render cards grouped by destination with labeled section headers
- [ ] Render position numbers (1-indexed) within each group
- [ ] Color-coded borders per destination (blue=top, amber=bottom, green=hand, purple=graveyard)
- [ ] Click card toggles destination (scry: top↔bottom, surveil: top↔graveyard, select: bottom↔hand)
- [ ] Peek mode: read-only, no toggles, no Confirm button, no drag
- [ ] Confirm button calls `onConfirm` with correctly structured `PeekResult`
- [ ] Cancel button and Escape call `onClose`
- [ ] Backdrop click calls `onClose`
- [ ] Select mode: show "{K} selected" count
- [ ] Render within upper 83.33vh

**Requirements:** 2.1, 3.1-3.6, 4.1-4.5, 5.1-5.7, 6.1-6.7, 7.1-7.6
**Design:** PeekModal component section

## Task 6: Add @dnd-kit/sortable reordering within destination groups
- [ ] Wrap each destination group's card list in a `SortableContext`
- [ ] Each card rendered as a sortable item with drag handle
- [ ] Constrain drag to within the same destination group (separate SortableContext per group)
- [ ] On drag end: reorder within the group's assignments array
- [ ] Update position indicators immediately on reorder
- [ ] Peek mode: disable drag entirely
- [ ] When card changes destination, append to end of target group

**Requirements:** 2.2, 2.3, 2.4, 2.6, 3.4, 4.4, 5.4
**Design:** Card interaction section

## Task 7: Add keyboard navigation within PeekModal
- [ ] Arrow Left/Right cycles focus between cards (visual focus ring)
- [ ] Space on focused card toggles its destination (same as click)
- [ ] Suppress global keybinds while modal is open (stopPropagation on keydown)
- [ ] Enter activates Confirm button
- [ ] Tab navigates to Confirm/Cancel buttons

**Requirements:** 8.4, 8.7
**Design:** Card interaction section

## Task 8: Wire up App.tsx — mode selector → modal flow
- [ ] Add state: `showPeekModeSelector`, `peekCount`, `peekMode`
- [ ] Replace PEEK action handler: open mode selector instead of directly opening modal
- [ ] Guard: if library empty, no-op; if modal already open, ignore
- [ ] Guard: if mode selector already open, update count only
- [ ] `handlePeekModeSelected`: close selector, slice library, open modal with mode
- [ ] `handlePeekConfirm`: call `applyPeekResult` via `setGameStateWithHistory`, close modal
- [ ] Render `PeekModeSelector` component with props
- [ ] Update `PeekModal` render with new props (`mode`, `onConfirm`)

**Requirements:** 1.1, 1.2, 1.5, 1.6, 6.2, 6.3, 8.1, 8.5, 8.6
**Design:** App.tsx integration changes section

## Task 9: Update KeybindOverlay description
- [ ] Change "Peek top N cards" to "Scry/Surveil/Select/Peek top N cards"

**Requirements:** 8.1
**Design:** Component list item 6

## Task 10: PeekModal.test.tsx — component tests
- [ ] Test scry mode: renders header "Scry N", cards default to top group
- [ ] Test scry mode: click moves card to bottom group, click again moves back
- [ ] Test surveil mode: click moves card to graveyard group
- [ ] Test select mode: cards default to bottom, click moves to hand
- [ ] Test select mode: shows "N selected" count
- [ ] Test peek mode: no Confirm button, no click toggles
- [ ] Test Confirm: calls onConfirm with correct PeekResult (cards in correct arrays, correct order)
- [ ] Test Cancel: calls onClose, does not call onConfirm
- [ ] Test Escape: same as cancel

**Requirements:** All
**Design:** Testing Strategy section
