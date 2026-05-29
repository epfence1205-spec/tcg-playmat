/**
 * Centralized error handling hook for the TCG Playmat application.
 *
 * Consolidates error handling patterns across the app:
 * - Registers localStorage quota exceeded handler → shows warning toast
 * - Provides importWithErrorHandling wrapper → catches Scryfall/network errors → shows error toast with retry
 * - Ensures API errors never corrupt existing game state (guaranteed by pure function architecture)
 *
 * Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.5
 */

import { useCallback } from 'react';
import { useToastContext } from '../contexts/ToastContext';

/**
 * Error categories for structured error handling.
 */
export type ErrorCategory =
  | 'scryfall_unavailable'
  | 'network_error'
  | 'url_invalid'
  | 'url_timeout'
  | 'quota_exceeded'
  | 'unknown';

/**
 * Classifies an error into a known category for appropriate UI treatment.
 */
export function classifyError(error: unknown): ErrorCategory {
  if (!(error instanceof Error)) return 'unknown';

  const msg = error.message.toLowerCase();

  if (msg.includes('timed out') || msg.includes('timeout')) return 'url_timeout';
  if (msg.includes('invalid') && (msg.includes('url') || msg.includes('moxfield') || msg.includes('archidekt'))) return 'url_invalid';
  if (msg.includes('unavailable') || msg.includes('503') || msg.includes('502')) return 'scryfall_unavailable';
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch')) return 'network_error';

  return 'unknown';
}

/**
 * Hook providing centralized error handling utilities.
 *
 * Usage:
 * ```tsx
 * const { handleQuotaExceeded, importWithErrorHandling } = useErrorHandling();
 * // Pass handleQuotaExceeded to useGameState
 * // Wrap import calls with importWithErrorHandling
 * ```
 */
export function useErrorHandling() {
  const { addToast } = useToastContext();

  /**
   * Callback for localStorage quota exceeded events.
   * Shows a warning toast and the game continues in-memory.
   * Requirement 29.3: localStorage write fails → warning + continue in-memory
   */
  const handleQuotaExceeded = useCallback(() => {
    addToast({
      type: 'warning',
      message: 'Storage quota exceeded. Game continues in-memory — changes will be lost if you close this tab.',
    });
  }, [addToast]);

  /**
   * Wraps an async import operation with error handling.
   * Catches errors, classifies them, and shows appropriate toasts.
   *
   * Requirement 29.1: Scryfall unreachable → error toast + retry
   * Requirement 29.4: Invalid/private URL → clear error message
   * Requirement 29.5: API errors never corrupt existing game state
   *   (guaranteed because import builds a NEW state — only applied on success)
   *
   * @param operation - The async import function to execute
   * @param retry - Optional retry function to attach to the toast action button
   * @returns The result of the operation, or null if it failed
   */
  const importWithErrorHandling = useCallback(
    async <T>(operation: () => Promise<T>, retry?: () => void): Promise<T | null> => {
      try {
        return await operation();
      } catch (error: unknown) {
        const category = classifyError(error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';

        switch (category) {
          case 'scryfall_unavailable':
          case 'network_error':
            addToast({
              type: 'error',
              message: `Import failed: ${message}`,
              action: retry ? { label: 'Retry', onClick: retry } : undefined,
            });
            break;

          case 'url_timeout':
            addToast({
              type: 'error',
              message: `Request timed out: ${message}`,
              action: retry ? { label: 'Retry', onClick: retry } : undefined,
            });
            break;

          case 'url_invalid':
            addToast({
              type: 'error',
              message,
            });
            break;

          default:
            addToast({
              type: 'error',
              message: `Error: ${message}`,
              action: retry ? { label: 'Retry', onClick: retry } : undefined,
            });
        }

        return null;
      }
    },
    [addToast]
  );

  /**
   * Shows a generic error toast. Useful for one-off error notifications
   * that don't fit the import flow.
   */
  const showError = useCallback(
    (message: string, retry?: () => void) => {
      addToast({
        type: 'error',
        message,
        action: retry ? { label: 'Retry', onClick: retry } : undefined,
      });
    },
    [addToast]
  );

  /**
   * Shows a warning toast for non-critical issues.
   */
  const showWarning = useCallback(
    (message: string) => {
      addToast({
        type: 'warning',
        message,
      });
    },
    [addToast]
  );

  return {
    handleQuotaExceeded,
    importWithErrorHandling,
    showError,
    showWarning,
  };
}
