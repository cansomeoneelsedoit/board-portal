# Board packs in SharePoint

Board pack files live in SharePoint. Board Portal stores a *pointer* to each
file plus the governance metadata SharePoint has no concept of — which agenda
item a paper belongs to, and its tags.

## Why there is no "sync"

You asked for uploads to change in both places. The way to get that reliably is
to not have two places.

There is exactly one copy of every file, and it is in SharePoint:

- **Upload in the app** → the bytes go straight to SharePoint via Microsoft
  Graph. Nothing is stored on the Board Portal server.
- **Drop a file into the SharePoint folder** → it appears in the app the next
  time the list loads, because the list is read from SharePoint.
- **Delete in the app** → deleted in SharePoint.
- **Delete in SharePoint** → the pointer row is removed on the next refresh.

A two-way *sync* — two copies plus a reconciliation engine — would introduce
conflicts, drift, and "which version is right?" questions. This design has none
of those, because there is nothing to reconcile. It is the same approach the
SMSF platform takes (`listMatterDocuments` reads live from Graph rather than
from its own database), and it is the right one to carry over.

The one thing that *is* reconciled is the pointer table, and only in one
direction: SharePoint is always treated as the truth.

## Folder layout

```
<the folder you pick>/
├── 2026-08-19 August Ordinary Meeting/
│   ├── Board Pack — August 2026.pdf
│   └── Roof Remediation — Quotation A.pdf
└── 2026-07-20 July Ordinary Meeting/
    └── Minutes — July Ordinary Meeting.pdf
```

Uploads are filed under `YYYY-MM-DD Meeting title`. Files found in a folder
whose name matches a meeting are automatically linked to that meeting.

## Setup

### 1. Azure app registration

Board Portal has no user login, so it authenticates to Graph **as itself**
(client credentials). That means it needs an **application** permission, not
the delegated one the SMSF platform uses.

In the Azure portal → **App registrations** → your app:

| Where | What |
|---|---|
| Overview | copy **Application (client) ID** and **Directory (tenant) ID** |
| Certificates & secrets | **New client secret** → copy the *value* immediately |
| API permissions | **Microsoft Graph → Application permissions → `Sites.ReadWrite.All`** → then **Grant admin consent** |

> The admin consent step is the one people miss. Without it every Graph call
> returns 403 and the app will tell you so.

You can reuse the SMSF platform's app registration if it is in the same tenant —
just add the `Sites.ReadWrite.All` **application** permission to it, since SMSF
only has the delegated `Files.ReadWrite`.

If you would rather restrict access to a single site instead of all of them,
use `Sites.Selected` and grant the app write access to just the board-packs
site. The code works either way.

### 2. Backend environment

Local — add to `backend/.env`:

```
MICROSOFT_TENANT_ID=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
SHAREPOINT_SITE_ID=yourtenant.sharepoint.com:/sites/BoardPacks
```

On Railway, set the same four on the `board-portal` service.

`SHAREPOINT_SITE_ID` is only a default for the folder browser — you can type a
different site in the UI.

### 3. Pick the folder

Open **Integrations** in the app. The SharePoint card will show *Not linked*
once the credentials work. Browse to the folder you want and click **Use
"<folder>"**. That is stored against the board.

Board Packs then switches from the local list to the live SharePoint one.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /api/sharepoint/status` | configured / linked / reachable, with the real error if not |
| `GET /api/sharepoint/site?siteId=` | resolve a site |
| `GET /api/sharepoint/drives?siteId=` | document libraries in a site |
| `GET /api/sharepoint/folders?driveId=&folderId=` | sub-folders, for drilling down |
| `POST /api/sharepoint/destination` | save `{siteId, driveId, folderId}` against the board |
| `DELETE /api/sharepoint/destination` | unlink (touches nothing in SharePoint) |
| `GET /api/documents` | live list, reconciled against SharePoint |
| `POST /api/documents/sync` | force a reconcile |
| `POST /api/documents/upload` | multipart `file` → SharePoint |
| `GET /api/documents/:id/download` | 302 to a short-lived Graph download URL |
| `PATCH /api/documents/:id` | governance metadata only (agenda item, tags, display name) |
| `DELETE /api/documents/:id` | deletes in SharePoint too |

## Notes and limits

- Files over 4 MB automatically use a chunked upload session; below that a
  single PUT. Board packs of 50–100 MB are fine.
- Downloads redirect to a pre-authenticated Graph URL, so file bytes never pass
  through the Board Portal server.
- Folder listing is one level deep (root + meeting folders). Deeper nesting
  will not be picked up.
- Renaming a file is done in SharePoint. `PATCH` changes only the display name
  held in Board Portal.
- **Access control is SharePoint's.** Board Portal has no login of its own, so
  anyone who can reach the app can read anything in the linked folder. Do not
  point it at a sensitive library until the app sits behind the host vertical's
  authentication.
