# Technology Stack & Rules

- **Framework:** React (Vite scaffolding).
- **Styling:** Tailwind CSS.
- **Card Data:** Strict reliance on the external Scryfall API.
- **Data Schema:** Every card object must conform to: `name`, `setCode`, `collectorNumber`, `imageURI`, `typeLine`, `oracleText`.
- **State Management:** Local React state with strict persistence. Absolutely no full-page browser refreshes allowed. Use a "Soft Reset" function to clear state without breaking active window capture.

# Drag Architecture — DO NOT DEVIATE

Every battlefield card uses the SAME 3-div hierarchy. No exceptions. No alternative wrappers. No `useDroppable` inside battlefield card trees.

```
SortableCardWrapper  (useSortable — drag source + sortable displacement)
  └─ RotationDiv     (tap rotation, attachments/EquipmentDock, counters, badges, name banner)
       └─ <img>      (Scryfall card image — plain img tag, never DraggableCard)
```

- **`SortableCardWrapper`** is the SOLE drag source for all battlefield cards (creatures, lands, artifacts, enchantments, planeswalkers). It uses `useSortable` which provides within-row reorder, cross-row drag, and ghost overlay (0.3 opacity placeholder).
- **`RotationDiv`** is the SOLE inner wrapper for all battlefield cards. It handles tap rotation, equipment/aura attachment rendering (EquipmentDock), keyword badges, counters, and name banners. It does NOT use `useDroppable` or `useDraggable`.
- **Cards inside `RotationDiv` render as plain `<img>` tags — NEVER use `DraggableCard` inside a sortable wrapper.** `DraggableCard` registers a duplicate ID with dnd-kit and breaks the ghost overlay AND sortable displacement.
- **`DraggableCard` is ONLY used for:** hand tray cards, and independently-draggable equipment attachments inside `RotationDiv` (with `onPointerDown={stopPropagation}`).
- **Do NOT add `useDroppable` inside any component rendered within `SortableCardWrapper`.** It steals the `over` event from `SortableContext` and kills the "cards move aside" displacement animation.
- **Do NOT add `useDraggable` to any component rendered inside `SortableCardWrapper`.**
- **Equipment/aura docking works via `SortableCardWrapper`'s `data` prop** (which includes `cardId`, `cardType`, `rowId`). The drag-end handler reads `overData.cardType === 'creature'` to detect attachment drops. No separate `useDroppable` is needed.