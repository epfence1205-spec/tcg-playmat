import { useState, useCallback, useRef } from 'react';
import type { RowCard, EffectiveStats, Zone } from '../types';
import { DraggableCard } from './DraggableCard';

export type EquipmentAction =
  | { type: 'MOVE_TO'; equipmentId: string; destination: Zone }
  | { type: 'EQUIP_TO'; equipmentId: string };

export interface EquipmentDockProps {
  /** The creature card that equipment is attached to */
  creature: RowCard;
  /** Equipment/Aura cards docked to this creature */
  attachments: RowCard[];
  /** Calculated effective stats including all modifiers */
  effectiveStats: EffectiveStats;
  /** Callback for equipment actions (move to zone or re-equip) */
  onAction: (action: EquipmentAction) => void;
  /** Called when the creature is clicked (tap) */
  onTapCard?: (cardId: string) => void;
  /** Called when mouse enters the creature */
  onCardHoverStart?: (cardId: string, zone: 'battlefield') => void;
  /** Called when mouse leaves the creature */
  onCardHoverEnd?: (cardId: string) => void;
}

/** Cascade offset in vh between each stacked attachment */
const CASCADE_OFFSET_VH = 2;

/**
 * EquipmentDock — Renders equipment/auras docked behind a creature with cascade offset.
 *
 * Responsibilities:
 * - Render attached equipment behind creature with 15px cascade offset per attachment
 * - Display equipment card name as white text on dark grey background, rendered sideways
 * - Auto-display modified P/T on creature (e.g., "3/4 → 5/6")
 * - When creature is tapped (rotated 90°), all attachments rotate with it
 * - Ctrl+click on the creature fans out all attachments temporarily for individual selection
 * - Each fanned-out attachment has a "Detach" action (calls onDetach)
 *
 * Validates: Requirements 9.2, 9.3, 9.7, 9.8, 9.11
 */
export function EquipmentDock({
  creature,
  attachments,
  effectiveStats,
  onAction,
  onTapCard,
  onCardHoverStart,
  onCardHoverEnd,
}: EquipmentDockProps) {
  const [isFannedOut, setIsFannedOut] = useState(false);
  const [fanPosition, setFanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const creatureRef = useRef<HTMLDivElement>(null);

  const handleCreatureClick = useCallback(
    (e: React.MouseEvent) => {
      // Ctrl+click to fan out attachments for individual selection
      if (e.ctrlKey && attachments.length > 0) {
        e.stopPropagation();
        // Position fan panel below the creature card
        if (creatureRef.current) {
          const rect = creatureRef.current.getBoundingClientRect();
          setFanPosition({ x: rect.left, y: rect.bottom + 4 });
        }
        setIsFannedOut((prev) => !prev);
      }
    },
    [attachments.length]
  );

  // Determine if stats were modified
  const hasModifiedStats =
    effectiveStats.modifiedPower !== effectiveStats.basePower ||
    effectiveStats.modifiedToughness !== effectiveStats.baseToughness;

  // Container rotation when creature is tapped — rotates entire dock as a unit
  return (
    <div
      className="relative inline-block"
      style={{
        transform: creature.isTapped ? 'rotate(90deg)' : undefined,
        transition: 'transform 200ms ease',
        transformOrigin: 'center center',
      }}
    >
      {/* Attachments rendered behind the creature with cascade offset */}
      {!isFannedOut &&
        attachments.map((attachment, index) => (
          <div
            key={attachment.instanceId}
            className="absolute"
            style={{
              // Position behind creature with cascade offset to the left
              // Later attachments go further left; first attached is closest to creature
              left: `-${(attachments.length - index) * CASCADE_OFFSET_VH}vh`,
              top: '0px',
              zIndex: index,
              transition: 'all 300ms ease-in-out',
            }}
          >
            {/* Equipment card (partially hidden behind creature) */}
            <div className="relative" style={{ width: '11.43vh', height: '16vh' }}>
              <DraggableCard
                card={attachment.card}
                sourceZone="battlefield"
                isTapped={false}
                isFaceDown={attachment.isFaceDown}
                className="opacity-80"
              />
              {/* Sideways equipment name label */}
              <div
                className="absolute top-0 left-0 h-full flex items-center justify-center pointer-events-none"
                style={{ width: '2vh', zIndex: 50 }}
              >
                <span
                  className="text-white bg-gray-800/90 text-[1.2vh] font-semibold px-[0.3vh] py-[0.2vh] rounded whitespace-nowrap"
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    maxHeight: '14vh',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {attachment.card.name}
                </span>
              </div>
            </div>
          </div>
        ))}

      {/* Creature card (on top of attachments) */}
      <div
        ref={creatureRef}
        className="relative"
        style={{
          zIndex: attachments.length + 1,
        }}
        onClickCapture={handleCreatureClick}
      >
        <DraggableCard
          card={creature.card}
          sourceZone="battlefield"
          isTapped={false}
          isFaceDown={creature.isFaceDown}
          showingBackFace={creature.showingBackFace}
          onClick={onTapCard}
          onHoverStart={onCardHoverStart}
          onHoverEnd={onCardHoverEnd}
        />

        {/* Modified P/T overlay */}
        {hasModifiedStats && (
          <div
            className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1 py-0.5 rounded pointer-events-none"
            style={{ zIndex: attachments.length + 5 }}
            aria-label={`Modified stats: ${effectiveStats.modifiedPower}/${effectiveStats.modifiedToughness}`}
          >
            {effectiveStats.modifiedPower}/{effectiveStats.modifiedToughness}
          </div>
        )}
      </div>

      {/* Fanned-out attachments for individual selection (Ctrl+click) */}
      {isFannedOut && attachments.length > 0 && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={(e) => { e.stopPropagation(); setIsFannedOut(false); }}
        >
          <div
            className="fixed flex gap-3 z-[9999] bg-gray-900/95 p-3 rounded-xl shadow-2xl border border-gray-700"
            style={{
              left: `${Math.min(fanPosition.x, window.innerWidth - 300)}px`,
              top: `${Math.min(fanPosition.y, window.innerHeight - 200)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            role="group"
            aria-label="Fanned equipment attachments"
          >
          {attachments.map((attachment) => (
            <FannedAttachmentCard
              key={attachment.instanceId}
              attachment={attachment}
              onAction={onAction}
              onClose={() => { if (attachments.length <= 1) setIsFannedOut(false); }}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Individual fanned attachment card with "Move to" dropdown */
function FannedAttachmentCard({ attachment, onAction, onClose }: {
  attachment: RowCard;
  onAction: (action: EquipmentAction) => void;
  onClose: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className="w-[70px] h-[98px]">
        <DraggableCard
          card={attachment.card}
          sourceZone="battlefield"
          isTapped={false}
          isFaceDown={attachment.isFaceDown}
          className="w-full h-full"
        />
      </div>
      <span className="text-white text-[9px] font-medium text-center truncate max-w-[70px]">
        {attachment.card.name}
      </span>
      <div className="flex flex-col gap-0.5 w-full relative">
        <button
          className="text-gray-200 hover:text-white text-[9px] font-medium bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded transition-colors w-full text-center"
          onClick={(e) => {
            e.stopPropagation();
            setShowMoveMenu(!showMoveMenu);
          }}
        >
          Move to ▾
        </button>
        {showMoveMenu && (
          <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-lg z-10 flex flex-col">
            <button
              className="text-gray-200 hover:text-white text-[9px] hover:bg-gray-700 px-2 py-1 text-left"
              onClick={(e) => { e.stopPropagation(); onAction({ type: 'MOVE_TO', equipmentId: attachment.instanceId, destination: 'hand' }); onClose(); }}
            >
              Hand
            </button>
            <button
              className="text-gray-200 hover:text-white text-[9px] hover:bg-gray-700 px-2 py-1 text-left"
              onClick={(e) => { e.stopPropagation(); onAction({ type: 'MOVE_TO', equipmentId: attachment.instanceId, destination: 'graveyard' }); onClose(); }}
            >
              Graveyard
            </button>
            <button
              className="text-gray-200 hover:text-white text-[9px] hover:bg-gray-700 px-2 py-1 text-left"
              onClick={(e) => { e.stopPropagation(); onAction({ type: 'MOVE_TO', equipmentId: attachment.instanceId, destination: 'exile' }); onClose(); }}
            >
              Exile
            </button>
          </div>
        )}
        <button
          className="text-blue-300 hover:text-blue-200 text-[9px] font-medium bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded transition-colors w-full text-center"
          onClick={(e) => {
            e.stopPropagation();
            onAction({ type: 'EQUIP_TO', equipmentId: attachment.instanceId });
            onClose();
          }}
        >
          Equip to...
        </button>
      </div>
    </div>
  );
}
