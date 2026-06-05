# TCG Playmat — Feature Status

## Status: 600 tests pass, TypeScript compiles clean, app runs at localhost:5173

## All Features Complete
- ✅ Deck import from Archidekt (with set codes for correct art)
- ✅ Deck import from Moxfield (via proxy)
- ✅ Mulligan flow (draw 7, mulligan, confirm keep, put-back selection)
- ✅ Cards auto-sort to correct rows (creatures → creature area, lands → row3/row4, artifacts → row3, enchantments → row4)
- ✅ Utility vs mana-only land classification (ETB conditions treated as mana-related)
- ✅ Instants/sorceries → creature row 2 (isolated, disappears when empty)
- ✅ Creature rows: max 2, split at >14, merge at ≤14, preserve user arrangement when >14
- ✅ Keybind B moves hovered card to battlefield (from any zone)
- ✅ Quick play 1-9 plays Nth card from hand to battlefield
- ✅ D draws, N next turn (untap+draw), U untap all
- ✅ T taps hovered battlefield card (tapped cards get higher z-index)
- ✅ New Game resets and starts mulligan
- ✅ Undo (Ctrl+Z) — 50-entry state history stack, skips mulligan phase
- ✅ Card back image (local /card-back.webp)
- ✅ Drag-and-drop between zones (hand → battlefield, battlefield → sidebar)
- ✅ Drag to library puts card on top (context menu: top/bottom/shuffle)
- ✅ Equipment docking detection in drag handler
- ✅ Hand fan (overlap, hover pop, neighbor spread, 250ms smooth transitions)
- ✅ Hand reordering (drag within hand zone)
- ✅ Creature row overlap with high-vis banners (Method 2, only when rows overflow)
- ✅ Name/PT banner on left edge (rotates with card, PT guaranteed visible, name truncates)
- ✅ Equipped creature banner shows modified P/T from equipment
- ✅ Whole card slot fades during drag (equipment + banners + card)
- ✅ Overlap reverts when cards removed (reactive margin recalculation)
- ✅ Hover tracking on battlefield and hand cards (with zone awareness)
- ✅ Persistence to localStorage with Set<string> serialization
- ✅ Error boundary with "Clear State & Reload" button
- ✅ Context Menu — right-click on any card opens zone-aware context menu
- ✅ Context Menu actions: tap, move-to (all destinations), flip, transform, morph, phase, counters, power/toughness, token copy, delete, detach, play to battlefield, play as back face (MDFC)
- ✅ DFC / MDFC "Play as back face" — context menu option for MDFCs in hand
- ✅ Keybind handlers: all card actions wired (MORPH, PHASE, TOKEN_COPY, ADD/REMOVE_COUNTER, DELETE, FLIP/TRANSFORM, REVEAL)
- ✅ HD Zoom Portal shows hovered card preview in hand tray
- ✅ Peek Modal (Alt+1-9) — shows top N cards of library
- ✅ Library Browser (Ctrl+F) — searchable modal with move-to-zone actions, auto-shuffles on close
- ✅ Keybind Overlay (? key) — full-screen shortcut reference
- ✅ Toggle Reveal (Spacebar / click) — visual reveal state for hand cards
- ✅ Token system (create tokens, token copies, ephemerality, token panel)
- ✅ Tokens filtered from softReset (don't pollute library)

## Known Bugs
- **Yellow ring flash on click+keybind** — Clicking a card then immediately using a keyboard shortcut (e.g., T to tap neighbor) causes dnd-kit to briefly show yellow drop-target ring (~3s). Likely dnd-kit interpreting mousedown as drag start before keyboard action fires.
- **Lands/noncreatures lack sortable ghost** — Creature rows have drag-to-reorder with ghost indicator, but split rows (lands, artifacts, enchantments) don't show the same sortable ghost feedback during drag.

## Next Session
- **Creature row rebalancing** — When split into 2 rows, prefer moving a card to row 2 over compressing row 1 if row 2 has room to spare
- **Command zone stack behavior** — Show only top commander card, Alt+click to fan out for partner commanders (match library/graveyard/exile stack pattern instead of current flex-wrap layout)
- **Enchant land auras** — Allow auras with "Enchant land" to attach to lands in rows 3/4 (currently only creatures are valid dock targets)
- **Mutate** — Support mutate mechanic (stack creature cards, share abilities/P+T modifications)
- **Browse graveyard/exile** — Searchable modal for graveyard and exile (like Library Browser) with move-to-zone actions
- **Turn counter** — Track current turn number, increment on Next Turn (N key)
- **Life counter** — Track life total with +/- buttons, keyboard shortcuts, and visible HUD display

## Tabled: Battlefield Row Sortable (needs spec — partially implemented)
- Within-row reorder works via @dnd-kit/sortable (already wired up in RowTrack and SplitRowTrack)
- **Missing: Cross-container insertion gaps** — Show visual gap/insertion indicator when dragging cards between rows or from other zones to a specific position within a row (requires custom collision detection beyond @dnd-kit/sortable's single-context limitation)
- **Missing: Cross-row drag** — Drag a card from one row to another with positional targeting (not just "drop on row, append to end")
- Constraints: must coexist with cross-zone drag, equipment docking, and basic land auto-sort
- Needs a fresh spec and design before implementation

## Tabled: Production Readiness (post-beta)
- **Backend proxy** — Replace Vite dev proxies with a real backend (serverless functions or edge proxy) for Moxfield/Archidekt/Scryfall API calls
- **Deployment** — Host on Vercel/Netlify/Cloudflare Pages with proper API routing
- **CORS-free API layer** — Server-side fetch for all external APIs
- **Error reporting** — Sentry or similar for runtime crash tracking
- **Analytics** — Basic usage metrics (deck imports, games played)
- **PWA support** — Service worker for offline play after initial load
- **Mobile responsive** — Touch-friendly layout for tablet play
- **Multi-player** — WebSocket or WebRTC for shared game state (spelltable replacement)
- **Deck persistence** — Save/load multiple decks (not just current game state)
- **Performance audit** — Profile with 40+ cards on battlefield, optimize re-renders
- **Accessibility audit** — Screen reader support, keyboard-only navigation
- **OBS integration testing** — Verify crop line works across resolutions

## Tabled: Future Features (needs specs)
- **LLM-powered equipment parser** — Replace regex stat/keyword extraction with semantic understanding
