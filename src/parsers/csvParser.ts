/**
 * CSV decklist parser.
 * Parses CSV-formatted decklists with support for quoted fields,
 * header detection, and flexible column ordering.
 */

import type { DeckEntry } from './plainTextParser';

/** Header keywords that indicate a header row (case-insensitive) */
const HEADER_KEYWORDS = ['name', 'card', 'quantity', 'count', 'qty', 'amount', 'number'];

/**
 * Determines if a row looks like a header row by checking if any field
 * matches known header keywords.
 */
function isHeaderRow(fields: string[]): boolean {
  return fields.some(field =>
    HEADER_KEYWORDS.includes(field.toLowerCase().trim())
  );
}

/**
 * Parses a single CSV line into fields, respecting quoted values.
 * Handles fields like: "Jace, the Mind Sculptor"
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Push the last field
  fields.push(current.trim());

  return fields;
}

/**
 * Determines if a string represents a numeric quantity.
 */
function isNumeric(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/**
 * Parses a CSV-formatted decklist into an array of DeckEntry objects.
 *
 * Supported formats:
 * - Single column: just card names (quantity defaults to 1)
 * - Two columns: "quantity,name" or "name,quantity"
 * - Optional header row (auto-detected and skipped)
 * - Quoted fields for card names containing commas
 * - Empty rows are skipped
 */
export function parseCsv(input: string): DeckEntry[] {
  const lines = input.split('\n');
  const entries: DeckEntry[] = [];

  let startIndex = 0;

  // Check if the first non-empty line is a header row
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;

    const fields = parseCSVLine(trimmed);
    if (isHeaderRow(fields)) {
      startIndex = i + 1;
    } else {
      startIndex = i;
    }
    break;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip empty lines
    if (trimmed === '') continue;

    const fields = parseCSVLine(trimmed);

    // Skip rows where all fields are empty
    if (fields.every(f => f === '')) continue;

    if (fields.length === 1) {
      // Single column: just a card name
      const name = fields[0];
      if (name) {
        entries.push({ name, quantity: 1 });
      }
    } else if (fields.length >= 2) {
      // Two columns: determine which is quantity and which is name
      const first = fields[0];
      const second = fields[1];

      if (isNumeric(first) && second) {
        // Format: quantity, name
        const quantity = parseInt(first, 10);
        if (quantity > 0) {
          entries.push({ name: second, quantity });
        }
      } else if (isNumeric(second) && first) {
        // Format: name, quantity
        const quantity = parseInt(second, 10);
        if (quantity > 0) {
          entries.push({ name: first, quantity });
        }
      } else if (first) {
        // Both non-numeric: treat first as name, default quantity 1
        entries.push({ name: first, quantity: 1 });
      }
    }
  }

  return entries;
}
