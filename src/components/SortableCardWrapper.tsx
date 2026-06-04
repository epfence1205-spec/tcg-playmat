import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardType, RowTarget } from '../types';

interface SortableCardWrapperProps {
  id: string;              // instanceId — sortable key
  cardName: string;
  cardType: CardType;
  rowId: RowTarget;
  isTapped: boolean;
  attachmentCount: number;
  isCollapsing?: boolean;  // When true, animate width → 0 before removal
  children: React.ReactNode;
  style?: React.CSSProperties;   // compression margins passed through
  className?: string;
}

export function SortableCardWrapper({ id, cardName, cardType, rowId, isTapped, attachmentCount, isCollapsing = false, children, style, className }: SortableCardWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { cardId: id, cardName, sourceZone: 'battlefield', cardType, rowId },
  });

  const wrapperTransition = 'transform 200ms ease, width 200ms ease';

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? (transition || wrapperTransition) : wrapperTransition,
    opacity: isCollapsing ? 0 : isDragging ? 0.3 : 1,
    width: isCollapsing ? 0 : isTapped ? '16vh' : `${11.43 + attachmentCount * 2}vh`,
    height: isCollapsing ? 0 : '16vh',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    overflow: isCollapsing ? 'hidden' : undefined,
    ...style,
  };

  return (
    <div ref={setNodeRef} style={wrapperStyle} className={className} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
