# Design Document: Creature Tap & Equipment Outer Div

## Overview

This design replaces the current multi-div creature rendering architecture with a **single Outer_Div model** where one `<div>` per creature owns all visual elements (card image, equipment cascade, badges, banners). Both the tap rotation transform and the width displacement property apply to this same outer div, eliminating the current split between `DroppableCardSlot` (which sets width) and `EquipmentDock` (which applies rotation internally).

### Current Architecture Problems

1. **Rotation is applied inside EquipmentDock** on a nested div, while **width is set on DroppableCardSlot** — these are two separate elements, causing flex layout to not account for rotation displacement correctly.
2. **Equipment margin is added externally** (`marginLeft` on DroppableCardSlot) rather than being part of the div's intrinsic width — this breaks the flex layout model.
3. **Z-index uses arbitrary values** (50, 9999) scattered across components rather than a formula-based layer stack.
4. **Row splitting uses `countIndependentElements`** (unique card names) rather than width-based overflow detection.

### New Architecture Summary

```
RowTrack (flex-row, gap-1, align-items: center)

  ┌──────────┐  ┌──────────────────┐  ┌──────────┐
  │ Outer_Div│  │    Outer_Div     │  │ Outer_Div│
  │ w:11.43vh│  │ w:11.43+N*2vh    │  │ w:16vh   │
  │ h:16vh   │  │ h:16vh           │  │ h:16vh   │
  │ rotate:0 │  │ rotate:0         │  │ rotate:90│
  │          │  │ ┌───┬───┬──────┐ │  │          │
  │ [card]   │  │ │eq0│eq1│ card │ │  │ [card]   │
  │          │  │ └───┴───┴──────┘ │  │          │
  └──────────┘  └──────────────────┘  └──────────┘
```

## Architecture

### Component Hierarchy (New)

```
Battlefield
├── RowTrack (creature row — uses width-based compression and splitting)
│   └── CreatureOuterDiv (one per creature — THE single outer div)
│       ├── EquipmentCascade (positioned children, z-index 0..N-1)
│       │   └── EquipmentCard * N (each with stopPropagation)
│       ├── CreatureCardImage (z-index N)
│       ├── OverlayLayer (z-index N+1)
│       │   ├── NamePTBanner (conditional on compression)
│       │   ├── KeywordBadges
│       │   ├── CounterBadges
│       │   └── ModifiedStatsBadge
│       └── DragLayer (z-index N+2, only during drag)
└── SplitRowTrack (rows 4 and 5 — unchanged)
```

### Key Architectural Decisions

1. **Single div owns rotation AND width**: The `CreatureOuterDiv` component replaces both `DroppableCardSlot` and `EquipmentDock`'s outer wrapper. It receives `transform: rotate(90deg)` AND `width: computed` on the same element.

2. **Width is intrinsic, not margin-based**: Equipment cascade width is baked into the Outer_Div's `width` property (`11.43vh + N*2vh`), not added as external `marginLeft`. This means flex layout naturally accounts for equipment.

3. **Formula-based z-index**: All z-indexes derive from `N` (attachment count). No magic numbers.

4. **Width-based row splitting**: `creatureRows.ts` changes from counting unique names to summing `max(width, height)` per div.

### Migration from Current Code

| Current | New |
|---------|-----|
| `DroppableCardSlot` sets width + wraps `EquipmentDock` | `CreatureOuterDiv` is the single component |
| `EquipmentDock` applies rotation on its own wrapper div | Rotation moves to `CreatureOuterDiv` |
| `marginLeft: N*2vh` on DroppableCardSlot for equipment | `width: 11.43vh + N*2vh` on CreatureOuterDiv |
| `countIndependentElements()` for row split threshold | `sumWorstCaseFootprints()` for width-based split |
| z-index: 50, 9999, arbitrary | z-index: 0..N-1, N, N+1, N+2 |
| Compression uses card count in `useEffect` | Compression uses sum of Outer_Div widths |

## Components and Interfaces

### CreatureOuterDiv

The core new component replacing `DroppableCardSlot` + `EquipmentDock` wrapper.

```typescript
interface CreatureOuterDivProps {
  /** The creature RowCard (includes attachments, isTapped, counters) */
  creature: RowCard;
  /** Whether the row is currently compressed (triggers NamePTBanner) */
  isCompressed: boolean;
  /** Inline style overrides (e.g., negative margin from compression) */
  style?: React.CSSProperties;
  /** Tap toggle handler */
  onTapCard: (cardId: string) => void;
  /** Hover handlers for HD Zoom Portal */
  onCardHoverStart?: (cardId: string, zone: 'battlefield') => void;
  onCardHoverEnd?: (cardId: string) => void;
  /** Equipment action handler (move-to, equip-to from fanned view) */
  onEquipmentAction?: (action: EquipmentAction) => void;
}
```

**Responsibilities:**
- Compute and apply `width` based on tap state and attachment count
- Apply `transform: rotate(90deg)` when tapped
- Render equipment cascade as positioned children
- Render creature card image above equipment
- Render overlay layer (badges, banners) above creature
- Act as droppable target for equipment attachment
- Handle Ctrl+click to fan out attachments

**Width calculation (pure function):**

```typescript
function computeOuterDivWidthVh(isTapped: boolean, attachmentCount: number): number {
  if (isTapped) return 16;
  return 11.43 + attachmentCount * 2;
}
```

**Style applied to the outer div:**

```typescript
const outerStyle: React.CSSProperties = {
  width: `${computeOuterDivWidthVh(creature.isTapped, creature.attachments.length)}vh`,
  height: '16vh',
  transform: creature.isTapped ? 'rotate(90deg)' : undefined,
  transformOrigin: 'center center',
  transition: 'transform 200ms ease, width 200ms ease',
  position: 'relative',
};
```

### EquipmentCascade (internal to CreatureOuterDiv)

Renders attached equipment cards inside the Outer_Div, positioned to the left of the creature card.

```typescript
interface EquipmentCascadeProps {
  attachments: Attachment[];
  /** Total attachment count N — used for z-index calculation */
  attachmentCount: number;
  onEquipmentAction?: (action: EquipmentAction) => void;
}
```

**Layout within the Outer_Div:**

```
┌─────────────────────────────────────────────┐
│ Outer_Div (width = 11.43vh + N*2vh)         │
│                                             │
│  ┌─2vh─┐┌─2vh─┐                            │
│  │ eq0 ││ eq1 │┌──── 11.43vh ────┐         │
│  │     ││     ││                  │         │
│  │ z:0 ││ z:1 ││   creature      │         │
│  │     ││     ││   z: N          │         │
│  └─────┘└─────┘└──────────────────┘         │
│                                             │
│  equipment cascade    creature card         │
└─────────────────────────────────────────────┘
```

Each equipment card is absolutely positioned within the Outer_Div:
- `left: index * 2vh` (0-indexed from the left edge)
- `width: 11.43vh` (full card, but only 2vh strip visible)
- `z-index: index` (Layer 0)
- `pointer-events: auto` with `stopPropagation` on pointerdown/click

The creature card image is positioned:
- `left: N * 2vh` (after all equipment strips) OR `right: 0` (pinned to right edge)
- `width: 11.43vh`
- `z-index: N` (Layer 1)

**Equipment pointer event isolation:**

```tsx
<div
  onPointerDown={(e) => e.stopPropagation()}
  onClick={(e) => e.stopPropagation()}
  style={{ zIndex: index, position: 'absolute', left: `${index * 2}vh` }}
>
  <DraggableCard card={attachment.card} sourceZone="battlefield" ... />
  {/* Sideways name banner */}
  <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
    {attachment.card.name}
  </span>
</div>
```

### Z-Index Layer Stack

```typescript
function computeZIndex(
  layer: 'equipment' | 'creature' | 'overlay' | 'drag',
  attachmentCount: number,
  equipmentIndex?: number
): number {
  const N = attachmentCount;
  switch (layer) {
    case 'equipment': return equipmentIndex ?? 0;  // 0..N-1
    case 'creature': return N;                      // N
    case 'overlay': return N + 1;                   // N+1
    case 'drag': return N + 2;                      // N+2
  }
}
```

### Updated RowTrack (Creature Rows)

The `RowTrack` component in `Battlefield.tsx` changes to use `CreatureOuterDiv` and width-based compression:

```typescript
function RowTrack({ rowId, elements, onTapCard, ... }: RowTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [negativeMargin, setNegativeMargin] = useState(0);

  // Serialized key for dependency tracking
  const elementsKey = elements.map(
    el => `${el.instanceId}:${el.isTapped}:${el.attachments.length}`
  ).join(',');

  useEffect(() => {
    if (!containerRef.current || elements.length <= 1) {
      setNegativeMargin(0);
      return;
    }
    const containerWidth = containerRef.current.clientWidth;
    const vh = window.innerHeight / 100;
    const gapPx = 4; // gap-1

    const margin = computeCompression(elements, containerWidth, vh, gapPx);
    setNegativeMargin(margin);
  }, [elementsKey]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-row items-center gap-1">
      {elements.map((el, idx) => (
        <CreatureOuterDiv
          key={el.instanceId}
          creature={el}
          isCompressed={negativeMargin > 0}
          style={idx > 0 && negativeMargin > 0
            ? { marginLeft: `-${negativeMargin}px` }
            : undefined}
          onTapCard={onTapCard}
          ...
        />
      ))}
    </div>
  );
}
```

### Updated Row Splitting Logic

`creatureRows.ts` changes from unique-name counting to width-based overflow:

```typescript
/**
 * Computes the worst-case horizontal footprint for a creature in vh.
 * This is max(width, height) — since height is always 16vh,
 * and width = 11.43 + N*2 (untapped) or 16 (tapped),
 * the worst case is max(computedWidth, 16).
 */
export function worstCaseFootprintVh(isTapped: boolean, attachmentCount: number): number {
  const width = computeOuterDivWidthVh(isTapped, attachmentCount);
  const height = 16; // always 16vh
  return Math.max(width, height);
}

/**
 * Determines if permanents should be split into two rows
 * based on total worst-case footprint exceeding container width.
 */
export function shouldSplitRows(
  permanents: RowCard[],
  containerWidthVh: number,
  gapVh: number
): boolean {
  const totalFootprint = permanents.reduce(
    (sum, el) => sum + worstCaseFootprintVh(el.isTapped, el.attachments.length), 0
  ) + Math.max(0, permanents.length - 1) * gapVh;
  return totalFootprint > containerWidthVh;
}
```

The `recalculateCreatureRows` function changes its split condition from `elementCount > 14` to `shouldSplitRows(permanents, containerWidthVh, gapVh)`. The container width is passed in from the component that measures the DOM.

### Compression Calculation (Pure Function)

```typescript
/**
 * Computes the per-card negative margin needed to fit all cards in the container.
 * Returns 0 if no compression is needed.
 *
 * Formula: (totalWidth + gaps - containerWidth) / (cardCount - 1)
 */
export function computeCompression(
  elements: RowCard[],
  containerWidthPx: number,
  vhToPx: number,
  gapPx: number
): number {
  if (elements.length <= 1) return 0;

  const totalWidthPx = elements.reduce((sum, el) => {
    const widthVh = computeOuterDivWidthVh(el.isTapped, el.attachments.length);
    return sum + widthVh * vhToPx;
  }, 0);

  const totalGapsPx = (elements.length - 1) * gapPx;
  const totalNeeded = totalWidthPx + totalGapsPx;

  if (totalNeeded <= containerWidthPx) return 0;
  return (totalNeeded - containerWidthPx) / (elements.length - 1);
}
```

## Data Models

No changes to the core `RowCard`, `Attachment`, or `CreatureArea` types. The existing data model already supports this architecture:

- `RowCard.isTapped` — drives rotation and width
- `RowCard.attachments` — drives width growth and cascade rendering
- `RowCard.counters` — rendered in overlay layer
- `CreatureArea.rows` — split/merge logic changes from count-based to width-based

### New Pure Functions Module

A new file `src/creatureLayout.ts` extracts all pure layout calculations for testability:

```typescript
// src/creatureLayout.ts

/** Compute the Outer_Div width in vh units */
export function computeOuterDivWidthVh(isTapped: boolean, attachmentCount: number): number;

/** Compute the Outer_Div width in px */
export function computeOuterDivWidthPx(
  isTapped: boolean, attachmentCount: number, vhToPx: number
): number;

/** Compute worst-case horizontal footprint in vh */
export function worstCaseFootprintVh(isTapped: boolean, attachmentCount: number): number;

/** Compute per-card negative margin for compression (px) */
export function computeCompression(
  elements: RowCard[], containerWidthPx: number, vhToPx: number, gapPx: number
): number;

/** Determine if row should split based on width overflow */
export function shouldSplitRows(
  permanents: RowCard[], containerWidthVh: number, gapVh: number
): boolean;

/** Compute z-index for a given layer */
export function computeZIndex(
  layer: 'equipment' | 'creature' | 'overlay' | 'drag',
  attachmentCount: number,
  equipmentIndex?: number
): number;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Outer Div Width Calculation

*For any* creature with `isTapped` boolean and `attachmentCount` N (where N >= 0), the computed width SHALL equal `11.43 + N * 2` vh when untapped, and `16` vh when tapped, regardless of attachment count.

**Validates: Requirements 2.1, 2.2, 4.1, 4.2**

### Property 2: Outer Div Height Invariant

*For any* creature regardless of tap state or attachment count, the Outer_Div height SHALL always equal 16vh.

**Validates: Requirements 2.5**

### Property 3: Z-Index Layer Stack Formula

*For any* creature with N attachments (N >= 0), equipment card at index `i` SHALL have z-index `i`, the creature card SHALL have z-index `N`, overlays SHALL have z-index `N + 1`, and the drag layer SHALL have z-index `N + 2`.

**Validates: Requirements 9.1, 9.2**

### Property 4: Compression Formula

*For any* list of creatures in a row and a container width, the per-card negative margin SHALL equal `max(0, (totalWidth + gaps - containerWidth) / (cardCount - 1))` where `totalWidth` is the sum of all Outer_Div widths. When total fits within the container, margin SHALL be exactly 0.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 5: Compression Triggers Banner Display

*For any* row where the computed negative margin is greater than 0, every Outer_Div in that row SHALL display a NamePTBanner overlay.

**Validates: Requirements 7.4**

### Property 6: Worst-Case Footprint Calculation

*For any* creature with computed width W and constant height H (16vh), the worst-case horizontal footprint SHALL equal `max(W, H)`.

**Validates: Requirements 8.1**

### Property 7: Row Split Decision

*For any* set of permanents, the system SHALL split into two rows if and only if the sum of all worst-case footprints plus inter-card gaps exceeds the container width. Otherwise, all permanents SHALL be in a single row.

**Validates: Requirements 8.2, 8.3**

### Property 8: Even Distribution on Split

*For any* set of N permanents being split into two rows, the first row SHALL contain `ceil(N/2)` permanents and the second row SHALL contain `floor(N/2)` permanents.

**Validates: Requirements 8.4**

### Property 9: Equipment Event Isolation

*For any* pointer event originating from an equipment card in the cascade, the creature's tap click handler SHALL NOT be invoked (stopPropagation prevents bubbling).

**Validates: Requirements 5.1, 5.3**

### Property 10: Attachment Rendering Completeness

*For any* creature with N attachments, exactly N equipment elements SHALL be rendered in the cascade, each with a sideways name banner using `writing-mode: vertical-rl`.

**Validates: Requirements 3.1, 3.2**

## Error Handling

| Scenario | Handling |
|----------|----------|
| `attachments` array is empty | Width defaults to base (11.43vh untapped, 16vh tapped). No cascade rendered. |
| Container width is 0 or unmeasured | Skip compression calculation, apply 0 margin. Recalculate on next layout. |
| `vhToPx` is 0 (edge case on very small viewports) | Guard with `Math.max(1, vhToPx)` to prevent division by zero. |
| Single card in row | Compression formula divides by `(cardCount - 1)` — guard with early return when `cardCount <= 1`. |
| Drag operation in progress | Equipment cards with `stopPropagation` prevent accidental tap during drag. Active drag card gets z-index N+2. |
| Rapid tap/untap toggling | CSS transition handles animation; React state is the source of truth. No debouncing needed. |

## Testing Strategy

### Property-Based Tests (fast-check)

All pure layout functions in `src/creatureLayout.ts` are tested with property-based tests using `fast-check`. Each test runs a minimum of 100 iterations with generated inputs.

**Library:** `fast-check` (already available in the project's test ecosystem via vitest)

**Test file:** `src/__tests__/creatureLayout.property.test.ts`

Properties 1-8 map directly to pure functions:
- `computeOuterDivWidthVh` — Property 1, 2
- `computeZIndex` — Property 3
- `computeCompression` — Property 4, 5
- `worstCaseFootprintVh` — Property 6
- `shouldSplitRows` — Property 7, 8

Each property test is tagged with a comment:
```typescript
// Feature: creature-tap-equip, Property 1: Outer Div Width Calculation
```

**Generators:**

```typescript
// Arbitrary for a creature's layout-relevant state
const creatureStateArb = fc.record({
  isTapped: fc.boolean(),
  attachmentCount: fc.nat({ max: 10 }),
});

// Arbitrary for a row of creatures
const rowArb = fc.array(creatureStateArb, { minLength: 1, maxLength: 30 });

// Arbitrary for container width (in vh, realistic range)
const containerWidthVhArb = fc.double({ min: 50, max: 200, noNaN: true });
```

### Unit Tests (example-based)

**Test file:** `src/components/CreatureOuterDiv.test.tsx`

- Verify rotation transform is applied/removed on tap state change
- Verify CSS transition property is present (200ms ease)
- Verify no child elements have individual rotation transforms
- Verify equipment cards render with `stopPropagation` handlers
- Verify NamePTBanner appears only when `isCompressed` is true
- Verify Ctrl+click fans out attachments
- Verify droppable target is registered for equipment attachment

### Integration Tests

**Test file:** `src/components/Battlefield.test.tsx` (extend existing)

- Verify RowTrack reflows when a creature is tapped/untapped
- Verify RowTrack reflows when equipment is attached/detached
- Verify row splitting triggers when width threshold is exceeded
- Verify dragging equipment off a creature detaches it
- Verify compression recalculates on tap/untap/attach/detach
