import { describe, it, expect } from 'vitest';
import { parsePlainText } from './plainTextParser';

describe('parsePlainText', () => {
  it('parses a card name without quantity (defaults to 1)', () => {
    const result = parsePlainText('Lightning Bolt');
    expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 1 }]);
  });

  it('parses a card with numeric quantity prefix', () => {
    const result = parsePlainText('4 Lightning Bolt');
    expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 4 }]);
  });

  it('parses a card with "x" quantity prefix (lowercase)', () => {
    const result = parsePlainText('4x Lightning Bolt');
    expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 4 }]);
  });

  it('parses a card with "X" quantity prefix (uppercase)', () => {
    const result = parsePlainText('4X Lightning Bolt');
    expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 4 }]);
  });

  it('skips empty lines', () => {
    const input = 'Lightning Bolt\n\nCounterspell';
    const result = parsePlainText(input);
    expect(result).toEqual([
      { name: 'Lightning Bolt', quantity: 1 },
      { name: 'Counterspell', quantity: 1 },
    ]);
  });

  it('skips comment lines starting with //', () => {
    const input = '// This is a comment\nLightning Bolt\n// Another comment';
    const result = parsePlainText(input);
    expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 1 }]);
  });

  it('skips lines with only whitespace', () => {
    const input = '   \nLightning Bolt\n\t\t';
    const result = parsePlainText(input);
    expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 1 }]);
  });

  it('trims whitespace from card names', () => {
    const result = parsePlainText('  Lightning Bolt  ');
    expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 1 }]);
  });

  it('trims whitespace from card names with quantity prefix', () => {
    const result = parsePlainText('4   Lightning Bolt  ');
    expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 4 }]);
  });

  it('parses a full decklist with mixed formats', () => {
    const input = `// Creatures
4 Goblin Guide
4x Monastery Swiftspear
2X Eidolon of the Great Revel

// Spells
4 Lightning Bolt
Lava Spike

// Lands
Mountain`;

    const result = parsePlainText(input);
    expect(result).toEqual([
      { name: 'Goblin Guide', quantity: 4 },
      { name: 'Monastery Swiftspear', quantity: 4 },
      { name: 'Eidolon of the Great Revel', quantity: 2 },
      { name: 'Lightning Bolt', quantity: 4 },
      { name: 'Lava Spike', quantity: 1 },
      { name: 'Mountain', quantity: 1 },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parsePlainText('')).toEqual([]);
  });

  it('returns empty array for input with only comments and whitespace', () => {
    const input = '// comment\n\n   \n// another comment';
    expect(parsePlainText(input)).toEqual([]);
  });

  it('handles single-digit and multi-digit quantities', () => {
    const input = '1 Sol Ring\n20 Forest';
    const result = parsePlainText(input);
    expect(result).toEqual([
      { name: 'Sol Ring', quantity: 1 },
      { name: 'Forest', quantity: 20 },
    ]);
  });

  it('handles card names with special characters', () => {
    const input = "2 Jace, the Mind Sculptor\n1 Fire // Ice";
    const result = parsePlainText(input);
    expect(result).toEqual([
      { name: 'Jace, the Mind Sculptor', quantity: 2 },
      { name: 'Fire // Ice', quantity: 1 },
    ]);
  });
});
