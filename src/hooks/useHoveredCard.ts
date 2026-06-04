import { useState, useEffect, useRef, useCallback } from 'react';
import type { CardData, Counter, GameState, KeywordAbility, Zone } from '../types';
import { getAllBattlefieldCards } from '../gameActions';

export interface HoveredCardData {
  card: CardData | null;
  keywords: KeywordAbility[];
  counters: Counter[];
  attachments: CardData[];
  zone: Zone | null;
}

/**
 * Tracks which card is under the cursor using elementFromPoint.
 * Re-resolves on every gameState change and on mouse movement.
 * Single source of truth: the mouse position + DOM hit-testing.
 */
export function useHoveredCard(gameState: GameState) {
  const [hoveredCardData, setHoveredCardData] = useState<HoveredCardData>({
    card: null, keywords: [], counters: [], attachments: [], zone: null,
  });
  const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /** Find the card under the cursor and resolve its data */
  const resolveFromPoint = useCallback(() => {
    const el = document.elementFromPoint(mousePos.current.x, mousePos.current.y);
    if (!el) {
      setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
      return;
    }

    const cardEl = el.closest('[data-card-id]') as HTMLElement | null;
    if (!cardEl) {
      setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
      return;
    }

    const cardId = cardEl.getAttribute('data-card-id')!;
    const zone = cardEl.getAttribute('data-card-zone') as Zone;

    if (zone === 'battlefield') {
      const allBf = getAllBattlefieldCards(gameState);
      const found = allBf.find(rc => rc.instanceId === cardId);
      if (found) {
        setHoveredCardData({ card: found.card, keywords: found.card.keywords, counters: found.counters, attachments: found.attachments.map(a => a.card), zone });
        return;
      }
    } else if (zone === 'hand') {
      const card = gameState.hand.find(c => c.id === cardId);
      if (card) { setHoveredCardData({ card, keywords: card.keywords, counters: [], attachments: [], zone }); return; }
    } else if (zone === 'commandZone') {
      const card = gameState.commandZone.find(c => c.id === cardId);
      if (card) { setHoveredCardData({ card, keywords: card.keywords, counters: [], attachments: [], zone }); return; }
    } else if (zone === 'graveyard') {
      const card = gameState.graveyard.find(c => c.id === cardId);
      if (card) { setHoveredCardData({ card, keywords: card.keywords, counters: [], attachments: [], zone }); return; }
    } else if (zone === 'exile') {
      const ec = gameState.exile.find(e => e.card.id === cardId);
      if (ec) { setHoveredCardData({ card: ec.card, keywords: ec.card.keywords, counters: [], attachments: [], zone }); return; }
    } else if (zone === 'library') {
      if (gameState.library.length > 0) {
        const top = gameState.library[0];
        setHoveredCardData({ card: top, keywords: top.keywords, counters: [], attachments: [], zone });
        return;
      }
    }

    setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
  }, [gameState]);

  // Re-resolve on every state change
  useEffect(() => {
    resolveFromPoint();
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track mouse position and resolve on move
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      resolveFromPoint();
    };
    document.addEventListener('mousemove', handler, { passive: true });
    return () => document.removeEventListener('mousemove', handler);
  }, [resolveFromPoint]);

  return { hoveredCardData };
}
