import type { CreatureArea, RowCard } from './types';
import { shouldSplitRows, computeOuterDivWidthVh } from './creatureLayout';

/**
 * Counts independent elements in a list of RowCards.
 * Fanned groups (cards with the same name) count as 1 element each.
 *
 * @param elements - All RowCards across creature rows
 * @returns The number of independent elements (unique card names)
 */
export function countIndependentElements(elements: RowCard[]): number {
  const uniqueNames = new Set(elements.map(el => el.card.name));
  return uniqueNames.size;
}

/**
 * Recalculates the creature area row structure based on element count thresholds.
 *
 * Rules:
 * - Instants/sorceries always live in row 2 (isolated from permanents)
 * - Permanents ≤14 unique → merge to 1 row (always)
 * - Permanents >14 unique → 2 rows, preserve user arrangement if already split
 * - Row 2 exists if: spells are present OR permanents >14
 * - Never creates a 3rd row
 *
 * @param creatureArea - The current creature area state
 * @returns A new CreatureArea with the correct number of rows (max 2) and updated totalElementCount
 */
export function recalculateCreatureRows(
  creatureArea: CreatureArea,
  containerWidthPx: number = 0,
  vhToPx: number = 10.8,
  gapPx: number = 4
): CreatureArea {
  const allElements = creatureArea.rows.flatMap(r => r.elements);

  // Separate instants/sorceries from permanents
  const permanents = allElements.filter(el =>
    el.card.cardType !== 'instant' && el.card.cardType !== 'sorcery' && el.card.cardType !== 'other'
  );
  const spells = allElements.filter(el =>
    el.card.cardType === 'instant' || el.card.cardType === 'sorcery' || el.card.cardType === 'other'
  );

  const totalCount = countIndependentElements(allElements);

  if (shouldSplitRows(permanents, containerWidthPx, vhToPx, gapPx)) {
    // Need 2 rows for permanents
    // Check if already split — preserve user arrangement
    const currentRows = creatureArea.rows.map(r => ({
      permanents: r.elements.filter(el =>
        el.card.cardType !== 'instant' && el.card.cardType !== 'sorcery' && el.card.cardType !== 'other'
      ),
    }));
    const rowsWithPermanents = currentRows.filter(r => r.permanents.length > 0).length;

    if (rowsWithPermanents >= 2) {
      // Already split — preserve user arrangement, ensure spells at end of row 2
      const row1Permanents = currentRows[0]?.permanents ?? [];
      const row2Permanents = currentRows.slice(1).flatMap(r => r.permanents);
      return {
        rows: [
          { id: 'creature-1', elements: row1Permanents },
          { id: 'creature-2', elements: [...row2Permanents, ...spells] },
        ],
        totalElementCount: totalCount,
      };
    }

    // Not yet split — redistribute evenly
    const perRow = Math.ceil(permanents.length / 2);
    return {
      rows: [
        { id: 'creature-1', elements: permanents.slice(0, perRow) },
        { id: 'creature-2', elements: [...permanents.slice(perRow), ...spells] },
      ],
      totalElementCount: totalCount,
    };
  }

  // ≤14 permanents — always merge to 1 row
  if (spells.length > 0) {
    return {
      rows: [
        { id: 'creature-1', elements: permanents },
        { id: 'creature-2', elements: spells },
      ],
      totalElementCount: totalCount,
    };
  }

  return {
    rows: [{ id: 'creature-1', elements: permanents }],
    totalElementCount: totalCount,
  };
}


/**
 * Determines which row a new creature should be added to.
 * 
 * Logic:
 * 1. If only 1 row exists → creature-1 (recalculateCreatureRows handles split)
 * 2. If 2 rows exist and row 1 would compress with the new card → creature-2
 * 3. Otherwise → creature-1
 *
 * Uses tap-agnostic width (computeOuterDivWidthVh) so tap state doesn't affect routing.
 *
 * @param creatureArea - Current creature area state
 * @param containerWidthPx - Container width in pixels
 * @param vhToPx - Conversion factor (window.innerHeight / 100)
 * @param gapPx - Gap between cards in pixels
 * @returns 'creature-1' or 'creature-2'
 */
export function getTargetRowForNewCreature(
  creatureArea: CreatureArea,
  containerWidthPx: number,
  vhToPx: number,
  gapPx: number = 4
): 'creature-1' | 'creature-2' {
  // Only 1 row — always add to row 1 (split logic handles the rest)
  if (creatureArea.rows.length < 2) return 'creature-1';

  // Get row 1 permanents
  const row1Elements = creatureArea.rows[0]?.elements.filter(el =>
    el.card.cardType !== 'instant' && el.card.cardType !== 'sorcery' && el.card.cardType !== 'other'
  ) ?? [];

  if (containerWidthPx <= 0 || row1Elements.length === 0) return 'creature-1';

  // Would row 1 compress if we added one more standard card (11.43vh)?
  const currentWidthPx = row1Elements.reduce((sum, el) => {
    return sum + computeOuterDivWidthVh(el.isTapped, el.attachments.length) * vhToPx;
  }, 0);
  const newCardWidthPx = 11.43 * vhToPx;
  const totalNeeded = currentWidthPx + newCardWidthPx + row1Elements.length * gapPx;

  if (totalNeeded > containerWidthPx) return 'creature-2';
  return 'creature-1';
}
