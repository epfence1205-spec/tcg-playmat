import { useState, useRef } from 'react';
import type { RowCard, KeywordAbility } from '../types';
import { DraggableCard } from './DraggableCard';
import { computeOuterDivWidthVh, computeOuterDivHeightVh, computeZIndex } from '../creatureLayout';
import { calculateEffectiveStats } from '../keywords';
import { computeGrantedKeywords } from '../oracleClassifier';
import { CARD_BACK_URL } from '../cardBack';
import { createRowCard } from '../gameActions';
import { aggregateMutateKeywords } from '../mutateActions';
import type { EquipmentAction } from './EquipmentDock';

export interface RotationDivProps {
  creature: RowCard;
  isCompressed: boolean;
  style?: React.CSSProperties;
  onTapCard: (cardId: string) => void;
  onEquipmentAction?: (action: EquipmentAction) => void;
  /** When true, skip onTapCard — SortableCardWrapper handles batch tap */
  isSelected?: boolean;
}

export function RotationDiv({
  creature,
  isCompressed,
  style,
  onTapCard,
  onEquipmentAction,
  isSelected,
}: RotationDivProps) {
  const N = creature.attachments.length;
  const widthVh = computeOuterDivWidthVh(creature.isTapped, N);
  const heightVh = computeOuterDivHeightVh(creature.isTapped, N);
  const [isFannedOut, setIsFannedOut] = useState(false);
  const [isMutateFannedOut, setIsMutateFannedOut] = useState(false);
  const [fanPosition, setFanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const outerRef = useRef<HTMLDivElement>(null);

  const grantedKeywords: KeywordAbility[] = [];
  if (creature.mutateStack && creature.mutateStack.length > 0) {
    // Mutated creature: aggregate keywords from all cards in the stack + equipment
    for (const kw of aggregateMutateKeywords(creature)) {
      grantedKeywords.push(kw);
    }
    // Also include equipment-granted keywords (uses two-phase classifier)
    for (const att of creature.attachments) {
      const kws = computeGrantedKeywords(att.card.oracleText);
      for (const kw of kws) {
        if (!grantedKeywords.includes(kw as KeywordAbility)) grantedKeywords.push(kw as KeywordAbility);
      }
    }
  } else {
    // Non-mutated creature: only equipment-granted keywords (uses two-phase classifier)
    for (const att of creature.attachments) {
      const kws = computeGrantedKeywords(att.card.oracleText);
      for (const kw of kws) {
        if (!grantedKeywords.includes(kw as KeywordAbility)) grantedKeywords.push(kw as KeywordAbility);
      }
    }
  }

  const attachmentRowCards = creature.attachments.map((att) =>
    createRowCard(att.card, creature.rowAssignment, 0)
  );
  const effectiveStats = calculateEffectiveStats(creature, attachmentRowCards);

  // Counter modifiers: +1/+1 adds, -1/-1 subtracts
  const plus1Count = creature.counters
    .filter((c) => c.type === '+1/+1')
    .reduce((sum, c) => sum + c.value, 0);
  const minus1Count = creature.counters
    .filter((c) => c.type === '-1/-1')
    .reduce((sum, c) => sum + c.value, 0);

  // Determine if basePower/baseToughness is non-numeric (e.g., "*")
  const topBasePower = creature.card.basePower;
  const topBaseToughness = creature.card.baseToughness;
  const isNumericPower = topBasePower != null && !isNaN(parseInt(topBasePower, 10));
  const isNumericToughness = topBaseToughness != null && !isNaN(parseInt(topBaseToughness, 10));

  // Final displayed stats: if non-numeric, show raw value without modifiers
  const displayedPower = isNumericPower
    ? effectiveStats.modifiedPower + plus1Count - minus1Count + (creature.powerModifier ?? 0)
    : topBasePower;
  const displayedToughness = isNumericToughness
    ? effectiveStats.modifiedToughness + plus1Count - minus1Count + (creature.toughnessModifier ?? 0)
    : topBaseToughness;

  const hasModifiedStats =
    (isNumericPower && displayedPower !== effectiveStats.basePower) ||
    (isNumericToughness && displayedToughness !== effectiveStats.baseToughness);

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
    if (e.altKey && creature.mutateStack && creature.mutateStack.length > 0) {
      e.stopPropagation();
      if (outerRef.current) {
        const rect = outerRef.current.getBoundingClientRect();
        setFanPosition({ x: rect.left, y: rect.bottom + 4 });
      }
      setIsMutateFannedOut((prev) => !prev);
      return;
    }
    // Ctrl+Click is handled by SortableCardWrapper for selection toggle — don't tap
    if (e.ctrlKey || e.metaKey) return;
    // If card is selected, SortableCardWrapper handles batch tap — don't tap individually
    if (isSelected) return;
    onTapCard(creature.instanceId);
  };

  return (
    <div
      ref={outerRef}
      style={outerStyle}
      onClick={handleClick}
      className="flex-shrink-0"
      data-card-id={creature.instanceId}
      data-card-zone="battlefield"
      aria-label={creature.isFaceDown ? 'Face-down card' : `${creature.card.name} in battlefield`}
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
      <div className="bg-black rounded-lg overflow-hidden" style={{ position: 'absolute', left: `${N * 2}vh`, top: 0, width: '11.43vh', height: '16vh', zIndex: N }}>
        <img
          src={creature.isFaceDown ? CARD_BACK_URL : creature.showingBackFace && creature.card.backFaceImageURI ? creature.card.backFaceImageURI : creature.card.imageURI}
          alt={creature.isFaceDown ? 'Face-down card' : creature.card.name}
          className="w-full h-full pointer-events-none object-cover !z-0"
          draggable={false}
        />

        {/* Overlays — static z-2, always above creature card image */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          {creature.mutateStack && creature.mutateStack.length > 0 && (
            <span className="absolute top-0 right-0 bg-indigo-600/90 text-white text-[0.9vh] font-bold px-[0.4vh] py-[0.1vh] rounded-sm shadow">
              {1 + creature.mutateStack.length}
            </span>
          )}
          {/* Keyword badges — granted keywords + keyword counters, unified purple style */}
          {(() => {
            const KEYWORD_COUNTER_TYPES = new Set(['lifelink', 'hexproof', 'indestructible', 'shroud', 'flying', 'deathtouch', 'menace', 'trample', 'first_strike', 'double_strike', 'reach', 'vigilance', 'haste']);
            const keywordCounters = creature.counters.filter(c => KEYWORD_COUNTER_TYPES.has(c.type) && c.value > 0);
            const allKeywords = [...grantedKeywords];
            for (const kc of keywordCounters) {
              if (!allKeywords.includes(kc.type as any)) allKeywords.push(kc.type as any);
            }
            const numericCounters = creature.counters.filter(c => !KEYWORD_COUNTER_TYPES.has(c.type) && c.value !== 0);

            return (
              <>
                {allKeywords.length > 0 && (
                  <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex flex-wrap gap-[0.3vh] justify-center" style={{ maxWidth: '10vh', transform: creature.isTapped ? 'rotate(-90deg)' : undefined, transition: 'transform 200ms ease' }}>
                    {allKeywords.map((kw) => (
                      <span key={kw} className="bg-purple-900/80 text-purple-200 text-[0.9vh] font-bold px-[0.4vh] py-[0.1vh] rounded-sm shadow">{kw}</span>
                    ))}
                  </div>
                )}
                {numericCounters.length > 0 && (
                  <div className="absolute bottom-[5%] left-[5%] flex flex-wrap gap-[0.3vh]" style={{ maxWidth: '8vh' }}>
                    {(() => {
                      // Net +1/+1 and -1/-1 counters against each other
                      const plus = numericCounters.find(c => c.type === '+1/+1');
                      const minus = numericCounters.find(c => c.type === '-1/-1');
                      const plusVal = plus ? plus.value : 0;
                      const minusVal = minus ? minus.value : 0;
                      const net = plusVal - minusVal;
                      const otherCounters = numericCounters.filter(c => c.type !== '+1/+1' && c.type !== '-1/-1');

                      const badges: { label: string; key: string }[] = [];
                      if (net > 0) badges.push({ label: `+1/+1 ×${net}`, key: '+1/+1' });
                      else if (net < 0) badges.push({ label: `-1/-1 ×${Math.abs(net)}`, key: '-1/-1' });
                      for (const c of otherCounters) {
                        badges.push({ label: `${c.type}: ${c.value}`, key: `${c.type}-${c.value}` });
                      }

                      return badges.map((b) => (
                        <span key={b.key} className="bg-black/80 text-white font-bold rounded shadow inline-block" style={{ fontSize: '1.1vh', padding: '0.2vh 0.5vh' }}>
                          {b.label}
                        </span>
                      ));
                    })()}
                  </div>
                )}
              </>
            );
          })()}
          {isCompressed && (
            <div className="absolute top-0 left-0 h-full flex flex-col items-center justify-center" style={{ width: '2.2vh' }}>
              <span className="text-white font-bold whitespace-nowrap bg-gray-900/90 px-[0.3vh] py-[0.2vh] rounded-sm shadow" style={{ fontSize: '1vh', writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minHeight: 0 }}>
                {creature.showingBackFace && creature.card.backFaceName ? creature.card.backFaceName : creature.card.name}
              </span>
              {creature.card.cardType === 'creature' && (creature.showingBackFace ? creature.card.backFacePower : creature.card.basePower) != null && (
                <span className="text-yellow-300 font-bold whitespace-nowrap bg-gray-900/90 px-[0.3vh] py-[0.2vh] rounded-sm shadow" style={{ fontSize: '1.2vh', writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', flexShrink: 0 }}>
                  {creature.showingBackFace ? `${creature.card.backFacePower}/${creature.card.backFaceToughness}` : `${displayedPower}/${displayedToughness}`}
                </span>
              )}
            </div>
          )}
          {hasModifiedStats && (
            <div className="absolute bottom-[5%] right-[5%] bg-black/80 text-white font-bold rounded shadow" style={{ fontSize: '1.4vh', padding: '0.3vh 0.6vh' }} aria-label={`Modified stats: ${displayedPower}/${displayedToughness}`}>
              {displayedPower}/{displayedToughness}
            </div>
          )}
          {creature.card.isTokenCopy && (
            <div className="absolute top-[38%] left-1/2 -translate-x-1/2 bg-black/70 text-white text-[9px] font-bold px-1 py-0.5 rounded">
              TOKEN
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

      {isMutateFannedOut && creature.mutateStack && creature.mutateStack.length > 0 && (
        <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setIsMutateFannedOut(false); }}>
          <div
            className="fixed flex z-[9999] bg-gray-900/95 p-3 rounded-xl shadow-2xl border border-indigo-700"
            style={{ left: `${Math.min(fanPosition.x, window.innerWidth - 300)}px`, top: `${Math.min(fanPosition.y, window.innerHeight - 200)}px` }}
            onClick={(e) => e.stopPropagation()}
            role="group"
            aria-label="Fanned mutate stack"
          >
            {[creature.card, ...creature.mutateStack].map((card, index) => (
              <div
                key={`${card.id}-${index}`}
                className="relative flex-shrink-0"
                style={{ marginLeft: index === 0 ? 0 : '-56px', zIndex: index + 1 }}
                data-card-id={card.id}
                data-card-zone="battlefield"
              >
                <img
                  src={card.imageURI}
                  alt={card.name}
                  className="w-[70px] h-[98px] rounded-md object-cover pointer-events-none"
                  draggable={false}
                />
                <span className="absolute bottom-0 left-0 right-0 text-white text-[8px] font-medium text-center truncate bg-black/70 px-0.5 py-0.5 rounded-b-md">
                  {card.name}
                </span>
              </div>
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
