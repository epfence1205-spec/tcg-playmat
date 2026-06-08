# Technology Stack & Rules

- **Framework:** React (Vite scaffolding).
- **Styling:** Tailwind CSS.
- **Card Data:** Strict reliance on the external Scryfall API.
- **Data Schema:** Every card object must conform to: `name`, `setCode`, `collectorNumber`, `imageURI`, `typeLine`, `oracleText`.
- **State Management:** Local React state with strict persistence. Absolutely no full-page browser refreshes allowed. Use a "Soft Reset" function to clear state without breaking active window capture.

# Drag Architecture — DO NOT DEVIATE

- **`SortableCardWrapper`** is the SOLE drag source for all battlefield cards (creatures, lands, artifacts, enchantments). It uses `useSortable` which provides both within-row reorder and cross-zone drag.
- **`DroppableCardSlot`** is a drop TARGET only (receives equipment/auras). It uses `useDroppable`.
- **Cards inside `DroppableCardSlot` render as plain `<img>` tags — NEVER use `DraggableCard` inside a sortable wrapper.** `DraggableCard` registers a duplicate ID with dnd-kit and breaks the ghost overlay.
- **`DraggableCard` is ONLY used for:** hand tray cards, and independently-draggable equipment attachments inside `CreatureOuterDiv` (with `onPointerDown={stopPropagation}`).
- Do not add `useDraggable` to any component rendered inside `SortableCardWrapper`.