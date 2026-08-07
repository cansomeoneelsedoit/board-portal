const express = require('express');
const prisma = require('../lib/prisma');
const { getAppAccessToken, resetTokenCache, getTokenRoles } = require('../lib/graph/auth');
const { graphFetch } = require('../lib/graph/client');
const { isConfigured, getDefaultSiteId } = require('../lib/graph/config');
const sp = require('../lib/graph/sharepoint');
const { isGraphError, isConfigError } = require('../lib/graph/errors');

const router = express.Router();

/** Turns Graph failures into 4xx/5xx with a usable message rather than a stack. */
function handle(res, error) {
  if (isConfigError(error)) return res.status(503).json({ error: error.message, configured: false });
  if (isGraphError(error)) return res.status(502).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: error.message || 'SharePoint request failed' });
}

const resolveBoard = async (boardId) =>
  boardId
    ? prisma.board.findUnique({ where: { id: boardId } })
    : prisma.board.findFirst({ orderBy: { createdAt: 'asc' } });

/**
 * Connection status. Never throws — the UI calls this to decide whether to show
 * the setup prompt or the document list.
 */
router.get('/status', async (req, res) => {
  const configured = isConfigured();
  const board = await resolveBoard(req.query.boardId);

  const linked = Boolean(board?.sharepointDriveId && board?.sharepointFolderId);

  if (!configured) {
    return res.json({
      configured: false,
      linked,
      reachable: false,
      message:
        'Microsoft credentials are not set. Add MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID and ' +
        'MICROSOFT_CLIENT_SECRET to the backend service.',
      board: board ? { id: board.id, name: board.name } : null,
      folder: null,
    });
  }

  // Prove the credentials actually work rather than just reporting they exist.
  try {
    const token = await getAppAccessToken();

    // A token proves nothing on its own — client credentials issues one even for
    // an app with zero application permissions, which then 401s on every call.
    const roles = getTokenRoles(token);
    const canReadSites = roles.some((r) => /^Sites\.(Read|ReadWrite|Selected|Manage|FullControl)/i.test(r));

    if (!canReadSites) {
      return res.json({
        configured: true,
        linked,
        reachable: false,
        roles,
        message:
          roles.length === 0
            ? 'The app registration has no application permissions. Add Microsoft Graph > ' +
              'Application permissions > Sites.ReadWrite.All and click "Grant admin consent". ' +
              '(A delegated permission is not enough — this service signs in as itself.)'
            : `The app registration grants [${roles.join(', ')}] but not Sites.ReadWrite.All. ` +
              'Add it under Application permissions and grant admin consent.',
        board: board ? { id: board.id, name: board.name } : null,
        folder: null,
      });
    }

    // Sites.Selected grants nothing until the site is explicitly shared, so make
    // one real call before claiming we are connected.
    const probe = await graphFetch(token, '/sites/root?$select=id');
    if (!probe.ok && (probe.status === 401 || probe.status === 403)) {
      return res.json({
        configured: true,
        linked,
        reachable: false,
        roles,
        message:
          `Graph rejected the request (${probe.status}). If the app uses Sites.Selected, the ` +
          'board-packs site must be shared with it explicitly.',
        board: board ? { id: board.id, name: board.name } : null,
        folder: null,
      });
    }

    let folder = null;
    if (linked) {
      folder = await sp.getFolderDetails(token, board.sharepointDriveId, board.sharepointFolderId);
    }
    return res.json({
      configured: true,
      linked,
      reachable: true,
      message: linked ? 'Connected' : 'Credentials valid — choose a destination folder',
      board: board ? { id: board.id, name: board.name } : null,
      folder: folder
        ? {
            id: folder.id,
            name: folder.name,
            webUrl: folder.webUrl,
            driveId: board.sharepointDriveId,
            siteId: board.sharepointSiteId,
          }
        : null,
    });
  } catch (error) {
    return res.json({
      configured: true,
      linked,
      reachable: false,
      message: error.message,
      board: board ? { id: board.id, name: board.name } : null,
      folder: null,
    });
  }
});

/** Resolve a site by "host:/sites/Name" or by site id. */
router.get('/site', async (req, res) => {
  try {
    const siteId = (req.query.siteId || getDefaultSiteId() || '').trim();
    if (!siteId) {
      return res.status(400).json({
        error: 'No site specified. Pass ?siteId=contoso.sharepoint.com:/sites/BoardPacks or set SHAREPOINT_SITE_ID.',
      });
    }
    const token = await getAppAccessToken();
    res.json(await sp.getSite(token, siteId));
  } catch (error) {
    handle(res, error);
  }
});

/** Document libraries in a site. */
router.get('/drives', async (req, res) => {
  try {
    const siteId = (req.query.siteId || getDefaultSiteId() || '').trim();
    if (!siteId) return res.status(400).json({ error: 'siteId is required' });
    const token = await getAppAccessToken();
    res.json(await sp.listSiteDrives(token, siteId));
  } catch (error) {
    handle(res, error);
  }
});

/** Sub-folders, for drilling down to a destination. */
router.get('/folders', async (req, res) => {
  try {
    const { driveId, folderId = 'root' } = req.query;
    if (!driveId) return res.status(400).json({ error: 'driveId is required' });
    const token = await getAppAccessToken();
    res.json(await sp.listFolders(token, driveId, folderId));
  } catch (error) {
    handle(res, error);
  }
});

/** Save the chosen destination against a board, after checking it is reachable. */
router.post('/destination', async (req, res) => {
  try {
    const { boardId, siteId, driveId, folderId } = req.body || {};
    if (!driveId || !folderId) {
      return res.status(400).json({ error: 'driveId and folderId are required' });
    }

    const board = await resolveBoard(boardId);
    if (!board) return res.status(404).json({ error: 'No board found' });

    const token = await getAppAccessToken();
    const folder = await sp.getFolderDetails(token, driveId, folderId);

    const updated = await prisma.board.update({
      where: { id: board.id },
      data: {
        sharepointSiteId: siteId || getDefaultSiteId(),
        sharepointDriveId: driveId,
        sharepointFolderId: folder.id,
        sharepointFolderName: folder.name,
        sharepointWebUrl: folder.webUrl,
      },
    });

    res.json({
      boardId: updated.id,
      folder: { id: folder.id, name: folder.name, webUrl: folder.webUrl },
    });
  } catch (error) {
    handle(res, error);
  }
});

/** Unlink without touching anything in SharePoint. */
router.delete('/destination', async (req, res) => {
  try {
    const board = await resolveBoard(req.query.boardId);
    if (!board) return res.status(404).json({ error: 'No board found' });

    await prisma.board.update({
      where: { id: board.id },
      data: {
        sharepointSiteId: null,
        sharepointDriveId: null,
        sharepointFolderId: null,
        sharepointFolderName: null,
        sharepointWebUrl: null,
      },
    });

    resetTokenCache();
    res.json({ unlinked: true });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
