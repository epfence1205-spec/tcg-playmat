import type { RowCard } from '../types';

export interface StreamCardProps {
  rowCard: RowCard;
}

/**
 * Static card renderer for the stream view.
 * No pointer events, no hover states, no drag handles.
 * Renders card image with tap rotation, counter badges,
 * equipment attachments with cascade offset, and mutate stack indicators.
 *
 * Uses vh-based sizing matching the player view's RotationDiv:
 * - Card: 11.43vh wide × 16vh tall
 * - Equipment: same size, cascaded 2vh offset
 */
export function StreamCard({ rowCard }: StreamCardProps) {
  const { card, isTapped, isFaceDown, showingBackFace, counters, attachments, mutateStack } = rowCard;

  // Determine which image to display
  let imageSrc: string;
  if (isFaceDown) {
    imageSrc = '/card-back.webp';
  } else if (showingBackFace && card.backFaceImageURI) {
    imageSrc = card.backFaceImageURI;
  } else {
    imageSrc = card.imageURI;
  }

  // Filter counters with non-zero values
  const activeCounters = counters.filter((c) => c.value !== 0);

  // Compute outer width: base card + equipment cascade (each attachment offsets 2vh left)
  const N = attachments.length;
  const outerWidthVh = 11.43 + N * 2;
  const outerHeightVh = 16;

  return (
    <div
      className="relative pointer-events-none select-none"
      style={{
        width: `${outerWidthVh}vh`,
        height: `${outerHeightVh}vh`,
        transform: isTapped ? 'rotate(90deg)' : undefined,
        transformOrigin: 'center center',
      }}
    >
      {/* Equipment attachments — rendered behind the main card */}
      {attachments.map((att, idx) => (
        <div
          key={att.instanceId}
          className="absolute top-0"
          style={{ left: `${idx * 2}vh`, width: '11.43vh', height: '16vh', zIndex: idx }}
        >
          <img
            src={att.card.imageURI}
            alt={att.card.name}
            className="w-full h-full object-cover rounded-md opacity-80"
            draggable={false}
          />
        </div>
      ))}

      {/* Main card image — on top of equipment */}
      <div
        className="absolute top-0"
        style={{ left: `${N * 2}vh`, width: '11.43vh', height: '16vh', zIndex: N }}
      >
        <img
          src={imageSrc}
          alt={card.name}
          className="w-full h-full object-cover rounded-md"
          draggable={false}
        />

        {/* Counter badges */}
        {activeCounters.length > 0 && (
          <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 flex flex-wrap gap-[0.3vh] justify-center" style={{ maxWidth: '10vh' }}>
            {activeCounters.map((counter, idx) => (
              <span
                key={`${counter.type}-${idx}`}
                className="bg-black/80 text-white font-bold rounded shadow inline-block"
                style={{ fontSize: '1.1vh', padding: '0.2vh 0.5vh' }}
              >
                {counter.type}: {counter.value}
              </span>
            ))}
          </div>
        )}

        {/* Mutate stack indicator */}
        {mutateStack.length > 0 && (
          <span
            className="absolute top-[3%] right-[5%] bg-purple-600 text-white font-bold rounded-full"
            style={{ fontSize: '1.1vh', padding: '0.2vh 0.6vh' }}
          >
            ×{mutateStack.length + 1}
          </span>
        )}
      </div>
    </div>
  );
}
