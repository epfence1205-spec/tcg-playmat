# Implementation Plan: Land Categorization

## Overview

Integrate the existing `classifyLand` function into the card import pipeline by adding `landCategory` to `CardData`, wiring it through `mapToCardData`, updating battlefield row assignment to use category-based routing, adding sorted insertion for row 3 lands by mana-color group, and patching the persistence layer for backward compatibility.

## Tasks

- [x] 1. Extend CardData with landCategory field
  - [x] 1.1 Add `landCategory` field to the `CardData` interface in `src/types.ts`
    - Import `LandCategory` from `./api/landCategorizer`
    - Add `landCategory: LandCategory | null` to the interface
    - _Requirements: 2.1_

  - [x] 1.2 Integrate `classifyLand` into `mapToCardData` in `src/api/mapToCardData.ts`
    - Import `classifyLand` from `./landCategorizer`
    - After deriving `cardType`, call `classifyLand` when `cardType === 'land'`, else set `null`
    - Pass `oracleText`, `frontFaceTypeLine`, `producedMana`, and `name` to `classifyLand`
    - Add `landCategory` to the returned CardData object
    - _Requirements: 2.2, 2.3, 2.4_

  - [x]* 1.3 Write property tests for CardData mapping (Properties 2, 3)
    - **Property 2: Non-land nullity** — For any card with `cardType !== 'land'`, `landCategory` is `null`
    - **Property 3: Land classification consistency** — For any land, `landCategory` equals `classifyLand(...)` output
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - Add tests to `src/api/mapToCardData.test.ts`

- [x] 2. Update battlefield row assignment logic
  - [x] 2.1 Replace inline oracle-text heuristic in `getDefaultRowTarget` in `src/gameActions.ts`
    - Remove the existing `case 'land'` block that parses oracle text
    - Replace with `landCategory`-based check: `utility` and `creatureland` → `row4-lands`, all others → `row3-lands`
    - Handle `null` / `"unknown"` → `row3-lands`
    - _Requirements: 4.1, 4.2_

  - [x]* 2.2 Write unit tests for updated `getDefaultRowTarget` routing
    - Test known landCategory values route to correct rows
    - Test `null` and `"unknown"` default to `row3-lands`
    - _Requirements: 4.1, 4.2_

- [x] 3. Implement sorted land insertion for row 3
  - [x] 3.1 Add `getManaGroupKey` helper to `src/gameActions.ts`
    - Filter producedMana to WUBRG colors only
    - Sort alphabetically and join with comma
    - Return `"rainbow"` for 5+ colors
    - Export the function for testability
    - _Requirements: 4.3, 4.4_

  - [x] 3.2 Add `findColorGroupInsertionIndex` helper to `src/gameActions.ts`
    - Find last card in the same group → insert after it
    - New groups insert before the rainbow section
    - Rainbow lands always append at the end
    - Export the function for testability
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x] 3.3 Add `insertLandSorted` helper and wire into `addRowCardToTarget`
    - Replace the simple append for `row3-lands` with `insertLandSorted`
    - `insertLandSorted` creates the RowCard and uses `findColorGroupInsertionIndex` to place it
    - _Requirements: 4.1, 4.2, 4.5_

  - [x]* 3.4 Write property tests for land grouping (Properties 6, 7, 8)
    - **Property 6: Color-group adjacency** — All lands with same group key are adjacent
    - **Property 7: Rainbow endpoint** — Rainbow lands are contiguously at the rightmost end
    - **Property 8: Stable insertion** — Unrelated groups maintain relative order after insertion
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
    - Create `src/__tests__/landGrouping.pbt.ts`

- [x] 4. Checkpoint - Verify core logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Patch persistence layer for backward compatibility
  - [x] 5.1 Add `patchCardData` function to `src/persistence.ts`
    - Add a function that defaults missing `landCategory` to `null`
    - Apply recursively in `deserializeState` to all CardData in hand, library, graveyard, exile, commandZone, and all RowCards/attachments on battlefield
    - _Requirements: 6.1, 6.2_

  - [x]* 5.2 Write property test for backward compatibility (Property 10)
    - **Property 10: Backward compatibility** — CardData without `landCategory` deserializes with `landCategory === null`
    - **Validates: Requirements 6.1, 6.2**
    - Create `src/__tests__/persistence.pbt.ts`

- [x] 6. Add classifyLand property tests
  - [x]* 6.1 Write property test for output validity (Property 1)
    - **Property 1: Output validity** — For arbitrary inputs, `classifyLand` always returns a valid `LandCategory`
    - **Validates: Requirements 1.1**
    - Create `src/__tests__/landCategorization.pbt.ts`

  - [x]* 6.2 Write property test for priority ordering (Property 4)
    - **Property 4: Priority ordering** — When multiple rules match, the highest-priority category wins
    - **Validates: Requirements 3.26**

  - [x]* 6.3 Write property test for case insensitivity (Property 5)
    - **Property 5: Case insensitivity** — Arbitrary case transformations don't change output
    - **Validates: Requirements 3.27**

  - [x]* 6.4 Write property test for determinism (Property 9)
    - **Property 9: Determinism** — Calling `classifyLand` twice with same args returns same result
    - **Validates: Requirements 5.1, 5.2**

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `classifyLand` function already exists and requires no changes — only integration
- `fast-check@4.8.0` is already installed in the project

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "5.1"] },
    { "id": 2, "tasks": ["1.3", "2.1", "3.1", "5.2"] },
    { "id": 3, "tasks": ["2.2", "3.2", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 4, "tasks": ["3.3", "3.4"] }
  ]
}
```
