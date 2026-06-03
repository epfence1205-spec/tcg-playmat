import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook } from '@testing-library/react';
import { useKeybinds } from '../hooks/useKeybinds';
import type { GameState } from '../types';

/**
 * Property 25: Keybind Input Isolation
 * For any key press event, when focus is in a text input/textarea/contenteditable
 * element, no game action is dispatched.
 *
 * **Validates: Requirements 15.26**
 */

// Minimal valid game state for the hook
function makeGameState(): GameState {
  return {
    gamePhase: 'PLAYING',
    creatureArea: { rows: [{ id: 'creature-1', elements: [] }], totalElementCount: 0 },
    row3: { left: [], right: [] },
    row4: { left: [], right: [] },
    hand: [],
    commandZone: [],
    graveyard: [],
    library: [],
    exile: [],
    mulliganState: null,
    deckLoaded: false,
    lifeTotal: 40,
  };
}

// Helper to create a text input element with a given type
function createTextInput(type: string): HTMLElement {
  const el = document.createElement('input');
  el.type = type;
  return el;
}

// Helper to create a textarea element
function createTextarea(): HTMLElement {
  return document.createElement('textarea');
}

// Helper to create a contenteditable element (with isContentEditable polyfill for jsdom)
function createContentEditable(): HTMLElement {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  // jsdom doesn't implement isContentEditable, so we define it
  Object.defineProperty(el, 'isContentEditable', { get: () => true, configurable: true });
  return el;
}

// Arbitrary for single keys that are valid game keybinds
const arbSingleKey = fc.constantFrom(
  'n', 'u', 'd', 't', 'f', 'm', 'p', 'c', 'b', 'h', 'g', 'e', 'z', 'y', 'l',
  '?', '+', '=', '-', ' ', 'Delete', 'Backspace',
  '1', '2', '3', '4', '5', '6', '7', '8', '9'
);

// Arbitrary for Ctrl+key combinations
const arbCtrlKey = fc.constantFrom('g', 's', 'f', 'z', 'e');

// Arbitrary for Alt+number combinations (peek)
const arbAltNumber = fc.integer({ min: 1, max: 9 }).map(n => String(n));

// Arbitrary for text input element types that should suppress keybinds
const arbTextInputElement: fc.Arbitrary<HTMLElement> = fc.oneof(
  fc.constantFrom('text', 'search', 'url', 'tel', 'email', 'password', 'number').map(createTextInput),
  fc.constant(createTextarea()),
  fc.constant(createContentEditable())
);

describe('Property 25: Keybind Input Isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Property 25a: For any single key press, when focus is in a text input element, no game action is dispatched', () => {
    fc.assert(
      fc.property(
        arbSingleKey,
        arbTextInputElement,
        (key, focusedElement) => {
          const onAction = vi.fn();

          // Mock document.activeElement before rendering the hook
          Object.defineProperty(document, 'activeElement', {
            get: () => focusedElement,
            configurable: true,
          });

          const { unmount } = renderHook(() =>
            useKeybinds({
              gameState: makeGameState(),
              hoveredCardId: 'card-1',
              hoveredZone: 'battlefield',
              selectedCardIds: ['card-1'],
              onAction,
            })
          );

          // Dispatch keydown event
          const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            ctrlKey: false,
            altKey: false,
          });
          document.dispatchEvent(event);

          // No game action should be dispatched
          expect(onAction).not.toHaveBeenCalled();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 25b: For any Ctrl+key combination, when focus is in a text input element, no game action is dispatched', () => {
    fc.assert(
      fc.property(
        arbCtrlKey,
        arbTextInputElement,
        (key, focusedElement) => {
          const onAction = vi.fn();

          Object.defineProperty(document, 'activeElement', {
            get: () => focusedElement,
            configurable: true,
          });

          const { unmount } = renderHook(() =>
            useKeybinds({
              gameState: makeGameState(),
              hoveredCardId: 'card-1',
              hoveredZone: 'battlefield',
              selectedCardIds: ['card-1'],
              onAction,
            })
          );

          const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            ctrlKey: true,
            altKey: false,
          });
          document.dispatchEvent(event);

          expect(onAction).not.toHaveBeenCalled();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 25c: For any Alt+number combination, when focus is in a text input element, no game action is dispatched', () => {
    fc.assert(
      fc.property(
        arbAltNumber,
        arbTextInputElement,
        (key, focusedElement) => {
          const onAction = vi.fn();

          Object.defineProperty(document, 'activeElement', {
            get: () => focusedElement,
            configurable: true,
          });

          const { unmount } = renderHook(() =>
            useKeybinds({
              gameState: makeGameState(),
              hoveredCardId: 'card-1',
              hoveredZone: 'battlefield',
              selectedCardIds: ['card-1'],
              onAction,
            })
          );

          const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            ctrlKey: false,
            altKey: true,
          });
          document.dispatchEvent(event);

          expect(onAction).not.toHaveBeenCalled();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
