# Requirements Document

## Introduction

This specification defines the outer creature div behavior on the battlefield. A single outer div per creature owns all visual elements (card image, equipment cascade, keyword badges, counter badges, compression banners). Tap rotation and width displacement both apply to this same outer div. Equipment attachment grows the outer div's width to accommodate the cascade. Row compression uses width-based overflow detection rather than card count thresholds.

## Glossary

- **Outer_Div**: The single outermost `<div>` per creature on the battlefield. It receives the tap rotation transform AND the width property that drives flex layout displacement. Contains all child elements (card image, equipment cascade, badges, banners).
- **RowTrack**: A horizontal flex container (`flex-direction: row`, `gap-1`) holding Outer_Divs. Uses each Outer_Div's `width` property for layout flow.
- **Equipment_Cascade**: Attached equipment cards rendered inside the Outer_Div, offset to the left of the creature card image, each showing a sideways name banner.
- **NamePTBanner**: A vertical text overlay showing card name and power/toughness, displayed when the row is compressed.
- **Tapped_State**: Boolean on a RowCard. When true, the Outer_Div gets `transform: rotate(90deg)` and `width: 16vh`.
- **Viewport_Height_Unit (vh)**: CSS unit equal to 1% of viewport height, used for all card sizing.

## Requirements

### Requirement 1: Outer Div Tap Rotation

**User Story:** As a player, I want to tap a creature so that the entire unit (card, equipment, badges) rotates 90° as one piece.

#### Acceptance Criteria

1. WHEN a player clicks an untapped creature, THE Outer_Div SHALL apply `transform: rotate(90deg)` with `transform-origin: center center`.
2. WHEN a player clicks a tapped creature, THE Outer_Div SHALL remove the rotation transform (back to 0°).
3. THE Outer_Div SHALL animate the rotation with a CSS transition of 200ms ease.
4. WHILE a creature is tapped, ALL child elements (card image, Equipment_Cascade, keyword badges, counter badges, NamePTBanner) SHALL rotate together with the Outer_Div without any individual rotation transforms.

### Requirement 2: Outer Div Width Displacement

**User Story:** As a player, I want tapped creatures to displace neighbors in the flex row so that the layout reflects tap state without visual overlap.

#### Acceptance Criteria

1. WHILE a creature is in Tapped_State with zero attachments, THE Outer_Div SHALL set its `width` to 16vh.
2. WHILE a creature is untapped with zero attachments, THE Outer_Div SHALL set its `width` to 11.43vh.
3. WHEN a creature transitions between tapped and untapped, THE Outer_Div SHALL animate the width change with a CSS transition of 200ms ease.
4. THE RowTrack flex layout SHALL use the Outer_Div's `width` property (not the CSS transform visual footprint) to determine horizontal spacing between cards.
5. WHILE a creature is in Tapped_State, THE Outer_Div height SHALL be `11.43vh + (N × 2vh)` where N is the attachment count (the untapped width becomes the tapped height). WHILE untapped, height SHALL be 16vh.

### Requirement 3: Equipment Cascade Rendering

**User Story:** As a player, I want attached equipment to appear as a cascade extending to the left of my creature so I can see what is equipped.

#### Acceptance Criteria

1. WHILE a creature has N attachments, THE Equipment_Cascade SHALL render each attachment inside the Outer_Div, offset to the left of the creature card image.
2. EACH attachment in the Equipment_Cascade SHALL display a sideways name banner using `writing-mode: vertical-rl` with white text on a dark background.
3. THE Equipment_Cascade SHALL layer attachments with increasing z-index so the creature card image renders on top.
4. WHILE a creature is tapped, THE Equipment_Cascade SHALL rotate with the Outer_Div (no separate rotation logic needed since it is a child of the Outer_Div).

### Requirement 4: Equipment Width Growth

**User Story:** As a player, I want the creature's outer div to grow wider when equipment is attached so the cascade is visible and neighbors are displaced.

#### Acceptance Criteria

1. WHILE a creature has N attachments and is untapped, THE Outer_Div SHALL set its width to `11.43vh + (N × 2vh)`.
2. WHILE a creature has N attachments and is tapped, THE Outer_Div SHALL set its width to `16vh` (tapped width does not grow with attachments).
3. WHEN an attachment is added or removed, THE Outer_Div SHALL recalculate its width and the RowTrack SHALL reflow neighboring Outer_Divs accordingly.

### Requirement 5: Equipment Pointer Event Isolation

**User Story:** As a player, I want to drag equipment off a creature independently without triggering the creature's tap action.

#### Acceptance Criteria

1. EACH equipment card in the Equipment_Cascade SHALL call `stopPropagation` on pointer events so that dragging equipment does not bubble to the Outer_Div's click handler.
2. WHEN a player drags an equipment card out of the Equipment_Cascade, THE system SHALL detach the equipment from the creature's attachments array.
3. THE creature's tap click handler SHALL NOT fire when the player interacts with an equipment card in the cascade.

### Requirement 6: RowTrack Flex Layout

**User Story:** As a player, I want cards in a row to be spaced consistently using flex layout so the battlefield looks organized.

#### Acceptance Criteria

1. THE RowTrack SHALL use CSS flexbox with `flex-direction: row`, `align-items: center`, and a gap of 4px (`gap-1`).
2. THE RowTrack SHALL use each Outer_Div's computed `width` as the flex item size for layout calculations.
3. THE RowTrack SHALL NOT use CSS transform visual footprints for spacing — only the `width` property matters.

### Requirement 7: Width-Based Row Compression

**User Story:** As a player, I want the row to compress cards with negative margins when they overflow so that no cards are hidden.

#### Acceptance Criteria

1. WHEN the sum of all Outer_Div widths plus inter-card gaps exceeds the RowTrack container width, THE system SHALL compute a per-card negative margin as `(totalWidth + gaps - containerWidth) / (cardCount - 1)`.
2. THE system SHALL apply the computed negative margin as `margin-left` on each Outer_Div after the first.
3. WHEN the total width fits within the container, THE system SHALL apply zero negative margin.
4. WHEN the row is compressed, EACH Outer_Div SHALL display a NamePTBanner overlay showing card name and power/toughness in vertical text.
5. THE system SHALL recalculate compression whenever a card is tapped, untapped, or gains/loses an attachment.

### Requirement 8: Width-Based Row Splitting

**User Story:** As a player, I want the creature area to split into multiple rows based on total width overflow rather than a fixed card count.

#### Acceptance Criteria

1. FOR each Outer_Div, THE system SHALL compute its worst-case horizontal footprint as `max(width, height)` — using the two dimensions already stored on the div.
2. WHEN the sum of all worst-case footprints plus inter-card gaps exceeds the RowTrack container width, THE system SHALL split permanents into two rows.
3. WHILE the sum of all worst-case footprints plus gaps fits within the container, THE system SHALL merge all permanents into one row.
4. WHEN splitting into two rows, THE system SHALL distribute permanents evenly by count.
5. WHILE permanents are already split across two rows, THE system SHALL preserve the user's arrangement rather than re-distributing.

### Requirement 9: Z-Index Layer Stack

**User Story:** As a player, I want banners, badges, and stat overlays to always be visible above the card art so that game-critical information is never hidden behind card images.

#### Acceptance Criteria

1. THE z-index layering within each Outer_Div SHALL follow a fixed 4-layer stack:
   - **Layer 0 (Equipment cards)**: Each equipment card in the cascade SHALL have z-index equal to its position index (0, 1, 2, ..., N-1) so they layer correctly behind each other.
   - **Layer 1 (Creature card)**: The creature card image SHALL have a static z-index of `N` (attachment count) so it always renders above all equipment cards.
   - **Layer 2 (Overlays)**: All overlays SHALL have a static z-index of `N + 1` — this includes equipment sideways name banners, aura/equipment stat modification text, NamePTBanner, keyword badges, and counter badges.
   - **Layer 3 (Drag state)**: The active drag overlay SHALL have the highest z-index to render above everything during drag operations.
2. Layer 0 SHALL be dynamic (based on attachment count). Layers 1, 2, and 3 SHALL be computed as offsets from Layer 0's max value (N, N+1, N+2).
3. THE system SHALL NOT use arbitrary fixed z-index values (e.g., 50, 9999). All z-indexes SHALL be derived from the layer stack formula.
4. WHEN an attachment is added or removed, THE system SHALL recalculate all z-index values within the Outer_Div based on the new attachment count.

### Requirement 10: Keyword Badge Counter-Rotation

**User Story:** As a player, I want keyword badges (haste, flying, etc.) to stay horizontal and readable even when the creature is tapped, so I can always identify abilities at a glance.

#### Acceptance Criteria

1. WHILE a creature is in Tapped_State, THE keyword badge container SHALL apply `transform: rotate(-90deg)` to cancel the parent Outer_Div's rotation, keeping badge text horizontal.
2. WHILE a creature is untapped, THE keyword badge container SHALL NOT apply any counter-rotation transform.
3. THE keyword badges SHALL remain positionally attached to the Outer_Div (they move with it during reflow) — only their visual orientation is counter-rotated.
4. THE counter-rotation SHALL NOT affect the badges' z-index, pointer-events, or layout within the Outer_Div.
