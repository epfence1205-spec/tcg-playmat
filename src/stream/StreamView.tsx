import { useEffect, useState } from 'react';
import { useStreamState } from './useStreamState';
import { StreamBattlefield } from './StreamBattlefield';
import { StreamHandTray } from './StreamHandTray';
import { StreamPublicStack } from './StreamPublicStack';

const TRANSPARENT_KEY = 'tcg-stream-transparent';

/**
 * StreamView — root component for the `/stream` route.
 *
 * Exact same grid structure as AppShell:
 * - Outer: 100vw × 100vh, overflow hidden, grid with '80vh 20vh' rows
 * - Upper region: grid with '1fr calc(11.43vh + 16px)' columns
 * - Zone A (battlefield) + Zone B (sidebar) in upper region
 * - Zone C (hand tray) at bottom
 *
 * All interactivity stripped: no DndContext, no keybinds, no modals.
 * pointer-events: none on root.
 */
export function StreamView() {
  const { state, revealedHandIds } = useStreamState();
  const [transparentBg, setTransparentBg] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('transparent') === '1') {
      localStorage.setItem(TRANSPARENT_KEY, 'true');
      return true;
    }
    return localStorage.getItem(TRANSPARENT_KEY) === 'true';
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('transparent') === '1') {
      localStorage.setItem(TRANSPARENT_KEY, 'true');
      setTransparentBg(true);
    }
  }, []);

  return (
    <div
      className="w-screen h-screen overflow-hidden grid pointer-events-none"
      style={{
        gridTemplateRows: '80vh 20vh',
        background: transparentBg ? 'transparent' : undefined,
      }}
    >
      {/* Upper region: Zone A (Battlefield) + Zone B (Sidebar) */}
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateColumns: '1fr calc(11.43vh + 16px)',
          gridTemplateRows: 'minmax(0, 1fr)',
          height: '80vh',
        }}
      >
        {/* Zone A — Battlefield */}
        <StreamBattlefield state={state} />

        {/* Zone B — Sidebar (PublicStack mirror) */}
        <StreamPublicStack state={state} />
      </div>

      {/* Zone C — Hand Tray */}
      <div className="overflow-hidden w-full h-full">
        <StreamHandTray hand={state.hand} revealedIds={revealedHandIds} />
      </div>
    </div>
  );
}
