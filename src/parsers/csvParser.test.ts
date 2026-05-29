import { describe, it, expect } from 'vitest';
import { parseCsv } from './csvParser';

describe('parseCsv', () => {
  describe('single column (card names only)', () => {
    it('parses single card name with quantity defaulting to 1', () => {
      const result = parseCsv('Lightning Bolt');
      expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 1 }]);
    });

    it('parses multiple card names one per line', () => {
      const input = 'Lightning Bolt\nCounterspell\nSol Ring';
      const result = parseCsv(input);
      expect(result).toEqual([
        { name: 'Lightning Bolt', quantity: 1 },
        { name: 'Counterspell', quantity: 1 },
        { name: 'Sol Ring', quantity: 1 },
      ]);
    });
  });

  describe('two columns: quantity,name', () => {
    it('parses quantity,name format', () => {
      const input = '4,Lightning Bolt\n2,Counterspell';
      const result = parseCsv(input);
      expect(result).toEqual([
        { name: 'Lightning Bolt', quantity: 4 },
        { name: 'Counterspell', quantity: 2 },
      ]);
    });
  });

  describe('two columns: name,quantity', () => {
    it('parses name,quantity format', () => {
      const input = 'Lightning Bolt,4\nCounterspell,2';
      const result = parseCsv(input);
      expect(result).toEqual([
        { name: 'Lightning Bolt', quantity: 4 },
        { name: 'Counterspell', quantity: 2 },
      ]);
    });
  });

  describe('header row detection', () => {
    it('skips header row with "name" and "quantity"', () => {
      const input = 'name,quantity\nLightning Bolt,4\nCounterspell,2';
      const result = parseCsv(input);
      expect(result).toEqual([
        { name: 'Lightning Bolt', quantity: 4 },
        { name: 'Counterspell', quantity: 2 },
      ]);
    });

    it('skips header row with "card" and "count"', () => {
      const input = 'card,count\nLightning Bolt,4';
      const result = parseCsv(input);
      expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 4 }]);
    });

    it('skips header row with "qty" keyword', () => {
      const input = 'qty,card\n4,Lightning Bolt';
      const result = parseCsv(input);
      expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 4 }]);
    });

    it('does not skip first row if it does not look like a header', () => {
      const input = 'Lightning Bolt,4\nCounterspell,2';
      const result = parseCsv(input);
      expect(result).toEqual([
        { name: 'Lightning Bolt', quantity: 4 },
        { name: 'Counterspell', quantity: 2 },
      ]);
    });
  });

  describe('quoted fields', () => {
    it('handles quoted card names with commas', () => {
      const input = '4,"Jace, the Mind Sculptor"';
      const result = parseCsv(input);
      expect(result).toEqual([{ name: 'Jace, the Mind Sculptor', quantity: 4 }]);
    });

    it('handles quoted card names in name,quantity format', () => {
      const input = '"Jace, the Mind Sculptor",4';
      const result = parseCsv(input);
      expect(result).toEqual([{ name: 'Jace, the Mind Sculptor', quantity: 4 }]);
    });

    it('handles escaped quotes within quoted fields', () => {
      const input = '"Card ""The Great""",2';
      const result = parseCsv(input);
      expect(result).toEqual([{ name: 'Card "The Great"', quantity: 2 }]);
    });
  });

  describe('empty rows and edge cases', () => {
    it('skips empty rows', () => {
      const input = 'Lightning Bolt\n\n\nCounterspell';
      const result = parseCsv(input);
      expect(result).toEqual([
        { name: 'Lightning Bolt', quantity: 1 },
        { name: 'Counterspell', quantity: 1 },
      ]);
    });

    it('returns empty array for empty input', () => {
      expect(parseCsv('')).toEqual([]);
    });

    it('returns empty array for input with only empty lines', () => {
      expect(parseCsv('\n\n\n')).toEqual([]);
    });

    it('skips rows where quantity is 0', () => {
      const input = '0,Lightning Bolt\n4,Counterspell';
      const result = parseCsv(input);
      expect(result).toEqual([{ name: 'Counterspell', quantity: 4 }]);
    });

    it('handles whitespace around fields', () => {
      const input = ' 4 , Lightning Bolt ';
      const result = parseCsv(input);
      expect(result).toEqual([{ name: 'Lightning Bolt', quantity: 4 }]);
    });
  });

  describe('mixed format decklist', () => {
    it('parses a full CSV decklist with header', () => {
      const input = `Name,Quantity
Lightning Bolt,4
"Jace, the Mind Sculptor",1
Counterspell,3
Sol Ring,1`;

      const result = parseCsv(input);
      expect(result).toEqual([
        { name: 'Lightning Bolt', quantity: 4 },
        { name: 'Jace, the Mind Sculptor', quantity: 1 },
        { name: 'Counterspell', quantity: 3 },
        { name: 'Sol Ring', quantity: 1 },
      ]);
    });
  });
});
