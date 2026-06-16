import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StreamCard } from './StreamCard';
import type { RowCard, CardData, Attachment } from '../types';

const mockCard: CardData = {
  id: 'card-1',
  name: 'Grizzly Bears',
  setCode: 'lea',
  collectorNumber: '195',
  imageURI: 'https://cards.scryfall.io/normal/front/grizzly.jpg',
  imageURILarge: 'https://cards.scryfall.io/large/front/grizzly.jpg',
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
};

const mockDFC: CardData = {
  ...mockCard,
  id: 'dfc-1',
  name: 'Delver of Secrets',
  backFaceImageURI: 'https://cards.scryfall.io/normal/back/delver.jpg',
};

function makeRowCard(overrides: Partial<RowCard> = {}): RowCard {
  return {
    card: mockCard,
    instanceId: 'card-1',
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

describe('StreamCard', () => {
  it('renders card image face-up', () => {
    render(<StreamCard rowCard={makeRowCard()} />);
    const img = screen.getByAltText('Grizzly Bears');
    expect(img).toHaveAttribute('src', mockCard.imageURI);
  });

  it('applies 90deg rotation when tapped', () => {
    const { container } = render(<StreamCard rowCard={makeRowCard({ isTapped: true })} />);
    const rotationDiv = container.querySelector('[style*="rotate(90deg)"]');
    expect(rotationDiv).not.toBeNull();
  });

  it('does not apply rotation when untapped', () => {
    const { container } = render(<StreamCard rowCard={makeRowCard({ isTapped: false })} />);
    const rotationDiv = container.querySelector('[style*="rotate(90deg)"]');
    expect(rotationDiv).toBeNull();
  });

  it('renders card-back when face-down', () => {
    render(<StreamCard rowCard={makeRowCard({ isFaceDown: true })} />);
    const img = screen.getByAltText('Grizzly Bears');
    expect(img).toHaveAttribute('src', '/card-back.webp');
  });

  it('renders back face image when showingBackFace is true', () => {
    render(
      <StreamCard rowCard={makeRowCard({ card: mockDFC, showingBackFace: true })} />
    );
    const img = screen.getByAltText('Delver of Secrets');
    expect(img).toHaveAttribute('src', mockDFC.backFaceImageURI);
  });

  it('renders counter badges for non-zero counters', () => {
    render(
      <StreamCard
        rowCard={makeRowCard({
          counters: [
            { type: '+1/+1', value: 3 },
            { type: 'loyalty', value: 4 },
          ],
        })}
      />
    );
    expect(screen.getByText('+1/+1: 3')).toBeInTheDocument();
    expect(screen.getByText('loyalty: 4')).toBeInTheDocument();
  });

  it('does not render counters with zero value', () => {
    render(
      <StreamCard
        rowCard={makeRowCard({
          counters: [{ type: '+1/+1', value: 0 }],
        })}
      />
    );
    expect(screen.queryByText('+1/+1: 0')).not.toBeInTheDocument();
  });

  it('renders equipment attachments with cascade offset', () => {
    const equipment: Attachment[] = [
      {
        card: { ...mockCard, id: 'eq-1', name: 'Sword of Fire and Ice', imageURI: 'https://sword.jpg' },
        instanceId: 'eq-1',
        isTapped: false,
      },
      {
        card: { ...mockCard, id: 'eq-2', name: 'Lightning Greaves', imageURI: 'https://greaves.jpg' },
        instanceId: 'eq-2',
        isTapped: false,
      },
    ];
    render(<StreamCard rowCard={makeRowCard({ attachments: equipment })} />);
    expect(screen.getByAltText('Sword of Fire and Ice')).toBeInTheDocument();
    expect(screen.getByAltText('Lightning Greaves')).toBeInTheDocument();
  });

  it('renders mutate stack badge with correct count', () => {
    render(
      <StreamCard
        rowCard={makeRowCard({
          mutateStack: [mockCard, mockCard],
        })}
      />
    );
    // Stack count = mutateStack.length + 1 (top card)
    expect(screen.getByText('×3')).toBeInTheDocument();
  });

  it('does not render mutate badge when stack is empty', () => {
    render(<StreamCard rowCard={makeRowCard({ mutateStack: [] })} />);
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('has pointer-events-none on root element', () => {
    const { container } = render(<StreamCard rowCard={makeRowCard()} />);
    const root = container.firstElementChild;
    expect(root?.className).toContain('pointer-events-none');
  });
});
