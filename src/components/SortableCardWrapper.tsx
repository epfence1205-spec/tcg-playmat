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
  /** Whether this card is currently in the multi-select set */
  isSelected?: boolean;
  /** Mutate targeting state — when active, highlights valid targets and dims others */
  mutateTargeting?: MutateTargetingState;
  /** Called when a valid mutate target is clicked during targeting mode */
  onMutateTargetSelect?: (cardId: string) => void;
  /** Called when Ctrl+Click toggles selection for this card */
  onSelectionToggle?: (cardId: string) => void;
  /** Whether any card in the selection set is currently selected */
  hasSelection?: boolean;
  /** Called to clear the entire selection set (e.g., on normal click while selection exists) */
  onClearSelection?: () => void;
  /** Called when a selected card is clicked (no modifier) — taps all selected cards */
  onTapSelected?: () => void;
}

export function SortableCardWrapper({ id, cardName, cardType, rowId, isTapped, attachmentCount, isCollapsing = false, children, style, className, isSelected, mutateTargeting, onMutateTargetSelect, onSelectionToggle, hasSelection, onClearSelection, onTapSelected }: SortableCardWrapperProps) {
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
    ...style,
    // Tapped cards get a small boost above neighbors but MUST stay below UI overlays (z-[99]+)
    zIndex: isTapped ? ((style?.zIndex as number) || 0) + 50 : (style?.zIndex ?? undefined),
  };

  // Build className with targeting highlights and selection ring
  const targetingClasses = isValidTarget
    ? 'ring-2 ring-indigo-500 rounded-sm'
    : isSelected
      ? 'ring-2 ring-cyan-400 rounded-sm'
      : '';
  const combinedClassName = [className, targetingClasses].filter(Boolean).join(' ');

  // During targeting mode: intercept clicks on valid targets, ignore non-valid
  // When not targeting: intercept Ctrl+Click for selection toggle
  const handleClick = isTargetingActive
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isValidTarget && onMutateTargetSelect) {
          onMutateTargetSelect(id);
        }
        // Non-valid cards: click is swallowed (ignored)
      }
    : (e: React.MouseEvent) => {
        if ((e.ctrlKey || e.metaKey) && onSelectionToggle) {
          e.stopPropagation();
          e.preventDefault();
          onSelectionToggle(id);
        } else if (isSelected && onTapSelected) {
          // Clicking a selected card (no modifier) → tap ALL selected, then clear
          e.stopPropagation();
          e.preventDefault();
          onTapSelected();
        } else if (hasSelection && onClearSelection) {
          // Normal click on a NON-selected card while selection exists: clear selection, then let tap propagate
          onClearSelection();
          // Do NOT stop propagation — let RotationDiv handle the tap
        }
        // If no selection and no Ctrl: let event propagate normally for tap handling
      };

  // During targeting mode, suppress drag listeners on all cards
  const effectiveListeners = isTargetingActive ? {} : listeners;

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      className={combinedClassName}
      data-card-id={id}
      {...attributes}
      {...effectiveListeners}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
