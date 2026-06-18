/**
 * API proxy base URL.
 *
 * In development: Vite's built-in proxy handles /api/* routes.
 * In production: Cloudflare Worker at the configured VITE_PROXY_URL,
 * or falls back to direct API calls (may fail due to CORS).
 */

const PROXY_BASE = import.meta.env.VITE_PROXY_URL as string | undefined;

/** Base URL for Archidekt API requests */
export const ARCHIDEKT_BASE = import.meta.env.DEV
  ? '/api/archidekt'
  : PROXY_BASE
    ? `${PROXY_BASE}/archidekt`
    : 'https://archidekt.com/api';

/** Base URL for Moxfield API requests */
export const MOXFIELD_BASE = import.meta.env.DEV
  ? '/api/moxfield'
  : PROXY_BASE
    ? `${PROXY_BASE}/moxfield`
    : '/api/moxfield'; // Will fail without proxy — intentional, shows clear error
