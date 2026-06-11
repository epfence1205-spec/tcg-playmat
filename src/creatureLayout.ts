/**
 * Pure layout calculation functions for creature outer div sizing.
 * These are extracted for testability — no DOM, no React, just math.
 */

import type { RowCard } from './types';

/**
 * Compute the outer div width in viewport-height units.
 *
 * - Tapped: always 16vh (card height becomes the horizontal footprint)
 * - Untapped: 11.43vh (base card width) + 2vh per attachment (cascade offset)
 *
 * @param isTapped - Whether the creature is currently tapped
 * @param attachmentCount - Number of equipment/aura cards attached
 * @returns Width in vh units
 */
export function computeOuterDivWidthVh(isTapped: boolean, attachmentCount: number): number {
  void isTapped;
  return 11.43 + attachmentCount * 2;
}

/**
 * Compute the sortable wrapper width in viewport-height units.
 * This is the actual horizontal footprint used for layout and compression.
 *
 * - Tapped: 16vh (card height becomes the horizontal footprint)
 * - Untapped: 11.43vh + 2vh per attachment
 *
 * @param isTapped - Whether the card is currently tapped
 * @param attachmentCount - Number of equipment/aura cards attached
 * @returns Width in vh units
 */
export function computeSortableWrapperWidthVh(isTapped: boolean, attachmentCount: number): number {
  if (isTapped) return 16;
  return 11.43 + attachmentCount * 2;
}

/**
 * Compute the outer div height in viewport-height units.
 *
 * - Untapped: always 16vh (card height)
 * - Tapped: 16vh (square box so rotation stays centered)
 *
 * @param isTapped - Whether the creature is currently tapped
 * @param attachmentCount - Number of equipment/aura cards attached
 * @returns Height in vh units
 */
export function computeOuterDivHeightVh(isTapped: boolean, attachmentCount: number): number {
  void attachmentCount;
  void isTapped;
  return 16;
}


/**
 * Compute the z-index for a given layer within a creature's outer div.
 *
 * Layer stack (bottom to top):
 * - equipment: 0, 1, 2, ..., N-1 (each equipment card at its index)
 * - creature: N (always above all equipment)
 * - overlay: N+1 (banners, badges, stats — always above creature art)
 * - drag: N+2 (active drag state — highest)
 *
 * @param layer - Which layer to compute z-index for
 * @param attachmentCount - Total number of attachments (N)
 * @param equipmentIndex - Position index for equipment layer (0-based)
 * @returns The z-index value
 */
export function computeZIndex(
  layer: 'equipment' | 'creature' | 'overlay' | 'drag',
  attachmentCount: number,
  equipmentIndex?: number
): number {
  switch (layer) {
    case 'equipment': return equipmentIndex ?? 0;
    case 'creature': return attachmentCount;
    case 'overlay': return attachmentCount + 1;
    case 'drag': return attachmentCount + 2;
  }
}


/**
 * Compute the worst-case horizontal footprint for a creature in vh.
 * Used for row-split decisions — takes max(width, height) so the split
 * is stable regardless of tap state.
 *
 * @param isTapped - Current tap state (used to compute width)
 * @param attachmentCount - Number of attachments
 * @returns The larger of width or height (always 16vh minimum)
 */
export function worstCaseFootprintVh(isTapped: boolean, attachmentCount: number): number {
  const width = computeOuterDivWidthVh(isTapped, attachmentCount);
  const height = 16;
  return Math.max(width, height);
}


/**
 * Compute the per-card negative margin needed to fit all cards in the container.
 * Returns 0 if no compression is needed.
 *
 * Formula: max(0, (totalWidth + gaps - containerWidth) / (cardCount - 1))
 *
 * @param elements - Array of RowCards in the row
 * @param containerWidthPx - Available container width in pixels
 * @param vhToPx - Conversion factor (window.innerHeight / 100)
 * @param gapPx - Gap between cards in pixels (4 for gap-1)
 * @returns Per-card negative margin in pixels, or 0 if no compression needed
 */
export function computeCompression(
  elements: RowCard[],
  containerWidthPx: number,
  vhToPx: number,
  gapPx: number
): number {
  if (elements.length <= 1) return 0;

  const totalWidthPx = elements.reduce((sum, el) => {
    const widthVh = computeSortableWrapperWidthVh(el.isTapped, el.attachments.length);
    return sum + widthVh * vhToPx;
  }, 0);

  // Count same-name adjacent pairs — these use fixed 9vh aggressive overlap at render
  let aggressivePairs = 0;
  for (let i = 1; i < elements.length; i++) {
    if (elements[i].card.name === elements[i - 1].card.name) aggressivePairs++;
  }
  const aggressiveSavingsPx = aggressivePairs * 9 * vhToPx;

  const totalGapsPx = (elements.length - 1) * gapPx;
  const totalNeeded = totalWidthPx + totalGapsPx - aggressiveSavingsPx;

  if (totalNeeded <= containerWidthPx) return 0;

  // Distribute overflow only across non-aggressive gaps
  const compressibleGaps = elements.length - 1 - aggressivePairs;
  if (compressibleGaps <= 0) return 0;
  return (totalNeeded - containerWidthPx) / compressibleGaps;
}


/**
 * Determine if permanents should be split into two rows based on
 * total worst-case footprint exceeding container width.
 *
 * Uses max(width, height) per creature so the decision is stable
 * regardless of current tap state.
 *
 * @param permanents - Array of RowCards in the creature area
 * @param containerWidthPx - Available container width in pixels
 * @param vhToPx - Conversion factor (window.innerHeight / 100)
 * @param gapPx - Gap between cards in pixels (4 for gap-1)
 * @returns true if the row should split into two
 */
export function shouldSplitRows(
  permanents: RowCard[],
  containerWidthPx: number,
  vhToPx: number,
  gapPx: number
): boolean {
  if (permanents.length <= 1) return false;

  const totalFootprintPx = permanents.reduce(
    (sum, el) => sum + worstCaseFootprintVh(el.isTapped, el.attachments.length) * vhToPx,
    0
  ) + (permanents.length - 1) * gapPx;

  return totalFootprintPx > containerWidthPx;
}
