import { useEffect } from 'react';
import type { GameState, Zone } from '../types';

// ─── GameAction Discriminated Union ──────────────────────────────────────────

/**
 * All possible game actions dispatched by the keybind engine.
 */
export type GameAction =
  | { type: 'NEXT_TURN' }
  | { type: 'UNTAP_ALL' }
  | { type: 'DRAW' }
  | { type: 'NEW_GAME' }
  | { type: 'SHUFFLE' }
  | { type: 'BROWSE_LIBRARY' }
  | { type: 'BROWSE_GRAVEYARD' }
  | { type: 'BROWSE_EXILE' }
  | { type: 'UNDO' }
  | { type: 'TOGGLE_KEYBIND_OVERLAY' }
  | { type: 'TOGGLE_GAME_LOG' }
  | { type: 'MOVE_CARD'; cardId: string; destination: Zone }
  | { type: 'TAP_CARD'; cardId: string }
  | { type: 'FLIP_CARD'; cardId: string }
  | { type: 'MORPH_CARD'; cardId: string }
  | { type: 'PHASE_CARD'; cardId: string }
  | { type: 'TOKEN_COPY'; cardId: string }
  | { type: 'ADD_COUNTER'; cardId: string }
  | { type: 'REMOVE_COUNTER'; cardId: string }
  | { type: 'DELETE_CARD'; cardId: string }
  | { type: 'EQUIP_MODE'; cardId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_REVEAL'; cardId: string }
  | { type: 'QUICK_PLAY'; handIndex: number }
  | { type: 'PEEK'; count: number };

// ─── Hook Options ────────────────────────────────────────────────────────────

export interface UseKeybindsOptions {
  gameState: GameState;
  hoveredCardId: string | null;
  hoveredZone: Zone | null;
  selectedCardIds: string[];
  onAction: (action: GameAction) => void;
}

// ─── Input Focus Detection ───────────────────────────────────────────────────

/**
 * Returns true if the currently focused element is a text input,
 * textarea, or contenteditable — keybinds should be suppressed.
 */
function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const inputType = (el as HTMLInputElement).type.toLowerCase();
    const textTypes = ['text', 'search', 'url', 'tel', 'email', 'password', 'number'];
    return textTypes.includes(inputType);
  }
  if (tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

// ─── Hook Implementation ─────────────────────────────────────────────────────

/**
 * Registers global keydown listener for all game keybinds.
 * Suppresses keybinds when text input is focused.
 * Applies card actions to hovered card, or all selected cards if hovered card is in selection.
 */
export function useKeybinds({
  gameState,
  hoveredCardId,
  hoveredZone,
  selectedCardIds,
  onAction,
}: UseKeybindsOptions): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // Suppress all keybinds when text input is focused
      if (isTextInputFocused()) return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;

      // ─── Ctrl+Key Shortcuts ──────────────────────────────────────────
      if (ctrl && !alt) {
        switch (key) {
          case 'g':
            e.preventDefault();
            onAction({ type: 'NEW_GAME' });
            return;
          case 's':
            e.preventDefault();
            onAction({ type: 'SHUFFLE' });
            return;
          case 'f':
            e.preventDefault();
            onAction({ type: 'BROWSE_LIBRARY' });
            return;
          case 'y':
            e.preventDefault();
            onAction({ type: 'BROWSE_GRAVEYARD' });
            return;
          case 'z':
            e.preventDefault();
            onAction({ type: 'UNDO' });
            return;
          case 'e':
            e.preventDefault();
            onAction({ type: 'BROWSE_EXILE' });
            return;
        }
        return;
      }

      // ─── Alt+Key Shortcuts (Peek + Equip) ──────────────────────────────
      if (alt && !ctrl) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          onAction({ type: 'PEEK', count: num });
          return;
        }
        if (key === 'e') {
          e.preventDefault();
          if (hoveredCardId) {
            dispatchCardAction({ type: 'EQUIP_MODE', cardId: hoveredCardId });
          }
          return;
        }
        return;
      }

      // ─── Single Key Shortcuts (no modifiers) ─────────────────────────

      // Quick play from hand (1-9)
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && !ctrl && !alt) {
        e.preventDefault();
        onAction({ type: 'QUICK_PLAY', handIndex: num - 1 });
        return;
      }

      switch (key) {
        // ─── Page Actions ────────────────────────────────────────────────
        case '?':
          e.preventDefault();
          onAction({ type: 'TOGGLE_KEYBIND_OVERLAY' });
          return;
        case 'l':
          e.preventDefault();
          onAction({ type: 'TOGGLE_GAME_LOG' });
          return;
        case 'n':
          e.preventDefault();
          onAction({ type: 'NEXT_TURN' });
          return;
        case 'u':
          e.preventDefault();
          onAction({ type: 'UNTAP_ALL' });
          return;
        case 'd':
          e.preventDefault();
          onAction({ type: 'DRAW' });
          return;

        // ─── Card Movement Keys ─────────────────────────────────────────
        case 'b':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'MOVE_CARD', cardId: targetId, destination: 'battlefield' });
          }
          return;
        case 'h':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'MOVE_CARD', cardId: targetId, destination: 'hand' });
          }
          return;
        case 'g':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'MOVE_CARD', cardId: targetId, destination: 'graveyard' });
          }
          return;
        case 'e':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'MOVE_CARD', cardId: targetId, destination: 'exile' });
          }
          return;
        case 'z':
          e.preventDefault();
          if (hoveredCardId) {
            dispatchCardAction({ type: 'MOVE_CARD', cardId: hoveredCardId, destination: 'commandZone' });
          }
          return;
        case 'y':
          e.preventDefault();
          if (hoveredCardId) {
            dispatchCardAction({ type: 'MOVE_CARD', cardId: hoveredCardId, destination: 'library' });
          }
          return;
        case 'l':
          e.preventDefault();
          if (hoveredCardId) {
            // "bottom of library" — we use 'library' as destination;
            // the consumer differentiates top vs bottom via the key used
            dispatchCardAction({ type: 'MOVE_CARD', cardId: hoveredCardId, destination: 'library' });
          }
          return;

        // ─── Battlefield Card Actions ───────────────────────────────────
        case 't':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'TAP_CARD', cardId: targetId });
          }
          return;
        case 'f':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'FLIP_CARD', cardId: targetId });
          }
          return;
        case 'm':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'MORPH_CARD', cardId: targetId });
          }
          return;
        case 'p':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'PHASE_CARD', cardId: targetId });
          }
          return;
        case 'c':
          e.preventDefault();
          if (hoveredCardId) {
            dispatchCardAction({ type: 'TOKEN_COPY', cardId: hoveredCardId });
          }
          return;
        case '+':
        case '=':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'ADD_COUNTER', cardId: targetId });
          }
          return;
        case '-':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'REMOVE_COUNTER', cardId: targetId });
          }
          return;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'DELETE_CARD', cardId: targetId });
          }
          return;

        // ─── Spacebar (Reveal Toggle) ───────────────────────────────────
        case ' ':
          e.preventDefault();
          {
            const targetId = hoveredCardId ?? selectedCardIds[0];
            if (targetId) dispatchCardAction({ type: 'TOGGLE_REVEAL', cardId: targetId });
          }
          return;
      }
    }

    /**
     * Dispatches a card action. If the target card is part of the current
     * multi-selection, the action is applied to all selected cards, then selection is cleared.
     * If no hoveredCardId but selection exists, pass any selectedCardId to trigger multi-dispatch.
     */
    function dispatchCardAction(action: Extract<GameAction, { cardId: string }>): void {
      if (selectedCardIds.includes(action.cardId) && selectedCardIds.length > 1) {
        // Apply action to all selected cards, then clear selection
        for (const cardId of selectedCardIds) {
          onAction({ ...action, cardId } as typeof action);
        }
        onAction({ type: 'CLEAR_SELECTION' });
      } else {
        onAction(action);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, hoveredCardId, hoveredZone, selectedCardIds, onAction]);
}
