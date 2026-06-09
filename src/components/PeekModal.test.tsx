import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PeekModal } from './PeekModal';
import type { CardData } from '../types';
import type { PeekResult } from '../peekActions';

// Mock dnd-kit for testing (same pattern as SortableCardWrapper.test.tsx)
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  horizontalListSortingStrategy: {},
  useSortable: () => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  arrayMove: (arr: any[], from: number, to: number) => {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
  },
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  closestCenter: () => null,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(id: string, name = `Card ${id}`): CardData {
  return {
    id,
    name,
    setCode: 'tst',
    collectorNumber: '1',
    imageURI: `https://example.com/${id}.jpg`,
    imageURILarge: '',
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
    cmc: 2,
    manaCost: '{1}{U}',
    colorIdentity: ['U'],
    producedMana: [],
    landCategory: null,
    isToken: false,
    isTokenCopy: false,
  };
}

const cards = [makeCard('c1', 'Alpha'), makeCard('c2', 'Beta'), makeCard('c3', 'Gamma')];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PeekModal', () => {
  describe('scry mode', () => {
    it('renders header "Scry N"', () => {
      render(<PeekModal cards={cards} mode="scry" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText('Scry 3')).toBeInTheDocument();
    });

    it('cards default to top group', () => {
      render(<PeekModal cards={cards} mode="scry" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText('📚 Top of Library')).toBeInTheDocument();
    });

    it('click moves card to bottom group', () => {
      render(<PeekModal cards={cards} mode="scry" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      // Click the first card's container (border div)
      const images = screen.getAllByRole('img');
      fireEvent.click(images[0].closest('[class*="border-"]')!);
      // Now bottom group should appear
      expect(screen.getByText('⬇ Bottom of Library')).toBeInTheDocument();
    });

    it('confirm calls onConfirm with correct PeekResult', () => {
      const onConfirm = vi.fn();
      render(<PeekModal cards={cards} mode="scry" isOpen={true} onConfirm={onConfirm} onClose={vi.fn()} />);
      // All cards default to top, click confirm
      fireEvent.click(screen.getByText('Confirm'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      const result: PeekResult = onConfirm.mock.calls[0][0];
      expect(result.mode).toBe('scry');
      expect(result.topCards).toHaveLength(3);
      expect(result.bottomCards).toHaveLength(0);
      expect(result.originalCardIds).toEqual(['c1', 'c2', 'c3']);
    });
  });

  describe('surveil mode', () => {
    it('renders header "Surveil N"', () => {
      render(<PeekModal cards={cards} mode="surveil" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText('Surveil 3')).toBeInTheDocument();
    });

    it('click moves card to graveyard group', () => {
      render(<PeekModal cards={cards} mode="surveil" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      const images = screen.getAllByRole('img');
      fireEvent.click(images[0].closest('[class*="border-"]')!);
      expect(screen.getByText('💀 Graveyard')).toBeInTheDocument();
    });

    it('confirm with graveyard assignment', () => {
      const onConfirm = vi.fn();
      render(<PeekModal cards={[cards[0]]} mode="surveil" isOpen={true} onConfirm={onConfirm} onClose={vi.fn()} />);
      // Toggle to graveyard
      const images = screen.getAllByRole('img');
      fireEvent.click(images[0].closest('[class*="border-"]')!);
      fireEvent.click(screen.getByText('Confirm'));
      const result: PeekResult = onConfirm.mock.calls[0][0];
      expect(result.graveyardCards).toHaveLength(1);
      expect(result.topCards).toHaveLength(0);
    });
  });

  describe('select mode', () => {
    it('renders header "Select N"', () => {
      render(<PeekModal cards={cards} mode="select" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText(/Select 3/)).toBeInTheDocument();
    });

    it('cards default to bottom group', () => {
      render(<PeekModal cards={cards} mode="select" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText('⬇ Bottom of Library')).toBeInTheDocument();
    });

    it('click moves card to hand and shows selected count', () => {
      render(<PeekModal cards={cards} mode="select" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      const images = screen.getAllByRole('img');
      fireEvent.click(images[0].closest('[class*="border-"]')!);
      expect(screen.getByText('(1 selected)')).toBeInTheDocument();
    });

    it('confirm with hand selection', () => {
      const onConfirm = vi.fn();
      render(<PeekModal cards={cards} mode="select" isOpen={true} onConfirm={onConfirm} onClose={vi.fn()} />);
      // Toggle first card to hand
      const images = screen.getAllByRole('img');
      fireEvent.click(images[0].closest('[class*="border-"]')!);
      fireEvent.click(screen.getByText('Confirm'));
      const result: PeekResult = onConfirm.mock.calls[0][0];
      expect(result.handCards).toHaveLength(1);
      expect(result.bottomCards).toHaveLength(2);
    });
  });

  describe('peek mode (read-only)', () => {
    it('renders header "Peek N"', () => {
      render(<PeekModal cards={cards} mode="peek" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText('Peek 3')).toBeInTheDocument();
    });

    it('does not show Confirm button', () => {
      render(<PeekModal cards={cards} mode="peek" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    });

    it('does not show Cancel button', () => {
      render(<PeekModal cards={cards} mode="peek" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('shows position indicators', () => {
      render(<PeekModal cards={cards} mode="peek" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
    });
  });

  describe('cancellation', () => {
    it('Cancel button calls onClose', () => {
      const onClose = vi.fn();
      render(<PeekModal cards={cards} mode="scry" isOpen={true} onConfirm={vi.fn()} onClose={onClose} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('Escape calls onClose', () => {
      const onClose = vi.fn();
      render(<PeekModal cards={cards} mode="scry" isOpen={true} onConfirm={vi.fn()} onClose={onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('Cancel does not call onConfirm', () => {
      const onConfirm = vi.fn();
      render(<PeekModal cards={cards} mode="scry" isOpen={true} onConfirm={onConfirm} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('does not render when isOpen is false', () => {
      render(<PeekModal cards={cards} mode="scry" isOpen={false} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.queryByText('Scry')).not.toBeInTheDocument();
    });

    it('does not render when cards is empty', () => {
      render(<PeekModal cards={[]} mode="scry" isOpen={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.queryByText('Scry')).not.toBeInTheDocument();
    });
  });
});
