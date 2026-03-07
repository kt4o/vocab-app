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

### Endpoints

- `GET /api/health`
- `POST /api/auth/register` body: `{"username":"demo_user","password":"yourpass123"}`
- `POST /api/auth/login` body: `{"username":"demo_user","password":"yourpass123"}`
- `GET /api/words?difficulty=a1&q=ab`
- `GET /api/progress` with `Authorization: Bearer <token>`
- `PUT /api/progress` with `Authorization: Bearer <token>` and JSON body:
  `{"totalXp":120,"coins":18,"streakCount":3,"learnedWords":["adapt"]}`
- `GET /api/state` with `Authorization: Bearer <token>`
- `PUT /api/state` with `Authorization: Bearer <token>` and JSON body:
  `{"appState":{"backupVersion":1,"exportedAt":"2026-03-07T00:00:00.000Z","data":{"theme":"light"}}}`

### Notes

- progress is stored in Postgres (`progress` table).
- full app state is stored as JSON per user in `app_state`.
- account auth uses token-based bearer auth from `/api/auth/login` or `/api/auth/register`.
- Frontend can call `/api/...` because Vite proxy forwards to `http://localhost:4000`.
