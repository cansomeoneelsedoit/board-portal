const express = require('express');
const prisma = require('../lib/prisma');
const packs = require('../lib/pack-sources');
const sp = require('../lib/graph/sharepoint');
const { getGraphToken } = require('../lib/graph/auth');
const {
  meetingFolderName, matchMeetingFolder, agendaNumberFromFolderName, receivedStatus,
} = require('../lib/board-pack');
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
 * Folders available in the host platform's file vault, for the per-meeting
 * picker. The adapter is registered by the host at boot; standalone there is
 * none and we say so. (Declared before /:meetingId so it is never shadowed.)
 */
router.get('/vault/folders', async (req, res) => {
  try {
    if (!packs.hasVaultAdapter()) {
      return res.status(400).json({
        error: 'The file vault is provided by the host platform (Mason-View) and is not available standalone.',
      });
    }
    const adapter = packs.getVaultAdapter();
    if (typeof adapter.listFolders !== 'function') {
      return res.status(501).json({ error: 'This vault adapter does not support folder browsing.' });
    }
    res.json(await adapter.listFolders());
  } catch (error) {
    handle(res, error);
  }
});

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

/**
 * Received stamps for the agenda.
 *
 * Automates the "Received 29/7/26 @ 15:15" annotations the secretary keeps by
 * hand on the agenda: each agenda item is matched to its pack folder (the
 * numbered sub-folders — "05 Financial & Grand Treasurer's Reports" -> item 5)
 * or to directly-uploaded papers, and the latest file's time becomes the
 * item's received stamp, classified against the papers-due window.
 */
router.get('/:meetingId/received', async (req, res) => {
  try {
    const meeting = await loadMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const board = meeting.board;
    const dueDays = board?.papersDueDays ?? 4;
    const agendaItems = await prisma.agendaItem.findMany({
      where: { meetingId: meeting.id },
      orderBy: { order: 'asc' },
    });

    // itemNumber -> { receivedAt, fileCount }
    const byNumber = new Map();

    const source = packs.effectiveSource(meeting, meeting.board);

    if (source === 'SHAREPOINT' && board?.sharepointDriveId) {
      const { token } = await getGraphToken();
      let folderId = meeting.sharepointFolderId;
      if (!folderId) {
        const children = await sp.listChildren(token, board.sharepointDriveId, board.sharepointFolderId);
        folderId = matchMeetingFolder(children.filter((c) => c.isFolder), meeting)?.id || null;
      }
      if (folderId) {
        const entries = await sp.listChildren(token, board.sharepointDriveId, folderId);
        for (const entry of entries.filter((e) => e.isFolder)) {
          const number = agendaNumberFromFolderName(entry.name);
          if (number === null) continue;
          const files = (await sp.listChildren(token, board.sharepointDriveId, entry.id))
            .filter((f) => !f.isFolder);
          if (!files.length) {
            if (!byNumber.has(number)) byNumber.set(number, { receivedAt: null, fileCount: 0 });
            continue;
          }
          const latest = files.reduce((a, b) =>
            new Date(a.modifiedAt || 0) > new Date(b.modifiedAt || 0) ? a : b);
          byNumber.set(number, {
            receivedAt: latest.modifiedAt,
            fileCount: files.length,
            files: files.map((f) => ({ name: f.name, receivedAt: f.modifiedAt })),
          });
        }
      }
    } else {
      // LOCAL: uploaded papers carry their agenda item directly.
      const docs = await prisma.document.findMany({
        where: { meetingId: meeting.id, agendaItemId: { not: null } },
      });
      const byItem = new Map();
      for (const d of docs) {
        const at = d.modifiedAt || d.createdAt;
        const cur = byItem.get(d.agendaItemId) || { receivedAt: at, fileCount: 0, files: [] };
        if (new Date(at) > new Date(cur.receivedAt)) cur.receivedAt = at;
        cur.fileCount += 1;
        cur.files.push({ name: d.name, receivedAt: at });
        byItem.set(d.agendaItemId, cur);
      }
      for (const item of agendaItems) {
        const hit = byItem.get(item.id);
        if (hit) byNumber.set(Number(item.number), hit);
      }
    }

    const dueAt = meeting.date
      ? new Date(new Date(meeting.date).getTime() - dueDays * 86400000)
      : null;

    res.json({
      meetingDate: meeting.date,
      dueDays,
      dueAt,
      items: agendaItems.map((item) => {
        const hit = byNumber.get(Number(item.number));
        return {
          agendaItemId: item.id,
          number: item.number,
          receivedAt: hit?.receivedAt || null,
          fileCount: hit?.fileCount || 0,
          // Each report stamped individually — one item can have the
          // executive report on time and another paper late.
          files: (hit?.files || []).map((f) => ({
            ...f,
            status: receivedStatus(f.receivedAt, meeting.date, dueDays),
          })),
          // null when nothing has arrived — "awaited" only if a folder exists.
          status: hit?.receivedAt
            ? receivedStatus(hit.receivedAt, meeting.date, dueDays)
            : hit ? 'AWAITED' : null,
        };
      }),
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
    const { name, tags, agendaItemId, relativePath } = req.body || {};

    if (source === 'LOCAL') {
      const document = await packs.saveLocalUpload(meeting, file, {
        name, tags, agendaItemId, relativePath,
      });
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
