/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuProps } from './ContextMenu';

/**
 * Preservation Property Tests
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**
 *
 * Property 2: Preservation — Counter Grid, Move To, Card Actions, and
 * Non-Battlefield Menus Unchanged
 *
 * These tests encode CURRENT correct behavior that must NOT change after the bugfix.
 * All tests MUST PASS on the unfixed code.
 */

const ALL_COUNTER_TYPES = [
  '+1/+1', '-1/-1', 'lifelink', 'hexproof', 'indestructible', 'shroud',
  'time', 'charge', 'generic', 'loyalty', 'flying', 'deathtouch',
  'menace', 'trample', 'first_strike', 'double_strike', 'reach',
  'vigilance', 'token', 'lore', 'shield', 'haste', 'custom',
] as const;

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

describe('Preservation: Counter List Add Unchanged (Req 3.1, 3.3)', () => {
  /**
   * Property-based test: for all counter types in ALL_COUNTER_TYPES,
   * clicking in "Add counters" list dispatches ADD_COUNTER with that type.
   */
  it('property: clicking any counter type in "Add counters" list dispatches ADD_COUNTER with that type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_COUNTER_TYPES),
        (counterType) => {
          const onAction = vi.fn();
          const { unmount } = render(
            <ContextMenu {...baseProps} onAction={onAction} />
          );

          // Open the "Add counters" submenu
          const trigger = screen.getByText('Add counters');
          fireEvent.mouseEnter(trigger.closest('.relative')!);

          // Click the counter type button by text content
          const buttons = screen.getAllByText(counterType);
          // The submenu item is the one inside the absolute-positioned submenu
          const submenuButton = buttons.find(
            (btn) => btn.closest('.absolute')
          ) || buttons[0];
          fireEvent.click(submenuButton);

          const dispatched = onAction.mock.calls[0]?.[0];
          unmount();

          return (
            dispatched?.type === 'ADD_COUNTER' &&
            dispatched?.counterType === counterType
          );
        }
      ),
      { numRuns: 23 }
    );
  });

  /**
   * Property-based test: inline counter quick-adjust "−" button dispatches
   * REMOVE_COUNTER for the correct counter type.
   */
  it('property: clicking "−" on inline counter quick-adjust dispatches REMOVE_COUNTER', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('+1/+1', '-1/-1', 'charge', 'loyalty', 'flying') as fc.Arbitrary<typeof ALL_COUNTER_TYPES[number]>,
        (counterType) => {
          const onAction = vi.fn();
          const counters = [{ type: counterType, value: 2 }];
          const { unmount } = render(
            <ContextMenu {...baseProps} onAction={onAction} counters={counters} />
          );

          // Find the inline row for this counter type and click "−"
          const decrementButtons = screen.getAllByText('−');
          fireEvent.click(decrementButtons[0]);

          const dispatched = onAction.mock.calls[0]?.[0];
          unmount();

          return (
            dispatched?.type === 'REMOVE_COUNTER' &&
            dispatched?.counterType === counterType
          );
        }
      ),
      { numRuns: 5 }
    );
  });
});

describe('Preservation: Non-Battlefield Menus Have No Counter/PT Sections (Req 3.5)', () => {
  const nonBattlefieldZones = ['hand', 'graveyard', 'exile', 'commandZone'] as const;

  nonBattlefieldZones.forEach((zone) => {
    it(`context menu for "${zone}" zone does NOT render counter/PT sections`, () => {
      render(<ContextMenu {...baseProps} cardZone={zone} />);

      // These labels only appear in the battlefield menu
      expect(screen.queryByText('Add counters')).not.toBeInTheDocument();
      expect(screen.queryByText('Add / subtract power')).not.toBeInTheDocument();
      expect(screen.queryByText('Add / subtract toughness')).not.toBeInTheDocument();
      expect(screen.queryByText('Add / subtract +X/+X')).not.toBeInTheDocument();
    });
  });
});

describe('Preservation: "Move to" Destinations for Battlefield Cards (Req 3.6)', () => {
  it('"Move to" submenu for battlefield renders exactly: Hand, Graveyard, Exile, Command Zone, Top of Library, Bottom of Library, Shuffle into Library', () => {
    const onAction = vi.fn();
    render(<ContextMenu {...baseProps} onAction={onAction} />);

    // Open the "Move to" submenu
    const trigger = screen.getByText('Move to');
    fireEvent.mouseEnter(trigger.closest('.relative')!);

    // Verify all expected destinations are present
    expect(screen.getByText('Hand')).toBeInTheDocument();
    expect(screen.getByText('Graveyard')).toBeInTheDocument();
    expect(screen.getByText('Exile')).toBeInTheDocument();
    expect(screen.getByText('Command Zone')).toBeInTheDocument();
    expect(screen.getByText('Top of Library')).toBeInTheDocument();
    expect(screen.getByText('Bottom of Library')).toBeInTheDocument();
    expect(screen.getByText('Shuffle into Library')).toBeInTheDocument();
  });

  it('clicking each "Move to" destination dispatches the correct MOVE_TO action', () => {
    const expectedDestinations = [
      { label: 'Hand', destination: 'hand' },
      { label: 'Graveyard', destination: 'graveyard' },
      { label: 'Exile', destination: 'exile' },
      { label: 'Command Zone', destination: 'commandZone' },
      { label: 'Top of Library', destination: 'top-library' },
      { label: 'Bottom of Library', destination: 'bottom-library' },
      { label: 'Shuffle into Library', destination: 'shuffle-library' },
    ] as const;

    for (const { label, destination } of expectedDestinations) {
      const onAction = vi.fn();
      const { unmount } = render(
        <ContextMenu {...baseProps} onAction={onAction} />
      );

      const trigger = screen.getByText('Move to');
      fireEvent.mouseEnter(trigger.closest('.relative')!);
      fireEvent.click(screen.getByText(label));

      expect(onAction).toHaveBeenCalledWith({ type: 'MOVE_TO', destination });
      unmount();
    }
  });
});

describe('Preservation: "Card actions" Items Match Current Behavior (Req 3.6)', () => {
  it('"Card actions" submenu renders exactly: Flip / Transform, Morph face-down, Phase out, Flip 180°', () => {
    render(<ContextMenu {...baseProps} />);

    // Open the "Card actions" submenu
    const trigger = screen.getByText('Card actions');
    fireEvent.mouseEnter(trigger.closest('.relative')!);

    expect(screen.getByText('Flip / Transform')).toBeInTheDocument();
    expect(screen.getByText('Morph face-down')).toBeInTheDocument();
    expect(screen.getByText('Phase out')).toBeInTheDocument();
    expect(screen.getByText('Flip 180°')).toBeInTheDocument();
  });

  it('clicking each card action dispatches the correct action type', () => {
    const expectedActions = [
      { label: 'Flip / Transform', type: 'TRANSFORM' },
      { label: 'Morph face-down', type: 'MORPH' },
      { label: 'Phase out', type: 'PHASE' },
      { label: 'Flip 180°', type: 'FLIP' },
    ] as const;

    for (const { label, type } of expectedActions) {
      const onAction = vi.fn();
      const { unmount } = render(
        <ContextMenu {...baseProps} onAction={onAction} />
      );

      const trigger = screen.getByText('Card actions');
      fireEvent.mouseEnter(trigger.closest('.relative')!);
      fireEvent.click(screen.getByText(label));

      expect(onAction).toHaveBeenCalledWith({ type });
      unmount();
    }
  });
});
