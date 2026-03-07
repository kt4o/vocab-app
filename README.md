# My Vocab App

React + Vite frontend with an Express + SQLite backend.

## Local development

1. Install dependencies:
   `npm install`
2. Start frontend:
   `npm run dev`
3. Start backend (separate terminal):
   `npm run dev:server`

Frontend requests to `/api/*` are proxied by Vite to `http://localhost:4000` during local dev.

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

## Deploy backend

Because this backend writes to SQLite files in `server/data`, deploy it to a server platform that supports persistent disk (for example Render, Railway, Fly.io, or a VPS).

After backend deployment, set:
- backend `PORT` (platform-provided)
- frontend `VITE_API_BASE_URL` (Netlify env var)
