# Requirements Document

## Introduction

This document defines the requirements for the Token System feature in the TCG Playmat application. Tokens are ephemeral game objects that exist only on the battlefield and cease to exist when moved to any other zone.

## Glossary

- **Token**: A game object created by card effects that exists only on the battlefield. When moved to any other zone, it ceases to exist.
- **Token Copy**: A token created via the C keybind that duplicates an existing battlefield card's properties.
- **TokenDefinition**: A Scryfall-sourced data object describing a token (name, typeLine, power, toughness, imageURI).
- **Zone**: A game area (battlefield, hand, graveyard, exile, library, commandZone).
- **Ephemerality**: The property of tokens that causes them to be deleted from game state when leaving the battlefield.

## Requirements

### Requirement 1: Token Data Model

**User Story:** As a player, I want tokens to be clearly distinguished from real cards in the data model so the system can enforce token-specific rules (ephemerality, badges).

#### Acceptance Criteria

- WHEN a CardData object is created THEN it MUST include `isToken: boolean` (default `false`) and `isTokenCopy: boolean` (default `false`)
- WHEN a token is created from a Scryfall TokenDefinition (via the Token Panel) THEN `isToken` MUST be `true` AND `isTokenCopy` MUST be `false`
- WHEN a token copy is created via the C keybind from a card whose typeLine does NOT contain "Token" THEN `isToken` MUST be `true` AND `isTokenCopy` MUST be `true` AND `isCommander` MUST be `false`
- WHEN a token copy is created via the C keybind from a card whose typeLine DOES contain "Token" THEN `isToken` MUST be `true` AND `isTokenCopy` MUST be `false`
- GIVEN `isTokenCopy === true` THEN `isToken` MUST also be `true` (isTokenCopy implies isToken)

### Requirement 2: Token Zone Rules (Ephemerality)

**User Story:** As a player, I want tokens to automatically vanish when they leave the battlefield so I don't have to manually track ephemeral objects in other zones.

#### Acceptance Criteria

- WHEN a token (isToken === true) is moved from the battlefield to any other zone THEN the token MUST be deleted from game state entirely — it is NOT added to the destination zone
- WHEN a token with attachments leaves the battlefield THEN equipment MUST detach and remain on the battlefield (in artifacts row) AND auras MUST go to the graveyard BEFORE the token is deleted
- GIVEN a valid game state THEN no token (isToken === true) may exist in hand, graveyard, library, exile, or commandZone
- WHEN a token is moved from battlefield to battlefield (row change) THEN the token MUST be preserved normally

### Requirement 3: Token Copy (C Key)

**User Story:** As a player, I want to press C on a battlefield card to create a token copy of it so I can represent clone effects and token-producing abilities quickly.

#### Acceptance Criteria

- WHEN the user presses C while hovering a battlefield card THEN a new CardData MUST be created with the same name, imageURI, typeLine, cardType, and stats as the source card
- WHEN a token copy is created from a card whose typeLine does NOT contain "Token" THEN `isTokenCopy` MUST be `true`
- WHEN a token copy is created from a card whose typeLine DOES contain "Token" THEN `isTokenCopy` MUST be `false`
- WHEN a token copy is created THEN it MUST have a unique `id` (crypto.randomUUID()) different from the source
- WHEN a token copy is created THEN it MUST be placed on the battlefield in the correct row based on its cardType

### Requirement 4: Token Visual Badge

**User Story:** As a player, I want token copies to display a visible "TOKEN" badge so I can distinguish them from real cards at a glance.

#### Acceptance Criteria

- WHEN a card has `isTokenCopy === true` THEN a "TOKEN" badge MUST render in the top-left corner of the card
- WHEN a card has `isToken === true` but `isTokenCopy === false` THEN the TOKEN badge MUST NOT render
- GIVEN a token copy that is tapped, flipped, or phased THEN the TOKEN badge MUST still be visible

### Requirement 5: Token Resolver (Scryfall Integration)

**User Story:** As a player, I want the system to automatically fetch token data from Scryfall when I import a deck so I have quick access to all tokens my deck can produce.

#### Acceptance Criteria

- WHEN a deck is imported THEN the system MUST fetch `all_parts` data from Scryfall for each card and extract entries where `component === "token"`
- WHEN token parts are found THEN the system MUST resolve each token part's full data via the Scryfall API
- WHEN fetching token data THEN requests MUST be rate-limited with at least 50ms delay between calls
- WHEN token data is resolved THEN the result MUST be cached by setCode/collectorNumber for the session
- WHEN multiple cards produce the same token THEN the token list MUST be deduplicated by name
- WHEN the Scryfall API fails for a card THEN the system MUST gracefully continue without tokens for that card

### Requirement 6: Toolbar in Zone C

**User Story:** As a player, I want game action buttons (Import, New Game, Draw, Tokens) in a toolbar beside my hand so I can access them without cluttering the battlefield.

#### Acceptance Criteria

- WHEN the app renders Zone C THEN a toolbar column MUST appear on the left side containing: Import/Switch Deck, New Game, Draw, and Tokens buttons
- WHEN the toolbar is in Zone C THEN the absolute-positioned toolbar overlay inside the Battlefield MUST be removed
- GIVEN the Zone C layout THEN it MUST be: [Toolbar (~8vh wide) | Hand cards (flex-1) | HD Zoom Portal (right)]

### Requirement 7: Token Dropdown Panel

**User Story:** As a player, I want a token panel dropdown so I can browse and spawn tokens that my deck produces without memorizing card names.

#### Acceptance Criteria

- WHEN the user clicks the "Tokens" button THEN a dropdown panel MUST open showing the deck's pre-loaded tokens
- GIVEN the token panel is open THEN it MUST display each token with its image, name, and P/T
- GIVEN the token panel is open THEN a search bar MUST be available that queries Scryfall for any token
- GIVEN the token panel is open THEN each token entry MUST have a quantity selector (1-5)
- WHEN the user selects a token and quantity and confirms THEN the specified number of tokens MUST be created on the battlefield
- WHEN the user clicks outside the token panel THEN the panel MUST close

### Requirement 8: createTokens Game Action

**User Story:** As a player, I want a reliable game action that spawns multiple tokens at once so batch token creation (e.g., "create 5 Soldier tokens") works correctly.

#### Acceptance Criteria

- WHEN `createTokens(state, tokenDef, quantity)` is called with quantity between 1 and 10 THEN exactly `quantity` new CardData objects MUST be added to the battlefield
- WHEN tokens are created from a TokenDefinition THEN each MUST have `isToken: true`, `isTokenCopy: false`, a unique UUID, and correct cardType
- WHEN tokens are created THEN they MUST be placed in the correct battlefield row based on their cardType
- WHEN `createTokens` is called with quantity <= 0 THEN the state MUST be returned unchanged
