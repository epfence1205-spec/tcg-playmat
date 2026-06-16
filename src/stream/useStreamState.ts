import { useState, useEffect, useRef } from 'react';
import type { GameState } from '../types';
import { CHANNEL_NAME, FALLBACK_POLL_MS } from './constants';
import { loadGameState } from '../persistence';
import { isValidSyncMessage } from './validateMessage';

/**
 * Stream-side state subscription hook.
 * Reads game state from BroadcastChannel (primary) or localStorage (fallback).
 * NEVER writes to localStorage or BroadcastChannel — strictly read-only.
 */
export function useStreamState(): { state: GameState; revealedHandIds: string[] } {
  const [state, setState] = useState<GameState>(() => loadGameState());
  const [revealedHandIds, setRevealedHandIds] = useState<string[]>([]);
  const receivedMessage = useRef(false);

  useEffect(() => {
    // If BroadcastChannel is not supported, fall back to polling localStorage
    if (typeof BroadcastChannel === 'undefined') {
      const interval = setInterval(() => {
        setState(loadGameState());
      }, FALLBACK_POLL_MS);
      return () => clearInterval(interval);
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (event: MessageEvent) => {
      const msg = event.data as unknown;
      if (!isValidSyncMessage(msg)) return;
      receivedMessage.current = true;
      setState(msg.payload);
      setRevealedHandIds(msg.revealedHandIds);
    };

    // Fallback: if no message within FALLBACK_POLL_MS, re-read localStorage
    const fallbackTimer = setTimeout(() => {
      if (!receivedMessage.current) {
        setState(loadGameState());
      }
    }, FALLBACK_POLL_MS);

    return () => {
      clearTimeout(fallbackTimer);
      channel.close();
    };
  }, []);

  return { state, revealedHandIds };
}


