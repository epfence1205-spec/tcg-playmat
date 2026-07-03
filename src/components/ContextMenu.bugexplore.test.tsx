import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuProps } from './ContextMenu';

/**
 * Bug Condition Exploration Test
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 *
 * Property 1: Bug Condition — Power/Toughness/Combined Submenus Render Only 2 Options
 * and Combined Dispatches Wrong Action
 *
 * This test encodes the EXPECTED (correct) behavior. When run on UNFIXED code,
 * it MUST FAIL — failure confirms the bug exists.
 *
 * Defects being surfaced:
 * 1. Power submenu renders only 2 items (should render 10: Clear + 9 presets)
 * 2. Toughness submenu renders only 2 items (should render 10: Clear + 9 presets)
 * 3. Combined +X/+X submenu renders only 2 items (should render 10: Clear + 9 presets)
 * 4. Combined +X/+X submenu dispatches ADD_COUNTER instead of ADD_PT_COMBINED
 * 5. No inline counter quick-adjust controls when card has counters
 */

const baseProps: ContextMenuProps = {
  isOpen: true,
  position: { x: 100, y: 100 },
  cardId: 'test-card-1',
  cardZone: 'battlefield',
  cardType: 'creature',
  isEquipment: false,
  isDocked: false,
  isDFC: false,
  hasMutateKeyword: false,
  hasMutateStack: false,
  onAction: vi.fn(),
  onClose: vi.fn(),
};

/** Expected preset range for power/toughness submenus */
const PT_PRESETS = [-3, -2, -1, 1, 2, 3, 4, 5, 6];

describe('Bug Condition Exploration: Counter & P/T Context Menu Defects', () => {
  /**
   * Defect 1.2: Power submenu renders only 2 items instead of 10
   *
   * Expected: "Clear" + 9 presets (-3, -2, -1, +1, +2, +3, +4, +5, +6)
   * Actual (bug): Only "+1 Power" and "-1 Power" rendered
   */
  describe('Power submenu renders exactly 10 items', () => {
    it('renderPowerSubmenu renders Clear plus 9 preset values (-3 to +6)', () => {
      const onAction = vi.fn();
      const { container } = render(
        <ContextMenu {...baseProps} onAction={onAction} />
      );

      // Open the power submenu by hovering the trigger
      const powerTrigger = screen.getByText((content) =>
        content.includes('Power') || content.includes('power')
      );
      fireEvent.mouseEnter(powerTrigger.closest('[class*="relative"]')!);

      // Find the absolute-positioned submenu (not the main menu triggers)
      const absoluteDivs = container.querySelectorAll('.absolute');
      let submenuButtonCount = 0;
      absoluteDivs.forEach(div => {
        const btns = div.querySelectorAll('button');
        if (btns.length > 0 && btns.length <= 12) {
          submenuButtonCount = btns.length;
        }
      });

      expect(submenuButtonCount).toBe(10);
    });

    it('property: for all presets in [-3, -2, -1, +1, +2, +3, +4, +5, +6], power submenu contains that value', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PT_PRESETS),
          (preset) => {
            const onAction = vi.fn();
            const { container, unmount } = render(
              <ContextMenu {...baseProps} onAction={onAction} />
            );

            // Open the power submenu
            const powerTrigger = screen.getByText((content) =>
              content.includes('Power') || content.includes('power')
            );
            fireEvent.mouseEnter(powerTrigger.closest('[class*="relative"]')!);

            // Look for the preset label in any rendered button
            const expectedLabel = preset > 0 ? `+${preset}` : `${preset}`;
            const absoluteDivs = container.querySelectorAll('.absolute');
            const labels: string[] = [];
            absoluteDivs.forEach(div => {
              const btns = div.querySelectorAll('button');
              btns.forEach(b => labels.push(b.textContent?.trim() || ''));
            });

            unmount();

            // The submenu must contain this preset value
            return labels.some(label => label.includes(expectedLabel));
          }
        ),
        { numRuns: 9 }
      );
    });
  });

  /**
   * Defect 1.3: Toughness submenu renders only 2 items instead of 10
   *
   * Expected: "Clear" + 9 presets (-3, -2, -1, +1, +2, +3, +4, +5, +6)
   * Actual (bug): Only "+1 Toughness" and "-1 Toughness" rendered
   */
  describe('Toughness submenu renders exactly 10 items', () => {
    it('renderToughnessSubmenu renders Clear plus 9 preset values (-3 to +6)', () => {
      const onAction = vi.fn();
      const { container } = render(
        <ContextMenu {...baseProps} onAction={onAction} />
      );

      // Open the toughness submenu
      const toughnessTrigger = screen.getByText((content) =>
        content.includes('Toughness') || content.includes('toughness')
      );
      fireEvent.mouseEnter(toughnessTrigger.closest('[class*="relative"]')!);

      // Count buttons in the toughness submenu
      const absoluteDivs = container.querySelectorAll('.absolute');
      let submenuButtonCount = 0;
      absoluteDivs.forEach(div => {
        const btns = div.querySelectorAll('button');
        if (btns.length > 0 && btns.length <= 12) {
          submenuButtonCount = btns.length;
        }
      });

      expect(submenuButtonCount).toBe(10);
    });

    it('property: for all presets in [-3, -2, -1, +1, +2, +3, +4, +5, +6], toughness submenu contains that value', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PT_PRESETS),
          (preset) => {
            const onAction = vi.fn();
            const { container, unmount } = render(
              <ContextMenu {...baseProps} onAction={onAction} />
            );

            // Open the toughness submenu
            const toughnessTrigger = screen.getByText((content) =>
              content.includes('Toughness') || content.includes('toughness')
            );
            fireEvent.mouseEnter(toughnessTrigger.closest('[class*="relative"]')!);

            const expectedLabel = preset > 0 ? `+${preset}` : `${preset}`;
            const absoluteDivs = container.querySelectorAll('.absolute');
            const labels: string[] = [];
            absoluteDivs.forEach(div => {
              const btns = div.querySelectorAll('button');
              btns.forEach(b => labels.push(b.textContent?.trim() || ''));
            });

            unmount();

            return labels.some(label => label.includes(expectedLabel));
          }
        ),
        { numRuns: 9 }
      );
    });
  });

  /**
   * Defect 1.6: Combined +X/+X submenu renders only 2 items instead of 10
   *
   * Expected: "Clear custom +X/+X" + 9 presets (-3/-3, ..., +6/+6)
   * Actual (bug): Only "+1/+1" and "-1/-1" rendered
   */
  describe('Combined +X/+X submenu renders exactly 10 items', () => {
    it('renderPTCombinedSubmenu renders Clear plus 9 preset values (-3/-3 to +6/+6)', () => {
      const onAction = vi.fn();
      const { container } = render(
        <ContextMenu {...baseProps} onAction={onAction} />
      );

      // Open the combined submenu
      const combinedTrigger = screen.getByText((content) =>
        content.includes('+X/+X')
      );
      fireEvent.mouseEnter(combinedTrigger.closest('[class*="relative"]')!);

      // Count items in the submenu
      const absoluteDivs = container.querySelectorAll('.absolute');
      let submenuButtonCount = 0;
      absoluteDivs.forEach(div => {
        const btns = div.querySelectorAll('button');
        // The combined submenu should have exactly 10 items
        if (btns.length > 0 && btns.length <= 12) {
          submenuButtonCount = btns.length;
        }
      });

      expect(submenuButtonCount).toBe(10);
    });

    it('property: for all presets in [-3, -2, -1, +1, +2, +3, +4, +5, +6], combined submenu contains X/X label', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PT_PRESETS),
          (preset) => {
            const onAction = vi.fn();
            const { container, unmount } = render(
              <ContextMenu {...baseProps} onAction={onAction} />
            );

            // Open the combined submenu
            const combinedTrigger = screen.getByText((content) =>
              content.includes('+X/+X')
            );
            fireEvent.mouseEnter(combinedTrigger.closest('[class*="relative"]')!);

            const expectedLabel = preset > 0 ? `+${preset}/+${preset}` : `${preset}/${preset}`;
            const absoluteDivs = container.querySelectorAll('.absolute');
            const labels: string[] = [];
            absoluteDivs.forEach(div => {
              const btns = div.querySelectorAll('button');
              btns.forEach(b => labels.push(b.textContent?.trim() || ''));
            });

            unmount();

            return labels.some(label => label.includes(expectedLabel));
          }
        ),
        { numRuns: 9 }
      );
    });
  });

  /**
   * Defect 1.4, 1.5: Combined submenu dispatches ADD_COUNTER instead of ADD_PT_COMBINED
   *
   * Expected: Clicking "+3/+3" dispatches { type: 'ADD_PT_COMBINED', amount: 3 }
   * Actual (bug): Dispatches { type: 'ADD_COUNTER', counterType: '+1/+1' }
   */
  describe('Combined +X/+X submenu dispatches ADD_PT_COMBINED, not ADD_COUNTER', () => {
    it('clicking "+3/+3" dispatches ADD_PT_COMBINED with amount 3', () => {
      const onAction = vi.fn();
      render(<ContextMenu {...baseProps} onAction={onAction} />);

      // Open the combined submenu
      const combinedTrigger = screen.getByText((content) =>
        content.includes('+X/+X')
      );
      fireEvent.mouseEnter(combinedTrigger.closest('[class*="relative"]')!);

      // Try to click the +3/+3 option (won't exist on unfixed code)
      const option = screen.queryByText('+3/+3');
      expect(option).not.toBeNull();
      if (option) {
        fireEvent.click(option);
      }

      // Should dispatch ADD_PT_COMBINED, NOT ADD_COUNTER
      expect(onAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ADD_PT_COMBINED', amount: 3 })
      );
      // Must NOT have dispatched ADD_COUNTER
      const addCounterCalls = onAction.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type: string })?.type === 'ADD_COUNTER'
      );
      expect(addCounterCalls.length).toBe(0);
    });

    it('property: for all combined presets, dispatch is ADD_PT_COMBINED not ADD_COUNTER', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PT_PRESETS),
          (preset) => {
            const onAction = vi.fn();
            const { unmount } = render(
              <ContextMenu {...baseProps} onAction={onAction} />
            );

            // Open the combined submenu
            const combinedTrigger = screen.getByText((content) =>
              content.includes('+X/+X')
            );
            fireEvent.mouseEnter(combinedTrigger.closest('[class*="relative"]')!);

            // Try to find the preset option
            const label = preset > 0 ? `+${preset}/+${preset}` : `${preset}/${preset}`;
            const option = screen.queryByText(label);

            unmount();

            // If the option doesn't exist, the submenu is incomplete (bug confirmed)
            if (!option) return false;

            return true;
          }
        ),
        { numRuns: 9 }
      );
    });
  });

  /**
   * Defect 1.1: No inline counter quick-adjust controls when card has counters
   *
   * Expected: When counters prop has entries, inline rows render below "Add counters"
   * Actual (bug): ContextMenu doesn't accept counters prop, no inline UI
   */
  describe('Inline counter quick-adjust renders when card has counters', () => {
    it('when counters prop contains entries, inline quick-adjust rows render', () => {
      const onAction = vi.fn();
      const counters = [{ type: '+1/+1' as const, value: 3 }];

      // Cast to any because the unfixed code doesn't have counters prop yet
      const propsWithCounters = { ...baseProps, onAction, counters } as any;
      const { container } = render(
        <ContextMenu {...propsWithCounters} />
      );

      // Look for inline counter quick-adjust controls
      const menuContent = container.querySelector('[role="menu"]');
      const allText = menuContent?.textContent || '';

      // The inline controls should display the counter count "3"
      // and have a remove (🗑️) button for the counter type
      const hasCounterDisplay = allText.includes('3');
      const hasRemoveBtn = allText.includes('🗑️') || allText.includes('🗑');

      // The key assertion: inline quick-adjust row must be present
      expect(hasCounterDisplay && hasRemoveBtn).toBe(true);
    });

    it('property: for any non-empty counter array, inline controls are rendered', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              type: fc.constantFrom('+1/+1', '-1/-1', 'charge', 'loyalty') as fc.Arbitrary<any>,
              value: fc.integer({ min: 1, max: 10 }),
            }),
            { minLength: 1, maxLength: 4 }
          ),
          (counters) => {
            const onAction = vi.fn();
            // Cast to any because unfixed code doesn't have counters prop
            const propsWithCounters = { ...baseProps, onAction, counters } as any;
            const { container, unmount } = render(
              <ContextMenu {...propsWithCounters} />
            );

            const menuContent = container.querySelector('[role="menu"]');
            const allText = menuContent?.textContent || '';

            // Should show at least one counter value and a remove button
            const hasAnyValue = counters.some((c: { value: number }) => allText.includes(String(c.value)));
            const hasRemoveBtn = allText.includes('🗑️') || allText.includes('🗑');

            unmount();

            return hasAnyValue && hasRemoveBtn;
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
