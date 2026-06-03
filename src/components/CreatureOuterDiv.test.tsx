import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CreatureOuterDiv } from './CreatureOuterDiv';
import type { RowCard, CardData, Attachment } from '../types';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
}));

// --- Test Fixtures ---

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: overrides.id ?? 'creature-id-1',
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
    isToken: false,
    isTokenCopy: false,
    ...overrides,
  };
}

function makeRowCard(overrides: Partial<RowCard> = {}): RowCard {
  const card = makeCard(overrides.card ? overrides.card as Partial<CardData> : undefined);
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
    isRevealed: false,
    ...overrides,
  };
}

function makeAttachment(overrides: { instanceId?: string; isTapped?: boolean; card?: Partial<CardData> } = {}): Attachment {
  const card = makeCard({
    id: overrides.instanceId ?? 'equip-id-1',
    name: overrides.card?.name ?? 'Bonesplitter',
    cardType: 'artifact',
    typeLine: 'Artifact — Equipment',
    oracleText: overrides.card?.oracleText ?? 'Equipped creature gets +2/+0.',
    basePower: null,
    baseToughness: null,
    ...overrides.card,
  });
  return {
    card,
    instanceId: overrides.instanceId ?? card.id,
    isTapped: overrides.isTapped ?? false,
  };
}

// --- Tests ---

describe('CreatureOuterDiv', () => {
  describe('Rotation transform when tapped', () => {
    it('applies rotate(90deg) transform when creature.isTapped is true', () => {
      const creature = makeRowCard({ isTapped: true });

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.style.transform).toBe('rotate(90deg)');
    });

    it('does not apply rotation when creature is untapped', () => {
      const creature = makeRowCard({ isTapped: false });

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.style.transform).toBe('');
    });
  });

  describe('Width changes with attachment count', () => {
    it('width is 11.43vh with 0 attachments', () => {
      const creature = makeRowCard({ attachments: [] });

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.style.width).toBe('11.43vh');
    });

    it('width is 11.43 + N*2 vh with N attachments', () => {
      const attachments = [
        makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } }),
        makeAttachment({ instanceId: 'equip-2', card: { id: 'equip-2', name: 'Lightning Greaves' } }),
        makeAttachment({ instanceId: 'equip-3', card: { id: 'equip-3', name: 'Sword of Fire and Ice' } }),
      ];
      const creature = makeRowCard({ attachments });
      const N = 3;

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;
      const expectedWidth = `${11.43 + N * 2}vh`;
      expect(outerDiv.style.width).toBe(expectedWidth);
    });

    it('width increases by 2vh for each additional attachment', () => {
      const attachment1 = makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } });
      const creature1 = makeRowCard({ attachments: [attachment1] });

      const attachment2 = makeAttachment({ instanceId: 'equip-2', card: { id: 'equip-2', name: 'Greaves' } });
      const creature2 = makeRowCard({ attachments: [attachment1, attachment2] });

      const { container: c1 } = render(
        <CreatureOuterDiv creature={creature1} isCompressed={false} onTapCard={vi.fn()} />
      );
      const { container: c2 } = render(
        <CreatureOuterDiv creature={creature2} isCompressed={false} onTapCard={vi.fn()} />
      );

      const width1 = parseFloat((c1.firstElementChild as HTMLElement).style.width);
      const width2 = parseFloat((c2.firstElementChild as HTMLElement).style.width);
      expect(width2 - width1).toBeCloseTo(2, 5);
    });
  });

  describe('Equipment cascade renders N attachment cards when not fanned out', () => {
    it('renders N attachment cards in the cascade', () => {
      const attachments = [
        makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } }),
        makeAttachment({ instanceId: 'equip-2', card: { id: 'equip-2', name: 'Lightning Greaves' } }),
      ];
      const creature = makeRowCard({ attachments });

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      // Each attachment gets a wrapper with absolute positioning and left offset in vh
      const outerDiv = container.firstElementChild as HTMLElement;
      const absoluteElements = outerDiv.querySelectorAll('[style*="position: absolute"]');
      // The attachment divs have left: Xvh where X = index * 2
      const cascadeElements = Array.from(absoluteElements).filter(
        el => {
          const left = (el as HTMLElement).style.left;
          return left && left.match(/^\d+vh$/) && left !== `${attachments.length * 2}vh`;
        }
      );
      expect(cascadeElements.length).toBe(2);
    });

    it('renders 0 cascade cards when no attachments', () => {
      const creature = makeRowCard({ attachments: [] });

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;
      const absoluteElements = outerDiv.querySelectorAll('[style*="position: absolute"]');
      // Only the creature wrapper should be absolute positioned at 0vh
      const cascadeElements = Array.from(absoluteElements).filter(
        el => {
          const left = (el as HTMLElement).style.left;
          return left && left !== '0vh' && left.match(/^\d+vh$/);
        }
      );
      expect(cascadeElements.length).toBe(0);
    });

    it('attachment name labels are visible in cascade', () => {
      const attachments = [
        makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } }),
      ];
      const creature = makeRowCard({ attachments });

      render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      expect(screen.getByText('Bonesplitter')).toBeInTheDocument();
    });
  });

  describe('Alt+click toggles fan-out panel visibility', () => {
    it('Alt+click opens fan-out panel when attachments exist', () => {
      const attachments = [
        makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } }),
      ];
      const creature = makeRowCard({ attachments });

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;
      fireEvent.click(outerDiv, { altKey: true });

      const fanGroup = screen.getByRole('group', { name: 'Fanned equipment attachments' });
      expect(fanGroup).toBeInTheDocument();
    });

    it('Alt+click again closes the fan-out panel', () => {
      const attachments = [
        makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } }),
      ];
      const creature = makeRowCard({ attachments });

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={vi.fn()}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;

      // Open fan-out
      fireEvent.click(outerDiv, { altKey: true });
      expect(screen.getByRole('group', { name: 'Fanned equipment attachments' })).toBeInTheDocument();

      // Close fan-out (click the outerDiv again with alt)
      fireEvent.click(outerDiv, { altKey: true });
      expect(screen.queryByRole('group', { name: 'Fanned equipment attachments' })).not.toBeInTheDocument();
    });

    it('Alt+click does NOT open fan-out when no attachments', () => {
      const creature = makeRowCard({ attachments: [] });
      const onTapCard = vi.fn();

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={onTapCard}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;
      fireEvent.click(outerDiv, { altKey: true });

      // Should not have a fan panel
      expect(screen.queryByRole('group', { name: 'Fanned equipment attachments' })).not.toBeInTheDocument();
      // Instead, the regular tap handler fires
      expect(onTapCard).toHaveBeenCalledWith('creature-id-1');
    });

    it('regular click triggers onTapCard, not fan-out', () => {
      const attachments = [
        makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } }),
      ];
      const creature = makeRowCard({ attachments });
      const onTapCard = vi.fn();

      const { container } = render(
        <CreatureOuterDiv
          creature={creature}
          isCompressed={false}
          onTapCard={onTapCard}
        />
      );

      const outerDiv = container.firstElementChild as HTMLElement;
      fireEvent.click(outerDiv);

      expect(onTapCard).toHaveBeenCalledWith('creature-id-1');
      expect(screen.queryByRole('group', { name: 'Fanned equipment attachments' })).not.toBeInTheDocument();
    });
  });
});
