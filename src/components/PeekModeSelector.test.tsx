import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PeekModeSelector } from './PeekModeSelector';

describe('PeekModeSelector', () => {
  const defaultProps = {
    count: 3,
    isOpen: true,
    onSelectMode: vi.fn(),
    onClose: vi.fn(),
  };

  function renderSelector(overrides = {}) {
    const props = { ...defaultProps, ...overrides, onSelectMode: vi.fn(), onClose: vi.fn() };
    render(<PeekModeSelector {...props} />);
    return props;
  }

  it('renders 4 mode options with correct labels', () => {
    renderSelector();
    expect(screen.getByText('Scry')).toBeInTheDocument();
    expect(screen.getByText('Surveil')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Peek')).toBeInTheDocument();
  });

  it('displays the count in the header', () => {
    renderSelector({ count: 5 });
    expect(screen.getByText('Peek 5 — Choose Mode')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<PeekModeSelector {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Scry')).not.toBeInTheDocument();
  });

  it('calls onSelectMode with "scry" when Scry is clicked', () => {
    const props = renderSelector();
    fireEvent.click(screen.getByText('Scry'));
    expect(props.onSelectMode).toHaveBeenCalledWith('scry');
  });

  it('calls onSelectMode with "surveil" when Surveil is clicked', () => {
    const props = renderSelector();
    fireEvent.click(screen.getByText('Surveil'));
    expect(props.onSelectMode).toHaveBeenCalledWith('surveil');
  });

  it('calls onSelectMode with "select" when Select is clicked', () => {
    const props = renderSelector();
    fireEvent.click(screen.getByText('Select'));
    expect(props.onSelectMode).toHaveBeenCalledWith('select');
  });

  it('calls onSelectMode with "peek" when Peek is clicked', () => {
    const props = renderSelector();
    fireEvent.click(screen.getByText('Peek'));
    expect(props.onSelectMode).toHaveBeenCalledWith('peek');
  });

  it('keyboard shortcut S selects scry', () => {
    const props = renderSelector();
    fireEvent.keyDown(document, { key: 's' });
    expect(props.onSelectMode).toHaveBeenCalledWith('scry');
  });

  it('keyboard shortcut V selects surveil', () => {
    const props = renderSelector();
    fireEvent.keyDown(document, { key: 'v' });
    expect(props.onSelectMode).toHaveBeenCalledWith('surveil');
  });

  it('keyboard shortcut E selects select', () => {
    const props = renderSelector();
    fireEvent.keyDown(document, { key: 'e' });
    expect(props.onSelectMode).toHaveBeenCalledWith('select');
  });

  it('keyboard shortcut P selects peek', () => {
    const props = renderSelector();
    fireEvent.keyDown(document, { key: 'p' });
    expect(props.onSelectMode).toHaveBeenCalledWith('peek');
  });

  it('Escape calls onClose', () => {
    const props = renderSelector();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('backdrop click calls onClose', () => {
    const props = renderSelector();
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('ArrowDown + Enter selects highlighted mode', () => {
    const props = renderSelector();
    // Default highlight is index 0 (Scry). ArrowDown moves to Surveil.
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(props.onSelectMode).toHaveBeenCalledWith('surveil');
  });
});
