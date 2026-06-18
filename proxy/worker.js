/**
 * Cloudflare Worker — API proxy for TCG Playmat
 *
 * Relays requests to Archidekt and Moxfield APIs, bypassing CORS
 * and Cloudflare bot detection (JA3 fingerprinting).
 *
 * Routes:
 *   /archidekt/*  → https://archidekt.com/api/*
 *   /moxfield/*   → https://api2.moxfield.com/*
 *
 * Deploy: `npx wrangler deploy` from the proxy/ directory
 */

const ROUTES = {
  '/archidekt/': {
    target: 'https://archidekt.com/api/',
    headers: {},
  },
  '/moxfield/': {
    target: 'https://api2.moxfield.com/',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  },
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
        },
      });
    }

    // Find matching route
    let matchedPrefix = null;
    let routeConfig = null;
    for (const [prefix, config] of Object.entries(ROUTES)) {
      if (path.startsWith(prefix)) {
        matchedPrefix = prefix;
        routeConfig = config;
        break;
      }
    }

    if (!routeConfig) {
      return new Response('Not found', { status: 404 });
    }

    // Build upstream URL
    const upstreamPath = path.slice(matchedPrefix.length);
    const upstreamUrl = routeConfig.target + upstreamPath + url.search;

    // Forward the request
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...routeConfig.headers,
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    // Return with CORS headers
    const response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        'Content-Type': upstreamResponse.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });

    return response;
  },
};
