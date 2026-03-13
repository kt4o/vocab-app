# Vocalibry

React + Vite frontend with an Express + PostgreSQL backend.

## Local development

1. Install dependencies:
   `npm install`
2. Start frontend:
   `npm run dev`
3. Start backend (separate terminal):
   `npm run dev:server`
   - Optional auto-reload mode: `npm run dev:server:watch`
4. Optional API smoke test (with backend running):
   `npm run test:smoke`

Frontend requests to `/api/*` are proxied by Vite to `http://localhost:4000` during local dev.

If sign in/register fails, verify backend health in your browser:

- `http://localhost:4000/api/health` should return JSON with `"ok": true`.
- If it does not load, check `server/.env` and make sure `DATABASE_URL` is valid/reachable.

## Deploy frontend to Netlify

This repo includes `netlify.toml` with:

- build command: `npm run build`
- publish directory: `dist`
- SPA fallback redirect to `index.html`

In Netlify site settings, add environment variable:

- `VITE_API_BASE_URL = https://your-backend-domain`

Example:

- `VITE_API_BASE_URL=https://my-vocab-api.onrender.com`

The app will then call:

- `https://my-vocab-api.onrender.com/api/auth/...`
- `https://my-vocab-api.onrender.com/api/state`

## Stripe billing (optional)

To enable Free + Paid accounts, configure backend environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` (subscription price)
- `APP_BASE_URL` (frontend base URL used for Stripe redirects)

Then set your Stripe webhook endpoint to:

- `https://your-backend-domain/api/billing/webhook`

## Deploy backend

This backend uses PostgreSQL (`DATABASE_URL`), so deploy it where outbound DB connections are allowed (for example Render, Railway, Fly.io, or a VPS).

After backend deployment, set:

- backend `PORT` (platform-provided)
- frontend `VITE_API_BASE_URL` (Netlify env var)
