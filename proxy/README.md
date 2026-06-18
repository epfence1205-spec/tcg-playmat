# API Proxy (Cloudflare Worker)

Relays Archidekt and Moxfield API requests, bypassing CORS and Cloudflare bot detection.

## Deploy

1. Sign up at https://dash.cloudflare.com (free tier)
2. Install wrangler: `npm install -g wrangler`
3. Login: `wrangler login`
4. Deploy from this directory: `npx wrangler deploy`
5. Note your worker URL (e.g., `https://tcg-playmat-proxy.your-subdomain.workers.dev`)
6. Update `../.env.production` with your worker URL

## Routes

| Path | Upstream |
|------|----------|
| `/archidekt/*` | `https://archidekt.com/api/*` |
| `/moxfield/*` | `https://api2.moxfield.com/*` |
