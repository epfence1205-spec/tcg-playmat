import { describe, it, expect } from 'vitest';
import { recalculateCreatureRows, countIndependentElements } from './creatureRows';
import type { CreatureArea, RowCard, CardData } from './types';

function makeCard(name: string, id?: string): CardData {
  return {
    id: id ?? `id-${name}-${Math.random().toString(36).slice(2)}`,
    name,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front.jpg',
    backFaceImageURI: null,
    typeLine: 'Creature — Test',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: '2',
    baseToughness: '2',
    cardType: 'creature',
    isToken: false,
    isTokenCopy: false,
  };
}

function makeRowCard(name: string, id?: string): RowCard {
  const card = makeCard(name, id);
  return {
    card,
    instanceId: card.id,
    rowAssignment: 'creature-1',
    positionIndex: 0,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters: [],
    isRevealed: false,
  };
}

describe('countIndependentElements', () => {
  it('returns 0 for empty array', () => {
    expect(countIndependentElements([])).toBe(0);
  });

  it('counts unique card names', () => {
    const elements = [
      makeRowCard('Alpha'),
      makeRowCard('Beta'),
      makeRowCard('Gamma'),
    ];
    expect(countIndependentElements(elements)).toBe(3);
  });

  it('counts fanned groups (same name) as 1 element', () => {
    const elements = [
      makeRowCard('Forest', 'f1'),
      makeRowCard('Forest', 'f2'),
      makeRowCard('Forest', 'f3'),
      makeRowCard('Mountain', 'm1'),
    ];
    expect(countIndependentElements(elements)).toBe(2);
  });

  it('counts all same-name cards as 1', () => {
    const elements = [
      makeRowCard('Forest', 'f1'),
      makeRowCard('Forest', 'f2'),
      makeRowCard('Forest', 'f3'),
      makeRowCard('Forest', 'f4'),
    ];
    expect(countIndependentElements(elements)).toBe(1);
  });
});

describe('recalculateCreatureRows', () => {
  it('keeps 1 row when ≤14 elements', () => {
    const elements = Array.from({ length: 5 }, (_, i) => makeRowCard(`Card${i}`));
    const area: CreatureArea = {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: 0,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(1);
    expect(result.totalElementCount).toBe(5);
  });

  it('keeps 1 row when exactly 14 elements', () => {
    const elements = Array.from({ length: 14 }, (_, i) => makeRowCard(`Card${i}`));
    const area: CreatureArea = {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: 0,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(1);
    expect(result.totalElementCount).toBe(14);
  });

  it('splits to 2 rows when >14 and ≤28 elements', () => {
    const elements = Array.from({ length: 15 }, (_, i) => makeRowCard(`Card${i}`));
    const area: CreatureArea = {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: 0,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(2);
    // Redistribution: 15 cards split evenly → ceil(15/2)=8 in row 1, 7 in row 2
    expect(result.rows[0].elements.length).toBe(8);
    expect(result.rows[1].elements.length).toBe(7);
    expect(result.totalElementCount).toBe(15);
  });

  it('splits to 2 rows when exactly 28 elements', () => {
    const elements = Array.from({ length: 28 }, (_, i) => makeRowCard(`Card${i}`));
    const area: CreatureArea = {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: 0,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(2);
    expect(result.totalElementCount).toBe(28);
  });

  it('stays at 2 rows when >28 elements (overlap handles overflow)', () => {
    const elements = Array.from({ length: 30 }, (_, i) => makeRowCard(`Card${i}`));
    const area: CreatureArea = {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: 0,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(2);
    // Redistribution: 30 cards split evenly → ceil(30/2)=15 per row
    expect(result.rows[0].elements.length).toBe(15);
    expect(result.rows[1].elements.length).toBe(15);
    expect(result.totalElementCount).toBe(30);
  });

  it('merges rows when element count drops below threshold', () => {
    // Start with 2 rows but only 5 unique elements total
    const elements1 = [makeRowCard('A'), makeRowCard('B'), makeRowCard('C')];
    const elements2 = [makeRowCard('D'), makeRowCard('E')];
    const area: CreatureArea = {
      rows: [
        { id: 'creature-1', elements: elements1 },
        { id: 'creature-2', elements: elements2 },
      ],
      totalElementCount: 5,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(1);
    // All elements should be in the single remaining row
    expect(result.rows[0].elements.length).toBe(5);
    expect(result.totalElementCount).toBe(5);
  });

  it('merges 3 rows to 2 when element count is >14', () => {
    const elements1 = Array.from({ length: 8 }, (_, i) => makeRowCard(`A${i}`));
    const elements2 = Array.from({ length: 5 }, (_, i) => makeRowCard(`B${i}`));
    const elements3 = Array.from({ length: 3 }, (_, i) => makeRowCard(`C${i}`));
    const area: CreatureArea = {
      rows: [
        { id: 'creature-1', elements: elements1 },
        { id: 'creature-2', elements: elements2 },
        { id: 'creature-3', elements: elements3 },
      ],
      totalElementCount: 16,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(2);
    expect(result.totalElementCount).toBe(16);
  });

  it('counts fanned groups as 1 element for threshold decisions', () => {
    // 10 cards but only 5 unique names → should stay at 1 row
    const elements = [
      makeRowCard('Forest', 'f1'),
      makeRowCard('Forest', 'f2'),
      makeRowCard('Mountain', 'm1'),
      makeRowCard('Mountain', 'm2'),
      makeRowCard('Island', 'i1'),
      makeRowCard('Island', 'i2'),
      makeRowCard('Plains', 'p1'),
      makeRowCard('Plains', 'p2'),
      makeRowCard('Swamp', 's1'),
      makeRowCard('Swamp', 's2'),
    ];
    const area: CreatureArea = {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: 0,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(1); // 5 unique names ≤ 14
    expect(result.totalElementCount).toBe(5);
  });

  it('does not change row count when already correct', () => {
    const elements = Array.from({ length: 15 }, (_, i) => makeRowCard(`Card${i}`));
    const area: CreatureArea = {
      rows: [
        { id: 'creature-1', elements: elements.slice(0, 8) },
        { id: 'creature-2', elements: elements.slice(8) },
      ],
      totalElementCount: 15,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(2);
    expect(result.totalElementCount).toBe(15);
  });

  it('assigns correct row IDs when splitting', () => {
    const elements = Array.from({ length: 15 }, (_, i) => makeRowCard(`Card${i}`));
    const area: CreatureArea = {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: 0,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows[0].id).toBe('creature-1');
    expect(result.rows[1].id).toBe('creature-2');
  });

  it('never exceeds 2 rows', () => {
    const elements = Array.from({ length: 50 }, (_, i) => makeRowCard(`Card${i}`));
    const area: CreatureArea = {
      rows: [{ id: 'creature-1', elements }],
      totalElementCount: 0,
    };
    const result = recalculateCreatureRows(area);
    expect(result.rows.length).toBe(2);
  });
});
