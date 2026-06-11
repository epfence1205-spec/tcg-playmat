# TCG Playmat — Feature Status

## Status: 699 tests pass, TypeScript compiles clean, app runs at localhost:5173

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
- ✅ Creature row rebalancing (route new creatures to row 2 when row 1 at capacity)
- ✅ Command zone stack (CMC sorting, cascade overlap, Alt+click fan-out for partner commanders)
- ✅ Enchant land auras (full aura/equipment docking matrix — enchant land, artifact, permanent, planeswalker, fortification)
- ✅ Land categorization (classify utility vs mana-only, sorted row insertion, painland/checkland fixes)
- ✅ Peek upgrade (scry/surveil/select modes: reorder peeked cards, move individual cards to GY/bottom/hand, confirm arrangement)
- ✅ Library browser hover fix (resolves correct card by ID, suppresses HD zoom on face-down pile)

## Known Bugs
- ~~**Yellow ring flash on click+keybind** — Fixed: removed global `*:focus-visible` CSS outline and browser default focus outline from index.css.~~
- ~~**Lands/noncreatures lack sortable ghost** — Fixed: replaced `DraggableCard` with plain `<img>` inside `DroppableCardSlot` to eliminate dnd-kit ID collision with `SortableCardWrapper`.~~
- **Moxfield 403** — Cloudflare blocks Node's TLS fingerprint (JA3) on Vite's built-in HTTP proxy. `curl.exe` with browser User-Agent passes fine (proven). Parser logic is fixed and tested against v3 API (`boards.{zone}.cards` structure, `cn` field). **Dev fix:** custom Vite plugin shelling out to curl (WIP in `vite.config.ts`, plugin file not yet created). **Prod fix:** GitHub Pages is static-only — needs an external serverless proxy (Cloudflare Worker free tier or Vercel Edge Function) to relay Moxfield requests. Archidekt has the same prod requirement but works in dev because their API doesn't use Cloudflare bot detection.
- ~~**Plain text parser drops "Reanimate"** — Fixed: Scryfall's `/cards/collection` deduplicates DFC back-face names against standalones within the same batch. Added `separateDfcCollisions()` to defer standalone cards whose names match a DFC back face into a separate API request where they resolve correctly.~~

## Next Session
- **Mutate** — Support mutate mechanic (stack creature cards, share abilities/P+T modifications)
- **Turn counter** — Track current turn number, increment on Next Turn (N key)
- **Life counter** — Track life total with +/- buttons, keyboard shortcuts, and visible HUD display

## ~~Tabled: Battlefield Row Sortable~~ ✅ Implemented
- Within-row reorder works via @dnd-kit/sortable (RowTrack and SplitRowTrack)
- All rows use universal SortableCardWrapper → RotationDiv → img hierarchy
- Sortable displacement (cards move aside) works for creatures, lands, artifacts, enchantments

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
- **Reveal vs private peek distinction** — Scry/surveil are private (not shown to opponents); discover/cascade/impulse are revealed (public). Add a `revealed` flag to peek modes with visual differentiation in the OBS broadcast zone. Depends on multiplayer or stream-aware context to be meaningful.
- **Cascade/Discover mode** — Reveal cards one-at-a-time from top until a valid target is hit (MV < source). Different from fixed-N peek since count is unknown upfront. Needs its own sequential reveal UI.
