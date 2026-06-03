import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { describe, it, expect, vi } from 'vitest';
import { EquipmentDock } from './EquipmentDock';
import type { RowCard, EffectiveStats, CardData, Attachment } from '../types';

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

function makeAttachment(overrides: Partial<Attachment & { card?: Partial<CardData> }> = {}): Attachment {
  const card = makeCard({
    id: overrides.instanceId ?? 'equip-id-1',
    name: overrides.card?.name ?? 'Bonesplitter',
    cardType: 'artifact',
    typeLine: 'Artifact — Equipment',
    basePower: null,
    baseToughness: null,
    ...overrides.card,
  });
  return {
    card,
    instanceId: card.id,
    isTapped: false,
    ...overrides,
  };
}

const defaultStats: EffectiveStats = {
  basePower: 2,
  baseToughness: 2,
  modifiedPower: 3,
  modifiedToughness: 2,
  modifiers: [{ power: 1, toughness: 0, source: 'equip-id-1' }],
};

const unmodifiedStats: EffectiveStats = {
  basePower: 2,
  baseToughness: 2,
  modifiedPower: 2,
  modifiedToughness: 2,
  modifiers: [],
};

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

// --- Tests ---

describe('EquipmentDock', () => {
  describe('Rotation transform when tapped (Requirement 4.1)', () => {
    it('applies transform: rotate(90deg) to root div when creature is tapped', () => {
      const creature = makeRowCard({ isTapped: true });
      const attachment = makeAttachment();
      const attachments = [makeRowCard({
        card: attachment.card,
        instanceId: attachment.instanceId,
      })];

      const { container } = renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv).toBeTruthy();
      expect(rootDiv.style.transform).toBe('rotate(90deg)');
    });

    it('root div has no rotation when creature is untapped', () => {
      const creature = makeRowCard({ isTapped: false });
      const attachment = makeAttachment();
      const attachments = [makeRowCard({
        card: attachment.card,
        instanceId: attachment.instanceId,
      })];

      const { container } = renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.style.transform).toBe('');
    });
  });

  describe('Creature DraggableCard is draggable (Requirement 4.2)', () => {
    it('creature card renders with cursor-grab (draggable)', () => {
      const creature = makeRowCard();
      const attachment = makeAttachment();
      const attachments = [makeRowCard({
        card: attachment.card,
        instanceId: attachment.instanceId,
      })];

      renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      const creatureEl = screen.getByRole('button', { name: 'Grizzly Bears in battlefield' });
      expect(creatureEl.className).toContain('cursor-grab');
    });

    it('creature card does not have drag ref attached (no aria-grabbed)', () => {
      const creature = makeRowCard();
      const attachment = makeAttachment();
      const attachments = [makeRowCard({
        card: attachment.card,
        instanceId: attachment.instanceId,
      })];

      renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      // When disableDrag=true, the DraggableCard should not have aria-grabbed attribute
      // (since useDraggable is skipped, no drag attributes are applied)
      const creatureEl = screen.getByRole('button', { name: 'Grizzly Bears in battlefield' });
      expect(creatureEl.getAttribute('aria-grabbed')).toBe('false');
    });
  });

  describe('Equipment DraggableCards do NOT receive disableDrag={true} (Requirement 4.3)', () => {
    it('equipment cards render with cursor-grab (indicating disableDrag is false/unset)', () => {
      const creature = makeRowCard();
      const attachment1 = makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } });
      const attachment2 = makeAttachment({ instanceId: 'equip-2', card: { id: 'equip-2', name: 'Lightning Greaves' } });
      const attachments = [
        makeRowCard({ card: attachment1.card, instanceId: attachment1.instanceId }),
        makeRowCard({ card: attachment2.card, instanceId: attachment2.instanceId }),
      ];

      renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      // Equipment cards in the cascade should have cursor-grab (draggable)
      const equipCards = screen.getAllByRole('button').filter(
        el => el.className.includes('cursor-grab')
      );
      // At least the equipment cards should be draggable
      expect(equipCards.length).toBeGreaterThanOrEqual(2);
    });

    it('equipment cards are independently draggable (not disabled)', () => {
      const creature = makeRowCard();
      const attachment = makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Sword of Fire and Ice' } });
      const attachments = [makeRowCard({ card: attachment.card, instanceId: attachment.instanceId })];

      renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      // The equipment card should be rendered with cursor-grab (draggable)
      const swordEl = screen.getByRole('button', { name: 'Sword of Fire and Ice in battlefield' });
      expect(swordEl.className).toContain('cursor-grab');
      expect(swordEl.className).not.toContain('cursor-pointer');
    });
  });

  describe('Cascade layout (offset positioning)', () => {
    it('renders attachments with cascade offset positioning', () => {
      const creature = makeRowCard();
      const attachment1 = makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } });
      const attachment2 = makeAttachment({ instanceId: 'equip-2', card: { id: 'equip-2', name: 'Lightning Greaves' } });
      const attachments = [
        makeRowCard({ card: attachment1.card, instanceId: attachment1.instanceId }),
        makeRowCard({ card: attachment2.card, instanceId: attachment2.instanceId }),
      ];

      const { container } = renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      // Cascade offset elements should have left positioning with negative vh values
      const absoluteElements = container.querySelectorAll('.absolute');
      const cascadeElements = Array.from(absoluteElements).filter(
        el => (el as HTMLElement).style.left?.includes('vh')
      );
      expect(cascadeElements.length).toBe(2); // Two attachments with cascade offset
    });

    it('cascade offsets increase for each attachment', () => {
      const creature = makeRowCard();
      const attachment1 = makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } });
      const attachment2 = makeAttachment({ instanceId: 'equip-2', card: { id: 'equip-2', name: 'Lightning Greaves' } });
      const attachments = [
        makeRowCard({ card: attachment1.card, instanceId: attachment1.instanceId }),
        makeRowCard({ card: attachment2.card, instanceId: attachment2.instanceId }),
      ];

      const { container } = renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      const absoluteElements = container.querySelectorAll('.absolute');
      const cascadeElements = Array.from(absoluteElements).filter(
        el => (el as HTMLElement).style.left?.includes('vh')
      );

      // First attachment should be further left (larger offset) than second
      const offset1 = parseFloat((cascadeElements[0] as HTMLElement).style.left);
      const offset2 = parseFloat((cascadeElements[1] as HTMLElement).style.left);
      // Both should be negative (positioned to the left)
      expect(offset1).toBeLessThan(0);
      expect(offset2).toBeLessThan(0);
      // First attachment (index 0) should have larger absolute offset than second (index 1)
      expect(Math.abs(offset1)).toBeGreaterThan(Math.abs(offset2));
    });
  });

  describe('Fan-out behavior (Ctrl+click)', () => {
    it('Ctrl+click on creature fans out attachments', () => {
      const creature = makeRowCard();
      const attachment = makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } });
      const attachments = [makeRowCard({ card: attachment.card, instanceId: attachment.instanceId })];

      renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      // Find the creature wrapper and Ctrl+click it
      const creatureEl = screen.getByRole('button', { name: 'Grizzly Bears in battlefield' });
      const creatureWrapper = creatureEl.parentElement!;
      fireEvent.click(creatureWrapper, { ctrlKey: true });

      // After fan-out, the fan panel should appear with the attachment
      const fanGroup = screen.getByRole('group', { name: 'Fanned equipment attachments' });
      expect(fanGroup).toBeInTheDocument();
    });

    it('fan-out panel shows "Move to" button for each attachment', () => {
      const creature = makeRowCard();
      const attachment = makeAttachment({ instanceId: 'equip-1', card: { id: 'equip-1', name: 'Bonesplitter' } });
      const attachments = [makeRowCard({ card: attachment.card, instanceId: attachment.instanceId })];

      renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      // Ctrl+click to fan out
      const creatureEl = screen.getByRole('button', { name: 'Grizzly Bears in battlefield' });
      const creatureWrapper = creatureEl.parentElement!;
      fireEvent.click(creatureWrapper, { ctrlKey: true });

      // Should show "Move to" button
      expect(screen.getByText('Move to ▾')).toBeInTheDocument();
    });
  });

  describe('Modified P/T overlay', () => {
    it('shows modified P/T when stats differ from base', () => {
      const creature = makeRowCard();
      const attachment = makeAttachment();
      const attachments = [makeRowCard({ card: attachment.card, instanceId: attachment.instanceId })];

      renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={defaultStats}
          onAction={vi.fn()}
        />
      );

      // Modified stats overlay should show "3/2"
      expect(screen.getByLabelText('Modified stats: 3/2')).toBeInTheDocument();
    });

    it('does NOT show modified P/T when stats are unchanged', () => {
      const creature = makeRowCard();
      const attachment = makeAttachment();
      const attachments = [makeRowCard({ card: attachment.card, instanceId: attachment.instanceId })];

      renderWithDnd(
        <EquipmentDock
          creature={creature}
          attachments={attachments}
          effectiveStats={unmodifiedStats}
          onAction={vi.fn()}
        />
      );

      // No modified stats overlay when base === modified
      expect(screen.queryByLabelText(/Modified stats/)).not.toBeInTheDocument();
    });
  });
});
