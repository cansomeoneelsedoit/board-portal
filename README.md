# Board Portal

Board pack repository and governance workflow — meetings, agendas, board packs,
motions and voting, minutes, attendance, conflicts of interest, and proxies.

Runs standalone today. Built to be lifted into the **MasonsView** and
**HotelView** verticals as a `modules/BoardPortal` module — see
[MODULE-PORT.md](MODULE-PORT.md).

---

## Stack

| Layer | |
|---|---|
| Backend | Node 18+, Express 4, Prisma 5, **PostgreSQL** |
| Frontend | React 18, Vite 5, Tailwind 3, react-router 6 |
| Hosting | Railway — two services + a Postgres service |

---

## Running locally

Requires Docker (for Postgres) and Node 18+.

**1. Start the database**

```bash
docker compose up -d
```

Postgres listens on **5440** (chosen to avoid the 5432–5439 range already used
by other projects on this machine).

**2. Backend**

```bash
cd backend && cp .env.example .env && npm install && npm run db:setup && npm run db:seed && npm run dev
```

API on **http://localhost:3013**. `GET /health` reports database connectivity.

**3. Frontend**

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

App on **http://localhost:3012**. Vite proxies `/api` to the backend.

### Ports

| Service | Port |
|---|---|
| Frontend | 3012 |
| API | 3013 |
| Postgres | 5440 |

### Useful commands

```bash
cd backend && npm run db:reset
```

Drops, recreates and reseeds the schema. `npm run db:studio` opens Prisma Studio.

---

## Skins

The UI ships with two designs, switched by the palette button in the header:

- **Mason-View** (default) — matches the host product. Tokens are taken from the
  real Mason-View `resources/css/app.css`: Instrument Sans, the shadcn oklch
  scale, navy `#1c3a66` + gold `#d4af37`, light sidebar, `0.625rem` radius.
- **Classic** — the original Board Portal design, untouched.

The choice persists in `localStorage`. You can also force one with a query
param, which is handy for screenshots and for checking a regression against the
original:

```
http://localhost:3012/?skin=classic
```

Implementation:

- `src/theme/tokens.css` — every colour, font and radius for both skins, keyed
  on `data-skin` on `<html>`
- `src/theme/SkinProvider.jsx` — resolution order: `?skin=` → host config →
  `localStorage` → `VITE_DEFAULT_SKIN`
- `src/components/Layout.jsx` — **the original design, deliberately unmodified**
  apart from adding the toggle button
- `src/components/LayoutMasonsView.jsx` — the host-product shell
- `src/components/AppLayout.jsx` — picks between them

Pages are skin-agnostic: they use the semantic classes (`bp-card`, `bp-badge`,
`bp-btn`) and the shared primitives in `src/components/ui.jsx`, so there is one
copy of every page rather than one per skin.

---

## Deployment (Railway)

Project **board-portal**, environment `production`:

| Service | Root | URL |
|---|---|---|
| `board-portal` | `backend` | https://board-portal-production-5aee.up.railway.app |
| `board-portal-frontend` | `frontend` | https://fabulous-analysis-production-f860.up.railway.app |
| `Postgres` | — | internal only |

Deploy from the repo root:

```bash
railway up --service board-portal
```

```bash
railway up --service board-portal-frontend
```

Build and start behaviour lives in `backend/railway.json` and
`frontend/railway.json` rather than the dashboard.

### Environment variables that matter

| Service | Variable | Value |
|---|---|---|
| backend | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| backend | `SEED_DEMO_DATA` | `1` to seed on boot, otherwise `0` |
| backend | `CORS_ORIGIN` | `*`, or the frontend origin |
| frontend | `VITE_API_URL` | backend URL **including `/api`** — baked in at build time |
| backend | `MICROSOFT_TENANT_ID` / `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | SharePoint board packs — see [SHAREPOINT.md](SHAREPOINT.md) |
| backend | `SHAREPOINT_SITE_ID` | default site for the folder browser |

`SEED_DEMO_DATA` is deliberately `0` in production. The seed rebuilds the demo
board's meetings each run, so leaving it on would discard real data on every
restart. Set it to `1`, redeploy once, then set it back.

---

## API

Mounted under `API_PREFIX` (default `/api`).

| Route | Notes |
|---|---|
| `GET /health` | Status plus a real `SELECT 1` against Postgres |
| `GET /api/dashboard` | Aggregate — stats, upcoming meetings, activity stream |
| `/api/sharepoint/*` | Connection status and folder picker — see [SHAREPOINT.md](SHAREPOINT.md) |
| `/api/documents` | Board packs, read live from SharePoint when linked |
| `/api/meetings` | Hydrates board, agenda + documents, invitations, attendance, motions + votes, minutes |
| `/api/documents`, `/api/motions`, `/api/minutes`, `/api/attendance`, `/api/coi`, `/api/proxies`, `/api/integrations`, `/api/users`, `/api/boards`, `/api/agenda`, `/api/votes`, `/api/audit` | Generic CRUD with relation includes |

List endpoints accept any scalar field as a query filter, plus `take` and
`skip` — e.g. `/api/meetings?status=SCHEDULED&take=10`.

### No authentication

There is none, by design. The host vertical authenticates and forwards identity
as `x-user-id` and `x-org-key`. **Do not expose the API publicly with real data
until it is behind the host's auth**, or add an auth layer first.
