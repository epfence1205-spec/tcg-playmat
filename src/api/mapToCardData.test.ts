import { describe, it, expect } from 'vitest';
import { mapToCardData, deriveCardType } from './mapToCardData';
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
