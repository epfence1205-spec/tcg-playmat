import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { CardData, Zone } from '../types';

/** URL for the generic card back image (local asset) */
const CARD_BACK_URL = '/card-back.webp';

export interface DraggableCardProps {
  /** The card data to render */
  card: CardData;
  /** The zone this card currently resides in */
  sourceZone: Zone;
  /** Whether the card is tapped (rotated 90° clockwise) */
  isTapped?: boolean;
  /** Whether the card is face-down (shows card back) */
  isFaceDown?: boolean;
  /** For DFCs: whether to show the back face */
  showingBackFace?: boolean;
  /** When true, skip useDraggable — card becomes a pure visual (drag handled by parent sortable) */
  disableDrag?: boolean;
  /** Optional click handler (e.g., for tap toggle) */
  onClick?: (cardId: string) => void;
  /** Optional right-click handler (e.g., for flip) */
  onContextMenu?: (cardId: string) => void;
  /** Called when mouse enters this card */
  onHoverStart?: (cardId: string, sourceZone: Zone) => void;
  /** Called when mouse leaves this card */
  onHoverEnd?: (cardId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * DraggableCard — A card component that can be dragged between zones.
 *
 * Uses @dnd-kit/core's useDraggable hook. The card image follows the cursor
 * seamlessly during drag via CSS transforms. The drag overlay is handled by
 * the card itself (no separate DragOverlay needed for basic behavior).
 *
 * Performance considerations:
 * - Uses CSS `transform` for all positioning (GPU-accelerated, avoids layout thrashing)
 * - `will-change: transform` hints the browser to promote the element to its own layer
 * - Transition is disabled during active drag to avoid animation lag
 * - Image has `pointer-events: none` and `draggable={false}` to prevent browser drag interference
 * - React 18 auto-batches state updates in event handlers, so tap/flip/move are atomic
 *
 * Data passed to the drag event:
 *   - cardId: unique card instance ID
 *   - cardName: display name of the card
 *   - sourceZone: zone the card is being dragged from
 *   - cardType: derived card type for drop validation (creature, land, etc.)
 */
export function DraggableCard({
  card,
  sourceZone,
  isTapped = false,
  isFaceDown = false,
  showingBackFace = false,
  disableDrag = false,
  onClick,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
  className = '',
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: disableDrag,
    data: {
      cardId: card.id,
      cardName: card.name,
      sourceZone,
      cardType: card.cardType,
    },
  });

  // Determine which image to display
  const displayImage = isFaceDown
    ? CARD_BACK_URL
    : showingBackFace && card.backFaceImageURI
      ? card.backFaceImageURI
      : card.imageURI;

  // Build transform string: drag translation + tap rotation on the container
  const dragTransform = transform ? CSS.Translate.toString(transform) : undefined;
  const tapRotation = isTapped ? 'rotate(90deg)' : '';
  const combinedTransform = [dragTransform, tapRotation].filter(Boolean).join(' ') || undefined;

  const handleClick = () => {
    // Don't trigger click if we're currently dragging
    if (isDragging) return;
    onClick?.(card.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(card.id);
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        select-none touch-none ${disableDrag ? 'cursor-pointer' : 'cursor-grab'} overflow-hidden relative
        ${isDragging ? 'z-50 opacity-0 cursor-grabbing' : 'z-10'}
        ${className}
      `}
      style={{
        transform: combinedTransform,
        transition: isDragging ? undefined : 'all 200ms ease',
        willChange: 'transform',
        width: '11.43vh',
        height: '16vh',
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => onHoverStart?.(card.id, sourceZone)}
      onMouseLeave={() => onHoverEnd?.(card.id)}
      title={isFaceDown ? 'Face-down card' : card.name}
      role="button"
      aria-label={isFaceDown ? 'Face-down card' : `${card.name} in ${sourceZone}`}
      aria-grabbed={isDragging}
    >
      <img
        src={displayImage}
        alt={isFaceDown ? 'Card back' : card.name}
        className="w-full h-full rounded-md pointer-events-none object-cover"
        draggable={false}
      />
      {card.isTokenCopy && (
        <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1 py-0.5 rounded pointer-events-none z-10">
          TOKEN
        </div>
      )}
    </div>
  );
}
