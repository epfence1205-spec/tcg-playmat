import type { Counter, KeywordAbility, HDZoomPortalProps } from '../types';

/**
 * Color mapping for keyword ability badges.
 * Each keyword gets a distinct background color for quick visual identification.
 */
const KEYWORD_COLORS: Record<KeywordAbility, string> = {
  flying: 'bg-sky-500',
  trample: 'bg-green-600',
  haste: 'bg-red-500',
  vigilance: 'bg-yellow-500',
  lifelink: 'bg-white text-gray-900',
  deathtouch: 'bg-emerald-800',
  hexproof: 'bg-blue-600',
  indestructible: 'bg-amber-600',
  menace: 'bg-purple-600',
  reach: 'bg-lime-600',
  first_strike: 'bg-orange-500',
  double_strike: 'bg-orange-700',
  flash: 'bg-cyan-400 text-gray-900',
  defender: 'bg-stone-500',
  ward: 'bg-indigo-500',
  shroud: 'bg-teal-600',
  protection: 'bg-zinc-400 text-gray-900',
};

/**
 * Formats a keyword ability for display (replaces underscores with spaces, title case).
 */
function formatKeyword(keyword: KeywordAbility): string {
  return keyword
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a counter for display.
 */
function formatCounter(counter: Counter): string {
  return `${counter.type}: ${counter.value}`;
}

/**
 * HDZoomPortal — High-resolution card preview displayed on hover.
 *
 * Positioned absolutely on the right side of Zone C (the private hand tray).
 * Shows the large card image along with keyword badges, counter values,
 * and attachment list. Constrained to the bottom 20vh to never overflow
 * above the OBS crop line.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.7
 */
export function HDZoomPortal({ card, keywords, counters, attachments }: HDZoomPortalProps) {
  const isVisible = card !== null;

  return (
    <div
      className={`
        absolute right-2 top-0 bottom-0
        flex items-center gap-2
        pointer-events-none
        transition-opacity duration-200 ease-in-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
      style={{
        maxHeight: '20vh',
        zIndex: 100,
      }}
      data-obs-zone="below"
      data-testid="hd-zoom-portal"
      aria-hidden={!isVisible}
      role="img"
      aria-label={card ? `High-resolution preview of ${card.name}` : undefined}
    >
      {card && (
        <>
          {/* High-res card image */}
          <img
            src={card.imageURILarge}
            alt={card.name}
            className="h-full w-auto rounded-lg shadow-lg object-contain"
            style={{ maxHeight: '20vh' }}
            draggable={false}
          />

          {/* Info panel: keywords, counters, attachments */}
          <div
            className="flex flex-col gap-1 overflow-y-auto py-1"
            style={{ maxHeight: '20vh' }}
          >
            {/* Keyword ability badges */}
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className={`
                      px-1.5 py-0.5 rounded text-[10px] font-semibold
                      leading-tight whitespace-nowrap
                      ${KEYWORD_COLORS[kw]}
                    `}
                  >
                    {formatKeyword(kw)}
                  </span>
                ))}
              </div>
            )}

            {/* Counter values */}
            {counters.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {counters.map((counter, idx) => (
                  <span
                    key={`${counter.type}-${idx}`}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono
                      bg-gray-700 text-gray-100 whitespace-nowrap"
                  >
                    {formatCounter(counter)}
                  </span>
                ))}
              </div>
            )}

            {/* Attachment list */}
            {attachments.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-400 uppercase tracking-wide">
                  Attached
                </span>
                {attachments.map((att) => (
                  <span
                    key={att.id}
                    className="text-[10px] text-gray-200 truncate max-w-[120px]"
                    title={att.name}
                  >
                    {att.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
