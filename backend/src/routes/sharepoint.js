const express = require('express');
const prisma = require('../lib/prisma');
const { getAppAccessToken, getGraphToken, resetTokenCache, getTokenRoles } = require('../lib/graph/auth');
const { graphFetch } = require('../lib/graph/client');
const { isConfigured, getDefaultSiteId } = require('../lib/graph/config');
const sp = require('../lib/graph/sharepoint');
const { isGraphError, isConfigError } = require('../lib/graph/errors');
const {
  startDeviceLogin, completeDeviceLogin, getConnectedAccount, disconnectAccount,
} = require('../lib/graph/auth-device');

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
  const account = await getConnectedAccount();

  try {
    const { token, mode } = await getGraphToken();

    // App-only tokens carry `roles`; a token is issued even for an app with no
    // application permissions at all, and that token 401s on every call. So in
    // application mode, check the roles before claiming anything works.
    // Delegated tokens carry `scp` instead and are checked by the probe below.
    if (mode === 'application') {
      const roles = getTokenRoles(token);
      const canReadSites = roles.some((r) => /^Sites\.(Read|ReadWrite|Selected|Manage|FullControl)/i.test(r));

      if (!canReadSites) {
        return res.json({
          configured: true,
          linked,
          reachable: false,
          mode,
          account: null,
          canSignIn: true,
          roles,
          message:
            roles.length === 0
              ? 'No admin consent yet. Either sign in with a Microsoft account below (uses the ' +
                'delegated permissions the app already has, no admin needed), or ask an Azure ' +
                'admin to add the application permission Sites.ReadWrite.All and grant consent.'
              : `The app registration grants [${roles.join(', ')}] but not Sites.ReadWrite.All. ` +
                'Sign in with a Microsoft account below, or add that application permission.',
          board: board ? { id: board.id, name: board.name } : null,
          folder: null,
        });
      }
    }

    // Sites.Selected grants nothing until the site is explicitly shared, and a
    // delegated token only reaches what its owner can reach — so make one real
    // call before claiming we are connected.
    const probe = await graphFetch(token, '/sites/root?$select=id');
    if (!probe.ok && (probe.status === 401 || probe.status === 403)) {
      return res.json({
        configured: true,
        linked,
        reachable: false,
        mode,
        account: account?.account || null,
        canSignIn: true,
        message:
          mode === 'delegated'
            ? `Graph rejected the signed-in account (${probe.status}). It may not have access to ` +
              'this SharePoint site — try reconnecting with an account that does.'
            : `Graph rejected the request (${probe.status}). If the app uses Sites.Selected, the ` +
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
      mode,
      account: account?.account || null,
      canSignIn: true,
      message: linked
        ? `Connected${mode === 'delegated' && account?.account ? ` as ${account.account}` : ''}`
        : 'Connected — choose a destination folder',
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

/*
 * Sign in with a Microsoft account (device authorization grant).
 *
 * This is the route that needs no Azure change: no redirect URI, no admin
 * consent. The user opens the verification URL, types the code, and approves
 * with their own account — Board Portal then acts with that person's rights.
 */
router.post('/connect/start', async (req, res) => {
  try {
    res.json(await startDeviceLogin());
  } catch (error) {
    handle(res, error);
  }
});

/** Poll until the user finishes approving. Returns {pending:true} until then. */
router.post('/connect/complete', async (req, res) => {
  try {
    const { deviceCode } = req.body || {};
    if (!deviceCode) return res.status(400).json({ error: 'deviceCode is required' });
    res.json(await completeDeviceLogin(deviceCode));
  } catch (error) {
    handle(res, error);
  }
});

/** Forget the signed-in account. Files in SharePoint are untouched. */
router.delete('/connect', async (req, res) => {
  try {
    await disconnectAccount();
    res.json({ disconnected: true });
  } catch (error) {
    handle(res, error);
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
    const { token } = await getGraphToken();
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
    const { token } = await getGraphToken();
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
    const { token } = await getGraphToken();
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

    const { token } = await getGraphToken();
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
