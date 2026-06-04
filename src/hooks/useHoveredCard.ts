import { useState, useEffect, useRef, useCallback } from 'react';
import type { CardData, Counter, GameState, KeywordAbility, Zone } from '../types';
import { findCardOnBattlefield } from '../gameActions';

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

    // Find the closest card element (has aria-label with "in <zone>" or data-card-zone)
    const cardEl = el.closest('[aria-label]') as HTMLElement | null;
    const libraryEl = el.closest('[data-card-zone="library"]') as HTMLElement | null;

    if (libraryEl && gameState.library.length > 0) {
      const top = gameState.library[0];
      setHoveredCardData({ card: top, keywords: top.keywords, counters: [], attachments: [], zone: 'library' });
      return;
    }

    if (!cardEl) {
      setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
      return;
    }

    const label = cardEl.getAttribute('aria-label') ?? '';

    // Match "CardName in zone" pattern
    let match = label.match(/^(.+) in (battlefield|hand|commandZone|graveyard|exile|library)$/);
    if (!match) {
      // Check for face-down or library
      if (label === 'Face-down card' || label.includes('Library')) {
        // Library card-back — resolve top card
        if (gameState.library.length > 0) {
          const top = gameState.library[0];
          setHoveredCardData({ card: top, keywords: top.keywords, counters: [], attachments: [], zone: 'library' });
          return;
        }
      }
      setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
      return;
    }

    const cardName = match[1];
    const zone = match[2] as Zone;

    if (zone === 'battlefield') {
      // Search all battlefield cards by name
      const allBf = [
        ...gameState.creatureArea.rows.flatMap(r => r.elements),
        ...gameState.row3.left, ...gameState.row3.right,
        ...gameState.row4.left, ...gameState.row4.right,
      ];
      const found = allBf.find(rc => rc.card.name === cardName);
      if (found) {
        setHoveredCardData({
          card: found.card,
          keywords: found.card.keywords,
          counters: found.counters,
          attachments: found.attachments.map(a => a.card),
          zone: 'battlefield',
        });
        return;
      }
    } else if (zone === 'hand') {
      const card = gameState.hand.find(c => c.name === cardName);
      if (card) {
        setHoveredCardData({ card, keywords: card.keywords, counters: [], attachments: [], zone: 'hand' });
        return;
      }
    } else if (zone === 'commandZone') {
      const card = gameState.commandZone.find(c => c.name === cardName);
      if (card) {
        setHoveredCardData({ card, keywords: card.keywords, counters: [], attachments: [], zone: 'commandZone' });
        return;
      }
    } else if (zone === 'graveyard') {
      const card = gameState.graveyard.find(c => c.name === cardName);
      if (card) {
        setHoveredCardData({ card, keywords: card.keywords, counters: [], attachments: [], zone: 'graveyard' });
        return;
      }
    } else if (zone === 'exile') {
      const ec = gameState.exile.find(e => e.card.name === cardName);
      if (ec) {
        setHoveredCardData({ card: ec.card, keywords: ec.card.keywords, counters: [], attachments: [], zone: 'exile' });
        return;
      }
    } else if (zone === 'library') {
      if (gameState.library.length > 0) {
        const top = gameState.library[0];
        setHoveredCardData({ card: top, keywords: top.keywords, counters: [], attachments: [], zone: 'library' });
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

  // Keep onHoverStart/onHoverEnd for compatibility (some components still pass them)
  // but they're no-ops now — everything is driven by elementFromPoint
  const onHoverStart = useCallback((_cardId: string, _zone: Zone) => {}, []);
  const onHoverEnd = useCallback((_cardId: string) => {}, []);

  return { hoveredCardData, onHoverStart, onHoverEnd };
}
