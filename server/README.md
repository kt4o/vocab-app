## Backend API

### Run

1. Install dependencies:
   `npm install`
2. Start API:
   `npm run dev:server`
3. Optional env vars:
   - `PORT=4000`
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/my_vocab_app`
   - `PGSSLMODE=disable` (set `require` in production if your provider requires SSL)
   - `CORS_ORIGIN=https://your-frontend-domain.com` (or comma-separated list via `CORS_ORIGINS`)
   - `WRITE_RATE_LIMIT_WINDOW_MS=900000`
   - `WRITE_RATE_LIMIT_MAX_ATTEMPTS=180`
   - `SMTP_HOST=smtp.your-provider.com`
   - `SMTP_PORT=587`
   - `SMTP_SECURE=false` (`true` for port 465)
   - `SMTP_USER=your-smtp-user`
   - `SMTP_PASS=your-smtp-password`
   - `EMAIL_FROM="Vocalibry <no-reply@yourdomain.com>"`
   - `STRIPE_SECRET_KEY=sk_live_or_test_key`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `STRIPE_PRICE_ID=price_...` (recurring subscription price id)
   - `STRIPE_TRIAL_DAYS=30` (optional, applies trial days for first-time subscriptions only; set `0` to disable)
   - `APP_BASE_URL=https://your-frontend-domain.com` (used for Stripe success/cancel redirects)

### Endpoints

- `GET /api/health`
- `POST /api/auth/register/request-email-code` body: `{"email":"demo@example.com"}`
- `POST /api/auth/register/verify-email-code` body: `{"email":"demo@example.com","code":"123456"}`
- `POST /api/auth/register` body: `{"email":"demo@example.com","verifiedEmailToken":"<token>","username":"demo_user","password":"yourpass123"}`
- `POST /api/auth/password-reset/request-code` body: `{"email":"demo@example.com"}`
- `POST /api/auth/password-reset/verify-code` body: `{"email":"demo@example.com","code":"123456"}`
- `POST /api/auth/password-reset/complete` body: `{"email":"demo@example.com","resetToken":"<token>","password":"newpass123"}`
- `POST /api/auth/login` body: `{"username":"demo_user","password":"yourpass123"}`
- `POST /api/auth/account/change-password` with `Authorization: Bearer <token>` body: `{"currentPassword":"oldpass123","newPassword":"newpass123"}`
- `POST /api/auth/account/logout-all` with `Authorization: Bearer <token>`
- `DELETE /api/auth/account` with `Authorization: Bearer <token>` body: `{"password":"yourpass123"}`
- `GET /api/words?difficulty=a1&q=ab`
- `GET /api/progress` with `Authorization: Bearer <token>`
- `PUT /api/progress` with `Authorization: Bearer <token>` and JSON body:
  `{"totalXp":120,"coins":18,"streakCount":3,"learnedWords":["adapt"]}`
- `GET /api/state` with `Authorization: Bearer <token>`
- `PUT /api/state` with `Authorization: Bearer <token>` and JSON body:
  `{"appState":{"backupVersion":1,"exportedAt":"2026-03-07T00:00:00.000Z","data":{"theme":"light"}}}`
- `GET /api/social/overview` with `Authorization: Bearer <token>`
- `POST /api/social/requests` with `Authorization: Bearer <token>` body: `{"username":"friend_user"}`
- `POST /api/social/requests/:requestId/respond` with `Authorization: Bearer <token>` body: `{"action":"accept"}` or `{"action":"decline"}`
- `DELETE /api/social/requests/:requestId` with `Authorization: Bearer <token>` (cancel your own pending request)
- `DELETE /api/social/friends/:friendUserId` with `Authorization: Bearer <token>`
- `POST /api/analytics/retention/ping` with `Authorization: Bearer <token>` body: `{"eventName":"session_start","dayKey":"2026-03-14","metadata":{"source":"app/client"}}`
- `GET /api/analytics/retention/summary?days=30` with `Authorization: Bearer <token>`
- `GET /api/billing/status` with `Authorization: Bearer <token>`
- `POST /api/billing/checkout-session` with `Authorization: Bearer <token>`
- `POST /api/billing/portal-session` with `Authorization: Bearer <token>`
- `POST /api/billing/webhook` (Stripe webhook endpoint)

### Notes

- progress is stored in Postgres (`progress` table).
- full app state is stored as JSON per user in `app_state`.
- account auth uses token-based bearer auth from `/api/auth/login` or `/api/auth/register`.
- Frontend can call `/api/...` because Vite proxy forwards to `http://localhost:4000`.
