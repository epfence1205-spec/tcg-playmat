# Requirements Document

## Introduction

Add a `landCategory` property to the CardData interface that classifies lands into all 23 recognized Scryfall `is:` land categories plus `utility` and `unknown`. Classification is performed entirely at import time using pure oracle-text, type-line, produced-mana, and card-name heuristics. No runtime API calls are required — research confirmed that all 23 Scryfall categories can be reliably derived from card data already available in the Scryfall `/cards/collection` response.

## Glossary

- **Land_Categorizer**: The module responsible for determining a land card's category from oracle text heuristics.
- **CardData**: The app's core card data interface, resolved from the Scryfall API at deck import time.
- **Land_Category**: A string literal union type representing all 23 Scryfall `is:` land archetypes plus `utility` and `unknown`.
- **Scryfall_Resolver**: The existing `scryfallResolver.ts` module that batch-resolves card identifiers against Scryfall's `/cards/collection` endpoint.
- **Card_Mapper**: The existing `mapToCardData.ts` module that transforms raw Scryfall responses into CardData objects.
- **Oracle_Text**: The rules text printed on a card, available from the Scryfall API response.
- **Produced_Mana**: The array of mana colors a land can produce, already present on CardData.
- **Type_Line**: The full type line string (e.g., "Land — Plains Island") from the Scryfall response.

## Requirements

### Requirement 1: Land Category Type Definition

**User Story:** As a developer, I want a well-defined set of land category literals, so that the codebase has a single source of truth for all recognized land archetypes.

#### Acceptance Criteria

1. THE Land_Categorizer SHALL define a `LandCategory` union type containing exactly the following 26 string literals: `"basic"`, `"dual"`, `"shockland"`, `"fetchland"`, `"checkland"`, `"tangoland"`, `"fastland"`, `"slowland"`, `"bondland"`, `"painland"`, `"filterland"`, `"bounceland"`, `"canopyland"`, `"shadowland"`, `"scryland"`, `"gainland"`, `"surveilland"`, `"storageland"`, `"bikeland"`, `"tricycleland"`, `"triland"`, `"creatureland"`, `"pathway"`, `"rainbow"`, `"utility"`, `"unknown"`.
2. THE Land_Categorizer SHALL export `LandCategory` as a named TypeScript type export, importable by any other module in the project.
3. WHEN a land card has insufficient data to attempt classification (e.g., missing oracle text and type line), THE Land_Categorizer SHALL assign `"unknown"` as the category, reserving `"utility"` for lands that were fully evaluated but matched no recognized pattern.

### Requirement 2: CardData Extension

**User Story:** As a developer, I want a `landCategory` field on CardData, so that downstream components can read a land's classification without re-deriving it.

#### Acceptance Criteria

1. THE CardData interface SHALL include a required (non-optional) `landCategory` field of type `LandCategory | null`.
2. WHEN cardType is not `"land"`, THE Card_Mapper SHALL set `landCategory` to `null`.
3. WHEN cardType is `"land"`, THE Card_Mapper SHALL set `landCategory` to the value returned by calling `classifyLand` with the card's `oracleText`, `typeLine`, `producedMana`, and `name`.
4. WHEN a card is a double-faced card whose front face cardType is not `"land"` but whose `backFaceCardType` is `"land"`, THE Card_Mapper SHALL set `landCategory` to `null` (classification applies only to the primary face).

### Requirement 3: Oracle-Text Heuristic Classification

**User Story:** As a player, I want my lands automatically categorized at import time using all 23 Scryfall land categories, so that I can see at a glance which category each land belongs to.

#### Acceptance Criteria

Rules are evaluated in priority order (first match wins, top to bottom):

1. WHEN a land's Type_Line contains the case-insensitive word "Basic" AND the card name is exactly one of "Plains", "Island", "Swamp", "Mountain", or "Forest", THE Land_Categorizer SHALL classify it as `"basic"`.
2. WHEN a land's Type_Line contains exactly two basic land subtypes (any two of Plains, Island, Swamp, Mountain, Forest) AND the Oracle_Text is empty, THE Land_Categorizer SHALL classify it as `"dual"`.
3. WHEN a land's Oracle_Text contains the case-insensitive substring "pay 2 life" AND the Type_Line contains exactly two basic land subtypes AND the Produced_Mana array contains exactly two colors, THE Land_Categorizer SHALL classify it as `"shockland"`.
4. WHEN a land's Oracle_Text contains the case-insensitive substrings "search your library" AND "sacrifice", THE Land_Categorizer SHALL classify it as `"fetchland"`.
5. WHEN a land's Oracle_Text contains the case-insensitive substring "unless you control a" followed by a basic land type name (Plains, Island, Swamp, Mountain, or Forest), THE Land_Categorizer SHALL classify it as `"checkland"`.
6. WHEN a land's Oracle_Text contains the case-insensitive substring "enters tapped unless you control two or more basic lands", THE Land_Categorizer SHALL classify it as `"tangoland"`.
7. WHEN a land's Oracle_Text contains the case-insensitive substring "enters tapped unless you control two or fewer other lands", THE Land_Categorizer SHALL classify it as `"fastland"`.
8. WHEN a land's Oracle_Text contains the case-insensitive substring "enters tapped unless you control two or more other lands", THE Land_Categorizer SHALL classify it as `"slowland"`.
9. WHEN a land's Oracle_Text contains the case-insensitive substring "enters tapped unless you have two or more opponents", THE Land_Categorizer SHALL classify it as `"bondland"`.
10. WHEN a land's Oracle_Text contains the case-insensitive substrings "pay 1 life" AND "sacrifice this land: draw a card", THE Land_Categorizer SHALL classify it as `"canopyland"`.
11. WHEN a land's Oracle_Text contains the case-insensitive substrings "you may reveal a" AND "from your hand. If you don't, this land enters tapped", THE Land_Categorizer SHALL classify it as `"shadowland"`.
12. WHEN a land's Oracle_Text contains the case-insensitive substring "deals 1 damage to you" AND the Produced_Mana array contains exactly two colors, THE Land_Categorizer SHALL classify it as `"painland"`.
13. WHEN a land's Oracle_Text contains the case-insensitive substring "return a land" or "return a basic land", THE Land_Categorizer SHALL classify it as `"bounceland"`.
14. WHEN a land's Oracle_Text contains the case-insensitive substrings "enters tapped" AND "scry 1", THE Land_Categorizer SHALL classify it as `"scryland"`.
15. WHEN a land's Oracle_Text contains the case-insensitive substrings "enters tapped" AND "surveil 1", THE Land_Categorizer SHALL classify it as `"surveilland"`.
16. WHEN a land's Oracle_Text contains the case-insensitive substrings "enters tapped" AND "gain 1 life", THE Land_Categorizer SHALL classify it as `"gainland"`.
17. WHEN a land's Oracle_Text contains the case-insensitive substring "storage counter", THE Land_Categorizer SHALL classify it as `"storageland"`.
18. WHEN a land's Type_Line contains three or more basic land subtypes AND the Oracle_Text contains the case-insensitive substring "cycling", THE Land_Categorizer SHALL classify it as `"tricycleland"`.
19. WHEN a land's Type_Line contains at least one basic land subtype (but fewer than three) AND the Oracle_Text contains the case-insensitive substring "cycling", THE Land_Categorizer SHALL classify it as `"bikeland"`.
20. WHEN a land's Oracle_Text matches the hybrid mana filter pattern `{X/Y}, {T}: Add` OR the Odyssey-style pattern `{1}, {T}: Add {X}{Y}`, THE Land_Categorizer SHALL classify it as `"filterland"`.
21. WHEN a land's Oracle_Text contains the case-insensitive substrings "becomes a" AND "creature" AND "it's still a land", THE Land_Categorizer SHALL classify it as `"creatureland"`.
22. WHEN a land's card name contains the substring "Pathway", THE Land_Categorizer SHALL classify it as `"pathway"`.
23. WHEN a land's Oracle_Text contains the case-insensitive substring "enters tapped" AND the Produced_Mana array contains three or more colors AND the Oracle_Text does not contain "cycling", THE Land_Categorizer SHALL classify it as `"triland"`.
24. WHEN a land's Oracle_Text contains the case-insensitive substring "one mana of any color", THE Land_Categorizer SHALL classify it as `"rainbow"`.
25. IF a land's Oracle_Text and Type_Line do not match any pattern defined in criteria 1 through 24, THEN THE Land_Categorizer SHALL classify it as `"utility"`.
26. THE Land_Categorizer SHALL evaluate classification rules in the exact priority order listed (criteria 1 through 24), assigning the category of the first matching rule.
27. THE Land_Categorizer SHALL perform all Oracle_Text substring matching using case-insensitive comparison and SHALL execute classification exactly once per land card during the deck import resolution step.

### Requirement 4: Mana-Color Grouping on the Battlefield

**User Story:** As a player, I want my non-utility lands grouped by produced mana color on row 3, so that I can quickly find the right color when my lands are fanned together.

#### Acceptance Criteria

1. WHEN a non-utility land is placed on the battlefield in row 3, THE layout engine SHALL sort/group lands by their Produced_Mana values so that lands producing the same colors are adjacent.
2. THE grouping order SHALL cluster lands by color pair (or single color for basics), placing all lands that share the same Produced_Mana set next to each other.
3. WHEN a land produces multiple colors (e.g., `["W", "B"]`), THE layout engine SHALL group it with other lands that share the same color pair, regardless of land category.
4. WHEN a land produces all five colors or "any color" (rainbow lands), THE layout engine SHALL group it separately from dual-color lands, positioned at one end of the row.
5. THE grouping SHALL be stable — adding a new land to the battlefield SHALL insert it into the correct color group without re-ordering unrelated groups.

### Requirement 5: Classification Determinism and Testability

**User Story:** As a developer, I want land classification to be a pure function of card data, so that it can be unit-tested without network calls.

#### Acceptance Criteria

1. THE Land_Categorizer SHALL expose a pure function `classifyLand(oracleText: string, typeLine: string, producedMana: string[], name: string): LandCategory` that operates without side effects.
2. FOR ALL valid land CardData inputs, calling `classifyLand` with identical arguments SHALL always return the same LandCategory value (determinism).
3. THE `classifyLand` function SHALL NOT perform any network requests, file I/O, or read mutable external state.

### Requirement 6: Backward Compatibility

**User Story:** As a player with saved decks, I want my existing saved game state to load without errors after this feature is added.

#### Acceptance Criteria

1. WHEN loading persisted CardData that lacks a `landCategory` field, THE persistence layer SHALL assign `null` to the `landCategory` property on the deserialized CardData object without throwing an error.
2. WHEN validating persisted game state, THE persistence layer SHALL NOT reject a saved state solely because CardData objects are missing the `landCategory` field.
3. WHEN a deck is re-imported, THE Card_Mapper SHALL re-derive `landCategory` for all land cards using the current Land_Categorizer logic, overwriting any previously stored value.
