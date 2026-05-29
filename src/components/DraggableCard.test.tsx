import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { describe, it, expect, vi } from 'vitest';
import { DraggableCard } from './DraggableCard';
import type { CardData } from '../types';

const mockCard: CardData = {
  id: 'test-uuid-1234',
  name: 'Lightning Bolt',
  setCode: 'lea',
  collectorNumber: '161',
  imageURI: 'https://cards.scryfall.io/normal/front/e/3/e3285e6b-3e79-4d7c-bf96-d920f973b122.jpg',
  imageURILarge: 'https://cards.scryfall.io/large/front/e/3/e3285e6b-3e79-4d7c-bf96-d920f973b122.jpg',
  backFaceImageURI: null,
  typeLine: 'Instant',
  oracleText: 'Lightning Bolt deals 3 damage to any target.',
  isCommander: false,
  keywords: [],
  basePower: null,
  baseToughness: null,
  cardType: 'instant',
  isToken: false,
  isTokenCopy: false,
};

const mockDFC: CardData = {
  id: 'test-uuid-dfc',
  name: 'Delver of Secrets // Insectile Aberration',
  setCode: 'isd',
  collectorNumber: '51',
  imageURI: 'https://cards.scryfall.io/normal/front/1/1/11bf83bb-c95b-4b4f-9a56-ce7a1816e5db.jpg',
  imageURILarge: 'https://cards.scryfall.io/large/front/1/1/11bf83bb-c95b-4b4f-9a56-ce7a1816e5db.jpg',
  backFaceImageURI: 'https://cards.scryfall.io/normal/back/1/1/11bf83bb-c95b-4b4f-9a56-ce7a1816e5db.jpg',
  typeLine: 'Creature — Human Wizard // Creature — Human Insect',
  oracleText: 'At the beginning of your upkeep, look at the top card of your library.',
  isCommander: false,
  keywords: [],
  basePower: '1',
  baseToughness: '1',
  cardType: 'creature',
  isToken: false,
  isTokenCopy: false,
};

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

describe('DraggableCard', () => {
  it('renders card image face-up by default', () => {
    renderWithDnd(<DraggableCard card={mockCard} sourceZone="hand" />);
    const img = screen.getByAltText('Lightning Bolt');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockCard.imageURI);
  });

  it('renders card back when face-down', () => {
    renderWithDnd(<DraggableCard card={mockCard} sourceZone="battlefield" isFaceDown />);
    const img = screen.getByAltText('Card back');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('card-back');
  });

  it('renders back face for DFC when showingBackFace is true', () => {
    renderWithDnd(<DraggableCard card={mockDFC} sourceZone="battlefield" showingBackFace />);
    const img = screen.getByAltText(mockDFC.name);
    expect(img).toHaveAttribute('src', mockDFC.backFaceImageURI);
  });

  it('has correct aria-label for face-up card', () => {
    renderWithDnd(<DraggableCard card={mockCard} sourceZone="hand" />);
    const el = screen.getByRole('button', { name: 'Lightning Bolt in hand' });
    expect(el).toBeInTheDocument();
  });

  it('has correct aria-label for face-down card', () => {
    renderWithDnd(<DraggableCard card={mockCard} sourceZone="exile" isFaceDown />);
    const el = screen.getByRole('button', { name: 'Face-down card' });
    expect(el).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    renderWithDnd(<DraggableCard card={mockCard} sourceZone="hand" onClick={handleClick} />);
    const el = screen.getByRole('button', { name: 'Lightning Bolt in hand' });
    el.click();
    expect(handleClick).toHaveBeenCalledWith('test-uuid-1234');
  });

  it('calls onContextMenu handler on right-click', async () => {
    const handleContext = vi.fn();
    renderWithDnd(<DraggableCard card={mockCard} sourceZone="battlefield" onContextMenu={handleContext} />);
    const el = screen.getByRole('button', { name: 'Lightning Bolt in battlefield' });
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(handleContext).toHaveBeenCalledWith('test-uuid-1234');
  });

  it('applies tap rotation style when isTapped is true', () => {
    renderWithDnd(<DraggableCard card={mockCard} sourceZone="battlefield" isTapped />);
    const el = screen.getByRole('button', { name: 'Lightning Bolt in battlefield' });
    expect(el.style.width).toBe('11.43vh');
    expect(el.style.height).toBe('16vh');
    expect(el.style.transform).toContain('rotate(90deg)');
  });
});
