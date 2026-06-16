import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RotationDiv } from './RotationDiv';
import type { RowCard, CardData } from '../types';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
}));

// --- Test Fixtures ---

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: overrides.id ?? 'card-1',
    name: overrides.name ?? 'Grizzly Bears',
    setCode: 'lea',
    collectorNumber: '1',
    imageURI: 'https://example.com/bears.jpg',
    imageURILarge: 'https://example.com/bears-large.jpg',
    backFaceImageURI: null,
    backFaceCardType: null,
    backFaceName: null,
    backFacePower: null,
    backFaceToughness: null,
    typeLine: 'Creature — Bear',
    oracleText: '',
    isCommander: false,
    keywords: [],
    basePower: '2',
    baseToughness: '2',
    cardType: 'creature',
    cmc: 2,
    manaCost: '{1}{G}',
    colorIdentity: ['G'],
    producedMana: [],
    landCategory: null,
    isToken: false,
    isTokenCopy: false,
    ...overrides,
  };
}

function makeRowCard(overrides: Partial<RowCard> = {}): RowCard {
  const card = overrides.card ?? makeCard();
  return {
    card,
    instanceId: card.id,
    rowAssignment: 'creature-1',
    positionIndex: 0,
    isTapped: false,
    isFaceDown: false,
    showingBackFace: false,
    isPhased: false,
    attachments: [],
    counters: [],
    mutateStack: [],
    isRevealed: false,
    ...overrides,
  };
}

// --- Stack Indicator Badge Tests ---
// Validates: Requirements 6.1, 6.3

describe('RotationDiv — Stack Indicator Badge', () => {
  it('renders badge with correct count when mutateStack has entries', () => {
    const topCard = makeCard({ id: 'top-1', name: 'Gemrazer' });
    const stackCards = [
      makeCard({ id: 'under-1', name: 'Pouncing Shoreshark' }),
      makeCard({ id: 'under-2', name: 'Dirge Bat' }),
    ];
    const creature = makeRowCard({
      card: topCard,
      mutateStack: stackCards,
    });

    render(
      <RotationDiv creature={creature} isCompressed={false} onTapCard={vi.fn()} />
    );

    // Badge should show 1 + mutateStack.length = 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders badge showing 2 for a single mutateStack entry', () => {
    const topCard = makeCard({ id: 'top-1', name: 'Gemrazer' });
    const stackCards = [makeCard({ id: 'under-1', name: 'Pouncing Shoreshark' })];
    const creature = makeRowCard({
      card: topCard,
      mutateStack: stackCards,
    });

    render(
      <RotationDiv creature={creature} isCompressed={false} onTapCard={vi.fn()} />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does NOT render badge when mutateStack is empty', () => {
    const creature = makeRowCard({ mutateStack: [] });

    const { container } = render(
      <RotationDiv creature={creature} isCompressed={false} onTapCard={vi.fn()} />
    );

    // No badge element with a number. The badge has bg-indigo-600 class.
    const badge = container.querySelector('.bg-indigo-600\\/90');
    expect(badge).not.toBeInTheDocument();
  });
});

// --- Fan-Out Display Order Tests ---
// Validates: Requirement 7.2

describe('RotationDiv — Mutate Fan-Out Display Order', () => {
  it('fan-out displays cards in [Top_Card, ...mutateStack] order', () => {
    const topCard = makeCard({ id: 'top-1', name: 'Gemrazer' });
    const stackCards = [
      makeCard({ id: 'under-1', name: 'Pouncing Shoreshark' }),
      makeCard({ id: 'under-2', name: 'Dirge Bat' }),
    ];
    const creature = makeRowCard({
      card: topCard,
      mutateStack: stackCards,
      attachments: [], // no equipment so Alt+click triggers mutate fan
    });

    const { container } = render(
      <RotationDiv creature={creature} isCompressed={false} onTapCard={vi.fn()} />
    );

    // Alt+click to open mutate fan-out
    const outerDiv = container.firstElementChild as HTMLElement;
    fireEvent.click(outerDiv, { altKey: true });

    // Fan-out should appear
    const fanGroup = screen.getByRole('group', { name: 'Fanned mutate stack' });
    expect(fanGroup).toBeInTheDocument();

    // Verify order: Top_Card first (leftmost), then mutateStack entries
    const cardNames = fanGroup.querySelectorAll('span');
    const names = Array.from(cardNames).map(s => s.textContent);
    expect(names).toEqual(['Gemrazer', 'Pouncing Shoreshark', 'Dirge Bat']);
  });

  it('Alt+click has no fan-out effect when mutateStack is empty and no attachments', () => {
    const creature = makeRowCard({ mutateStack: [], attachments: [] });
    const onTapCard = vi.fn();

    const { container } = render(
      <RotationDiv creature={creature} isCompressed={false} onTapCard={onTapCard} />
    );

    const outerDiv = container.firstElementChild as HTMLElement;
    fireEvent.click(outerDiv, { altKey: true });

    // No fan-out panel should appear
    expect(screen.queryByRole('group', { name: 'Fanned mutate stack' })).not.toBeInTheDocument();
    // Regular tap fires instead
    expect(onTapCard).toHaveBeenCalledWith(creature.instanceId);
  });

  it('Alt+click again collapses the mutate fan-out', () => {
    const topCard = makeCard({ id: 'top-1', name: 'Gemrazer' });
    const stackCards = [makeCard({ id: 'under-1', name: 'Pouncing Shoreshark' })];
    const creature = makeRowCard({
      card: topCard,
      mutateStack: stackCards,
      attachments: [],
    });

    const { container } = render(
      <RotationDiv creature={creature} isCompressed={false} onTapCard={vi.fn()} />
    );

    const outerDiv = container.firstElementChild as HTMLElement;

    // Open fan-out
    fireEvent.click(outerDiv, { altKey: true });
    expect(screen.getByRole('group', { name: 'Fanned mutate stack' })).toBeInTheDocument();

    // Close fan-out
    fireEvent.click(outerDiv, { altKey: true });
    expect(screen.queryByRole('group', { name: 'Fanned mutate stack' })).not.toBeInTheDocument();
  });
});
