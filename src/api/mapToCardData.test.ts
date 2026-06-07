import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mapToCardData, deriveCardType } from './mapToCardData';
import { classifyLand } from './landCategorizer';
import type { ScryfallCard } from './scryfallResolver';

describe('deriveCardType', () => {
  it('returns creature for creature type lines', () => {
    expect(deriveCardType('Creature — Human Wizard')).toBe('creature');
  });

  it('returns creature for artifact creatures (creature takes priority)', () => {
    expect(deriveCardType('Artifact Creature — Golem')).toBe('creature');
  });

  it('returns planeswalker', () => {
    expect(deriveCardType('Legendary Planeswalker — Jace')).toBe('planeswalker');
  });

  it('returns battle', () => {
    expect(deriveCardType('Battle — Siege')).toBe('battle');
  });

  it('returns land', () => {
    expect(deriveCardType('Basic Land — Forest')).toBe('land');
  });

  it('returns artifact', () => {
    expect(deriveCardType('Artifact — Equipment')).toBe('artifact');
  });

  it('returns enchantment', () => {
    expect(deriveCardType('Enchantment — Aura')).toBe('enchantment');
  });

  it('returns instant', () => {
    expect(deriveCardType('Instant')).toBe('instant');
  });

  it('returns sorcery', () => {
    expect(deriveCardType('Sorcery')).toBe('sorcery');
  });

  it('returns other for unrecognized types', () => {
    expect(deriveCardType('Tribal')).toBe('other');
  });
});

describe('mapToCardData', () => {
  const normalCard: ScryfallCard = {
    name: 'Lightning Bolt',
    set: 'leb',
    collector_number: '162',
    image_uris: {
      normal: 'https://cards.scryfall.io/normal/front/bolt.jpg',
      large: 'https://cards.scryfall.io/large/front/bolt.jpg',
    },
    type_line: 'Instant',
    oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  };

  const creatureCard: ScryfallCard = {
    name: 'Questing Beast',
    set: 'eld',
    collector_number: '171',
    image_uris: {
      normal: 'https://cards.scryfall.io/normal/front/qb.jpg',
      large: 'https://cards.scryfall.io/large/front/qb.jpg',
    },
    type_line: 'Legendary Creature — Beast',
    oracle_text: 'Vigilance, deathtouch, haste\nQuesting Beast can\'t be blocked by creatures with power 2 or less.',
    power: '4',
    toughness: '4',
  };

  const dfcCard: ScryfallCard = {
    name: 'Delver of Secrets // Insectile Aberration',
    set: 'isd',
    collector_number: '51',
    card_faces: [
      {
        image_uris: {
          normal: 'https://cards.scryfall.io/normal/front/delver.jpg',
          large: 'https://cards.scryfall.io/large/front/delver.jpg',
        },
        oracle_text: 'At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.',
      },
      {
        image_uris: {
          normal: 'https://cards.scryfall.io/normal/back/aberration.jpg',
          large: 'https://cards.scryfall.io/large/back/aberration.jpg',
        },
        oracle_text: 'Flying',
      },
    ],
    type_line: 'Creature — Human Wizard // Creature — Human Insect',
    power: '1',
    toughness: '1',
  };

  it('maps a normal card correctly', () => {
    const result = mapToCardData(normalCard);

    expect(result.name).toBe('Lightning Bolt');
    expect(result.setCode).toBe('leb');
    expect(result.collectorNumber).toBe('162');
    expect(result.imageURI).toBe('https://cards.scryfall.io/normal/front/bolt.jpg');
    expect(result.imageURILarge).toBe('https://cards.scryfall.io/large/front/bolt.jpg');
    expect(result.backFaceImageURI).toBeNull();
    expect(result.typeLine).toBe('Instant');
    expect(result.oracleText).toBe('Lightning Bolt deals 3 damage to any target.');
    expect(result.isCommander).toBe(false);
    expect(result.cardType).toBe('instant');
    expect(result.basePower).toBeNull();
    expect(result.baseToughness).toBeNull();
    expect(result.keywords).toEqual([]);
  });

  it('maps a creature card with power, toughness, and keywords', () => {
    const result = mapToCardData(creatureCard);

    expect(result.name).toBe('Questing Beast');
    expect(result.cardType).toBe('creature');
    expect(result.basePower).toBe('4');
    expect(result.baseToughness).toBe('4');
    expect(result.keywords).toContain('vigilance');
    expect(result.keywords).toContain('deathtouch');
    expect(result.keywords).toContain('haste');
  });

  it('maps a DFC card with front and back face images', () => {
    const result = mapToCardData(dfcCard);

    expect(result.name).toBe('Delver of Secrets // Insectile Aberration');
    expect(result.setCode).toBe('isd');
    expect(result.collectorNumber).toBe('51');
    expect(result.imageURI).toBe('https://cards.scryfall.io/normal/front/delver.jpg');
    expect(result.imageURILarge).toBe('https://cards.scryfall.io/large/front/delver.jpg');
    expect(result.backFaceImageURI).toBe('https://cards.scryfall.io/normal/back/aberration.jpg');
    expect(result.typeLine).toBe('Creature — Human Wizard // Creature — Human Insect');
    expect(result.cardType).toBe('creature');
    expect(result.basePower).toBe('1');
    expect(result.baseToughness).toBe('1');
  });

  it('parses keywords from DFC oracle text (both faces combined)', () => {
    const result = mapToCardData(dfcCard);

    // "Flying" comes from the back face oracle text
    expect(result.keywords).toContain('flying');
  });

  it('generates a unique ID for each call', () => {
    const result1 = mapToCardData(normalCard);
    const result2 = mapToCardData(normalCard);

    expect(result1.id).not.toBe(result2.id);
    // Verify UUID format
    expect(result1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(result2.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('passes through the isCommander flag', () => {
    const asCommander = mapToCardData(normalCard, true);
    const notCommander = mapToCardData(normalCard, false);

    expect(asCommander.isCommander).toBe(true);
    expect(notCommander.isCommander).toBe(false);
  });

  it('defaults isCommander to false when not provided', () => {
    const result = mapToCardData(normalCard);
    expect(result.isCommander).toBe(false);
  });

  it('defaults oracle_text to empty string when missing', () => {
    const cardWithoutOracle: ScryfallCard = {
      name: 'Forest',
      set: 'leb',
      collector_number: '294',
      image_uris: {
        normal: 'https://cards.scryfall.io/normal/front/forest.jpg',
        large: 'https://cards.scryfall.io/large/front/forest.jpg',
      },
      type_line: 'Basic Land — Forest',
    };

    const result = mapToCardData(cardWithoutOracle);
    expect(result.oracleText).toBe('');
    expect(result.cardType).toBe('land');
    expect(result.keywords).toEqual([]);
    expect(result.basePower).toBeNull();
    expect(result.baseToughness).toBeNull();
  });

  it('maps imageURILarge to empty string when not available', () => {
    const cardNoLarge: ScryfallCard = {
      name: 'Test Card',
      set: 'tst',
      collector_number: '1',
      image_uris: { normal: 'https://cards.scryfall.io/normal/front/test.jpg' },
      type_line: 'Instant',
      oracle_text: '',
    };

    const result = mapToCardData(cardNoLarge);
    expect(result.imageURILarge).toBe('');
  });
});

// Feature: land-categorization, Property 2: Non-land nullity
// Feature: land-categorization, Property 3: Land classification consistency

/**
 * Arbitrary generator for non-land type lines.
 * Produces type lines that do NOT contain "land" (case-insensitive).
 */
const nonLandTypeLine = fc.constantFrom(
  'Creature — Human Wizard',
  'Artifact Creature — Golem',
  'Legendary Planeswalker — Jace',
  'Instant',
  'Sorcery',
  'Enchantment — Aura',
  'Artifact — Equipment',
  'Battle — Siege',
  'Tribal Instant — Goblin',
  'Legendary Creature — Dragon',
  'Artifact',
  'Enchantment',
);

/**
 * Arbitrary generator for land type lines.
 */
const landTypeLine = fc.constantFrom(
  'Basic Land — Forest',
  'Basic Land — Plains',
  'Basic Land — Island',
  'Basic Land — Swamp',
  'Basic Land — Mountain',
  'Land — Plains Island',
  'Land',
  'Land — Swamp Mountain',
  'Legendary Land',
  'Snow Land — Forest',
  'Land — Gate',
);

/**
 * Generator for a ScryfallCard with a non-land type line.
 */
const nonLandScryfallCard: fc.Arbitrary<ScryfallCard> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 40 }),
  set: fc.stringMatching(/^[a-z]{3,5}$/),
  collector_number: fc.nat({ max: 999 }).map(String),
  image_uris: fc.constant({ normal: 'https://example.com/card.jpg', large: 'https://example.com/card-large.jpg' }),
  type_line: nonLandTypeLine,
  oracle_text: fc.string({ maxLength: 200 }),
  produced_mana: fc.constant(undefined),
});

/**
 * Generator for a ScryfallCard with a land type line.
 */
const landScryfallCard: fc.Arbitrary<ScryfallCard> = fc.record({
  name: fc.constantFrom('Forest', 'Plains', 'Island', 'Swamp', 'Mountain', 'Breeding Pool', 'Scalding Tarn', 'Command Tower', 'Rogue\'s Passage', 'Temple of Silence'),
  set: fc.stringMatching(/^[a-z]{3,5}$/),
  collector_number: fc.nat({ max: 999 }).map(String),
  image_uris: fc.constant({ normal: 'https://example.com/land.jpg', large: 'https://example.com/land-large.jpg' }),
  type_line: landTypeLine,
  oracle_text: fc.oneof(
    fc.constant(''),
    fc.constant('{T}: Add {G}.'),
    fc.constant('({T}: Add {W} or {U}.)'),
    fc.constant('{T}: Add one mana of any color.'),
    fc.constant('Breeding Pool enters tapped unless you pay 2 life.\n({T}: Add {G} or {U}.)'),
    fc.constant('Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Sacrifice this land.'),
  ),
  produced_mana: fc.oneof(
    fc.constant(undefined),
    fc.constant(['G']),
    fc.constant(['W', 'U']),
    fc.constant(['W', 'U', 'B', 'R', 'G']),
    fc.constant(['B', 'R']),
  ),
});

describe('mapToCardData property tests', () => {
  /**
   * **Validates: Requirements 2.2, 2.4**
   *
   * Property 2: Non-land nullity — For any card with cardType !== 'land',
   * landCategory is null.
   */
  it('Property 2: non-land cards always have landCategory === null', () => {
    fc.assert(
      fc.property(nonLandScryfallCard, (card) => {
        const result = mapToCardData(card);
        expect(result.cardType).not.toBe('land');
        expect(result.landCategory).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.3**
   *
   * Property 3: Land classification consistency — For any land,
   * landCategory equals classifyLand(...) output.
   */
  it('Property 3: land cards have landCategory === classifyLand(...)', () => {
    fc.assert(
      fc.property(landScryfallCard, (card) => {
        const result = mapToCardData(card);
        // Only verify the property when front face is actually classified as land
        if (result.cardType !== 'land') return; // skip non-land edge cases from generator
        const expected = classifyLand(
          result.oracleText,
          card.card_faces?.[0]?.type_line ?? card.type_line,
          card.produced_mana ?? [],
          card.card_faces?.[0]?.name ?? card.name,
        );
        expect(result.landCategory).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
