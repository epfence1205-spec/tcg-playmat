import { useState, useCallback } from 'react';
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
 * Accepts the current GameState so it can look up card details including
 * counters and attachments for battlefield cards.
 */
export function useHoveredCard(gameState: GameState) {
  const [hoveredCardData, setHoveredCardData] = useState<HoveredCardData>({
    card: null,
    keywords: [],
    counters: [],
    attachments: [],
    zone: null,
  });

  /**
   * Called when the user starts hovering a card.
   * Looks up the card's full data from the game state based on zone.
   */
  const onHoverStart = useCallback(
    (cardId: string, zone: Zone) => {
      if (zone === 'battlefield') {
        // Look up the RowCard on the battlefield for counters and attachments
        const result = findCardOnBattlefield(gameState, cardId);
        if (result) {
          const { card: rowCard } = result;
          setHoveredCardData({
            card: rowCard.card,
            keywords: rowCard.card.keywords,
            counters: rowCard.counters,
            attachments: rowCard.attachments.map((a) => a.card),
            zone,
          });
        } else {
          // Card not found on battlefield — clear
          setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
        }
      } else if (zone === 'hand') {
        // Hand cards: look up from hand array
        const card = gameState.hand.find((c) => c.id === cardId) ?? null;
        setHoveredCardData({
          card,
          keywords: card?.keywords ?? [],
          counters: [],
          attachments: [],
          zone,
        });
      } else {
        // Sidebar zones (commandZone, graveyard, library, exile)
        let card: CardData | null = null;

        if (zone === 'commandZone') {
          card = gameState.commandZone.find((c) => c.id === cardId) ?? null;
        } else if (zone === 'graveyard') {
          card = gameState.graveyard.find((c) => c.id === cardId) ?? null;
        } else if (zone === 'library') {
          card = gameState.library.find((c) => c.id === cardId) ?? null;
        } else if (zone === 'exile') {
          const exileCard = gameState.exile.find((ec) => ec.card.id === cardId);
          card = exileCard?.card ?? null;
        }

        setHoveredCardData({
          card,
          keywords: card?.keywords ?? [],
          counters: [],
          attachments: [],
          zone,
        });
      }
    },
    [gameState]
  );

  /**
   * Called when the user stops hovering a card.
   * Clears the hovered card data.
   */
  const onHoverEnd = useCallback((_cardId: string) => {
    setHoveredCardData({ card: null, keywords: [], counters: [], attachments: [], zone: null });
  }, []);

  return { hoveredCardData, onHoverStart, onHoverEnd };
}
