import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importDeck, importDeckToGameState } from './importDeck';
import type { ImportResult } from './importDeck';
import type { DeckEntry } from '../parsers/plainTextParser';
import type { ScryfallCard } from '../api/scryfallResolver';
import type { CardData } from '../types';

vi.mock('../api/scryfallResolver', () => ({
  resolveCards: vi.fn(),
}));

import { resolveCards } from '../api/scryfallResolver';

const mockResolveCards = vi.mocked(resolveCards);

function makeScryfallCard(name: string): ScryfallCard {
  return {
    name,
    set: 'test',
    collector_number: '1',
    image_uris: { normal: `https://img.scryfall.com/${name}.jpg` },
    type_line: 'Creature — Test',
    oracle_text: `Oracle text for ${name}`,
  };
}

describe('importDeck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves entries and creates CardData instances with correct quantities', async () => {
    const entries: DeckEntry[] = [
      { name: 'Lightning Bolt', quantity: 4 },
      { name: 'Sol Ring', quantity: 1 },
    ];

    const resolvedMap = new Map<string, ScryfallCard>([
      ['Lightning Bolt', makeScryfallCard('Lightning Bolt')],
      ['Sol Ring', makeScryfallCard('Sol Ring')],
    ]);

    mockResolveCards.mockResolvedValue({ resolved: resolvedMap, failures: [] });

    const result = await importDeck(entries, []);

    // 4 copies of Lightning Bolt + 1 Sol Ring = 5 mainboard cards
    expect(result.mainboard).toHaveLength(5);
    expect(result.commanders).toHaveLength(0);
    expect(result.failures).toEqual([]);

    // Verify names
    const boltCards = result.mainboard.filter((c) => c.name === 'Lightning Bolt');
    expect(boltCards).toHaveLength(4);

    const solRingCards = result.mainboard.filter((c) => c.name === 'Sol Ring');
    expect(solRingCards).toHaveLength(1);

    // Each card should have a unique ID
    const ids = result.mainboard.map((c) => c.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('marks commander cards with isCommander: true', async () => {
    const entries: DeckEntry[] = [
      { name: 'Atraxa, Praetors Voice', quantity: 1 },
      { name: 'Sol Ring', quantity: 1 },
    ];

    const resolvedMap = new Map<string, ScryfallCard>([
      ['Atraxa, Praetors Voice', makeScryfallCard('Atraxa, Praetors Voice')],
      ['Sol Ring', makeScryfallCard('Sol Ring')],
    ]);

    mockResolveCards.mockResolvedValue({ resolved: resolvedMap, failures: [] });

    const result = await importDeck(entries, ['Atraxa, Praetors Voice']);

    expect(result.commanders).toHaveLength(1);
    expect(result.commanders[0].isCommander).toBe(true);
    expect(result.commanders[0].name).toBe('Atraxa, Praetors Voice');

    // Non-commander should not be marked
    expect(result.mainboard).toHaveLength(1);
    expect(result.mainboard[0].isCommander).toBe(false);
  });

  it('separates commanders from mainboard correctly', async () => {
    const entries: DeckEntry[] = [
      { name: 'Kenrith, the Returned King', quantity: 1 },
      { name: 'Thrasios, Triton Hero', quantity: 1 },
      { name: 'Lightning Bolt', quantity: 3 },
      { name: 'Counterspell', quantity: 2 },
    ];

    const resolvedMap = new Map<string, ScryfallCard>([
      ['Kenrith, the Returned King', makeScryfallCard('Kenrith, the Returned King')],
      ['Thrasios, Triton Hero', makeScryfallCard('Thrasios, Triton Hero')],
      ['Lightning Bolt', makeScryfallCard('Lightning Bolt')],
      ['Counterspell', makeScryfallCard('Counterspell')],
    ]);

    mockResolveCards.mockResolvedValue({ resolved: resolvedMap, failures: [] });

    const result = await importDeck(entries, [
      'Kenrith, the Returned King',
      'Thrasios, Triton Hero',
    ]);

    expect(result.commanders).toHaveLength(2);
    expect(result.mainboard).toHaveLength(5); // 3 bolts + 2 counterspells

    const commanderNames = result.commanders.map((c) => c.name);
    expect(commanderNames).toContain('Kenrith, the Returned King');
    expect(commanderNames).toContain('Thrasios, Triton Hero');

    // Mainboard should not contain commanders
    const mainboardNames = result.mainboard.map((c) => c.name);
    expect(mainboardNames).not.toContain('Kenrith, the Returned King');
    expect(mainboardNames).not.toContain('Thrasios, Triton Hero');
  });

  it('reports failures for unresolved cards', async () => {
    const entries: DeckEntry[] = [
      { name: 'Lightning Bolt', quantity: 4 },
      { name: 'Nonexistent Card', quantity: 2 },
    ];

    const resolvedMap = new Map<string, ScryfallCard>([
      ['Lightning Bolt', makeScryfallCard('Lightning Bolt')],
    ]);

    mockResolveCards.mockResolvedValue({
      resolved: resolvedMap,
      failures: ['Nonexistent Card'],
    });

    const result = await importDeck(entries, []);

    expect(result.mainboard).toHaveLength(4);
    expect(result.failures).toEqual(['Nonexistent Card']);
  });

  it('calls onProgress callback during resolution', async () => {
    const entries: DeckEntry[] = [{ name: 'Sol Ring', quantity: 1 }];
    const resolvedMap = new Map<string, ScryfallCard>([
      ['Sol Ring', makeScryfallCard('Sol Ring')],
    ]);

    mockResolveCards.mockResolvedValue({ resolved: resolvedMap, failures: [] });

    const onProgress = vi.fn();
    await importDeck(entries, [], { onProgress });

    // Verify resolveCards was called with the onProgress callback
    expect(mockResolveCards).toHaveBeenCalledWith(
      [{ name: 'Sol Ring' }],
      expect.objectContaining({ onProgress })
    );
  });

  it('handles empty entries array', async () => {
    mockResolveCards.mockResolvedValue({
      resolved: new Map(),
      failures: [],
    });

    const result = await importDeck([], []);

    expect(result.mainboard).toHaveLength(0);
    expect(result.commanders).toHaveLength(0);
    expect(result.failures).toEqual([]);
  });

  it('case-insensitive commander name matching', async () => {
    const entries: DeckEntry[] = [
      { name: 'Atraxa, Praetors Voice', quantity: 1 },
      { name: 'Sol Ring', quantity: 1 },
    ];

    const resolvedMap = new Map<string, ScryfallCard>([
      ['Atraxa, Praetors Voice', makeScryfallCard('Atraxa, Praetors Voice')],
      ['Sol Ring', makeScryfallCard('Sol Ring')],
    ]);

    mockResolveCards.mockResolvedValue({ resolved: resolvedMap, failures: [] });

    // Commander name in different case than the entry
    const result = await importDeck(entries, ['ATRAXA, PRAETORS VOICE']);

    expect(result.commanders).toHaveLength(1);
    expect(result.commanders[0].name).toBe('Atraxa, Praetors Voice');
    expect(result.commanders[0].isCommander).toBe(true);
    expect(result.mainboard).toHaveLength(1);
    expect(result.mainboard[0].name).toBe('Sol Ring');
  });
});

describe('importDeckToGameState', () => {
  function makeCardData(name: string, isCommander = false): CardData {
    return {
      id: `id-${name}-${Math.random().toString(36).slice(2)}`,
      name,
      setCode: 'test',
      collectorNumber: '1',
      imageURI: `https://img.scryfall.com/${name}.jpg`,
      imageURILarge: `https://img.scryfall.com/${name}-large.jpg`,
      backFaceImageURI: null,
      typeLine: 'Creature — Test',
      oracleText: `Oracle text for ${name}`,
      isCommander,
      keywords: [],
      basePower: '2',
      baseToughness: '2',
      cardType: 'creature',
      isToken: false,
      isTokenCopy: false,
    };
  }

  it('places commanders in commandZone and mainboard in library, then initializes mulligan', () => {
    const commanders = [makeCardData('Atraxa', true)];
    const mainboard = Array.from({ length: 99 }, (_, i) => makeCardData(`Card ${i}`));

    const importResult: ImportResult = {
      mainboard,
      commanders,
      failures: [],
    };

    const state = importDeckToGameState(importResult);

    // Commanders should be in commandZone
    expect(state.commandZone).toHaveLength(1);
    expect(state.commandZone[0].name).toBe('Atraxa');

    // gamePhase should be MULLIGAN
    expect(state.gamePhase).toBe('MULLIGAN');

    // mulliganState should be populated
    expect(state.mulliganState).not.toBeNull();
    expect(state.mulliganState!.drawnCards).toHaveLength(7);
    expect(state.mulliganState!.mulliganCount).toBe(0);
    expect(state.mulliganState!.requiredPutBacks).toBe(0); // First is free

    // Library should have 99 - 7 = 92 cards remaining
    expect(state.library).toHaveLength(92);

    // Total cards should be conserved: 1 commander + 99 mainboard = 100
    const totalCards =
      state.commandZone.length +
      state.library.length +
      state.mulliganState!.drawnCards.length;
    expect(totalCards).toBe(100);

    // deckLoaded should be true
    expect(state.deckLoaded).toBe(true);
  });

  it('handles small library (fewer than 7 cards) gracefully', () => {
    const mainboard = Array.from({ length: 3 }, (_, i) => makeCardData(`Card ${i}`));

    const importResult: ImportResult = {
      mainboard,
      commanders: [],
      failures: [],
    };

    const state = importDeckToGameState(importResult);

    // Should draw all 3 cards (fewer than 7 available)
    expect(state.mulliganState).not.toBeNull();
    expect(state.mulliganState!.drawnCards).toHaveLength(3);
    expect(state.library).toHaveLength(0);
    expect(state.gamePhase).toBe('MULLIGAN');
  });

  it('handles empty mainboard (commanders only)', () => {
    const commanders = [makeCardData('Commander', true)];

    const importResult: ImportResult = {
      mainboard: [],
      commanders,
      failures: [],
    };

    const state = importDeckToGameState(importResult);

    expect(state.commandZone).toHaveLength(1);
    expect(state.mulliganState).not.toBeNull();
    expect(state.mulliganState!.drawnCards).toHaveLength(0);
    expect(state.library).toHaveLength(0);
    expect(state.gamePhase).toBe('MULLIGAN');
  });

  it('starts with empty battlefield zones', () => {
    const mainboard = Array.from({ length: 10 }, (_, i) => makeCardData(`Card ${i}`));

    const importResult: ImportResult = {
      mainboard,
      commanders: [],
      failures: [],
    };

    const state = importDeckToGameState(importResult);

    // All battlefield zones should be empty
    expect(state.creatureArea.rows[0].elements).toHaveLength(0);
    expect(state.row3.left).toHaveLength(0);
    expect(state.row3.right).toHaveLength(0);
    expect(state.row4.left).toHaveLength(0);
    expect(state.row4.right).toHaveLength(0);
    expect(state.hand).toHaveLength(0);
    expect(state.graveyard).toHaveLength(0);
    expect(state.exile).toHaveLength(0);
  });

  it('sets lifeTotal to 40 (Commander default)', () => {
    const importResult: ImportResult = {
      mainboard: [makeCardData('Card 1')],
      commanders: [],
      failures: [],
    };

    const state = importDeckToGameState(importResult);
    expect(state.lifeTotal).toBe(40);
  });
});
