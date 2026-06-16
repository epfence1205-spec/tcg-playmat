import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardType, RowTarget, MutateTargetingState } from '../types';
import { computeSortableWrapperWidthVh } from '../creatureLayout';

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
  /** Mutate targeting state — when active, highlights valid targets and dims others */
  mutateTargeting?: MutateTargetingState;
  /** Called when a valid mutate target is clicked during targeting mode */
  onMutateTargetSelect?: (cardId: string) => void;
}

export function SortableCardWrapper({ id, cardName, cardType, rowId, isTapped, attachmentCount, isCollapsing = false, children, style, className, mutateTargeting, onMutateTargetSelect }: SortableCardWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { cardId: id, cardName, sourceZone: 'battlefield', cardType, rowId },
  });

  // Mutate targeting visual state
  const isTargetingActive = mutateTargeting?.isActive ?? false;
  const isValidTarget = isTargetingActive && mutateTargeting!.validTargetIds.includes(id);
  const isNonValidDuringTargeting = isTargetingActive && !isValidTarget;

  const wrapperTransition = 'transform 200ms ease, width 200ms ease';

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? (transition || wrapperTransition) : wrapperTransition,
    opacity: isCollapsing ? 0 : isDragging ? 0.3 : isNonValidDuringTargeting ? 0.5 : 1,
    width: isCollapsing ? 0 : `${computeSortableWrapperWidthVh(isTapped, attachmentCount)}vh`,
    height: isCollapsing ? 0 : '16vh',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isTargetingActive ? (isValidTarget ? 'pointer' : 'not-allowed') : 'grab',
    overflow: isCollapsing ? 'hidden' : undefined,
    zIndex: isTapped ? 10 : undefined,
    ...style,
  };

  // Build className with targeting highlights
  const targetingClasses = isValidTarget
    ? 'ring-2 ring-indigo-500 rounded-sm'
    : '';
  const combinedClassName = [className, targetingClasses].filter(Boolean).join(' ');

  // During targeting mode: intercept clicks on valid targets, ignore non-valid
  const handleClick = isTargetingActive
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isValidTarget && onMutateTargetSelect) {
          onMutateTargetSelect(id);
        }
        // Non-valid cards: click is swallowed (ignored)
      }
    : undefined;

  // During targeting mode, suppress drag listeners on all cards
  const effectiveListeners = isTargetingActive ? {} : listeners;

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      className={combinedClassName}
      {...attributes}
      {...effectiveListeners}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
