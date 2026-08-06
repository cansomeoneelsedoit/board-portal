# Porting Board Portal into the MasonsView / HotelView verticals

Target: `modules/BoardPortal` inside the Mason-View Laravel monolith, running as
a portal section in both verticals — the same move Echo made when it became
`modules/HotelCompliance`.

This document is the plan. **Nothing has been written into the Mason-View repo**
— see [Why the module was not built yet](#why-the-module-was-not-built-yet).

---

## The precedent

`modules/HotelCompliance` is the closest analogue: an external app ported inside
a vertical, keeping its own tables (`compliance_*`), mounting on an existing
portal's routes, and shipping Inertia React pages under
`resources/js/pages/compliance/`. Copy its shape.

```
modules/BoardPortal/
├── module.json                     # name, alias, providers
├── composer.json                   # PSR-4 autoload
├── app/
│   ├── Models/                     # Board, Meeting, AgendaItem, Motion, Vote, …
│   ├── Http/Controllers/           # one per page, returning Inertia::render
│   ├── Providers/BoardPortalServiceProvider.php
│   └── Queries/                    # the /api/dashboard aggregate lives here
├── config/config.php
├── database/migrations/            # board_* tables
├── resources/js/
│   ├── pages/board/                # dashboard, meetings, documents, motions, …
│   └── navigation/board.ts         # translated from frontend/src/navigation.js
└── routes/
    ├── web.php                     # domain + portal mount
    └── board.php
```

---

## What is already done on this side

The standalone app was built so this port is mechanical rather than a rewrite:

| Seam | Where | Why it matters |
|---|---|---|
| Single API entry point | `frontend/src/lib/api.js` | Only file that knows the base URL. Reads `window.__BOARD_PORTAL__` for `apiBase`, `userId`, `orgKey`. |
| Configurable mount prefix | `backend` `API_PREFIX` | The API can live under `/board-portal/api` without code changes. |
| Tenant column | `Board.orgKey` + index | Boards scope to a host organisation or hotel. Null standalone. |
| No auth assumptions | `server.js` middleware | Identity arrives as `x-user-id` / `x-org-key`. The host owns auth. |
| Host-matched design | `frontend/src/theme/tokens.css` | Tokens copied from the real `resources/css/app.css`, so ported pages inherit the host's look with no restyle. |
| Nav as data | `frontend/src/navigation.js` | Direct translation into `navigation/board.ts` — same labels, icons, grouping. |
| Presentational pages | `frontend/src/pages/*` | Data in via hooks, no router coupling below the layout. Swap `useApi` for Inertia props. |
| Configurable basename | `frontend/src/App.jsx` | Mounts under a sub-path. |

---

## Schema translation

Prisma models map one-to-one onto migrations. Prefix tables `board_` to avoid
collisions — the host already has `users`, `documents` and a `Vault` module.

| Prisma model | Table | Notes |
|---|---|---|
| `User` | *(drop)* | **Use the host's `users` table.** Replace `userId` FKs with the host user id. |
| `Board` | `board_boards` | `orgKey` becomes a real FK to the vertical's organisation / hotel |
| `BoardMember` | `board_members` | |
| `Meeting` | `board_meetings` | |
| `AgendaItem` | `board_agenda_items` | |
| `Document` | `board_documents` | **See the file-handling warning below** |
| `Invitation` | `board_invitations` | |
| `Attendance` | `board_attendances` | |
| `Motion` / `Vote` | `board_motions` / `board_votes` | |
| `COI` | `board_coi_declarations` | |
| `Proxy` | `board_proxies` | |
| `Minutes` / `MinutesApproval` | `board_minutes` / `board_minutes_approvals` | |
| `Integration` | *(drop)* | The host already owns SharePoint/Outlook integrations |
| `AuditLog` | *(drop)* | Use the host's audit trail |

Dropping `User`, `Integration` and `AuditLog` is the point of the exercise —
the module should consume the host's identity, integrations and audit rather
than keep parallel copies.

---

## Do not build the document store

Two hard constraints, both worth respecting:

1. **A `Vault` module already exists** in the host. Board packs are documents;
   they belong in Vault with a `board_documents` join table carrying the
   governance metadata (agenda item, tags, ordering) — not in a second file
   store.

2. **Upstream is mid-flight on exactly this.** Boyd and Mez were preparing major
   structural changes to the real Mason-View repo, *especially file handling*.
   Anything built against the current file APIs is likely to be thrown away.

So: port the governance workflow first (meetings, agenda, motions, votes,
minutes, attendance, COI, proxies). Wire documents to Vault **after** the
upstream file-handling changes land and the fork has been re-synced.

---

## Suggested sequence

1. Re-sync the fork with upstream first (the pending Mez/Boyd changes), so the
   module is written against the new structure rather than the old one.
2. Scaffold `modules/BoardPortal` from the HotelCompliance shape.
3. Migrations for the `board_*` tables, minus documents.
4. Models + the dashboard aggregate query.
5. Routes mounted per vertical, gated on the vertical resolver.
6. Convert the ten pages JSX → TSX, swapping `useApi(...)` for Inertia props and
   `<Link to>` for Wayfinder helpers. The markup and classes carry over as-is
   because the tokens already match.
7. `navigation/board.ts` from `frontend/src/navigation.js`.
8. Documents via Vault, last.

---

## Known traps in this codebase

Learned the hard way on HotelView and worth not rediscovering:

- **`composer.json` and `module.json` PSR-4 backslashes must be escaped.**
  Unescaped ones are invalid JSON and killed *every* image build with
  `Only arrays and Traversables can be unpacked, null given`.
- A vertical must bind `OwnerCascadeResolver`, `SectionLayoutResolver` and
  `VisibilityContextProvider`, but **not** when `runningUnitTests`.
- Console commands for a non-default vertical need `APP_VERTICAL=HotelView`.
- `wayfinder:generate` bakes build-time domains into route helpers; the
  Dockerfile's post-build `sed` strips them. Don't remove it.
- Register the module in `config/verticals.php` **and** `modules_statuses.json`,
  or it silently does nothing.

---

## Why the module was not built yet

Three reasons, all pointing the same way:

1. Upstream file-handling changes are imminent; the documents half would be
   rework.
2. It is a large change to a *different* repository that has a test suite and
   two live Railway services — it needs review before it lands, not an
   unsupervised overnight commit.
3. The standalone app is now genuinely useful on its own and can keep earning
   its keep while the port is scheduled.

The preparation that makes the port cheap is done. The port itself is a
reviewed piece of work for a waking day.
