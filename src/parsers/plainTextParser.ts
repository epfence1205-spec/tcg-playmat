/**
 * Plain-text decklist parser.
 * Parses one card per line with optional quantity prefix.
 */

export interface DeckEntry {
  name: string;
  quantity: number;
  /** Optional set code for specific printing (e.g., from Archidekt/Moxfield) */
  set?: string;
  /** Optional collector number for exact printing lookup via Scryfall */
  collectorNumber?: string;
}

/**
 * Parses a plain-text decklist into an array of DeckEntry objects.
 *
 * Supported formats:
 * - "Lightning Bolt" → { name: "Lightning Bolt", quantity: 1 }
 * - "4 Lightning Bolt" → { name: "Lightning Bolt", quantity: 4 }
 * - "4x Lightning Bolt" → { name: "Lightning Bolt", quantity: 4 }
 * - "4X Lightning Bolt" → { name: "Lightning Bolt", quantity: 4 }
 * - Empty lines → skipped
 * - "// comment" → skipped
 * - Lines with only whitespace → skipped
 */
export function parsePlainText(input: string): DeckEntry[] {
  const lines = input.split('\n');
  const entries: DeckEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and whitespace-only lines
    if (trimmed === '') continue;

    // Skip comment lines (starting with //)
    if (trimmed.startsWith('//')) continue;

    // Try to match quantity prefix: "4 Card Name" or "4x Card Name" or "4X Card Name"
    const match = trimmed.match(/^(\d+)\s*[xX]?\s+(.+)$/);

    if (match) {
      const quantity = parseInt(match[1], 10);
      const name = match[2].trim();
      if (name && quantity > 0) {
        entries.push({ name, quantity });
      }
    } else {
      // No quantity prefix — default to 1
      entries.push({ name: trimmed, quantity: 1 });
    }
  }

  return entries;
}
