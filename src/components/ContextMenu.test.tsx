import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuProps } from './ContextMenu';

/**
 * Property 24: Mutate Zone Restriction
 * "Mutate onto..." shown only for battlefield/hand cards with mutate keyword
 * "Split Mutate Stack" shown only when mutateStack.length > 0
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5
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

describe('ContextMenu — Mutate Zone Restriction (Property 24)', () => {
  describe('"Mutate onto..." visibility', () => {
    it('shows "Mutate onto..." when zone is battlefield and hasMutateKeyword is true', () => {
      render(<ContextMenu {...baseProps} cardZone="battlefield" hasMutateKeyword={true} />);
      expect(screen.getByText('Mutate onto...')).toBeInTheDocument();
    });

    it('shows "Mutate onto..." when zone is hand and hasMutateKeyword is true', () => {
      render(<ContextMenu {...baseProps} cardZone="hand" hasMutateKeyword={true} />);
      expect(screen.getByText('Mutate onto...')).toBeInTheDocument();
    });

    it('does NOT show "Mutate onto..." when zone is graveyard regardless of keyword', () => {
      render(<ContextMenu {...baseProps} cardZone="graveyard" hasMutateKeyword={true} />);
      expect(screen.queryByText('Mutate onto...')).not.toBeInTheDocument();
    });

    it('does NOT show "Mutate onto..." when zone is exile regardless of keyword', () => {
      render(<ContextMenu {...baseProps} cardZone="exile" hasMutateKeyword={true} />);
      expect(screen.queryByText('Mutate onto...')).not.toBeInTheDocument();
    });

    it('does NOT show "Mutate onto..." when zone is library regardless of keyword', () => {
      render(<ContextMenu {...baseProps} cardZone="library" hasMutateKeyword={true} />);
      expect(screen.queryByText('Mutate onto...')).not.toBeInTheDocument();
    });

    it('does NOT show "Mutate onto..." when zone is commandZone regardless of keyword', () => {
      render(<ContextMenu {...baseProps} cardZone="commandZone" hasMutateKeyword={true} />);
      expect(screen.queryByText('Mutate onto...')).not.toBeInTheDocument();
    });

    it('does NOT show "Mutate onto..." when hasMutateKeyword is false on battlefield', () => {
      render(<ContextMenu {...baseProps} cardZone="battlefield" hasMutateKeyword={false} />);
      expect(screen.queryByText('Mutate onto...')).not.toBeInTheDocument();
    });

    it('does NOT show "Mutate onto..." when hasMutateKeyword is false in hand', () => {
      render(<ContextMenu {...baseProps} cardZone="hand" hasMutateKeyword={false} />);
      expect(screen.queryByText('Mutate onto...')).not.toBeInTheDocument();
    });
  });

  describe('"Split Mutate Stack" visibility', () => {
    it('shows "Split Mutate Stack" when hasMutateStack is true on battlefield', () => {
      render(<ContextMenu {...baseProps} cardZone="battlefield" hasMutateStack={true} />);
      expect(screen.getByText('Split Mutate Stack')).toBeInTheDocument();
    });

    it('does NOT show "Split Mutate Stack" when hasMutateStack is false', () => {
      render(<ContextMenu {...baseProps} cardZone="battlefield" hasMutateStack={false} />);
      expect(screen.queryByText('Split Mutate Stack')).not.toBeInTheDocument();
    });

    it('does NOT show "Split Mutate Stack" in non-battlefield zones even if hasMutateStack is true', () => {
      render(<ContextMenu {...baseProps} cardZone="graveyard" hasMutateStack={true} />);
      expect(screen.queryByText('Split Mutate Stack')).not.toBeInTheDocument();
    });
  });
});
