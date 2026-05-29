/**
 * Integration tests for error handling scenarios.
 * Tests: Scryfall API failures, localStorage quota exceeded,
 * Moxfield/Archidekt timeouts, invalid URLs, and no-page-refresh invariant.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../hooks/useToast';
import { persistState, setQuotaExceededHandler, STORAGE_KEY } from '../persistence';
import { resolveCards } from '../api/scryfallResolver';
import { fetchMoxfieldDeck } from '../parsers/moxfieldParser';
import { fetchArchidektDeck } from '../parsers/archidektParser';
import type { GameState } from '../types';

describe('Error Handling Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    setQuotaExceededHandler(null);
  });

  describe('9.1 Toast notification system', () => {
    it('adds a toast and auto-dismisses after timeout', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({ type: 'error', message: 'Test error' });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].message).toBe('Test error');
      expect(result.current.toasts[0].type).toBe('error');

      // Auto-dismiss after 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.toasts).toHaveLength(0);
      vi.useRealTimers();
    });

    it('supports error, warning, and info types', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.addToast({ type: 'error', message: 'Error' });
        result.current.addToast({ type: 'warning', message: 'Warning' });
        result.current.addToast({ type: 'info', message: 'Info' });
      });

      expect(result.current.toasts).toHaveLength(3);
      expect(result.current.toasts[0].type).toBe('error');
      expect(result.current.toasts[1].type).toBe('warning');
      expect(result.current.toasts[2].type).toBe('info');
    });

    it('supports action buttons on toasts', () => {
      const { result } = renderHook(() => useToast());
      const retryFn = vi.fn();

      act(() => {
        result.current.addToast({
          type: 'error',
          message: 'Failed',
          action: { label: 'Retry', onClick: retryFn },
        });
      });

      expect(result.current.toasts[0].action?.label).toBe('Retry');
      result.current.toasts[0].action?.onClick();
      expect(retryFn).toHaveBeenCalledOnce();
    });

    it('can manually dismiss a toast', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        toastId = result.current.addToast({ type: 'info', message: 'Dismissable' });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.removeToast(toastId!);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('9.2 Scryfall API failures with retry', () => {
    it('returns failures when Scryfall API returns non-OK response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      const result = await resolveCards(['Lightning Bolt', 'Sol Ring']);

      expect(result.failures).toContain('Lightning Bolt');
      expect(result.failures).toContain('Sol Ring');
      expect(result.resolved.size).toBe(0);
    });

    it('returns failures when fetch throws a network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await resolveCards(['Lightning Bolt']);

      // Network errors are caught per-batch and reported as failures
      // (Requirement 29.5: API errors never corrupt existing game state)
      expect(result.failures).toContain('Lightning Bolt');
      expect(result.resolved.size).toBe(0);
    });

    it('existing game state is never cleared by API errors', async () => {
      // Simulate a game state already in localStorage
      const existingState: GameState = {
        hand: [{ id: '1', name: 'Island', setCode: 'lea', collectorNumber: '1', imageURI: 'https://cards.scryfall.io/normal/front/1.jpg', backFaceImageURI: null, typeLine: 'Basic Land — Island', oracleText: '', isCommander: false }],
        battlefield: [],
        commandZone: [],
        graveyard: [],
        library: [],
        exile: [],
        deckLoaded: true,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingState));

      // Scryfall fails
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response);

      await resolveCards(['Nonexistent Card']);

      // Verify existing state is untouched
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.hand).toHaveLength(1);
      expect(stored.hand[0].name).toBe('Island');
    });
  });

  describe('9.3 localStorage QuotaExceededError', () => {
    it('invokes quota exceeded handler when localStorage is full', () => {
      vi.useFakeTimers();
      const handler = vi.fn();
      setQuotaExceededHandler(handler);

      // Mock localStorage.setItem to throw QuotaExceededError
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      const state: GameState = {
        hand: [],
        battlefield: [],
        commandZone: [],
        graveyard: [],
        library: [],
        exile: [],
        deckLoaded: false,
      };

      persistState(state);

      // Advance past debounce
      vi.advanceTimersByTime(150);

      expect(handler).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });

    it('game continues in-memory when quota is exceeded', () => {
      vi.useFakeTimers();
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      const state: GameState = {
        hand: [{ id: '1', name: 'Mountain', setCode: 'lea', collectorNumber: '1', imageURI: 'https://cards.scryfall.io/normal/front/1.jpg', backFaceImageURI: null, typeLine: 'Basic Land — Mountain', oracleText: '', isCommander: false }],
        battlefield: [],
        commandZone: [],
        graveyard: [],
        library: [],
        exile: [],
        deckLoaded: true,
      };

      // Should not throw — game continues
      expect(() => persistState(state)).not.toThrow();
      vi.advanceTimersByTime(150);
      vi.useRealTimers();
    });
  });

  describe('9.4 Moxfield/Archidekt timeout (10s) with retry', () => {
    it('Moxfield fetch times out after 10 seconds', async () => {
      // Mock fetch to never resolve (simulating timeout)
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            const signal = (options as RequestInit)?.signal;
            if (signal) {
              signal.addEventListener('abort', () => {
                const abortError = new Error('The operation was aborted.');
                abortError.name = 'AbortError';
                reject(abortError);
              });
            }
          })
      );

      await expect(
        fetchMoxfieldDeck('https://www.moxfield.com/decks/abc123')
      ).rejects.toThrow('timed out');
    }, 15000);

    it('Archidekt fetch times out after 10 seconds', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            const signal = (options as RequestInit)?.signal;
            if (signal) {
              signal.addEventListener('abort', () => {
                const abortError = new Error('The operation was aborted.');
                abortError.name = 'AbortError';
                reject(abortError);
              });
            }
          })
      );

      await expect(
        fetchArchidektDeck('https://archidekt.com/decks/12345')
      ).rejects.toThrow('timed out');
    }, 15000);
  });

  describe('9.5 Invalid/private deck URLs with clear error message', () => {
    it('Moxfield: invalid URL format shows clear error', async () => {
      await expect(
        fetchMoxfieldDeck('https://example.com/not-moxfield')
      ).rejects.toThrow('Invalid Moxfield URL');
    });

    it('Moxfield: private/not-found deck shows clear error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response);

      await expect(
        fetchMoxfieldDeck('https://www.moxfield.com/decks/private123')
      ).rejects.toThrow('Deck not found');
    });

    it('Archidekt: invalid URL format shows clear error', async () => {
      await expect(
        fetchArchidektDeck('https://example.com/not-archidekt')
      ).rejects.toThrow('Invalid Archidekt URL');
    });

    it('Archidekt: private/not-found deck shows clear error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response);

      await expect(
        fetchArchidektDeck('https://archidekt.com/decks/99999')
      ).rejects.toThrow('Deck not found');
    });
  });

  describe('9.6 No error state triggers page refresh', () => {
    it('no window.location.reload is called during error handling', () => {
      // Verify that the reload function is never called
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadSpy },
        writable: true,
      });

      // Simulate various error scenarios
      vi.useFakeTimers();

      // Quota exceeded
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      const state: GameState = {
        hand: [],
        battlefield: [],
        commandZone: [],
        graveyard: [],
        library: [],
        exile: [],
        deckLoaded: false,
      };

      persistState(state);
      vi.advanceTimersByTime(150);

      expect(reloadSpy).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('document.readyState remains unchanged during error handling', () => {
      expect(document.readyState).toBe('complete');

      // After error handling, readyState should still be 'complete'
      vi.useFakeTimers();
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      persistState({
        hand: [],
        battlefield: [],
        commandZone: [],
        graveyard: [],
        library: [],
        exile: [],
        deckLoaded: false,
      });
      vi.advanceTimersByTime(150);

      expect(document.readyState).toBe('complete');
      vi.useRealTimers();
    });
  });
});
