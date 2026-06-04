import { useState, useRef } from 'react';
import type { RowCard, Zone, KeywordAbility } from '../types';
import { DraggableCard } from './DraggableCard';
import { computeOuterDivWidthVh, computeOuterDivHeightVh, computeZIndex } from '../creatureLayout';
import { calculateEffectiveStats, parseKeywords } from '../keywords';
import { createRowCard } from '../gameActions';
import type { EquipmentAction } from './EquipmentDock';

export interface CreatureOuterDivProps {
  creature: RowCard;
  isCompressed: boolean;
  style?: React.CSSProperties;
  onTapCard: (cardId: string) => void;
  onCardHoverStart?: (cardId: string, zone: Zone) => void;
  onCardHoverEnd?: (cardId: string) => void;
  onEquipmentAction?: (action: EquipmentAction) => void;
}

export function CreatureOuterDiv({
  creature,
  isCompressed,
  style,
  onTapCard,
  onCardHoverStart,
  onCardHoverEnd,
  onEquipmentAction,
}: CreatureOuterDivProps) {
  const N = creature.attachments.length;
  const widthVh = computeOuterDivWidthVh(creature.isTapped, N);
  const heightVh = computeOuterDivHeightVh(creature.isTapped, N);
  const [isFannedOut, setIsFannedOut] = useState(false);
  const [fanPosition, setFanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const outerRef = useRef<HTMLDivElement>(null);

  const grantedKeywords: KeywordAbility[] = [];
  for (const att of creature.attachments) {
    const kws = parseKeywords(att.card.oracleText);
    for (const kw of kws) {
      if (!grantedKeywords.includes(kw)) grantedKeywords.push(kw);
    }
  }

  const attachmentRowCards = creature.attachments.map((att) =>
    createRowCard(att.card, creature.rowAssignment, 0)
  );
  const effectiveStats = calculateEffectiveStats(creature, attachmentRowCards);
  const hasModifiedStats =
    effectiveStats.modifiedPower !== effectiveStats.basePower ||
    effectiveStats.modifiedToughness !== effectiveStats.baseToughness;

  const outerStyle: React.CSSProperties = {
    width: `${widthVh}vh`,
    height: `${heightVh}vh`,
    transform: creature.isTapped ? 'rotate(90deg)' : undefined,
    transformOrigin: 'center center',
    transition: 'transform 200ms ease',
    position: 'relative',
    ...style,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.altKey && N > 0) {
      e.stopPropagation();
      if (outerRef.current) {
        const rect = outerRef.current.getBoundingClientRect();
        setFanPosition({ x: rect.left, y: rect.bottom + 4 });
      }
      setIsFannedOut((prev) => !prev);
      return;
    }
    onTapCard(creature.instanceId);
  };

  return (
    <div
      ref={outerRef}
      style={outerStyle}
      onClick={handleClick}
      className="flex-shrink-0"
    >
      {!isFannedOut && creature.attachments.map((attachment, index) => (
        <div
          key={attachment.instanceId}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', left: `${index * 2}vh`, top: 0, zIndex: computeZIndex('equipment', N, index) }}
        >
          <div style={{ position: 'relative', width: '11.43vh', height: '16vh' }}>
            <DraggableCard card={attachment.card} sourceZone="battlefield" isTapped={false} className="opacity-80 !z-0" />
            <div className="absolute top-0 left-0 h-full flex items-center justify-center pointer-events-none" style={{ width: '2vh', zIndex: 1 }}>
              <span className="text-white bg-gray-800/90 text-[1.2vh] font-semibold px-[0.3vh] py-[0.2vh] rounded whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '14vh', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {attachment.card.name}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Creature wrapper — z-index N, contains card + all overlays */}
      <div style={{ position: 'absolute', left: `${N * 2}vh`, top: 0, width: '11.43vh', height: '16vh', zIndex: N }}>
        <img
          src={creature.isFaceDown ? '/card-back.webp' : creature.showingBackFace && creature.card.backFaceImageURI ? creature.card.backFaceImageURI : creature.card.imageURI}
          alt={creature.isFaceDown ? 'Face-down card' : creature.card.name}
          className="w-full h-full rounded-md pointer-events-none object-cover !z-0"
          draggable={false}
        />

        {/* Overlays — static z-2, always above creature card image */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          {grantedKeywords.length > 0 && (
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex flex-wrap gap-[0.3vh] justify-center" style={{ maxWidth: '10vh', transform: creature.isTapped ? 'rotate(-90deg)' : undefined, transition: 'transform 200ms ease' }}>
              {grantedKeywords.map((kw) => (
                <span key={kw} className="bg-purple-900/80 text-purple-200 text-[0.9vh] font-bold px-[0.4vh] py-[0.1vh] rounded-sm shadow">{kw}</span>
              ))}
            </div>
          )}
          {creature.counters.length > 0 && (
            <div className="absolute top-[5%] left-1/2 -translate-x-1/2 flex flex-wrap gap-[0.3vh] justify-center" style={{ maxWidth: '10vh' }}>
              {creature.counters.map((counter, idx) => (
                <span key={`${counter.type}-${idx}`} className="bg-black/80 text-white font-bold rounded shadow inline-block" style={{ fontSize: '1.1vh', padding: '0.2vh 0.5vh' }}>
                  {counter.type === '+1/+1' || counter.type === '-1/-1' ? `${counter.type} ×${counter.value}` : `${counter.type}: ${counter.value}`}
                </span>
              ))}
            </div>
          )}
          {isCompressed && (
            <div className="absolute top-0 left-0 h-full flex flex-col items-center justify-center" style={{ width: '2.2vh' }}>
              {creature.card.cardType === 'creature' && (creature.showingBackFace ? creature.card.backFacePower : creature.card.basePower) != null && (
                <span className="text-yellow-300 font-bold whitespace-nowrap bg-gray-900/90 px-[0.3vh] py-[0.2vh] rounded-sm shadow" style={{ fontSize: '1.2vh', writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', flexShrink: 0 }}>
                  {N > 0 ? `${effectiveStats.modifiedPower}/${effectiveStats.modifiedToughness}` : creature.showingBackFace ? `${creature.card.backFacePower}/${creature.card.backFaceToughness}` : `${creature.card.basePower}/${creature.card.baseToughness}`}
                </span>
              )}
              <span className="text-white font-bold whitespace-nowrap bg-gray-900/90 px-[0.3vh] py-[0.2vh] rounded-sm shadow" style={{ fontSize: '1vh', writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minHeight: 0 }}>
                {creature.showingBackFace && creature.card.backFaceName ? creature.card.backFaceName : creature.card.name}
              </span>
            </div>
          )}
          {hasModifiedStats && (
            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1 py-0.5 rounded" aria-label={`Modified stats: ${effectiveStats.modifiedPower}/${effectiveStats.modifiedToughness}`}>
              {effectiveStats.modifiedPower}/{effectiveStats.modifiedToughness}
            </div>
          )}
        </div>
      </div>

      {isFannedOut && N > 0 && (
        <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setIsFannedOut(false); }}>
          <div className="fixed flex gap-3 z-[9999] bg-gray-900/95 p-3 rounded-xl shadow-2xl border border-gray-700" style={{ left: `${Math.min(fanPosition.x, window.innerWidth - 300)}px`, top: `${Math.min(fanPosition.y, window.innerHeight - 200)}px` }} onClick={(e) => e.stopPropagation()} role="group" aria-label="Fanned equipment attachments">
            {creature.attachments.map((attachment) => (
              <FannedCard key={attachment.instanceId} attachment={attachment} onAction={onEquipmentAction} onClose={() => { if (N <= 1) setIsFannedOut(false); }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FannedCard({ attachment, onAction, onClose }: {
  attachment: { card: import('../types').CardData; instanceId: string; isTapped: boolean };
  onAction?: (action: EquipmentAction) => void;
  onClose: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  return (
    <div className="relative flex flex-col items-center gap-1">
      <div className="w-[70px] h-[98px]">
        <DraggableCard card={attachment.card} sourceZone="battlefield" isTapped={false} className="w-full h-full" />
      </div>
      <span className="text-white text-[9px] font-medium text-center truncate max-w-[70px]">{attachment.card.name}</span>
      <div className="flex flex-col gap-0.5 w-full relative">
        <button className="text-gray-200 hover:text-white text-[9px] font-medium bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded transition-colors w-full text-center" onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}>Move to ▾</button>
        {showMoveMenu && (
          <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-lg z-10 flex flex-col">
            <button className="text-gray-200 hover:text-white text-[9px] hover:bg-gray-700 px-2 py-1 text-left" onClick={(e) => { e.stopPropagation(); onAction?.({ type: 'MOVE_TO', equipmentId: attachment.instanceId, destination: 'hand' }); onClose(); }}>Hand</button>
            <button className="text-gray-200 hover:text-white text-[9px] hover:bg-gray-700 px-2 py-1 text-left" onClick={(e) => { e.stopPropagation(); onAction?.({ type: 'MOVE_TO', equipmentId: attachment.instanceId, destination: 'graveyard' }); onClose(); }}>Graveyard</button>
            <button className="text-gray-200 hover:text-white text-[9px] hover:bg-gray-700 px-2 py-1 text-left" onClick={(e) => { e.stopPropagation(); onAction?.({ type: 'MOVE_TO', equipmentId: attachment.instanceId, destination: 'exile' }); onClose(); }}>Exile</button>
          </div>
        )}
        <button className="text-blue-300 hover:text-blue-200 text-[9px] font-medium bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded transition-colors w-full text-center" onClick={(e) => { e.stopPropagation(); onAction?.({ type: 'EQUIP_TO', equipmentId: attachment.instanceId }); onClose(); }}>Equip to...</button>
      </div>
    </div>
  );
}
