# Master Feature Specifications: MTG Arena Playmat

## Core Architecture & Environmental Constants
- **Display Target:** Optimized for 1440p display scaling.
- **Viewport Bounds:** Strict `100vw` by `100vh` with `overflow: hidden`. No native browser scrolling or page wrapping is permitted under any circumstances.
- **OBS Virtual Camera / Privacy Split:** - **Zone A & B (Public Battlefield):** Bounded strictly within the upper **`83.33vh`** of the viewport. This area is captured by OBS for the SpellTable webcam feed.
  - **Zone C (Private Hand Tray):** Bounded strictly within the bottom **`16.67vh`** of the viewport (exactly 240px on a 1440p display). This area is completely cropped out by OBS, serving as the player's 100% hidden information zone.

---

## Epic 1: Continuous Flow Playmat Layout (No Grid Cells)
### Feature 1.1: Continuous Row Tracks & Horizontal Shifting
- **Requirement:** Completely eliminate static vertical columns, cells, or hardcoded card boxes from the battlefield.
- **Layout Structure:** Zone A consists of exactly 4 open, full-width horizontal row tracks:
  1. Creature Row 1 (Primary Attack/Token Track)
  2. Creature Row 2 (Secondary/Utility Track)
  3. Non-Creature Row (Artifacts, Enchantments, Planeswalkers)
  4. Land Row (Mana Source Track)
- **Behavior:** Cards placed within any row track must dynamically arrange themselves from left to right. When cards enter, leave, or shift positions, adjacent cards must animate smoothly to their new layout coordinates using hardware-accelerated transitions (`transition-all duration-300 ease-in-out transform`).

### Feature 1.2: Horizontal Card Fanning & 95% Overlap
- **Requirement:** To maximize playmat real estate, cards grouped by card type or attachment status must form a dense horizontal "deck-fan" layout.
- **Behavior:** When a card group forms (e.g., matching basic lands, cloned tokens):
  - Consecutive cards in the stack must overlay the preceding card with a strict **95% horizontal offset** to the right.
  - The left-most 5% of all underlying cards must remain permanently exposed, ensuring vertical art banners, mana costs, and tapped/untapped states remain legible to the SpellTable feed.
  - The `z-index` must increment sequentially per card in the fan (`z-10`, `z-20`, `z-30`) so the newest permanent is always fully visible on top.

### Feature 1.3: Dynamic Internal Sub-Wrapping (Dynamic 1.5 Rows)
- **Requirement:** Prevent a massive army of creatures or tokens from spilling horizontally off the screen or bleeding vertically into other zones.
- **Behavior:** The 2 dedicated creature row tracks must actively monitor their horizontal capacity.
  - **Standard State:** While a row contains $\le 7$ independent card elements or fanned groups, the track renders flat and shoulder-to-shoulder (`flex-row`).
  - **Wrapped State:** The moment an 8th card element enters, the row track dynamically triggers a multi-tier layout wrapper (`flex-wrap`).
  - **Height Compression:** When wrapped, cards within that specific track must automatically scale their vertical footprints or tighten horizontal fanning. 
- **Boundary Guardrail:** Even when wrapped into a "1.5 row" layout, the vertical bounds of that track must never expand past its allocation, preserving the strict `83.33vh` public/private boundary line.

---

## Epic 2: High-Fidelity Rendering & State Interactions
### Feature 2.1: HD Zoom Portal
- **Requirement:** Provide instant, high-definition legibility of card artwork and oracle text for the player.
- **Behavior:** Hovering over any card on the battlefield or in the private hand tray triggers an absolute-positioned hover portal overlay displaying a crisp, high-res render of the card.
- **Boundary Constraint:** The HD Zoom Portal must dynamically calculate screen real estate. It must *never* render, overflow, or flip out of the bottom `16.67vh` private hand zone, preventing accidental visual exposure to the SpellTable crop line.

### Feature 2.2: Equipment Visual Docking
- **Requirement:** Mathematically represent attachments (Equipment, Auras, Fortifications) to parent creatures.
- **Behavior:** Dragging an Equipment card onto a Creature removes the Equipment from the standard row track flow and binds its state array directly to the target Creature.
- **Visual Mapping:** The Equipment card must render tightly tucked underneath or behind the primary Creature card with a subtle 15px visual cascade offset. Moving or tapping the Creature card automatically translates the attached equipment card seamlessly.

---

## Epic 3: Game Initialization & Private Mulligan Engine
### Feature 3.1: Sub-16.67vh Inline Mulligan Tray
- **Requirement:** Game setup and mulligan choices must be managed with absolute privacy from the SpellTable pod.
- **Behavior:** When a new game initializes or a reset occurs, the application enters `gameState: "MULLIGAN"`.
- **Privacy Invariant:** The entire Mulligan UI—including the 7 drawn cards, action buttons ("Keep", "Mulligan"), and choice text—MUST render exclusively inside the bottom **`16.67vh`** private tray. The upper `83.33vh` battlefield remains completely empty and blank to the webcam feed.

### Feature 3.2: Interactive Put-Back Logic
- **Behavior:** - Cards drawn for the opening hand fan out horizontally in the private tray.
  - Clicking a card toggles its state to `selectedToPutBack: true` and triggers a distinct localized visual indicator (50% opacity dip and a red border).
  - The "Confirm Keep" button stays disabled until the player selects the exact number of cards dictated by the current `mulliganCount`.
  - Clicking "Confirm Keep" shuffles the selected put-backs to the bottom of the library state array, transitions the remaining cards into the active hand array, and switches the global state to `gameState: "PLAYING"`.

---

## Epic 4: Broadcaster Engine & Session Performance
### Feature 4.1: Global Shortcut Keybindings
- **Requirement:** Facilitate fast, mouse-free camera and state manipulation during gameplay.
- **Behavior:** Implement a global event listener at the root component level (`App.jsx`):
  - Keys `1`, `2`, `3`, or `4`: Focus/zoom the viewport onto specific quadrants of the battlefield layout.
  - `Spacebar`: Toggles the `isRevealed` state of a card currently being manipulated or highlighted in the hand tray.

### Feature 4.2: State Persistence & Soft Reset
- **Requirement:** Resetting a match layout must never interrupt or flash the active OBS video capture source.
- **Behavior:** Implement a custom "Soft Reset" feature. Clicking it zeroes out all active card arrays, resets Player HUD metrics, and re-initializes `gameState: "MULLIGAN"` purely through React state mutations. Native browser window refreshes (`location.reload()`) are strictly prohibited to maintain active virtual camera stability.