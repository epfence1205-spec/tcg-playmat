import { useState, useRef } from 'react';
import type { CardData } from '../types';
import { parsePlainText } from '../parsers/plainTextParser';
import type { DeckEntry } from '../parsers/plainTextParser';
import { parseCsv } from '../parsers/csvParser';
import { isMoxfieldUrl, fetchMoxfieldDeck } from '../parsers/moxfieldParser';
import { isArchidektUrl, fetchArchidektDeck } from '../parsers/archidektParser';
import { importDeck } from '../import/importDeck';
import type { ImportResult } from '../import/importDeck';
import { useToastContext } from '../contexts/ToastContext';

interface DeckImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (deck: { mainboard: CardData[]; commanders: CardData[] }) => void;
}

/**
 * DeckImportModal — Modal dialog for importing decklists.
 *
 * Supports:
 * - Plain-text paste (one card per line, optional quantity prefix)
 * - CSV paste
 * - Moxfield URL
 * - Archidekt URL
 *
 * When `isOpen` is false, renders nothing.
 */
export function DeckImportModal({ isOpen, onClose, onImportComplete }: DeckImportModalProps) {
  const [decklistText, setDecklistText] = useState('');
  const [commanderText, setCommanderText] = useState('');
  const [deckUrl, setDeckUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ resolved: number; total: number } | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToastContext();

  // Store the last successful import result for "Continue with partial" flow
  const lastImportResult = useRef<ImportResult | null>(null);

  if (!isOpen) return null;

  /**
   * Detects whether the text input looks like CSV (contains commas in data lines).
   */
  function looksLikeCsv(text: string): boolean {
    const lines = text.split('\n').filter((l) => l.trim() !== '');
    // If more than half the non-empty lines contain commas, treat as CSV
    const linesWithCommas = lines.filter((l) => l.includes(','));
    return linesWithCommas.length > lines.length / 2;
  }

  const handleImport = async () => {
    setError(null);
    setFailures([]);
    lastImportResult.current = null;

    const urlTrimmed = deckUrl.trim();
    const textTrimmed = decklistText.trim();

    // Validate: at least one input must be filled
    if (!urlTrimmed && !textTrimmed) {
      setError('Please paste a decklist or enter a deck URL.');
      return;
    }

    setIsImporting(true);
    setProgress(null);

    try {
      let entries: DeckEntry[] = [];
      let commanderNames: string[] = [];

      if (urlTrimmed) {
        // URL-based import
        if (isMoxfieldUrl(urlTrimmed)) {
          const result = await fetchMoxfieldDeck(urlTrimmed);
          entries = [...result.mainboard, ...result.commanders];
          commanderNames = result.commanders.map((e) => e.name);
        } else if (isArchidektUrl(urlTrimmed)) {
          const result = await fetchArchidektDeck(urlTrimmed);
          entries = [...result.mainboard, ...result.commanders];
          commanderNames = result.commanders.map((e) => e.name);
        } else {
          setError('Unrecognized URL. Please use a Moxfield or Archidekt deck URL.');
          setIsImporting(false);
          return;
        }
      } else {
        // Text-based import: detect CSV vs plain text
        if (looksLikeCsv(textTrimmed)) {
          entries = parseCsv(textTrimmed);
        } else {
          entries = parsePlainText(textTrimmed);
        }
        // Parse commander names from the commander textarea (run through parser for quantity prefix handling)
        const commanderEntries = parsePlainText(commanderText);
        commanderNames = commanderEntries.map((e) => e.name);
        // Add commanders to entries so they get resolved by Scryfall
        for (const ce of commanderEntries) {
          if (!entries.some((e) => e.name.toLowerCase() === ce.name.toLowerCase())) {
            entries.push(ce);
          }
        }
      }

      if (entries.length === 0) {
        setError('No cards found in the input. Please check the format.');
        setIsImporting(false);
        return;
      }

      // Run the import pipeline with progress tracking
      const result = await importDeck(entries, commanderNames, {
        onProgress: (resolved, total) => {
          setProgress({ resolved, total });
        },
      });

      lastImportResult.current = result;

      if (result.failures.length > 0) {
        // Show failures UI — user can choose to continue or dismiss
        setFailures(result.failures);
      } else {
        // Full success — deliver result and close
        onImportComplete({ mainboard: result.mainboard, commanders: result.commanders });
        resetState();
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      // Show a toast for network/API errors with retry option
      if (message.includes('timed out') || message.includes('network') || message.includes('Failed to fetch') || message.includes('unavailable')) {
        addToast({
          type: 'error',
          message,
          action: { label: 'Retry', onClick: handleImport },
        });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleContinueWithPartial = () => {
    // Accept the partial import (cards that resolved successfully)
    if (lastImportResult.current) {
      onImportComplete({
        mainboard: lastImportResult.current.mainboard,
        commanders: lastImportResult.current.commanders,
      });
    }
    resetState();
    onClose();
  };

  const handleDismissFailures = () => {
    resetState();
    onClose();
  };

  function resetState() {
    setDecklistText('');
    setCommanderText('');
    setDeckUrl('');
    setFailures([]);
    setError(null);
    setProgress(null);
    lastImportResult.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-import-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal dialog */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 flex flex-col gap-5">
        {/* Title */}
        <h2
          id="deck-import-title"
          className="text-xl font-semibold text-gray-100"
        >
          Import Deck
        </h2>

        {/* Error message */}
        {error && (
          <div
            className="rounded-lg border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-300"
            role="alert"
          >
            <p>{error}</p>
            {/* Show retry button for network/timeout errors */}
            {(error.includes('timed out') || error.includes('network') || error.includes('unavailable') || error.includes('Failed to fetch')) && (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-red-200 underline underline-offset-2 hover:text-red-100"
                onClick={handleImport}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Commander input — 2-line textarea for commander name(s) */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="commander-text" className="text-sm text-gray-400">
            Commander (one per line for partners)
          </label>
          <textarea
            id="commander-text"
            className="w-full resize-none rounded-lg bg-gray-800 border border-gray-600 text-gray-100 text-sm p-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder={"Atraxa, Praetors' Voice"}
            rows={2}
            value={commanderText}
            onChange={(e) => setCommanderText(e.target.value)}
            disabled={isImporting}
          />
        </div>

        {/* Text area for decklist paste */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="decklist-text" className="text-sm text-gray-400">
            Paste decklist (plain-text or CSV)
          </label>
          <textarea
            id="decklist-text"
            className="w-full h-48 resize-y rounded-lg bg-gray-800 border border-gray-600 text-gray-100 text-sm p-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder={"1 Lightning Bolt\n1 Sol Ring\n4 Island\n..."}
            value={decklistText}
            onChange={(e) => setDecklistText(e.target.value)}
            disabled={isImporting}
          />
        </div>

        {/* URL input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deck-url" className="text-sm text-gray-400">
            Or import from URL (Moxfield / Archidekt)
          </label>
          <input
            id="deck-url"
            type="url"
            className="w-full rounded-lg bg-gray-800 border border-gray-600 text-gray-100 text-sm p-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="https://www.moxfield.com/decks/..."
            value={deckUrl}
            onChange={(e) => setDeckUrl(e.target.value)}
            disabled={isImporting}
          />
        </div>

        {/* Progress indicator — visible only during import */}
        {isImporting && progress && (
          <div className="flex flex-col gap-2" role="status" aria-live="polite">
            <p className="text-sm text-gray-300">
              Resolving cards… {progress.resolved}/{progress.total}
            </p>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                style={{ width: `${progress.total > 0 ? (progress.resolved / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Partial failure reporting — visible after import completes with failures */}
        {!isImporting && failures.length > 0 && (
          <div
            className="rounded-lg border border-amber-500/50 bg-amber-950/30 p-4 flex flex-col gap-2"
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-amber-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <p className="text-sm font-medium text-amber-300">
                {failures.length} card{failures.length === 1 ? '' : 's'} could not be found
              </p>
            </div>
            <p className="text-sm text-amber-200/80 pl-7">
              {failures.join(', ')}
            </p>
          </div>
        )}

        {/* Action buttons — switch to partial import actions when failures are shown */}
        {!isImporting && failures.length > 0 ? (
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              onClick={handleDismissFailures}
            >
              Close
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              onClick={handleContinueWithPartial}
            >
              Continue with partial import
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              onClick={onClose}
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                isImporting
                  ? 'bg-indigo-600/50 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? 'Importing…' : 'Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
