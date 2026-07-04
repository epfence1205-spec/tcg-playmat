import type { RowCard, KeywordAbility } from '../types';
import { parseKeywords, calculateEffectiveStats } from '../keywords';
import { createRowCard } from '../gameActions';
import { computeOuterDivWidthVh, computeOuterDivHeightVh } from '../creatureLayout';
import { CARD_BACK_URL } from '../cardBack';

export interface StreamCardProps {
  rowCard: RowCard;
  isCompressed?: boolean;
}

/**
 * Aggregates keywords from a mutate stack (all cards contribute keywords).
 */
function aggregateStreamMutateKeywords(creature: RowCard): KeywordAbility[] {
  const kws: KeywordAbility[] = [];
  for (const kw of creature.card.keywords) {
    if (!kws.includes(kw)) kws.push(kw);
  }
  for (const stackCard of creature.mutateStack) {
    for (const kw of stackCard.keywords) {
      if (!kws.includes(kw)) kws.push(kw);
    }
  }
  return kws;
}

/**
 * StreamCard — Read-only mirror of RotationDiv.
 *
 * Mechanically copies RotationDiv's rendering:
 * - Same vh sizing (computeOuterDivWidthVh/HeightVh)
 * - Same equipment cascade (2vh offset, name banners)
 * - Same overlay badges (keyword, counters, P/T, mutate, token)
 * - Same bg-black rounded-lg overflow-hidden on card wrapper
 * - Same compressed name/PT banner
 *
 * Stripped: click handlers, hover, DraggableCard, fan-out overlays, useState.
 */
export function StreamCard({ rowCard: creature, isCompressed = false }: StreamCardProps) {
  const N = creature.attachments.length;
  const widthVh = computeOuterDivWidthVh(creature.isTapped, N);
  const heightVh = computeOuterDivHeightVh(creature.isTapped, N);

  // Granted keywords — same logic as RotationDiv
  const grantedKeywords: KeywordAbility[] = [];
  if (creature.mutateStack && creature.mutateStack.length > 0) {
    for (const kw of aggregateStreamMutateKeywords(creature)) {
      grantedKeywords.push(kw);
    }
    for (const att of creature.attachments) {
      const kws = parseKeywords(att.card.oracleText);
      for (const kw of kws) {
        if (!grantedKeywords.includes(kw)) grantedKeywords.push(kw);
      }
    }
  } else {
    for (const att of creature.attachments) {
      const kws = parseKeywords(att.card.oracleText);
      for (const kw of kws) {
        if (!grantedKeywords.includes(kw)) grantedKeywords.push(kw);
      }
    }
  }

  // Effective stats — same logic as RotationDiv
  const attachmentRowCards = creature.attachments.map((att) =>
    createRowCard(att.card, creature.rowAssignment, 0)
  );
  const effectiveStats = calculateEffectiveStats(creature, attachmentRowCards);

  const plus1Count = creature.counters
    .filter((c) => c.type === '+1/+1')
    .reduce((sum, c) => sum + c.value, 0);
  const minus1Count = creature.counters
    .filter((c) => c.type === '-1/-1')
    .reduce((sum, c) => sum + c.value, 0);

  const topBasePower = creature.card.basePower;
  const topBaseToughness = creature.card.baseToughness;
  const isNumericPower = topBasePower != null && !isNaN(parseInt(topBasePower, 10));
  const isNumericToughness = topBaseToughness != null && !isNaN(parseInt(topBaseToughness, 10));

  const displayedPower = isNumericPower
    ? effectiveStats.modifiedPower + plus1Count - minus1Count + (creature.powerModifier ?? 0)
    : topBasePower;
  const displayedToughness = isNumericToughness
    ? effectiveStats.modifiedToughness + plus1Count - minus1Count + (creature.toughnessModifier ?? 0)
    : topBaseToughness;

  const hasModifiedStats =
    (isNumericPower && displayedPower !== effectiveStats.basePower) ||
    (isNumericToughness && displayedToughness !== effectiveStats.baseToughness);

  // Image source
  const imageSrc = creature.isFaceDown
    ? CARD_BACK_URL
    : creature.showingBackFace && creature.card.backFaceImageURI
      ? creature.card.backFaceImageURI
      : creature.card.imageURI;

  return (
    <div
      className="relative pointer-events-none select-none flex-shrink-0"
      style={{
        width: `${widthVh}vh`,
        height: `${heightVh}vh`,
        transform: creature.isTapped ? 'rotate(90deg)' : undefined,
        transformOrigin: 'center center',
        transition: 'transform 200ms ease',
      }}
    >
      {/* Equipment attachments — same as RotationDiv */}
      {creature.attachments.map((attachment, index) => (
        <div
          key={attachment.instanceId}
          style={{ position: 'absolute', left: `${index * 2}vh`, top: 0, zIndex: index }}
        >
          <div style={{ position: 'relative', width: '11.43vh', height: '16vh' }}>
            <img
              src={attachment.card.imageURI}
              alt={attachment.card.name}
              className="w-full h-full object-cover rounded-md opacity-80"
              draggable={false}
            />
            <div className="absolute top-0 left-0 h-full flex items-center justify-center pointer-events-none" style={{ width: '2vh', zIndex: 1 }}>
              <span className="text-white bg-gray-800/90 text-[1.2vh] font-semibold px-[0.3vh] py-[0.2vh] rounded whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '14vh', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {attachment.card.name}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Creature wrapper — same as RotationDiv */}
      <div className="bg-black rounded-lg overflow-hidden" style={{ position: 'absolute', left: `${N * 2}vh`, top: 0, width: '11.43vh', height: '16vh', zIndex: N }}>
        <img
          src={imageSrc}
          alt={creature.isFaceDown ? 'Face-down card' : creature.card.name}
          className="w-full h-full pointer-events-none object-cover !z-0"
          draggable={false}
        />

        {/* Overlays — same as RotationDiv */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          {creature.mutateStack && creature.mutateStack.length > 0 && (
            <span className="absolute top-0 right-0 bg-indigo-600/90 text-white text-[0.9vh] font-bold px-[0.4vh] py-[0.1vh] rounded-sm shadow">
              {1 + creature.mutateStack.length}
            </span>
          )}
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
            <div className="absolute bottom-[5%] right-[5%] bg-black/80 text-white font-bold rounded shadow" style={{ fontSize: '1.4vh', padding: '0.3vh 0.6vh' }}>
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
    </div>
  );
}
