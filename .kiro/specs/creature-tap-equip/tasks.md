# Implementation Plan: Creature Tap & Equipment Outer Div

## Overview

Replace the current multi-div creature rendering (DroppableCardSlot + EquipmentDock wrapper) with a single Outer_Div model. Start with pure layout functions (testable in isolation), then build the new component, then wire it into the existing battlefield.

## Tasks

- [ ] 1. Create pure functions module `src/creatureLayout.ts`
  - [x] 1.1 Implement `computeOuterDivWidthVh`
    - Create `src/creatureLayout.ts` with the single exported function
    - Returns `16` when tapped, `11.43 + N * 2` when untapped
    - _Requirements: 2.1, 2.2, 4.1, 4.2_

  - [x]* 1.2 Write property test for `computeOuterDivWidthVh` (Property 1)
    - **Property 1: Outer Div Width Calculation**
    - Test: untapped → `11.43 + N * 2`; tapped → always `16` regardless of N
    - **Validates: Requirements 2.1, 2.2, 4.1, 4.2**

  - [x] 1.3 Implement `computeZIndex`
    - Add to `src/creatureLayout.ts`
    - equipment → index; creature → N; overlay → N+1; drag → N+2
    - _Requirements: 9.1, 9.2_

  - [x]* 1.4 Write property test for `computeZIndex` (Property 3)
    - **Property 3: Z-Index Layer Stack Formula**
    - Test: equipment[i] = i, creature = N, overlay = N+1, drag = N+2
    - **Validates: Requirements 9.1, 9.2**

  - [x] 1.5 Implement `worstCaseFootprintVh`
    - Add to `src/creatureLayout.ts`
    - Returns `max(computeOuterDivWidthVh(isTapped, N), 16)`
    - _Requirements: 8.1_

  - [x]* 1.6 Write property test for `worstCaseFootprintVh` (Property 6)
    - **Property 6: Worst-Case Footprint Calculation**
    - Test: result = max(width, 16) for all tap/attachment combos
    - **Validates: Requirements 8.1**

  - [x] 1.7 Implement `computeCompression`
    - Add to `src/creatureLayout.ts`
    - Returns `max(0, (totalWidth + gaps - containerWidth) / (cardCount - 1))`
    - Guard: return 0 when cardCount ≤ 1
    - _Requirements: 7.1, 7.2, 7.3_

  - [x]* 1.8 Write property test for `computeCompression` (Property 4)
    - **Property 4: Compression Formula**
    - Test: 0 when fits; correct formula when overflows; never negative
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 1.9 Implement `shouldSplitRows`
    - Add to `src/creatureLayout.ts`
    - Sums worst-case footprints + gaps, returns true if > containerWidthVh
    - _Requirements: 8.2, 8.3_

  - [x]* 1.10 Write property test for `shouldSplitRows` (Property 7)
    - **Property 7: Row Split Decision**
    - Test: split iff sum of footprints + gaps > container width
    - **Validates: Requirements 8.2, 8.3**

- [ ] 2. Checkpoint — Pure functions complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Create `CreatureOuterDiv` component
  - [ ] 3.1 Create `src/components/CreatureOuterDiv.tsx` with outer div shell
    - Define `CreatureOuterDivProps` interface
    - Render a single div with computed width, height 16vh, rotation when tapped
    - Apply CSS transition `transform 200ms ease, width 200ms ease`
    - Register as droppable target for equipment attachment (reuse existing pattern)
    - Render the creature's `DraggableCard` inside (no equipment yet)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.5_

  - [ ] 3.2 Add equipment cascade rendering to `CreatureOuterDiv`
    - Render each attachment absolutely positioned: `left: index * 2vh`, full card width, only 2vh strip visible
    - Each equipment card gets z-index from `computeZIndex('equipment', N, index)`
    - Creature card positioned at `left: N * 2vh` with z-index `computeZIndex('creature', N)`
    - Add sideways name banner (`writing-mode: vertical-rl`, `rotate(180deg)`) on each equipment strip
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 9.1, 9.2_

  - [ ] 3.3 Add pointer event isolation on equipment cards
    - Each equipment card wrapper calls `stopPropagation` on `pointerDown` and `click`
    - Creature tap handler must not fire when interacting with equipment
    - _Requirements: 5.1, 5.3_

  - [ ] 3.4 Add overlay layer (badges, banners, counters)
    - Render keyword badges, counter badges, and NamePTBanner at z-index `N+1`
    - NamePTBanner only visible when `isCompressed` prop is true
    - _Requirements: 7.4, 9.1_

  - [ ] 3.5 Add keyword badge counter-rotation when tapped
    - When `creature.isTapped`, apply `transform: rotate(-90deg)` to keyword badge container
    - When untapped, no counter-rotation
    - Badges stay positionally attached, only visual orientation changes
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 3.6 Add Alt+click fan-out for attachments
    - Alt+click on creature toggles fanned view (reuse existing FannedAttachmentCard pattern from EquipmentDock)
    - Fan panel shows each attachment with "Move to" and "Equip to" actions
    - _Requirements: 5.2_

- [ ] 4. Checkpoint — CreatureOuterDiv component complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update RowTrack to use CreatureOuterDiv
  - [ ] 5.1 Refactor creature row rendering in `Battlefield.tsx`
    - Replace `DroppableCardSlot` usage for creature rows with `CreatureOuterDiv`
    - Pass `isCompressed` and negative margin style from compression calculation
    - Keep `DroppableCardSlot` for non-creature rows (lands, etc.) unchanged
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 5.2 Add width-based compression to creature RowTrack
    - Add `containerRef` and `useEffect` that calls `computeCompression`
    - Compute `vhToPx` from `window.innerHeight / 100`
    - Apply negative margin to each `CreatureOuterDiv` after the first when compressed
    - Recalculate on tap/untap/attach/detach (use serialized elements key)
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [ ] 6. Update `creatureRows.ts` for width-based splitting
  - [ ] 6.1 Replace count-based split with `shouldSplitRows`
    - Change `recalculateCreatureRows` to accept `containerWidthVh` and `gapVh` parameters
    - Replace `elementCount > 14` condition with `shouldSplitRows(permanents, containerWidthVh, gapVh)`
    - Keep even distribution logic (`ceil(N/2)` / `floor(N/2)`) unchanged
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [ ]* 6.2 Write property test for even distribution on split (Property 8)
    - **Property 8: Even Distribution on Split**
    - Test: first row gets `ceil(N/2)`, second row gets `floor(N/2)`
    - **Validates: Requirements 8.4**

  - [ ] 6.3 Update callers of `recalculateCreatureRows` to pass container width
    - Find all call sites and pass measured container width (vh) and gap (0.5vh for gap-1)
    - _Requirements: 8.2_

- [ ] 7. Checkpoint — All wiring complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Clean up deprecated code
  - [ ] 8.1 Remove `DroppableCardSlot` creature-specific logic from `Battlefield.tsx`
    - Remove the creature-with-attachments branch from `DroppableCardSlot`
    - Keep `DroppableCardSlot` only for non-creature cards if still needed, or remove entirely if unused
    - _Requirements: 1.4, 9.3_

  - [ ]* 8.2 Write unit tests for `CreatureOuterDiv`
    - Test rotation transform applied/removed on tap
    - Test width changes with attachment count
    - Test NamePTBanner appears only when compressed
    - Test equipment stopPropagation prevents tap
    - Test keyword badge counter-rotation when tapped
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 5.1, 7.4, 10.1_

- [ ] 9. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Start with `creatureLayout.ts` pure functions since they are testable in isolation without DOM
- `CreatureOuterDiv` replaces both `DroppableCardSlot` (creature branch) and `EquipmentDock`'s outer wrapper
- The existing `EquipmentDock` component's fan-out UI can be reused inside `CreatureOuterDiv`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.5"] },
    { "id": 2, "tasks": ["1.4", "1.6", "1.7"] },
    { "id": 3, "tasks": ["1.8", "1.9"] },
    { "id": 4, "tasks": ["1.10", "3.1"] },
    { "id": 5, "tasks": ["3.2", "3.5"] },
    { "id": 6, "tasks": ["3.3", "3.4", "3.6"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2", "6.1"] },
    { "id": 9, "tasks": ["6.2", "6.3"] },
    { "id": 10, "tasks": ["8.1"] },
    { "id": 11, "tasks": ["8.2"] }
  ]
}
```
