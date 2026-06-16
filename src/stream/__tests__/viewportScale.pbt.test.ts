import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook } from '@testing-library/react';
import { useViewportScale } from '../useViewportScale';

/**
 * Property 6: Fixed resolution scale factor
 *
 * For any positive viewport dimensions (width, height), the computed scale factor
 * SHALL equal `min(width / 2560, height / 1440)`.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3**
 *
 * Feature: obs-stream-view, Property 6: Fixed resolution scale factor
 */

describe('Property 6: Fixed resolution scale factor', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
  });

  it('scale equals min(width / 2560, height / 1440) for any positive viewport', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8000 }),
        fc.integer({ min: 1, max: 8000 }),
        (width, height) => {
          Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
          Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

          const { result } = renderHook(() => useViewportScale());

          const expected = Math.min(width / 2560, height / 1440);
          expect(result.current).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
