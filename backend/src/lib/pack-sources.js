const fs = require('fs');
const path = require('path');
const prisma = require('./prisma');
const sp = require('./graph/sharepoint');
const { getGraphToken } = require('./graph/auth');
const { matchMeetingFolder, meetingFolderName } = require('./board-pack');
const { MicrosoftGraphConfigError } = require('./graph/errors');

/*
 * Where a meeting's papers come from.
 *
 * Three sources, one shape. Whichever a meeting uses, callers get
 * { source, folder, items, canUpload } and the browser renders it the same way,
 * so choosing a source is a setting rather than a different feature.
 *
 *   SHAREPOINT  the board's document library. Files live in SharePoint; we hold
 *               pointers. Best when papers are already filed there.
 *   VAULT       the host platform's file vault. Only available inside a vertical
 *               that provides one — see the adapter note below.
 *   LOCAL       uploaded straight into Board Portal. Simplest, and the fallback
 *               when neither of the above is set up.
 */

const SOURCES = ['SHAREPOINT', 'VAULT', 'LOCAL'];

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

/** A meeting's effective source, resolving INHERIT against the board. */
function effectiveSource(meeting, board) {
  const own = (meeting?.packSource || 'INHERIT').toUpperCase();
  if (own !== 'INHERIT' && SOURCES.includes(own)) return own;
  const boardDefault = (board?.packSource || 'SHAREPOINT').toUpperCase();
  return SOURCES.includes(boardDefault) ? boardDefault : 'SHAREPOINT';
}

/* ------------------------------------------------------------- sharepoint */

async function sharepointPack(meeting, board, folderId) {
  if (!board?.sharepointDriveId) {
    return {
      source: 'SHAREPOINT',
      configured: false,
      folder: null,
      items: [],
      canUpload: false,
      message: 'No SharePoint library is linked to this board yet.',
    };
  }

  const { token } = await getGraphToken();

  let target = folderId || meeting.sharepointFolderId;
  let folder = null;

  if (target) {
    folder = await sp.getFolderDetails(token, board.sharepointDriveId, target);
  } else {
    const children = await sp.listChildren(token, board.sharepointDriveId, board.sharepointFolderId);
    folder = matchMeetingFolder(children.filter((c) => c.isFolder), meeting);
    target = folder?.id || null;
  }

  if (!target) {
    return {
      source: 'SHAREPOINT',
      configured: true,
      folder: null,
      items: [],
      canUpload: true,
      expectedFolder: meetingFolderName(meeting),
      rootWebUrl: board.sharepointWebUrl,
      message: `No folder for this meeting yet. Expected "${meetingFolderName(meeting)}".`,
    };
  }

  return {
    source: 'SHAREPOINT',
    configured: true,
    folder: { id: folder.id, name: folder.name, webUrl: folder.webUrl },
    items: await sp.listChildren(token, board.sharepointDriveId, target),
    canUpload: true,
  };
}

/* ------------------------------------------------------------------ vault */

/**
 * The host platform's file vault.
 *
 * Board Portal has no vault of its own — the vertical it runs inside does. The
 * host registers an adapter at boot; standalone there is none, and we say so
 * plainly rather than pretending the source exists.
 */
let vaultAdapter = null;
const registerVaultAdapter = (adapter) => { vaultAdapter = adapter; };
const hasVaultAdapter = () => Boolean(vaultAdapter);

async function vaultPack(meeting) {
  if (!vaultAdapter) {
    return {
      source: 'VAULT',
      configured: false,
      folder: null,
      items: [],
      canUpload: false,
      message:
        'The file vault is provided by the host platform and is not available when Board Portal ' +
        'runs on its own. Use SharePoint or direct upload here.',
    };
  }

  if (!meeting.vaultFolderId) {
    return {
      source: 'VAULT',
      configured: true,
      folder: null,
      items: [],
      canUpload: true,
      message: 'No vault folder chosen for this meeting yet.',
    };
  }

  const result = await vaultAdapter.list(meeting.vaultFolderId);
  return {
    source: 'VAULT',
    configured: true,
    folder: result.folder,
    items: result.items,
    canUpload: true,
  };
}

/* ------------------------------------------------------------------ local */

const meetingUploadDir = (meetingId) => path.join(UPLOAD_DIR, 'meetings', meetingId);

async function localPack(meeting) {
  const documents = await prisma.document.findMany({
    where: { meetingId: meeting.id, source: 'LOCAL' },
    include: { agendaItem: true },
    orderBy: { createdAt: 'desc' },
  });

  return {
    source: 'LOCAL',
    configured: true,
    folder: { id: null, name: 'Uploaded papers', webUrl: null },
    canUpload: true,
    items: documents.map((d) => ({
      id: d.id,
      name: d.name,
      isFolder: false,
      size: d.size || 0,
      mimetype: d.mimetype,
      // Served by the static /uploads mount.
      webUrl: `/uploads/${d.path}`,
      modifiedAt: d.modifiedAt || d.createdAt,
      modifiedBy: null,
      documentId: d.id,
    })),
  };
}

/** Save an uploaded file for a LOCAL-source meeting. */
async function saveLocalUpload(meeting, file, meta = {}) {
  const dir = meetingUploadDir(meeting.id);
  fs.mkdirSync(dir, { recursive: true });

  // Keep the original name but never let it escape the meeting's directory.
  const safeName = path.basename(file.name).replace(/[\\/:*?"<>|]/g, '-');
  let finalName = safeName;
  let counter = 1;
  while (fs.existsSync(path.join(dir, finalName))) {
    const ext = path.extname(safeName);
    finalName = `${path.basename(safeName, ext)} (${counter++})${ext}`;
  }

  await fs.promises.writeFile(path.join(dir, finalName), file.data);

  return prisma.document.create({
    data: {
      name: meta.name || file.name,
      filename: finalName,
      mimetype: file.mimetype,
      size: file.size,
      path: `meetings/${meeting.id}/${finalName}`,
      tags: meta.tags || '',
      meetingId: meeting.id,
      agendaItemId: meta.agendaItemId || null,
      source: 'LOCAL',
      modifiedAt: new Date(),
    },
  });
}

/** Remove a locally-stored paper, file included. */
async function deleteLocalDocument(documentId) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.source !== 'LOCAL') return false;

  if (doc.path) {
    const full = path.join(UPLOAD_DIR, doc.path);
    // Refuse anything that resolves outside the upload directory.
    if (full.startsWith(path.resolve(UPLOAD_DIR)) && fs.existsSync(full)) {
      await fs.promises.unlink(full).catch(() => {});
    }
  }

  await prisma.document.delete({ where: { id: doc.id } });
  return true;
}

/* --------------------------------------------------------------- dispatch */

async function getPack(meeting, board, { folderId } = {}) {
  const source = effectiveSource(meeting, board);

  try {
    if (source === 'SHAREPOINT') return await sharepointPack(meeting, board, folderId);
    if (source === 'VAULT') return await vaultPack(meeting);
    return await localPack(meeting);
  } catch (error) {
    // Credentials missing is a setup state, not a failure to report as broken.
    if (error instanceof MicrosoftGraphConfigError) {
      return {
        source,
        configured: false,
        folder: null,
        items: [],
        canUpload: false,
        message: error.message,
      };
    }
    throw error;
  }
}

module.exports = {
  SOURCES,
  effectiveSource,
  getPack,
  saveLocalUpload,
  deleteLocalDocument,
  registerVaultAdapter,
  hasVaultAdapter,
  meetingUploadDir,
};
