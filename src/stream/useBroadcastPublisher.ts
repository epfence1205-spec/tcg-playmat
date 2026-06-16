import { useEffect, useRef } from 'react';
import type { GameState } from '../types';
import { CHANNEL_NAME, type StreamSyncMessage } from './constants';

/**
 * Player-side hook that publishes game state to the stream view
 * via BroadcastChannel on every state/revealedHandIds change.
 */
export function useBroadcastPublisher(state: GameState, revealedHandIds: string[]): void {
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Open channel on mount, close on unmount
  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, []);

  // Post STATE_UPDATE on every state/revealedHandIds change
  useEffect(() => {
    if (!channelRef.current) return;
    const message: StreamSyncMessage = {
      type: 'STATE_UPDATE',
      payload: state,
      revealedHandIds,
      timestamp: Date.now(),
    };
    channelRef.current.postMessage(message);
  }, [state, revealedHandIds]);
}
