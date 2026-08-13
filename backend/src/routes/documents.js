const express = require('express');
const prisma = require('../lib/prisma');
const { getGraphToken } = require('../lib/graph/auth');
const { isConfigured } = require('../lib/graph/config');
const sp = require('../lib/graph/sharepoint');
const { isGraphError, isConfigError } = require('../lib/graph/errors');
const { meetingFolderName } = require('../lib/board-pack');

const router = express.Router();

/*
 * Board packs are stored in SharePoint, not here.
 *
 * A Document row is a pointer plus the governance metadata SharePoint has no
 * concept of — which agenda item a paper belongs to, and its tags. Because
 * there is only ever one copy of the file, "upload in the app" and "drop it in
 * SharePoint" converge automatically: reconcile() re-reads the folder and makes
 * the rows match what is actually there.
 */

function handle(res, error) {
  if (isConfigError(error)) return res.status(503).json({ error: error.message, configured: false });
  if (isGraphError(error)) return res.status(502).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: error.message || 'Request failed' });
}

const boardFor = async (boardId) =>
  boardId
    ? prisma.board.findUnique({ where: { id: boardId } })
    : prisma.board.findFirst({ orderBy: { createdAt: 'asc' } });

const isLinked = (board) => Boolean(board?.sharepointDriveId && board?.sharepointFolderId);

/**
 * Make the Document rows match the SharePoint folder.
 *
 * - file present in SharePoint, no row  -> create a row (it was added in SharePoint)
 * - file present in both                -> refresh name/size/etag, keep agendaItemId + tags
 * - row present, file gone              -> drop the row (it was deleted in SharePoint)
 *
 * Returns the reconciled rows.
 */
async function reconcile(board) {
  const { token } = await getGraphToken();
  const remote = await sp.listBoardDocuments(token, {
    driveId: board.sharepointDriveId,
    folderId: board.sharepointFolderId,
  });

  const existing = await prisma.document.findMany({
    where: { sharepointDriveId: board.sharepointDriveId },
  });
  const byItemId = new Map(existing.map((d) => [d.sharepointItemId, d]));
  const seen = new Set();
  const now = new Date();

  // Map "2026-08-19 August Ordinary Meeting" folders back onto meetings.
  const meetings = await prisma.meeting.findMany({ where: { boardId: board.id } });
  const meetingByFolder = new Map(meetings.map((m) => [meetingFolderName(m), m.id]));

  for (const item of remote) {
    seen.add(item.itemId);
    const prior = byItemId.get(item.itemId);

    const data = {
      name: prior?.name && prior.name !== prior.filename ? prior.name : item.name,
      filename: item.name,
      mimetype: item.mimetype,
      size: item.size,
      source: 'SHAREPOINT',
      sharepointDriveId: board.sharepointDriveId,
      sharepointItemId: item.itemId,
      sharepointWebUrl: item.webUrl,
      sharepointFolder: item.folder,
      etag: item.etag,
      modifiedAt: item.modifiedAt ? new Date(item.modifiedAt) : null,
      lastSyncedAt: now,
      meetingId: prior?.meetingId ?? meetingByFolder.get(item.folder) ?? null,
    };

    if (prior) {
      // Never clobber the governance metadata a user set in the app.
      await prisma.document.update({ where: { id: prior.id }, data });
    } else {
      await prisma.document.create({ data });
    }
  }

  // Anything we previously tracked that has since vanished from SharePoint.
  const stale = existing.filter((d) => d.sharepointItemId && !seen.has(d.sharepointItemId));
  if (stale.length) {
    await prisma.document.deleteMany({ where: { id: { in: stale.map((d) => d.id) } } });
  }

  return prisma.document.findMany({
    where: { sharepointDriveId: board.sharepointDriveId },
    include: { agendaItem: true },
    orderBy: { modifiedAt: 'desc' },
  });
}

/**
 * List documents. Reads SharePoint live so files added there show up here.
 * Pass ?refresh=0 to read only the cached rows (useful if Graph is slow).
 */
router.get('/', async (req, res) => {
  try {
    const board = await boardFor(req.query.boardId);

    if (!isLinked(board) || !isConfigured()) {
      const docs = await prisma.document.findMany({
        include: { agendaItem: true },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({
        source: 'local',
        linked: false,
        configured: isConfigured(),
        documents: docs,
      });
    }

    if (req.query.refresh === '0') {
      const docs = await prisma.document.findMany({
        where: { sharepointDriveId: board.sharepointDriveId },
        include: { agendaItem: true },
        orderBy: { modifiedAt: 'desc' },
      });
      return res.json({ source: 'cache', linked: true, configured: true, documents: docs });
    }

    const documents = await reconcile(board);
    res.json({
      source: 'sharepoint',
      linked: true,
      configured: true,
      folder: {
        name: board.sharepointFolderName,
        webUrl: board.sharepointWebUrl,
      },
      documents,
    });
  } catch (error) {
    handle(res, error);
  }
});

/** Force a reconcile. Same as GET but explicit, for the Refresh button. */
router.post('/sync', async (req, res) => {
  try {
    const board = await boardFor(req.body?.boardId);
    if (!isLinked(board)) return res.status(400).json({ error: 'No SharePoint folder linked' });
    const documents = await reconcile(board);
    res.json({ synced: documents.length, documents });
  } catch (error) {
    handle(res, error);
  }
});

/** Upload straight into SharePoint, then record the pointer. */
router.post('/upload', async (req, res) => {
  try {
    const board = await boardFor(req.body?.boardId);
    if (!isLinked(board)) {
      return res.status(400).json({ error: 'No SharePoint folder linked for this board' });
    }

    const file = req.files?.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded (expected field "file")' });

    const { meetingId, agendaItemId, tags, name } = req.body || {};

    const meeting = meetingId
      ? await prisma.meeting.findUnique({ where: { id: meetingId } })
      : null;
    const segments = [meetingFolderName(meeting)];

    const { token } = await getGraphToken();
    const uploaded = await sp.uploadDocument(
      token,
      { driveId: board.sharepointDriveId, folderId: board.sharepointFolderId },
      segments,
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
      meetingId: meetingId || null,
      agendaItemId: agendaItemId || null,
      source: 'SHAREPOINT',
      sharepointDriveId: board.sharepointDriveId,
      sharepointItemId: uploaded.itemId,
      sharepointWebUrl: uploaded.webUrl,
      sharepointFolder: segments[0],
      etag: uploaded.etag,
      modifiedAt: uploaded.modifiedAt ? new Date(uploaded.modifiedAt) : new Date(),
      lastSyncedAt: new Date(),
    };

    // Re-uploading the same filename replaces the SharePoint item, so upsert.
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

    res.status(201).json(document);
  } catch (error) {
    handle(res, error);
  }
});

/** Redirect to a short-lived Graph download URL — bytes never pass through here. */
router.get('/:id/download', async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (doc.source !== 'SHAREPOINT' || !doc.sharepointItemId) {
      return res.status(409).json({ error: 'This document is not stored in SharePoint' });
    }

    const { token } = await getGraphToken();
    const url = await sp.getDownloadUrl(token, doc.sharepointDriveId, doc.sharepointItemId);
    if (!url) return res.status(404).json({ error: 'No download URL available' });
    res.redirect(url);
  } catch (error) {
    handle(res, error);
  }
});

/** Governance metadata only. Renaming the file in SharePoint is done there. */
router.patch('/:id', async (req, res) => {
  try {
    const { name, tags, agendaItemId, meetingId } = req.body || {};
    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(agendaItemId !== undefined ? { agendaItemId: agendaItemId || null } : {}),
        ...(meetingId !== undefined ? { meetingId: meetingId || null } : {}),
      },
      include: { agendaItem: true },
    });
    res.json(document);
  } catch (error) {
    handle(res, error);
  }
});

/** Delete in SharePoint too — otherwise the next reconcile would bring it back. */
router.delete('/:id', async (req, res) => {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (doc.source === 'SHAREPOINT' && doc.sharepointItemId) {
      const { token } = await getGraphToken();
      await sp.deleteItem(token, doc.sharepointDriveId, doc.sharepointItemId);
    }

    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ deleted: true });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { agendaItem: true },
    });
    if (!document) return res.status(404).json({ error: 'Not found' });
    res.json(document);
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
