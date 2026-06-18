import type { CardData } from './types';
import { parseKeywords } from './keywords';

/**
 * Helper to derive cardType from typeLine (same logic as mapToCardData).
 */
function deriveCardType(typeLine: string): CardData['cardType'] {
  const lower = typeLine.toLowerCase();
  if (lower.includes('creature')) return 'creature';
  if (lower.includes('planeswalker')) return 'planeswalker';
  if (lower.includes('battle')) return 'battle';
  if (lower.includes('land')) return 'land';
  if (lower.includes('artifact')) return 'artifact';
  if (lower.includes('enchantment')) return 'enchantment';
  if (lower.includes('instant')) return 'instant';
  if (lower.includes('sorcery')) return 'sorcery';
  return 'other';
}

/**
 * Helper to fill default fields for mock cards.
 */
function mockCard(partial: Omit<CardData, 'backFaceCardType' | 'backFaceName' | 'backFacePower' | 'backFaceToughness' | 'cmc' | 'manaCost' | 'colorIdentity' | 'producedMana' | 'landCategory'> & Partial<Pick<CardData, 'cmc' | 'manaCost' | 'colorIdentity' | 'producedMana' | 'landCategory'>>): CardData {
  return {
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    cmc: 0,
    manaCost: '',
    colorIdentity: [],
    producedMana: [],
    landCategory: null,
    ...partial,
  };
}

/**
 * Mock cards for offline testing.
 * Uses placeholder images since Scryfall CDN requires internet.
 * Replace with real Scryfall URLs when online.
 */

const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680" viewBox="0 0 488 680">
  <rect width="488" height="680" rx="16" fill="#1a1a2e"/>
  <rect x="16" y="16" width="456" height="648" rx="12" fill="#16213e" stroke="#0f3460" stroke-width="2"/>
  <text x="244" y="60" text-anchor="middle" fill="#e94560" font-family="serif" font-size="24" font-weight="bold">CARD_NAME</text>
  <rect x="32" y="80" width="424" height="300" rx="8" fill="#0f3460"/>
  <text x="244" y="420" text-anchor="middle" fill="#a8a8a8" font-family="sans-serif" font-size="16">CARD_TYPE</text>
  <text x="244" y="480" text-anchor="middle" fill="#cccccc" font-family="sans-serif" font-size="14">ORACLE_TEXT</text>
</svg>
`);

function makeImg(name: string, type: string): string {
  return PLACEHOLDER_IMG
    .replace('CARD_NAME', encodeURIComponent(name))
    .replace('CARD_TYPE', encodeURIComponent(type))
    .replace('ORACLE_TEXT', '');
}

export const MOCK_COMMANDER: CardData = {
  id: 'mock-cmd-001',
  name: 'Atraxa, Praetors\' Voice',
  setCode: 'c16',
  collectorNumber: '28',
  imageURI: makeImg('Atraxa', 'Legendary Creature'),
  imageURILarge: makeImg('Atraxa', 'Legendary Creature'),
  backFaceImageURI: null,
  backFaceCardType: null,
  backFaceName: null,
  backFacePower: null,
  backFaceToughness: null,
  typeLine: 'Legendary Creature — Phyrexian Angel Horror',
  oracleText: 'Flying, vigilance, deathtouch, lifelink. At the beginning of your end step, proliferate.',
  isCommander: true,
  basePower: '4',
  baseToughness: '4',
  cardType: 'creature',
  keywords: parseKeywords('Flying, vigilance, deathtouch, lifelink. At the beginning of your end step, proliferate.'),
  isToken: false,
  isTokenCopy: false,
  cmc: 4,
  manaCost: '{G}{W}{U}{B}',
  colorIdentity: ['G', 'W', 'U', 'B'],
  producedMana: [],
  landCategory: null,
};

export const MOCK_LIBRARY: CardData[] = [
  {
    id: 'mock-001',
    name: 'Lightning Bolt',
    setCode: 'lea',
    collectorNumber: '161',
    imageURI: makeImg('Lightning Bolt', 'Instant'),
    imageURILarge: makeImg('Lightning Bolt', 'Instant'),
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: 'Instant',
    oracleText: 'Lightning Bolt deals 3 damage to any target.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'instant',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
    cmc: 1,
    manaCost: '{R}',
    colorIdentity: ['R'],
    producedMana: [],
    landCategory: null,
  },
  {
    id: 'mock-002',
    name: 'Counterspell',
    setCode: 'lea',
    collectorNumber: '54',
    imageURI: makeImg('Counterspell', 'Instant'),
    imageURILarge: makeImg('Counterspell', 'Instant'),
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: 'Instant',
    oracleText: 'Counter target spell.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'instant',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
    cmc: 2,
    manaCost: '{U}{U}',
    colorIdentity: ['U'],
    producedMana: [],
    landCategory: null,
  },
  mockCard({
    id: 'mock-003',
    name: 'Sol Ring',
    setCode: 'c21',
    collectorNumber: '263',
    imageURI: makeImg('Sol Ring', 'Artifact'),
    imageURILarge: makeImg('Sol Ring', 'Artifact'),
    backFaceImageURI: null,
    typeLine: 'Artifact',
    oracleText: '{T}: Add {C}{C}.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'artifact',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
  }),
  mockCard({
    id: 'mock-004',
    name: 'Swords to Plowshares',
    setCode: 'lea',
    collectorNumber: '40',
    imageURI: makeImg('Swords to Plowshares', 'Instant'),
    imageURILarge: makeImg('Swords to Plowshares', 'Instant'),
    backFaceImageURI: null,
    typeLine: 'Instant',
    oracleText: 'Exile target creature. Its controller gains life equal to its power.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'instant',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
  }),
  mockCard({
    id: 'mock-005',
    name: 'Brainstorm',
    setCode: 'ice',
    collectorNumber: '61',
    imageURI: makeImg('Brainstorm', 'Instant'),
    imageURILarge: makeImg('Brainstorm', 'Instant'),
    backFaceImageURI: null,
    typeLine: 'Instant',
    oracleText: 'Draw three cards, then put two cards from your hand on top of your library.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'instant',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
  }),
  mockCard({
    id: 'mock-006',
    name: 'Dark Ritual',
    setCode: 'lea',
    collectorNumber: '98',
    imageURI: makeImg('Dark Ritual', 'Instant'),
    imageURILarge: makeImg('Dark Ritual', 'Instant'),
    backFaceImageURI: null,
    typeLine: 'Instant',
    oracleText: 'Add {B}{B}{B}.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'instant',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
  }),
  mockCard({
    id: 'mock-007',
    name: 'Path to Exile',
    setCode: 'con',
    collectorNumber: '15',
    imageURI: makeImg('Path to Exile', 'Instant'),
    imageURILarge: makeImg('Path to Exile', 'Instant'),
    backFaceImageURI: null,
    typeLine: 'Instant',
    oracleText: 'Exile target creature. Its controller may search their library for a basic land card.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'instant',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
  }),
  mockCard({
    id: 'mock-008',
    name: 'Mana Crypt',
    setCode: 'mps',
    collectorNumber: '16',
    imageURI: makeImg('Mana Crypt', 'Artifact'),
    imageURILarge: makeImg('Mana Crypt', 'Artifact'),
    backFaceImageURI: null,
    typeLine: 'Artifact',
    oracleText: 'At the beginning of your upkeep, flip a coin. If you lose the flip, Mana Crypt deals 3 damage to you. {T}: Add {C}{C}.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'artifact',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
  }),
  mockCard({
    id: 'mock-009',
    name: 'Rhystic Study',
    setCode: 'pcy',
    collectorNumber: '45',
    imageURI: makeImg('Rhystic Study', 'Enchantment'),
    imageURILarge: makeImg('Rhystic Study', 'Enchantment'),
    backFaceImageURI: null,
    typeLine: 'Enchantment',
    oracleText: 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'enchantment',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
  }),
  mockCard({
    id: 'mock-010',
    name: 'Cyclonic Rift',
    setCode: 'rtr',
    collectorNumber: '35',
    imageURI: makeImg('Cyclonic Rift', 'Instant'),
    imageURILarge: makeImg('Cyclonic Rift', 'Instant'),
    backFaceImageURI: null,
    typeLine: 'Instant',
    oracleText: 'Return target nonland permanent you don\'t control to its owner\'s hand. Overload {6}{U}.',
    isCommander: false,
    basePower: null,
    baseToughness: null,
    cardType: 'instant',
    keywords: [],
    isToken: false,
    isTokenCopy: false,
  }),
  ...Array.from({ length: 50 }, (_, i) => {
    const landName = ['Island', 'Plains', 'Swamp', 'Forest', 'Mountain'][i % 5];
    const typeLine = `Basic Land — ${landName}`;
    return mockCard({
      id: `mock-land-${i + 1}`,
      name: landName,
      setCode: 'lea',
      collectorNumber: `${280 + i}`,
      imageURI: makeImg(landName, 'Basic Land'),
      imageURILarge: makeImg(landName, 'Basic Land'),
      backFaceImageURI: null,
      typeLine,
      oracleText: '',
      isCommander: false,
      basePower: null,
      baseToughness: null,
      cardType: deriveCardType(typeLine),
      keywords: [],
      isToken: false,
      isTokenCopy: false,
      landCategory: 'basic',
    });
  }),
];
