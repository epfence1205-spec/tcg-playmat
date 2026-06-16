import { useEffect, useRef, useState, useCallback } from 'react';
import type { Zone, CardType, CounterType } from '../types';

// ─── Context Menu Action Types ───────────────────────────────────────────────

export type ContextMenuAction =
  | { type: 'TAP' }
  | { type: 'MOVE_TO'; destination: Zone | 'top-library' | 'bottom-library' | 'shuffle-library' }
  | { type: 'FLIP' }
  | { type: 'TRANSFORM' }
  | { type: 'MORPH' }
  | { type: 'PHASE' }
  | { type: 'ADD_COUNTER'; counterType: CounterType }
  | { type: 'REMOVE_COUNTER'; counterType: CounterType }
  | { type: 'ADD_POWER'; amount: number }
  | { type: 'ADD_TOUGHNESS'; amount: number }
  | { type: 'RESET_PT' }
  | { type: 'EQUIP' }
  | { type: 'DETACH' }
  | { type: 'VIEW_DETAILS' }
  | { type: 'TOKEN_COPY'; quantity: number }
  | { type: 'DELETE' }
  | { type: 'REVEAL' }
  | { type: 'PLAY_TO_BATTLEFIELD' }
  | { type: 'PLAY_TAPPED' }
  | { type: 'PLAY_FACE_DOWN' }
  | { type: 'PLAY_AS_BACK_FACE' }
  | { type: 'MUTATE_ONTO' }
  | { type: 'SPLIT_MUTATE_STACK' };

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  cardId: string;
  cardZone: Zone;
  cardType: CardType;
  isEquipment: boolean;
  isDocked: boolean;
  isDFC: boolean;
  hasMutateKeyword?: boolean;
  hasMutateStack?: boolean;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
}

// ─── Counter Types Grid ──────────────────────────────────────────────────────

const ALL_COUNTER_TYPES: CounterType[] = [
  '+1/+1', '-1/-1', 'lifelink', 'hexproof', 'indestructible', 'shroud',
  'time', 'charge', 'generic', 'loyalty', 'flying', 'deathtouch',
  'menace', 'trample', 'first_strike', 'double_strike', 'reach',
  'vigilance', 'token', 'lore', 'shield', 'haste', 'custom',
];

// ─── Submenu Types ───────────────────────────────────────────────────────────

type SubmenuId = 'move-to' | 'card-actions' | 'counters' | 'remove-counters' | 'power' | 'toughness' | 'pt-combined' | 'token-copy' | null;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ContextMenu — Right-click context menu for card interactions.
 *
 * Renders at cursor position on right-click. Adapts menu items based on
 * the card's current zone and type. Mirrors Archidekt's menu structure
 * with equip/detach additions.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7
 */
export function ContextMenu({
  isOpen,
  position,
  cardZone,
  cardType: _cardType,
  isEquipment,
  isDocked,
  isDFC,
  hasMutateKeyword = false,
  hasMutateStack = false,
  onAction,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId>(null);
  const submenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delayed submenu close — gives time to move mouse to submenu
  const openSubmenu = useCallback((id: SubmenuId) => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
    setActiveSubmenu(id);
  }, []);

  const closeSubmenuDelayed = useCallback(() => {
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 150);
  }, []);

  // ─── Dismiss on click-away ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Reset submenu when menu closes
  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenu(null);
    }
  }, [isOpen]);

  const handleAction = useCallback((action: ContextMenuAction) => {
    onAction(action);
    onClose();
  }, [onAction, onClose]);

  if (!isOpen) return null;

  // ─── Render Helpers ────────────────────────────────────────────────────────

  const renderMenuItem = (
    label: string,
    shortcut: string | null,
    onClick: () => void,
    variant: 'default' | 'danger' = 'default'
  ) => (
    <button
      type="button"
      className={`w-full flex items-center justify-between px-3 py-1.5 text-sm text-left rounded transition-colors ${
        variant === 'danger'
          ? 'text-red-400 hover:bg-red-900/40'
          : 'text-gray-200 hover:bg-gray-700'
      }`}
      onClick={onClick}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="ml-4 text-xs text-gray-500">{shortcut}</span>
      )}
    </button>
  );

  const renderSubmenuTrigger = (label: string, submenuId: SubmenuId) => (
    <button
      type="button"
      className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-gray-200 text-left rounded hover:bg-gray-700 transition-colors"
      onMouseEnter={() => openSubmenu(submenuId)}
      onClick={() => setActiveSubmenu(activeSubmenu === submenuId ? null : submenuId)}
    >
      <span>{label}</span>
      <span className="text-xs text-gray-500">▸</span>
    </button>
  );

  const renderDivider = () => (
    <div className="border-t border-gray-700 my-1" />
  );

  // ─── Move To Submenu ───────────────────────────────────────────────────────

  const renderMoveToSubmenu = () => {
    if (activeSubmenu !== 'move-to') return null;

    if (cardZone === 'battlefield') {
      return (
        <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-[60]`}>
          {renderMenuItem('Hand', 'H', () => handleAction({ type: 'MOVE_TO', destination: 'hand' }))}
          {renderMenuItem('Graveyard', 'G', () => handleAction({ type: 'MOVE_TO', destination: 'graveyard' }))}
          {renderMenuItem('Exile', 'E', () => handleAction({ type: 'MOVE_TO', destination: 'exile' }))}
          {renderMenuItem('Command Zone', 'Z', () => handleAction({ type: 'MOVE_TO', destination: 'commandZone' }))}
          {renderDivider()}
          {renderMenuItem('Top of Library', 'Y', () => handleAction({ type: 'MOVE_TO', destination: 'top-library' }))}
          {renderMenuItem('Bottom of Library', 'L', () => handleAction({ type: 'MOVE_TO', destination: 'bottom-library' }))}
          {renderMenuItem('Shuffle into Library', null, () => handleAction({ type: 'MOVE_TO', destination: 'shuffle-library' }))}
        </div>
      );
    }

    if (cardZone === 'hand') {
      return (
        <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-[60]`}>
          {renderMenuItem('Graveyard', 'G', () => handleAction({ type: 'MOVE_TO', destination: 'graveyard' }))}
          {renderMenuItem('Exile', 'E', () => handleAction({ type: 'MOVE_TO', destination: 'exile' }))}
          {renderDivider()}
          {renderMenuItem('Top of Library', 'Y', () => handleAction({ type: 'MOVE_TO', destination: 'top-library' }))}
          {renderMenuItem('Bottom of Library', 'L', () => handleAction({ type: 'MOVE_TO', destination: 'bottom-library' }))}
          {renderMenuItem('Shuffle into Library', null, () => handleAction({ type: 'MOVE_TO', destination: 'shuffle-library' }))}
        </div>
      );
    }

    // Stack zones (commandZone, graveyard, library, exile)
    return (
      <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-[60]`}>
        {renderMenuItem('Hand', 'H', () => handleAction({ type: 'MOVE_TO', destination: 'hand' }))}
        {renderMenuItem('Battlefield', 'B', () => handleAction({ type: 'MOVE_TO', destination: 'battlefield' }))}
        {renderDivider()}
        {cardZone !== 'graveyard' && renderMenuItem('Graveyard', null, () => handleAction({ type: 'MOVE_TO', destination: 'graveyard' }))}
        {cardZone !== 'exile' && renderMenuItem('Exile', null, () => handleAction({ type: 'MOVE_TO', destination: 'exile' }))}
        {cardZone !== 'commandZone' && renderMenuItem('Command Zone', null, () => handleAction({ type: 'MOVE_TO', destination: 'commandZone' }))}
        {cardZone !== 'library' && (
          <>
            {renderDivider()}
            {renderMenuItem('Top of Library', null, () => handleAction({ type: 'MOVE_TO', destination: 'top-library' }))}
            {renderMenuItem('Bottom of Library', null, () => handleAction({ type: 'MOVE_TO', destination: 'bottom-library' }))}
            {renderMenuItem('Shuffle into Library', null, () => handleAction({ type: 'MOVE_TO', destination: 'shuffle-library' }))}
          </>
        )}
      </div>
    );
  };

  // ─── Card Actions Submenu ──────────────────────────────────────────────────

  const renderCardActionsSubmenu = () => {
    if (activeSubmenu !== 'card-actions') return null;

    return (
      <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-[60]`}>
        {renderMenuItem('Flip / Transform', 'F', () => handleAction({ type: 'TRANSFORM' }))}
        {renderMenuItem('Morph face-down', 'M', () => handleAction({ type: 'MORPH' }))}
        {renderMenuItem('Phase out', 'P', () => handleAction({ type: 'PHASE' }))}
        {renderMenuItem('Flip 180°', 'J', () => handleAction({ type: 'FLIP' }))}
      </div>
    );
  };

  // ─── Counters Submenu ──────────────────────────────────────────────────────

  const renderCountersSubmenu = () => {
    if (activeSubmenu !== 'counters') return null;

    return (
      <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 z-[60]`}>
        <div className="grid grid-cols-4 gap-1">
          {ALL_COUNTER_TYPES.map((ct) => (
            <button
              key={ct}
              type="button"
              className="px-1.5 py-1 text-xs text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors truncate"
              title={ct}
              onClick={() => handleAction({ type: 'ADD_COUNTER', counterType: ct })}
            >
              {ct}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ─── Power Submenu ─────────────────────────────────────────────────────────

  const renderPowerSubmenu = () => {
    if (activeSubmenu !== 'power') return null;

    return (
      <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-[60]`}>
        {renderMenuItem('+1 Power', null, () => handleAction({ type: 'ADD_POWER', amount: 1 }))}
        {renderMenuItem('-1 Power', null, () => handleAction({ type: 'ADD_POWER', amount: -1 }))}
      </div>
    );
  };

  // ─── Toughness Submenu ─────────────────────────────────────────────────────

  const renderToughnessSubmenu = () => {
    if (activeSubmenu !== 'toughness') return null;

    return (
      <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-[60]`}>
        {renderMenuItem('+1 Toughness', null, () => handleAction({ type: 'ADD_TOUGHNESS', amount: 1 }))}
        {renderMenuItem('-1 Toughness', null, () => handleAction({ type: 'ADD_TOUGHNESS', amount: -1 }))}
      </div>
    );
  };

  // ─── +X/+X Combined Submenu ────────────────────────────────────────────────

  const renderPTCombinedSubmenu = () => {
    if (activeSubmenu !== 'pt-combined') return null;

    return (
      <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-[60]`}>
        {renderMenuItem('+1/+1', '+', () => handleAction({ type: 'ADD_COUNTER', counterType: '+1/+1' }))}
        {renderMenuItem('-1/-1', '-', () => handleAction({ type: 'ADD_COUNTER', counterType: '-1/-1' }))}
      </div>
    );
  };

  // ─── Token Copy Submenu ────────────────────────────────────────────────────

  const renderTokenCopySubmenu = () => {
    if (activeSubmenu !== 'token-copy') return null;

    return (
      <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 z-[60]`}>
        {[1, 2, 3, 4, 5].map((qty) => (
          <button
            key={qty}
            type="button"
            className="w-full flex items-center px-3 py-1.5 text-sm text-gray-200 text-left rounded hover:bg-gray-700 transition-colors"
            onClick={() => handleAction({ type: 'TOKEN_COPY', quantity: qty })}
          >
            {qty} {qty === 1 ? 'copy' : 'copies'}
          </button>
        ))}
      </div>
    );
  };

  // ─── Battlefield Menu ──────────────────────────────────────────────────────

  const renderBattlefieldMenu = () => (
    <>
      {renderMenuItem('Tap / Untap', 'T', () => handleAction({ type: 'TAP' }))}
      {renderDivider()}
      <div className="relative" onMouseEnter={() => openSubmenu('move-to')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Move to', 'move-to')}
        {renderMoveToSubmenu()}
      </div>
      <div className="relative" onMouseEnter={() => openSubmenu('card-actions')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Card actions', 'card-actions')}
        {renderCardActionsSubmenu()}
      </div>
      {hasMutateKeyword && renderMenuItem('Mutate onto...', null, () => handleAction({ type: 'MUTATE_ONTO' }))}
      {hasMutateStack && renderMenuItem('Split Mutate Stack', null, () => handleAction({ type: 'SPLIT_MUTATE_STACK' }))}
      {renderDivider()}
      <div className="relative" onMouseEnter={() => openSubmenu('counters')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Add counters', 'counters')}
        {renderCountersSubmenu()}
      </div>
      <div className="relative" onMouseEnter={() => openSubmenu('remove-counters')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Remove counters', 'remove-counters')}
        {activeSubmenu === 'remove-counters' && (
          <div className={`${opensLeft ? "absolute right-full top-0 -mr-1 pr-2" : "absolute left-full top-0 -ml-1 pl-2"} w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 z-[60]`}>
            <div className="grid grid-cols-4 gap-1">
              {ALL_COUNTER_TYPES.map((ct) => (
                <button
                  key={ct}
                  className="px-1.5 py-1 text-xs text-gray-200 bg-gray-700 rounded hover:bg-red-600 transition-colors truncate"
                  title={`Remove ${ct}`}
                  onClick={() => handleAction({ type: 'REMOVE_COUNTER', counterType: ct })}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="relative" onMouseEnter={() => openSubmenu('power')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Power +/-', 'power')}
        {renderPowerSubmenu()}
      </div>
      <div className="relative" onMouseEnter={() => openSubmenu('toughness')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Toughness +/-', 'toughness')}
        {renderToughnessSubmenu()}
      </div>
      <div className="relative" onMouseEnter={() => openSubmenu('pt-combined')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('+X/+X', 'pt-combined')}
        {renderPTCombinedSubmenu()}
      </div>
      {renderDivider()}
      {isEquipment && !isDocked && renderMenuItem('Equip / Attach', 'Ctrl+E', () => handleAction({ type: 'EQUIP' }))}
      {isDocked && renderMenuItem('Detach', null, () => handleAction({ type: 'DETACH' }))}
      {renderMenuItem('View details', null, () => handleAction({ type: 'VIEW_DETAILS' }))}
      <div className="relative" onMouseEnter={() => openSubmenu('token-copy')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Create token copy', 'token-copy')}
        {renderTokenCopySubmenu()}
      </div>
    </>
  );

  // ─── Hand Menu ─────────────────────────────────────────────────────────────

  const renderHandMenu = () => (
    <>
      {renderMenuItem('Play to Battlefield', 'B', () => handleAction({ type: 'PLAY_TO_BATTLEFIELD' }))}
      {renderMenuItem('Play Tapped', null, () => handleAction({ type: 'PLAY_TAPPED' }))}
      {renderMenuItem('Play Face-Down', null, () => handleAction({ type: 'PLAY_FACE_DOWN' }))}
      {isDFC && renderMenuItem('Play as Back Face', null, () => handleAction({ type: 'PLAY_AS_BACK_FACE' }))}
      {hasMutateKeyword && renderMenuItem('Mutate onto...', null, () => handleAction({ type: 'MUTATE_ONTO' }))}
      {renderDivider()}
      <div className="relative" onMouseEnter={() => openSubmenu('move-to')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Move to', 'move-to')}
        {renderMoveToSubmenu()}
      </div>
      {renderDivider()}
      {renderMenuItem('Reveal / Hide', 'Space', () => handleAction({ type: 'REVEAL' }))}
    </>
  );

  // ─── Stack Zone Menu ───────────────────────────────────────────────────────

  const renderStackZoneMenu = () => (
    <>
      {renderMenuItem('Play to Battlefield', 'B', () => handleAction({ type: 'PLAY_TO_BATTLEFIELD' }))}
      {renderMenuItem('Play Tapped', null, () => handleAction({ type: 'PLAY_TAPPED' }))}
      {renderMenuItem('Play Face-Down', null, () => handleAction({ type: 'PLAY_FACE_DOWN' }))}
      {renderDivider()}
      <div className="relative" onMouseEnter={() => openSubmenu('move-to')} onMouseLeave={closeSubmenuDelayed}>
        {renderSubmenuTrigger('Move to', 'move-to')}
        {renderMoveToSubmenu()}
      </div>
      {cardZone === 'exile' && (
        <>
          {renderDivider()}
          {renderMenuItem('Flip face-down', 'M', () => handleAction({ type: 'MORPH' }))}
        </>
      )}
    </>
  );

  // ─── Determine which menu to render ────────────────────────────────────────

  const renderMenuContent = () => {
    switch (cardZone) {
      case 'battlefield':
        return renderBattlefieldMenu();
      case 'hand':
        return renderHandMenu();
      case 'commandZone':
      case 'graveyard':
      case 'library':
      case 'exile':
        return renderStackZoneMenu();
      default:
        return renderStackZoneMenu();
    }
  };

  // ─── Position Clamping ─────────────────────────────────────────────────────
  // Ensure menu doesn't overflow viewport edges
  const menuWidth = 208; // w-52 = 13rem = 208px
  const menuHeight = 350; // approximate max height
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  const clampedX = Math.min(position.x, vw - menuWidth - 8);
  const clampedY = Math.min(position.y, vh - menuHeight - 8);

  // Determine if submenus should open left (when menu is near right edge)
  const opensLeft = clampedX > vw - menuWidth - 200;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${Math.max(8, clampedX)}px`,
    top: `${Math.max(8, clampedY)}px`,
    zIndex: 9999,
  };

  return (
    <div
      ref={menuRef}
      className="w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-1 select-none"
      style={menuStyle}
      role="menu"
      aria-label="Card context menu"
    >
      {renderMenuContent()}
    </div>
  );
}
