# Tasks

## Task 1: Data Model — Add Token Fields to CardData
- [ ] 1.1: Add `isToken: boolean` and `isTokenCopy: boolean` fields to the `CardData` interface in `src/types.ts`
- [ ] 1.2: Update `mapToCardData` in `src/api/mapToCardData.ts` to include `isToken: false` and `isTokenCopy: false` in the returned object
- [ ] 1.3: Update all mock card objects in `src/mockCards.ts` to include `isToken: false` and `isTokenCopy: false`
- [ ] 1.4: Update any test files that construct CardData literals to include the new fields
- [ ] 1.5: Run full test suite to verify no type errors or assertion failures

## Task 2: Token-Aware moveCard
- [ ] 2.1: In `moveCard` in `src/gameActions.ts`, after attachment detachment runs (equipment to battlefield, auras to graveyard), check if the card has `isToken === true`
- [ ] 2.2: If token AND destination is not battlefield: remove from battlefield, then delete from game (don't add to destination zone)
- [ ] 2.3: Flow: detach equipment → auras to graveyard → token removed → token ceases to exist
- [ ] 2.4: Add unit tests: token to graveyard = deleted, token to exile = deleted, non-tokens move normally, token with equipment detaches before deletion

## Task 3: Token Copy (C Key)
- [ ] 3.1: Update TOKEN_COPY handler in `src/App.tsx` — set `isToken: true` on the clone, set `isCommander: false`
- [ ] 3.2: Check source card's `typeLine` — if it does NOT contain "Token", set `isTokenCopy: true`; if it DOES contain "Token", set `isTokenCopy: false`
- [ ] 3.3: Verify clone gets fresh `crypto.randomUUID()` for its `id`

## Task 4: Token Visual Badge
- [ ] 4.1: In `src/components/DraggableCard.tsx`, add conditional render checking `card.isTokenCopy === true`
- [ ] 4.2: Render "TOKEN" badge in top-left corner (absolute positioned, semi-transparent black bg, white text)
- [ ] 4.3: Verify badge does NOT appear on Scryfall-sourced tokens (isTokenCopy=false)
- [ ] 4.4: Verify badge persists through tap/flip/phase states

## Task 5: Move Toolbar to Hand Zone (Zone C left side)
- [ ] 5.1: In `HandTray.tsx`, add a left-side toolbar column (~8vh wide) before the hand cards area with buttons stacked vertically
- [ ] 5.2: Move Import/Switch Deck, New Game, Draw buttons from the Battlefield overlay into this toolbar column
- [ ] 5.3: Add a "Tokens" dropdown button to the toolbar column
- [ ] 5.4: Remove the absolute-positioned toolbar overlay from inside the Battlefield component
- [ ] 5.5: Adjust HandTray flex layout: [toolbar | hand cards | HD zoom portal]

## Task 6: Token Resolver — Eager Fetch at Import
- [ ] 6.1: Create `src/api/tokenResolver.ts` with `TokenDefinition` interface and in-memory cache
- [ ] 6.2: Implement `resolveTokensForDeck(cards: CardData[]): Promise<TokenDefinition[]>` — fetch full Scryfall data for each card, collect tokens from `all_parts` where `component === "token"`
- [ ] 6.3: Add 50ms delay between Scryfall requests for rate limiting
- [ ] 6.4: Deduplicate tokens by name (same token from multiple cards = one entry)
- [ ] 6.5: Call `resolveTokensForDeck` during deck import in App.tsx, store results in state
- [ ] 6.6: Add `clearCache()` for New Game / deck switch

## Task 7: Token Dropdown Panel
- [ ] 7.1: Create `src/components/TokenPanel.tsx` — dropdown panel opened from the "Tokens" button in the toolbar
- [ ] 7.2: Display pre-loaded deck tokens as a list/grid (image + name + P/T)
- [ ] 7.3: Add search bar at top that queries Scryfall for any token (`/cards/search?q=type:token+{query}`)
- [ ] 7.4: Add quantity selector (1-5) for each token entry
- [ ] 7.5: On confirm: dispatch CREATE_TOKEN action with TokenDefinition + quantity
- [ ] 7.6: Panel closes after creation or stays open for batch (click outside to dismiss)

## Task 8: createTokens Game Action
- [ ] 8.1: Add `createTokens(state: GameState, tokenDef: TokenDefinition, quantity: number): GameState` to `src/gameActions.ts`
- [ ] 8.2: Build CardData from TokenDefinition with `isToken: true`, `isTokenCopy: false`, unique UUID, correct cardType/keywords
- [ ] 8.3: Call `addToBattlefield` for each token so they land in the correct row
- [ ] 8.4: Wire CREATE_TOKEN action in App.tsx to call `createTokens`
- [ ] 8.5: Add unit tests: correct quantity, all isToken=true, placed in correct row
