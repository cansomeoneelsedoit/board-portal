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
  // A meeting pinned by URL carries its own drive and works without any
  // board-level library link.
  const driveId = meeting.sharepointDriveId || board?.sharepointDriveId;
  if (!driveId) {
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
    folder = await sp.getFolderDetails(token, driveId, target);
  } else if (board?.sharepointDriveId && board?.sharepointFolderId) {
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
    items: await sp.listChildren(token, driveId, target),
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
const getVaultAdapter = () => vaultAdapter;

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
    items: documents
      .map((d) => ({
        id: d.id,
        name: d.name,
        isFolder: false,
        folder: d.sharepointFolder || null,
        size: d.size || 0,
        mimetype: d.mimetype,
        // Served by the static /uploads mount.
        webUrl: `/uploads/${d.path}`,
        modifiedAt: d.modifiedAt || d.createdAt,
        modifiedBy: null,
        documentId: d.id,
      }))
      // Group folder-uploads together, folders first, like a real library.
      .sort((a, b) =>
        (a.folder || '') === (b.folder || '')
          ? a.name.localeCompare(b.name)
          : String(a.folder || '~').localeCompare(String(b.folder || '~'))
      ),
  };
}

/**
 * Save an uploaded file for a LOCAL-source meeting.
 *
 * meta.relativePath preserves folder structure when a whole folder is
 * uploaded ("05 Financial Reports/2026 FR AFAM Inc.pdf") — sub-folders are
 * recreated on disk and the top-level folder becomes the grouping label, so
 * the pack browser reads like the folder that was dropped in.
 */
async function saveLocalUpload(meeting, file, meta = {}) {
  // Sanitise every path segment; reject traversal outright.
  const cleanSegment = (s) => String(s).replace(/[\\:*?"<>|]/g, '-').replace(/^\.+$/, '-').trim();
  const relSegments = String(meta.relativePath || '')
    .split('/')
    .map(cleanSegment)
    .filter((s) => s && s !== '-');
  // The last segment of relativePath is the filename itself.
  if (relSegments.length) relSegments.pop();

  const dir = path.join(meetingUploadDir(meeting.id), ...relSegments);
  fs.mkdirSync(dir, { recursive: true });

  const safeName = cleanSegment(path.basename(file.name)) || 'paper';
  let finalName = safeName;
  let counter = 1;
  while (fs.existsSync(path.join(dir, finalName))) {
    const ext = path.extname(safeName);
    finalName = `${path.basename(safeName, ext)} (${counter++})${ext}`;
  }

  const full = path.join(dir, finalName);
  // Belt and braces: whatever the segments were, stay inside the upload root.
  if (!path.resolve(full).startsWith(path.resolve(UPLOAD_DIR))) {
    throw new Error('Upload path escapes the upload directory');
  }
  await fs.promises.writeFile(full, file.data);

  return prisma.document.create({
    data: {
      name: meta.name || file.name,
      filename: finalName,
      mimetype: file.mimetype,
      size: file.size,
      path: ['meetings', meeting.id, ...relSegments, finalName].join('/'),
      tags: meta.tags || '',
      meetingId: meeting.id,
      agendaItemId: meta.agendaItemId || null,
      source: 'LOCAL',
      // Grouping label: the sub-folder the file sits in, like SharePoint packs.
      sharepointFolder: relSegments.join('/') || null,
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

async function getPack(meeting, board, { folderId, sourceOverride } = {}) {
  // An agenda dive knows its folder lives in SharePoint even when the
  // meeting's own papers are set to direct upload — honour the override.
  const source = SOURCES.includes(sourceOverride) ? sourceOverride : effectiveSource(meeting, board);

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
  UPLOAD_DIR,
};
