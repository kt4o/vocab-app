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
- `http://localhost:4000/api/ready` should return JSON with `"ok": true` and `"db": "up"`.
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

Recommended uptime settings on your backend host:

- configure a health check path: `/api/health` (liveness)
- configure a readiness check path: `/api/ready` (database connectivity)
- disable automatic sleep/spin-down if your host supports that feature

## Deploy backend on Railway (Hobby) checklist

1. Create a new Railway project and deploy this repository.
2. Set the service start command to:
   `npm run start:server`
3. Add backend environment variables in Railway:
   - `NODE_ENV=production`
   - `DATABASE_URL=postgres://...`
   - `PGSSLMODE=require`
   - `CORS_ORIGIN=https://<your-netlify-domain>`
   - `APP_BASE_URL=https://<your-netlify-domain>`
   - `PORT` is provided by Railway automatically
4. If using billing/email, also set:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `EMAIL_FROM`
5. Configure service health check path:
   - liveness: `/api/health`
   - readiness: `/api/ready`
6. Copy your Railway backend URL, then set Netlify env:
   - `VITE_API_BASE_URL=https://<your-railway-backend-domain>`
7. Redeploy Netlify frontend.
8. Verify in browser:
   - `https://<your-railway-backend-domain>/api/health`
   - `https://<your-railway-backend-domain>/api/ready`
9. Run smoke test against Railway:
   - `SMOKE_API_BASE_URL=https://<your-railway-backend-domain> npm run test:smoke`

Cutover tip:
- Keep Koyeb running until steps 8 and 9 pass, then switch Netlify `VITE_API_BASE_URL` and disable Koyeb.
