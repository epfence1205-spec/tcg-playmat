import type { StreamSyncMessage } from './constants';

/**
 * Validates incoming BroadcastChannel message shape.
 * Returns true if the message conforms to the StreamSyncMessage interface.
 */
export function isValidSyncMessage(msg: unknown): msg is StreamSyncMessage {
  if (msg === null || typeof msg !== 'object') return false;
  const obj = msg as Record<string, unknown>;
  return obj.type === 'STATE_UPDATE' && obj.payload != null && Array.isArray(obj.revealedHandIds);
}
