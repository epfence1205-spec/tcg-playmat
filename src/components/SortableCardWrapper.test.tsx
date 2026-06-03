import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SortableCardWrapper } from './SortableCardWrapper';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: (props: any) => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: props?.id === 'dragging-id',
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: (t: any) => t ? `translate3d(${t.x}px, ${t.y}px, 0)` : '' } },
}));

describe('SortableCardWrapper', () => {
  const defaultProps = {
    id: 'card-1',
    cardName: 'Lightning Bolt',
    cardType: 'instant' as const,
    rowId: 'row3-artifacts' as const,
    isTapped: false,
    attachmentCount: 0,
  };

  it('width = 16vh when isTapped=true regardless of attachmentCount', () => {
    const { container } = render(
      <SortableCardWrapper {...defaultProps} isTapped={true} attachmentCount={5}>
        <span>child</span>
      </SortableCardWrapper>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('16vh');
  });

  it('width = 11.43vh with 0 attachments untapped', () => {
    const { container } = render(
      <SortableCardWrapper {...defaultProps} isTapped={false} attachmentCount={0}>
        <span>child</span>
      </SortableCardWrapper>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('11.43vh');
  });

  it('width = 15.43vh with 2 attachments untapped', () => {
    const { container } = render(
      <SortableCardWrapper {...defaultProps} isTapped={false} attachmentCount={2}>
        <span>child</span>
      </SortableCardWrapper>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('15.43vh');
  });

  it('width = 17.43vh with 3 attachments untapped', () => {
    const { container } = render(
      <SortableCardWrapper {...defaultProps} isTapped={false} attachmentCount={3}>
        <span>child</span>
      </SortableCardWrapper>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('17.43vh');
  });

  it('opacity = 0.3 when isDragging', () => {
    const { container } = render(
      <SortableCardWrapper {...defaultProps} id="dragging-id">
        <span>child</span>
      </SortableCardWrapper>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.opacity).toBe('0.3');
  });

  it('opacity = 1 when not dragging', () => {
    const { container } = render(
      <SortableCardWrapper {...defaultProps} id="not-dragging">
        <span>child</span>
      </SortableCardWrapper>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.opacity).toBe('1');
  });

  it('style prop merges with wrapper styles', () => {
    const { container } = render(
      <SortableCardWrapper {...defaultProps} style={{ marginLeft: '-20px' }}>
        <span>child</span>
      </SortableCardWrapper>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.marginLeft).toBe('-20px');
  });

  it('children render inside the wrapper', () => {
    render(
      <SortableCardWrapper {...defaultProps}>
        <span data-testid="inner-child">Hello</span>
      </SortableCardWrapper>
    );
    expect(screen.getByTestId('inner-child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
