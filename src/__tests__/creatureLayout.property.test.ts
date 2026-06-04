import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeOuterDivWidthVh, computeSortableWrapperWidthVh } from '../creatureLayout';

// Feature: creature-tap-equip, Property 1: Outer Div Width Calculation

describe('Property 1: Outer Div Width Calculation', () => {
  it('untapped width equals 11.43 + attachmentCount * 2', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10 }),
        (attachmentCount) => {
          const width = computeOuterDivWidthVh(false, attachmentCount);
          expect(width).toBeCloseTo(11.43 + attachmentCount * 2, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tapped width is same as untapped (rotation handled by CSS transform)', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10 }),
        (attachmentCount) => {
          const tappedWidth = computeOuterDivWidthVh(true, attachmentCount);
          const untappedWidth = computeOuterDivWidthVh(false, attachmentCount);
          expect(tappedWidth).toBe(untappedWidth);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('untapped with zero attachments equals base card width 11.43', () => {
    expect(computeOuterDivWidthVh(false, 0)).toBeCloseTo(11.43, 10);
  });

  it('width is never negative', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.nat({ max: 20 }),
        (isTapped, attachmentCount) => {
          expect(computeOuterDivWidthVh(isTapped, attachmentCount)).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});


import { computeZIndex } from '../creatureLayout';

// Feature: creature-tap-equip, Property 3: Z-Index Layer Stack Formula

describe('Property 3: Z-Index Layer Stack Formula', () => {
  it('equipment z-index equals its position index', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10 }),
        fc.nat({ max: 9 }),
        (attachmentCount, equipmentIndex) => {
          const idx = Math.min(equipmentIndex, Math.max(0, attachmentCount - 1));
          expect(computeZIndex('equipment', attachmentCount, idx)).toBe(idx);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('creature z-index equals attachment count N', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10 }),
        (attachmentCount) => {
          expect(computeZIndex('creature', attachmentCount)).toBe(attachmentCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('overlay z-index equals N + 1', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10 }),
        (attachmentCount) => {
          expect(computeZIndex('overlay', attachmentCount)).toBe(attachmentCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('drag z-index equals N + 2', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10 }),
        (attachmentCount) => {
          expect(computeZIndex('drag', attachmentCount)).toBe(attachmentCount + 2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('layer ordering is always equipment < creature < overlay < drag', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10 }),
        (attachmentCount) => {
          const maxEquip = attachmentCount > 0 ? computeZIndex('equipment', attachmentCount, attachmentCount - 1) : -1;
          const creature = computeZIndex('creature', attachmentCount);
          const overlay = computeZIndex('overlay', attachmentCount);
          const drag = computeZIndex('drag', attachmentCount);
          expect(maxEquip).toBeLessThan(creature);
          expect(creature).toBeLessThan(overlay);
          expect(overlay).toBeLessThan(drag);
        }
      ),
      { numRuns: 100 }
    );
  });
});


import { worstCaseFootprintVh } from '../creatureLayout';

// Feature: creature-tap-equip, Property 6: Worst-Case Footprint Calculation

describe('Property 6: Worst-Case Footprint Calculation', () => {
  it('result is always max(width, 16)', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.nat({ max: 10 }),
        (isTapped, attachmentCount) => {
          const width = computeOuterDivWidthVh(isTapped, attachmentCount);
          const footprint = worstCaseFootprintVh(isTapped, attachmentCount);
          expect(footprint).toBe(Math.max(width, 16));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('footprint is never less than 16vh', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.nat({ max: 20 }),
        (isTapped, attachmentCount) => {
          expect(worstCaseFootprintVh(isTapped, attachmentCount)).toBeGreaterThanOrEqual(16);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('with 3+ attachments untapped, footprint exceeds 16', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        (attachmentCount) => {
          expect(worstCaseFootprintVh(false, attachmentCount)).toBeGreaterThan(16);
        }
      ),
      { numRuns: 50 }
    );
  });
});


import { computeCompression } from '../creatureLayout';
import { createRowCard } from '../gameActions';
import type { CardData, Attachment, RowCard, RowTarget } from '../types';

// Feature: creature-tap-equip, Property 4: Compression Formula

function makeCardData(id: string): CardData {
  return {
    id,
    name: `Card ${id}`,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
    imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
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

function makeAttachment(id: string): Attachment {
  return {
    card: makeCardData(id),
    instanceId: id,
    isTapped: false,
  };
}

function makeRowCardWithState(
  id: string,
  isTapped: boolean,
  attachmentCount: number
): RowCard {
  const card = makeCardData(id);
  const rc = createRowCard(card, 'creature-1' as RowTarget, 0);
  rc.isTapped = isTapped;
  rc.attachments = Array.from({ length: attachmentCount }, (_, i) =>
    makeAttachment(`${id}-equip-${i}`)
  );
  return rc;
}

describe('Property 4: Compression Formula', () => {
  const vhToPx = 10.8; // simulate 1080p (1080 / 100)
  const gapPx = 4;

  it('returns 0 when total width fits within container', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (cardCount) => {
          const elements = Array.from({ length: cardCount }, (_, i) =>
            makeRowCardWithState(`card-${i}`, false, 0)
          );
          // Container wide enough to fit all cards
          const containerWidth = cardCount * 11.43 * vhToPx + (cardCount - 1) * gapPx + 100;
          expect(computeCompression(elements, containerWidth, vhToPx, gapPx)).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('returns positive value when total width exceeds container', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (cardCount) => {
          const elements = Array.from({ length: cardCount }, (_, i) =>
            makeRowCardWithState(`card-${i}`, false, 0)
          );
          // Container too narrow
          const containerWidth = (cardCount - 1) * 11.43 * vhToPx;
          const result = computeCompression(elements, containerWidth, vhToPx, gapPx);
          expect(result).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('result is never negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.boolean(),
        fc.nat({ max: 3 }),
        fc.double({ min: 100, max: 2000, noNaN: true }),
        (cardCount, isTapped, attachments, containerWidth) => {
          const elements = Array.from({ length: cardCount }, (_, i) =>
            makeRowCardWithState(`card-${i}`, isTapped, attachments)
          );
          expect(computeCompression(elements, containerWidth, vhToPx, gapPx)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns 0 for single card regardless of container width', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 2000, noNaN: true }),
        (containerWidth) => {
          const elements = [makeRowCardWithState('solo', false, 0)];
          expect(computeCompression(elements, containerWidth, vhToPx, gapPx)).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('compression formula equals (totalNeeded - containerWidth) / (cardCount - 1)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.boolean(),
        fc.nat({ max: 3 }),
        (cardCount, isTapped, attachments) => {
          const elements = Array.from({ length: cardCount }, (_, i) =>
            makeRowCardWithState(`card-${i}`, isTapped, attachments)
          );
          // Use a container that's definitely too small
          const containerWidth = 50;
          const result = computeCompression(elements, containerWidth, vhToPx, gapPx);

          // Manually compute expected
          const totalWidthPx = elements.reduce((sum, el) => {
            const w = computeSortableWrapperWidthVh(el.isTapped, el.attachments.length);
            return sum + w * vhToPx;
          }, 0);
          const totalGaps = (cardCount - 1) * gapPx;
          const expected = (totalWidthPx + totalGaps - containerWidth) / (cardCount - 1);

          expect(result).toBeCloseTo(expected, 5);
        }
      ),
      { numRuns: 100 }
    );
  });
});


import { shouldSplitRows, worstCaseFootprintVh } from '../creatureLayout';

// Feature: creature-tap-equip, Property 7: Row Split Decision

describe('Property 7: Row Split Decision', () => {
  const vhToPx = 10.8;
  const gapPx = 4;

  it('splits when sum of worst-case footprints + gaps exceeds container width', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        fc.nat({ max: 3 }),
        (cardCount, attachments) => {
          const elements = Array.from({ length: cardCount }, (_, i) =>
            makeRowCardWithState(`card-${i}`, false, attachments)
          );
          const totalFootprintPx = elements.reduce(
            (sum, el) => sum + worstCaseFootprintVh(el.isTapped, el.attachments.length) * vhToPx, 0
          ) + (cardCount - 1) * gapPx;

          // Container smaller than total → should split
          const containerTooSmall = totalFootprintPx - 1;
          expect(shouldSplitRows(elements, containerTooSmall, vhToPx, gapPx)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not split when sum of worst-case footprints + gaps fits within container', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        fc.nat({ max: 3 }),
        (cardCount, attachments) => {
          const elements = Array.from({ length: cardCount }, (_, i) =>
            makeRowCardWithState(`card-${i}`, false, attachments)
          );
          const totalFootprintPx = elements.reduce(
            (sum, el) => sum + worstCaseFootprintVh(el.isTapped, el.attachments.length) * vhToPx, 0
          ) + (cardCount - 1) * gapPx;

          // Container larger than total → should not split
          const containerLargeEnough = totalFootprintPx + 1;
          expect(shouldSplitRows(elements, containerLargeEnough, vhToPx, gapPx)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('never splits a single card', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 2000, noNaN: true }),
        (containerWidthPx) => {
          const elements = [makeRowCardWithState('solo', false, 5)];
          expect(shouldSplitRows(elements, containerWidthPx, vhToPx, gapPx)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});


import { recalculateCreatureRows } from '../creatureRows';
import type { CreatureArea } from '../types';

// Feature: creature-tap-equip, Property 8: Even Distribution on Split

describe('Property 8: Even Distribution on Split', () => {
  const NARROW = 2000; // Force splits by using narrow container
  const vhToPx = 10.8;
  const gapPx = 4;

  /**
   * When recalculateCreatureRows splits into 2 rows, the first row should get
   * ceil(N/2) elements and the second row should get floor(N/2) elements.
   */
  it('first row gets ceil(N/2), second row gets floor(N/2) on fresh split', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 30 }),
        (cardCount) => {
          // Generate N creature cards with unique names
          const elements: import('../types').RowCard[] = Array.from({ length: cardCount }, (_, i) => {
            const card: import('../types').CardData = {
              id: `split-${i}`,
              name: `Creature_${i}`,
              setCode: 'tst',
              collectorNumber: '1',
              imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
              imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
              backFaceImageURI: null,
              backFaceCardType: null,
              backFaceName: null,
              backFacePower: null,
              backFaceToughness: null,
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
            return {
              card,
              instanceId: card.id,
              rowAssignment: 'creature-1' as import('../types').RowTarget,
              positionIndex: i,
              isTapped: false,
              isFaceDown: false,
              showingBackFace: false,
              isPhased: false,
              attachments: [],
              counters: [],
              isRevealed: false,
            };
          });

          const area: CreatureArea = {
            rows: [{ id: 'creature-1', elements }],
            totalElementCount: cardCount,
          };

          const result = recalculateCreatureRows(area, NARROW, vhToPx, gapPx);

          // Only check distribution if the function actually split into 2 rows
          if (result.rows.length === 2) {
            const row1Count = result.rows[0].elements.length;
            const row2Count = result.rows[1].elements.length;
            expect(row1Count).toBe(Math.ceil(cardCount / 2));
            expect(row2Count).toBe(Math.floor(cardCount / 2));
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('total element count is preserved across both rows after split', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 30 }),
        (cardCount) => {
          const elements: import('../types').RowCard[] = Array.from({ length: cardCount }, (_, i) => {
            const card: import('../types').CardData = {
              id: `preserve-${i}`,
              name: `Creature_${i}`,
              setCode: 'tst',
              collectorNumber: '1',
              imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
              imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
              backFaceImageURI: null,
              backFaceCardType: null,
              backFaceName: null,
              backFacePower: null,
              backFaceToughness: null,
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
            return {
              card,
              instanceId: card.id,
              rowAssignment: 'creature-1' as import('../types').RowTarget,
              positionIndex: i,
              isTapped: false,
              isFaceDown: false,
              showingBackFace: false,
              isPhased: false,
              attachments: [],
              counters: [],
              isRevealed: false,
            };
          });

          const area: CreatureArea = {
            rows: [{ id: 'creature-1', elements }],
            totalElementCount: cardCount,
          };

          const result = recalculateCreatureRows(area, NARROW, vhToPx, gapPx);

          if (result.rows.length === 2) {
            const totalAfterSplit = result.rows[0].elements.length + result.rows[1].elements.length;
            expect(totalAfterSplit).toBe(cardCount);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('first row always has >= second row element count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 30 }),
        (cardCount) => {
          const elements: import('../types').RowCard[] = Array.from({ length: cardCount }, (_, i) => {
            const card: import('../types').CardData = {
              id: `balance-${i}`,
              name: `Creature_${i}`,
              setCode: 'tst',
              collectorNumber: '1',
              imageURI: 'https://cards.scryfall.io/normal/front/test.jpg',
              imageURILarge: 'https://cards.scryfall.io/large/front/test.jpg',
              backFaceImageURI: null,
              backFaceCardType: null,
              backFaceName: null,
              backFacePower: null,
              backFaceToughness: null,
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
            return {
              card,
              instanceId: card.id,
              rowAssignment: 'creature-1' as import('../types').RowTarget,
              positionIndex: i,
              isTapped: false,
              isFaceDown: false,
              showingBackFace: false,
              isPhased: false,
              attachments: [],
              counters: [],
              isRevealed: false,
            };
          });

          const area: CreatureArea = {
            rows: [{ id: 'creature-1', elements }],
            totalElementCount: cardCount,
          };

          const result = recalculateCreatureRows(area, NARROW, vhToPx, gapPx);

          if (result.rows.length === 2) {
            const row1Count = result.rows[0].elements.length;
            const row2Count = result.rows[1].elements.length;
            expect(row1Count).toBeGreaterThanOrEqual(row2Count);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
