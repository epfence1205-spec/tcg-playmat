import { useEffect, useState, useCallback } from 'react';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import type { CardData } from '../types';
import type { PeekMode, PeekResult } from '../peekActions';

// ─── Types ───────────────────────────────────────────────────────────────────

type Destination = 'top' | 'bottom' | 'hand' | 'graveyard';

interface PeekCardAssignment {
  card: CardData;
  destination: Destination;
}

export interface PeekModalProps {
  /** Cards to manipulate (top N from library) */
  cards: CardData[];
  /** Active mode */
  mode: PeekMode;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called with result when player confirms */
  onConfirm: (result: PeekResult) => void;
  /** Called when cancelled */
  onClose: () => void;
}

// ─── Mode Configuration ──────────────────────────────────────────────────────

const MODE_CONFIG: Record<Exclude<PeekMode, 'peek'>, {
  defaultDestination: Destination;
  destinations: [Destination, Destination];
  label: string;
}> = {
  scry: { defaultDestination: 'top', destinations: ['top', 'bottom'], label: 'Scry' },
  surveil: { defaultDestination: 'top', destinations: ['top', 'graveyard'], label: 'Surveil' },
  select: { defaultDestination: 'bottom', destinations: ['hand', 'bottom'], label: 'Select' },
};

const DESTINATION_STYLES: Record<Destination, { border: string; badge: string; label: string }> = {
  top: { border: 'border-blue-400', badge: '📚', label: 'Top of Library' },
  bottom: { border: 'border-amber-400', badge: '⬇', label: 'Bottom of Library' },
  hand: { border: 'border-green-400', badge: '✋', label: 'Hand' },
  graveyard: { border: 'border-purple-400', badge: '💀', label: 'Graveyard' },
};

// ─── Sortable Card ───────────────────────────────────────────────────────────

function SortablePeekCard({ card, destination, index, onClick, isDraggable }: {
  card: CardData;
  destination: Destination;
  index: number;
  onClick: () => void;
  isDraggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !isDraggable,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    cursor: isDraggable ? 'grab' : 'pointer',
  };

  const destStyle = DESTINATION_STYLES[destination];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-shrink-0 flex flex-col items-center gap-1 border-2 rounded-lg p-1 ${destStyle.border}`}
      onClick={onClick}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      <img
        src={card.imageURI}
        alt={card.name}
        className="w-[93px] h-[130px] object-cover rounded-md shadow-lg"
        draggable={false}
      />
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-400 font-mono">#{index + 1}</span>
        <span className="text-[10px]">{destStyle.badge}</span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PeekModal({ cards, mode, isOpen, onConfirm, onClose }: PeekModalProps) {
  const [assignments, setAssignments] = useState<PeekCardAssignment[]>([]);
  const [focusedIdx, setFocusedIdx] = useState(0);

  // Initialize assignments when modal opens
  useEffect(() => {
    if (!isOpen || cards.length === 0) return;
    if (mode === 'peek') {
      setAssignments(cards.map(card => ({ card, destination: 'top' as Destination })));
    } else {
      const config = MODE_CONFIG[mode];
      setAssignments(cards.map(card => ({ card, destination: config.defaultDestination })));
    }
    setFocusedIdx(0);
  }, [isOpen, cards, mode]);

  // Toggle a card's destination
  const toggleDestination = useCallback((cardId: string) => {
    if (mode === 'peek') return;
    const config = MODE_CONFIG[mode];
    setAssignments(prev => prev.map(a => {
      if (a.card.id !== cardId) return a;
      const [d1, d2] = config.destinations;
      return { ...a, destination: a.destination === d1 ? d2 : d1 };
    }));
  }, [mode]);

  // Build PeekResult and confirm
  const handleConfirm = useCallback(() => {
    const result: PeekResult = {
      mode,
      topCards: assignments.filter(a => a.destination === 'top').map(a => a.card),
      bottomCards: assignments.filter(a => a.destination === 'bottom').map(a => a.card),
      handCards: assignments.filter(a => a.destination === 'hand').map(a => a.card),
      graveyardCards: assignments.filter(a => a.destination === 'graveyard').map(a => a.card),
      originalCardIds: cards.map(c => c.id),
    };
    onConfirm(result);
  }, [assignments, cards, mode, onConfirm]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      e.stopPropagation();

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIdx(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIdx(prev => Math.min(assignments.length - 1, prev + 1));
          break;
        case ' ':
          e.preventDefault();
          if (assignments[focusedIdx]) {
            toggleDestination(assignments[focusedIdx].card.id);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (mode !== 'peek') handleConfirm();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, assignments, focusedIdx, mode, toggleDestination, onClose, handleConfirm]);

  // Drag end handler for reordering within a destination group
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setAssignments(prev => {
      const activeIdx = prev.findIndex(a => a.card.id === active.id);
      const overIdx = prev.findIndex(a => a.card.id === over.id);
      if (activeIdx === -1 || overIdx === -1) return prev;

      // Only reorder within same destination group
      if (prev[activeIdx].destination !== prev[overIdx].destination) return prev;

      return arrayMove(prev, activeIdx, overIdx);
    });
  }, []);

  // DndContext sensor for modal-internal sorting
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const sensors = useSensors(pointerSensor);

  if (!isOpen || cards.length === 0) return null;

  // ─── Peek mode (read-only) ─────────────────────────────────────────────
  if (mode === 'peek') {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        style={{ maxHeight: '83.33vh' }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Peeking at top ${cards.length} cards of library`}
      >
        <div
          className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl max-w-[90vw]"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-200">
              Peek {cards.length}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
            >
              Esc
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {cards.map((card, idx) => (
              <div key={card.id} className="flex-shrink-0 flex flex-col items-center gap-1">
                <img
                  src={card.imageURI}
                  alt={card.name}
                  className="w-[93px] h-[130px] object-cover rounded-md shadow-lg"
                  draggable={false}
                />
                <span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-2 text-center">
            Cards remain in this order on top of library
          </p>
        </div>
      </div>
    );
  }

  // ─── Interactive modes (scry/surveil/select) ───────────────────────────
  const config = MODE_CONFIG[mode];
  const [dest1, dest2] = config.destinations;
  const group1 = assignments.filter(a => a.destination === dest1);
  const group2 = assignments.filter(a => a.destination === dest2);

  const dest1Style = DESTINATION_STYLES[dest1];
  const dest2Style = DESTINATION_STYLES[dest2];

  const selectedCount = mode === 'select' ? assignments.filter(a => a.destination === 'hand').length : null;

  // Determine which groups are draggable
  const draggableGroups: Set<Destination> = new Set();
  if (mode === 'scry') { draggableGroups.add('top'); draggableGroups.add('bottom'); }
  if (mode === 'surveil') { draggableGroups.add('top'); }
  if (mode === 'select') { draggableGroups.add('bottom'); }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ maxHeight: '83.33vh' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${config.label} ${cards.length}`}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl max-w-[90vw]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-200">
            {config.label} {cards.length}
            {selectedCount !== null && (
              <span className="ml-2 text-green-400 text-xs">({selectedCount} selected)</span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Card groups */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-4">
            {/* Group 1 */}
            {group1.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-400 mb-1 font-medium">
                  {dest1Style.badge} {dest1Style.label}
                </div>
                <SortableContext items={group1.map(a => a.card.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {group1.map((a, idx) => (
                      <SortablePeekCard
                        key={a.card.id}
                        card={a.card}
                        destination={a.destination}
                        index={idx}
                        onClick={() => toggleDestination(a.card.id)}
                        isDraggable={draggableGroups.has(dest1)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            )}

            {/* Group 2 */}
            {group2.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-400 mb-1 font-medium">
                  {dest2Style.badge} {dest2Style.label}
                </div>
                <SortableContext items={group2.map(a => a.card.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {group2.map((a, idx) => (
                      <SortablePeekCard
                        key={a.card.id}
                        card={a.card}
                        destination={a.destination}
                        index={idx}
                        onClick={() => toggleDestination(a.card.id)}
                        isDraggable={draggableGroups.has(dest2)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            )}
          </div>
        </DndContext>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm px-3 py-1 rounded hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1 rounded transition-colors font-medium"
          >
            Confirm
          </button>
        </div>

        <p className="text-[10px] text-gray-500 mt-2 text-center">
          Click cards to toggle destination • Drag to reorder within a group
        </p>
      </div>
    </div>
  );
}
