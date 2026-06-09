# Changelog

## 2026-06-09

### Features
- **Graveyard Browser (Ctrl+Y)** — searchable modal to browse graveyard, move cards to any zone
- **Exile Browser (Ctrl+E)** — searchable modal to browse exile, respects face-down state
- **Play Tapped** — context menu + zone browser option to play a card directly tapped
- **Play Face-Down** — manifest/dread support, plays card showing card back regardless of DFC status
- **Play as Back Face** — zone browser option for DFCs (only shown when card has back face)
- **Keybinds in zone browsers** — hover a card in any zone browser and use G/H/B/E/Y to move it
- **Equip mode moved to Alt+E** — freed Ctrl+E for exile browser

### Refactors
- **Unified ZoneBrowser component** — replaced LibraryBrowser, GraveyardBrowser, ExileBrowser with a single configurable component
- **RotationDiv** — renamed CreatureOuterDiv, now used universally for all battlefield cards (creatures, lands, artifacts, enchantments, planeswalkers)
- **Removed DroppableCardSlot** — its `useDroppable` was stealing `over` events from SortableContext, breaking sortable displacement for lands/artifacts
- **handleZoneBrowserMove** — single shared handler for all zone browser move actions (replaces 3 identical inline handlers)

### Bug Fixes
- **Sortable displacement fixed for lands/artifacts** — cards now shift aside when dragging within split rows (root cause: `useDroppable` inside `SortableCardWrapper` tree)
- **PLAY_TO_BATTLEFIELD** — now uses `cardZone` (actual source) instead of hardcoded `'hand'`, works from any zone via context menu

### Architecture (steering updated)
- Every battlefield card uses the same 3-div hierarchy: `SortableCardWrapper` → `RotationDiv` → `<img>`
- No `useDroppable` inside any component rendered within `SortableCardWrapper`
- Equipment/aura docking works via `SortableCardWrapper`'s `data` prop — no separate droppable needed
- Zone browsers use `data-card-id` / `data-card-zone` attributes for hover detection (same system as battlefield/hand)

### Test Deck
- Terra, Herald of Hope (FIC commander)
