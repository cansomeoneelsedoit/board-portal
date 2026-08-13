const express = require('express');
const prisma = require('../lib/prisma');
const packs = require('../lib/pack-sources');
const sp = require('../lib/graph/sharepoint');
const { getGraphToken } = require('../lib/graph/auth');
const { meetingFolderName } = require('../lib/board-pack');
const { isGraphError, isConfigError } = require('../lib/graph/errors');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

function handle(res, error) {
  if (isConfigError(error)) return res.status(503).json({ error: error.message, configured: false });
  if (isGraphError(error)) return res.status(502).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: error.message || 'Request failed' });
}

const loadMeeting = (id) =>
  prisma.meeting.findUnique({ where: { id }, include: { board: true } });

/**
 * A meeting's papers, whatever they are stored in.
 *
 * ?folderId= drills into a sub-folder (SharePoint only) so the browser can walk
 * a deep structure one level at a time.
 */
router.get('/:meetingId', async (req, res) => {
  try {
    const meeting = await loadMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const pack = await packs.getPack(meeting, meeting.board, { folderId: req.query.folderId });

    res.json({
      ...pack,
      meetingId: meeting.id,
      packSource: meeting.packSource,
      effectiveSource: packs.effectiveSource(meeting, meeting.board),
      vaultAvailable: packs.hasVaultAdapter(),
    });
  } catch (error) {
    handle(res, error);
  }
});

/** Choose where this meeting's papers come from. */
router.put('/:meetingId/source', requireAdmin, async (req, res) => {
  try {
    const { source, vaultFolderId, vaultPath, sharepointFolderId } = req.body || {};
    const next = String(source || '').toUpperCase();

    if (next !== 'INHERIT' && !packs.SOURCES.includes(next)) {
      return res.status(400).json({
        error: `Source must be one of INHERIT, ${packs.SOURCES.join(', ')}`,
      });
    }

    if (next === 'VAULT' && !packs.hasVaultAdapter()) {
      return res.status(400).json({
        error:
          'The file vault is provided by the host platform and is not available here. ' +
          'Use SharePoint or direct upload.',
      });
    }

    const meeting = await prisma.meeting.update({
      where: { id: req.params.meetingId },
      data: {
        packSource: next,
        ...(vaultFolderId !== undefined ? { vaultFolderId: vaultFolderId || null } : {}),
        ...(vaultPath !== undefined ? { vaultPath: vaultPath || null } : {}),
        ...(sharepointFolderId !== undefined
          ? { sharepointFolderId: sharepointFolderId || null }
          : {}),
      },
      include: { board: true },
    });

    res.json({
      meetingId: meeting.id,
      packSource: meeting.packSource,
      effectiveSource: packs.effectiveSource(meeting, meeting.board),
    });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * Add a paper to the meeting.
 *
 * Goes wherever the meeting's source points: into SharePoint via Graph, or onto
 * this service's disk for a LOCAL meeting. The caller does not choose — the
 * meeting's configured source does.
 */
router.post('/:meetingId/upload', requireAdmin, async (req, res) => {
  try {
    const meeting = await loadMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const file = req.files?.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded (expected field "file")' });

    const source = packs.effectiveSource(meeting, meeting.board);
    const { name, tags, agendaItemId } = req.body || {};

    if (source === 'LOCAL') {
      const document = await packs.saveLocalUpload(meeting, file, { name, tags, agendaItemId });
      return res.status(201).json({ source, document });
    }

    if (source === 'VAULT') {
      return res.status(400).json({
        error: 'Uploading to the file vault is handled by the host platform.',
      });
    }

    // SharePoint: create the meeting's folder if it does not exist yet, so the
    // first upload of a new meeting works without anyone pre-making folders.
    const board = meeting.board;
    if (!board?.sharepointDriveId) {
      return res.status(400).json({ error: 'No SharePoint library linked to this board' });
    }

    const { token } = await getGraphToken();
    const folderName = meeting.sharepointFolderId ? null : meetingFolderName(meeting);

    const uploaded = await sp.uploadDocument(
      token,
      {
        driveId: board.sharepointDriveId,
        folderId: meeting.sharepointFolderId || board.sharepointFolderId,
      },
      folderName ? [folderName] : [],
      file.name,
      file.data,
      file.mimetype
    );

    const data = {
      name: name || file.name,
      filename: uploaded.name,
      mimetype: uploaded.mimetype || file.mimetype,
      size: uploaded.size || file.size,
      tags: tags || '',
      meetingId: meeting.id,
      agendaItemId: agendaItemId || null,
      source: 'SHAREPOINT',
      sharepointDriveId: board.sharepointDriveId,
      sharepointItemId: uploaded.itemId,
      sharepointWebUrl: uploaded.webUrl,
      sharepointFolder: folderName,
      etag: uploaded.etag,
      modifiedAt: uploaded.modifiedAt ? new Date(uploaded.modifiedAt) : new Date(),
      lastSyncedAt: new Date(),
    };

    const document = await prisma.document.upsert({
      where: {
        sharepointDriveId_sharepointItemId: {
          sharepointDriveId: board.sharepointDriveId,
          sharepointItemId: uploaded.itemId,
        },
      },
      update: data,
      create: data,
    });

    res.status(201).json({ source, document });
  } catch (error) {
    handle(res, error);
  }
});

/** Remove a locally-uploaded paper. SharePoint items are deleted via /documents. */
router.delete('/:meetingId/items/:documentId', requireAdmin, async (req, res) => {
  try {
    const removed = await packs.deleteLocalDocument(req.params.documentId);
    if (!removed) {
      return res.status(400).json({
        error: 'That paper is not stored in Board Portal — remove it where it lives.',
      });
    }
    res.json({ deleted: true });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
