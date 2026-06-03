import { useState, useCallback, useRef, useEffect } from 'react';
import type { CardData, Counter, GameState, KeywordAbility, Zone } from '../types';
import { findCardOnBattlefield } from '../gameActions';

/**
 * Data exposed by the hook for the HD Zoom Portal.
 */
export interface HoveredCardData {
  card: CardData | null;
  keywords: KeywordAbility[];
  counters: Counter[];
  attachments: CardData[];
  zone: Zone | null;
}

/**
 * Tracks which card is currently being hovered and resolves its full data
 * from the game state for the HD Zoom Portal.
 *
 * Auto-refreshes on every state change while a card is hovered, so keybind
 * actions that change the hovered card (e.g. milling from library) stay current.
 */
export function useHoveredCard(gameState: GameState) {
  const [hoveredCardData, setHoveredCardData] = useState<HoveredCardData>({
    card: null,
    keywords: [],
    counters: [],
    attachments: [],
    zone: null,
  });

  // Track the raw hover intent (cardId + zone) so we can re-resolve on state changes
  const hoveredRef = useRef<{ cardId: string; zone: Zone } | null>(null);
  // Track previous hand to find the old index when a card leaves
  const prevHandRef = useRef<CardData[]>(gameState.hand);
  // Track last mouse position for synthetic re-hover after hand card removal
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keep mouse position updated
  useEffect(() => {
    const handler = (e: MouseEvent) => { lastMousePos.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener('mousemove', handler, { passive: true });
    return () => document.removeEventListener('mousemove', handler);
  }, []);

  /** Resolve card data from state for a given cardId + zone */
  const resolveCardData = useCallback(
    (cardId: string, zone: Zone): HoveredCardData => {
      if (zone === 'battlefield') {
        const result = findCardOnBattlefield(gameState, cardId);
        if (result) {
          const { card: rowCard } = result;
          return {
            card: rowCard.card,
            keywords: rowCard.card.keywords,
            counters: rowCard.counters,
            attachments: rowCard.attachments.map((a) => a.card),
            zone,
          };
        }
        return { card: null, keywords: [], counters: [], attachments: [], zone: null };
      }
      if (zone === 'hand') {
        const card = gameState.hand.find((c) => c.id === cardId) ?? null;
        return { card, keywords: card?.keywords ?? [], counters: [], attachments: [], zone };
      }
      // Sidebar zones
      let card: CardData | null = null;
      if (zone === 'commandZone') card = gameState.commandZone.find((c) => c.id === cardId) ?? null;
      else if (zone === 'graveyard') card = gameState.graveyard.find((c) => c.id === cardId) ?? null;
      else if (zone === 'library') card = gameState.library.find((c) => c.id === cardId) ?? null;
      else if (zone === 'exile') card = gameState.exile.find((ec) => ec.card.id === cardId)?.card ?? null;
      return { card, keywords: card?.keywords ?? [], counters: [], attachments: [], zone };
    },
    [gameState]
  );

  // Re-resolve hovered card whenever gameState changes
  useEffect(() => {
    if (!hoveredRef.current) return;
    const { cardId, zone } = hoveredRef.current;
    let card: CardData | null = null;
    let keywords: KeywordAbility[] = [];
    let counters: Counter[] = [];
    let attachments: CardData[] = [];

    if (zone === 'battlefield') {
      const result = findCardOnBattlefield(gameState, cardId);
      if (result) {
        card = result.card.card;
        keywords = card.keywords;
        counters = result.card.counters;
        attachments = result.card.attachments.map((a) => a.card);
      }
    } else if (zone === 'hand') {
      card = gameState.hand.find((c) => c.id === cardId) ?? null;
      keywords = card?.keywords ?? [];
    } else if (zone === 'commandZone') {
      card = gameState.commandZone.find((c) => c.id === cardId) ?? null;
      keywords = card?.keywords ?? [];
    } else if (zone === 'graveyard') {
      card = gameState.graveyard.find((c) => c.id === cardId) ?? null;
      keywords = card?.keywords ?? [];
    } else if (zone === 'library') {
      card = gameState.library.find((c) => c.id === cardId) ?? null;
      keywords = card?.keywords ?? [];
    } else if (zone === 'exile') {
      card = gameState.exile.find((ec) => ec.card.id === cardId)?.card ?? null;
      keywords = card?.keywords ?? [];
    }

    if (!card) {
      // For battlefield, wait for shift animation then find card under cursor
      if (zone === 'battlefield') {
        setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
        hoveredRef.current = null;
        setTimeout(() => {
          const el = document.elementFromPoint(lastMousePos.current.x, lastMousePos.current.y);
          const cardEl = el?.closest('[aria-label*="in battlefield"]');
          if (cardEl) {
            const label = cardEl.getAttribute('aria-label') ?? '';
            const match = label.match(/^(.+) in battlefield$/);
            if (match) {
              const cardName = match[1];
              // Search all battlefield cards for this name
              const allBf = [
                ...gameState.creatureArea.rows.flatMap(r => r.elements),
                ...gameState.row3.left, ...gameState.row3.right,
                ...gameState.row4.left, ...gameState.row4.right,
              ];
              const found = allBf.find(rc => rc.card.name === cardName);
              if (found) {
                hoveredRef.current = { cardId: found.instanceId, zone: 'battlefield' };
                const result = findCardOnBattlefield(gameState, found.instanceId);
                if (result) {
                  setHoveredCardData({
                    card: result.card.card,
                    keywords: result.card.card.keywords,
                    counters: result.card.counters,
                    attachments: result.card.attachments.map(a => a.card),
                    zone: 'battlefield',
                  });
                }
              }
            }
          }
        }, 200);
        return;
      }
      // For stack zones, auto-hover the new top card
      if (zone === 'library' && gameState.library.length > 0) {
        const newTop = gameState.library[0];
        hoveredRef.current = { cardId: newTop.id, zone };
        setHoveredCardData({ card: newTop, keywords: newTop.keywords, counters: [], attachments: [], zone });
      } else if (zone === 'graveyard' && gameState.graveyard.length > 0) {
        const newTop = gameState.graveyard[gameState.graveyard.length - 1];
        hoveredRef.current = { cardId: newTop.id, zone };
        setHoveredCardData({ card: newTop, keywords: newTop.keywords, counters: [], attachments: [], zone });
      } else if (zone === 'exile' && gameState.exile.length > 0) {
        const newTop = gameState.exile[gameState.exile.length - 1];
        hoveredRef.current = { cardId: newTop.card.id, zone };
        setHoveredCardData({ card: newTop.card, keywords: newTop.card.keywords, counters: [], attachments: [], zone });
      } else if (zone === 'hand' && gameState.hand.length > 0) {
        // Use elementFromPoint to find what card is actually under the cursor now
        const el = document.elementFromPoint(lastMousePos.current.x, lastMousePos.current.y);
        const cardEl = el?.closest('[aria-label*="in hand"]');
        if (cardEl) {
          const label = cardEl.getAttribute('aria-label') ?? '';
          const match = label.match(/^(.+) in hand$/);
          if (match) {
            const cardName = match[1];
            const foundCard = gameState.hand.find(c => c.name === cardName);
            if (foundCard) {
              hoveredRef.current = { cardId: foundCard.id, zone };
              setHoveredCardData({ card: foundCard, keywords: foundCard.keywords, counters: [], attachments: [], zone });
              return;
            }
          }
        }
        setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
        hoveredRef.current = null;
      } else {
        setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
        hoveredRef.current = null;
      }
    } else {
      setHoveredCardData({ card, keywords, counters, attachments, zone });
    }
    prevHandRef.current = gameState.hand;
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  const onHoverStart = useCallback(
    (cardId: string, zone: Zone) => {
      hoveredRef.current = { cardId, zone };
      setHoveredCardData(resolveCardData(cardId, zone));
    },
    [resolveCardData]
  );

  const onHoverEnd = useCallback((_cardId: string) => {
    hoveredRef.current = null;
    setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
  }, []);

  return { hoveredCardData, onHoverStart, onHoverEnd };
}
