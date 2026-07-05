# Project Roadmap — TCG Playmat → Commander Online

## Vision

A browser-based multiplayer Commander (EDH) game engine — think online poker for Magic: The Gathering commander players. Not trying to be MTG Arena or MTGO. The goal is a lightweight, browser-based experience where 4 players can sit down and play commander together with minimal friction.

## Current State

An advanced goldfishing tool (single-player playmat) with:
- Deck import from multiple sources (Moxfield, Archidekt, CSV, plain text)
- Full battlefield with creature rows, land/artifact/enchantment rows
- Equipment docking system with cascade display
- Tap/untap, counters, tokens, DFC support
- Hand management with sortable fan display
- Library browsing, mulligan engine
- Keyboard shortcuts for common actions
- Scryfall API integration for card data/images
- LocalStorage persistence (no page refresh needed)

## Macro Milestones

### Phase 1: Polished Single-Player Playmat ✅ COMPLETE

**Goal:** A complete, bug-free goldfishing tool that handles all Commander board states gracefully.

Completed work:
- [x] Battlefield sortable (drag-to-reorder within rows)
- [x] OBS Stream View (`/stream` route) — read-only view for OBS Virtual Camera (SpellTable feed)
- [x] Deck import (Moxfield, Archidekt, CSV, plain text)
- [x] Equipment docking with two-phase oracle classifier (static P/T + granted keywords)
- [x] Counter system (counters + separate P/T modifiers)
- [x] Mutate system
- [x] Multi-select with lasso + batch operations
- [x] Token panel
- [x] DFC support, tap/untap, phase out, morph
- [x] Hand management, mulligan engine, library browsing
- [x] Keyboard shortcuts
- [x] LocalStorage persistence

**Exit criteria:** ✅ A single player can goldfish any commander deck without hitting bugs or missing interactions. The OBS stream view provides a clean virtual camera feed.

---

### Phase 2: Game Rules Engine ← YOU ARE HERE

**Goal:** Encode enough MTG rules to automate phase transitions, priority, and trigger ordering.

Key work:
- [ ] Turn structure (untap → upkeep → draw → main → combat → main → end)
- [ ] Phase transition automation with trigger detection
- [ ] Stack/trigger analyzer for phase transitions
- [ ] Board-state-aware equipment calculator (7 formulas: Blackblade Reforged, Cranial Plating, Conqueror's Flail, Nettlecyst, Cranial Ram, Thran Power Suit, Hero's Blade)
  - Board-state query layer: count artifacts/lands/colors/attachments from GameState
  - Formula registry: map card names → counting functions
  - calculateEffectiveStats gains optional GameState param for dynamic formulas
  - Builds on the two-phase oracle classifier (oracleClassifier.ts) — VARIABLE_BONUS lines trigger formula lookup
- [ ] ETB counter auto-placement (oracle text → auto-populate counters on battlefield entry)
  - New classifier template: ENTERS_WITH_COUNTERS ("enters with X COUNTER_TYPE counter(s)")
  - Level 1 (fixed count): "enters with two stun counters" → auto-add on createRowCard
  - Level 2 (X-based): "enters with X +1/+1 counters" → prompt player for X value
  - Level 3 (conditional): "enters with a counter for each..." → board-state dependent (same infra as equipment calc)
  - Hook point: createRowCard in gameActions.ts, triggered on hand→battlefield transition
- [ ] Stack representation (LIFO, priority passing)
- [ ] Basic trigger ordering (ETB, LTB, attack, damage)
- [ ] Mana pool tracking (optional — many playgroups track mentally)
- [ ] Life total / commander damage tracking

**Exit criteria:** A single player can play through a full turn with automated phase prompts and trigger reminders.

---

### Phase 3: Multiplayer Networking (2-player first)

**Goal:** Two playmats connected over the network, seeing each other's public zones.

Key work:
- [ ] WebSocket or WebRTC connection layer
- [ ] Game state synchronization protocol
- [ ] Public zone visibility (battlefield, graveyard, exile visible to opponent)
- [ ] Private zone privacy (hand, library hidden)
- [ ] Turn order / priority passing between players
- [ ] Chat / emotes
- [ ] Reconnection handling

**Exit criteria:** Two players can play a full game of 1v1 Commander over the internet.

---

### Phase 4: 4-Player Commander

**Goal:** Scale networking to 4 players with commander-specific rules.

Key work:
- [ ] 4-player lobby / matchmaking
- [ ] Commander damage tracking (per-opponent)
- [ ] Turn order (clockwise, with priority for each player)
- [ ] Shared stack with 4-player priority passing
- [ ] Spectator mode
- [ ] Political features (voting, deals, alliances — optional flavor)

**Exit criteria:** 4 players can sit down and play a full commander game browser-to-browser.

---

### Phase 5: Platform Polish

**Goal:** Make it feel like a real product, not a dev tool.

Key work:
- [ ] Token system improvements (deferred from Phase 1)
- [ ] Undo/redo system (deferred from Phase 1)
- [ ] Performance optimization for large board states — 20+ creatures (deferred from Phase 1)
- [ ] User accounts / profiles
- [ ] Deck storage (cloud-synced)
- [ ] Game history / replay
- [ ] Mobile-responsive layout
- [ ] Sound effects / animations
- [ ] Accessibility improvements
- [ ] Performance at scale (many concurrent games)
- [ ] Free placement toggle (disable type-based auto-assign on hand-to-battlefield drag)

**Exit criteria:** You could show this to a stranger and they'd use it without explanation.

---

## Principles

1. **Browser-first** — No downloads, no installs. Open a URL and play.
2. **Commander-focused** — Not trying to support every format. Commander is the format.
3. **Trust-based** — Like paper Magic, players manage their own board. No full rules enforcement (that's MTGO's job). Trigger reminders, not trigger enforcement. This is magic among friends, not pro tournaments.
4. **Incremental** — Each phase is usable on its own. Phase 1 is already useful for goldfishing. Phase 3 is useful for 1v1.
5. **Lightweight** — Fast to load, fast to play. No heavy 3D rendering. Cards are images, the board is a grid.
6. **Conversational priority** — The game flows forward by default. Players interrupt when they want to act (opt-in interruption), not click through mandatory priority windows (opt-out continuation). Like paper: "combat?" and silence means proceed.

## Design Notes

### Priority Model (Phase 2+)

The priority system should feel like a conversation at a table, not a legal proceeding:

- **Active player acts** → system shows "Anyone respond?" with a short timer (3-5s)
- **Silence = pass** → auto-advance, resolve, move on
- **Someone clicks "respond"** → pause, let them act, re-ask
- **Phase stops** → per-player toggles ("stop me at upkeep / combat / end step") so players don't miss their own triggers
- **No bluff enforcement** — if you want to pause and pretend you have a counterspell, just wait before passing. The system doesn't reveal information.

This is the opposite of MTGO (which stops by default and requires explicit continuation). Arena does something similar with auto-pass but can't support the full card pool. We can because we're trust-based — we don't need to compute "does this player have any legal action."

### Competitive Landscape

| App | Rules Enforcement | Card Pool | Multiplayer | UX |
|-----|------------------|-----------|-------------|-----|
| MTGO | Full | All cards ever | Yes (slow) | 2002-era, click-heavy |
| Arena | Full | Standard/recent | No commander | Modern, auto-pass |
| XMage | Full | Most cards | Yes | Java desktop, clunky |
| Cockatrice | None | All cards | Yes | Shared canvas, zero automation |
| Spelltable | None | Physical cards | Yes (webcam) | Video feeds only |
| **This project** | Trust-based + reminders | All cards (Scryfall) | Yes (target) | Browser, conversational |
