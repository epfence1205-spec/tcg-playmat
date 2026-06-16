import type { GameState } from '../types';

export const CHANNEL_NAME = 'tcg-playmat-sync';

export const STREAM_RESOLUTION = { width: 2560, height: 1440 } as const;

export const FALLBACK_POLL_MS = 500;

export interface StreamSyncMessage {
  type: 'STATE_UPDATE';
  payload: GameState;
  revealedHandIds: string[];
  timestamp: number;
}
