const express = require('express');
const prisma = require('../lib/prisma');
const packs = require('../lib/pack-sources');
const sp = require('../lib/graph/sharepoint');
const { getGraphToken } = require('../lib/graph/auth');
const {
  meetingFolderName, matchMeetingFolder, agendaNumberFromFolderName, receivedStatus,
  agendaItemFromFolderName,
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

    const pack = await packs.getPack(meeting, meeting.board, {
      folderId: req.query.folderId,
      sourceOverride: String(req.query.source || '').toUpperCase() || undefined,
    });

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

    // itemNumber -> { receivedAt, fileCount, files }
    const byNumber = new Map();
    const stamp = (number, at, file) => {
      const cur = byNumber.get(number) || { receivedAt: null, fileCount: 0, files: [] };
      if (at && (!cur.receivedAt || new Date(at) > new Date(cur.receivedAt))) cur.receivedAt = at;
      if (file) {
        cur.fileCount += 1;
        cur.files.push(file);
      }
      byNumber.set(number, cur);
    };

    // A paper's received stamp is when it FIRST arrived, and it locks — a
    // minor edit to a file never rewrites when it was received. Edits show as
    // a separate "updated" time instead, and only when the file changed.
    const UPDATED_SLACK_MS = 60 * 1000;

    // Papers uploaded into the portal always count, whatever the pack source —
    // a meeting can follow a SharePoint pack AND have papers tabled directly.
    // Received is the upload moment; a replaced file shows as updated.
    const docs = await prisma.document.findMany({
      where: { meetingId: meeting.id, agendaItemId: { not: null } },
    });
    const itemNumber = new Map(agendaItems.map((i) => [i.id, Number(i.number)]));
    for (const d of docs) {
      const number = itemNumber.get(d.agendaItemId);
      if (number === undefined) continue;
      const receivedAt = d.createdAt;
      const updatedAt =
        d.modifiedAt && new Date(d.modifiedAt) - new Date(receivedAt) > UPDATED_SLACK_MS
          ? d.modifiedAt
          : null;
      stamp(number, receivedAt, { name: d.name, receivedAt, updatedAt });
    }

    const source = packs.effectiveSource(meeting, meeting.board);
    const meetingDriveId = meeting.sharepointDriveId || board?.sharepointDriveId;
    if (source === 'SHAREPOINT' && meetingDriveId) {
      const { token } = await getGraphToken();
      let folderId = meeting.sharepointFolderId;
      if (!folderId && board?.sharepointDriveId && board?.sharepointFolderId) {
        const children = await sp.listChildren(token, board.sharepointDriveId, board.sharepointFolderId);
        folderId = matchMeetingFolder(children.filter((c) => c.isFolder), meeting)?.id || null;
      }

      // What the pack holds right now, folder by folder.
      const spFiles = [];
      if (folderId) {
        const entries = await sp.listChildren(token, meetingDriveId, folderId);
        for (const entry of entries.filter((e) => e.isFolder)) {
          const number = agendaNumberFromFolderName(entry.name);
          if (number === null) continue;
          const files = (await sp.listChildren(token, meetingDriveId, entry.id))
            .filter((f) => !f.isFolder);
          if (!files.length) {
            // Folder exists but nothing in it — the paper is awaited.
            if (!byNumber.has(number)) byNumber.set(number, { receivedAt: null, fileCount: 0, files: [] });
            continue;
          }
          for (const f of files) spFiles.push({ number, file: f });
        }
      }

      // First sighting locks the received stamp; later sightings only move
      // the file's last-modified time when SharePoint says it changed.
      const receipts = new Map(
        (await prisma.packFileReceipt.findMany({ where: { meetingId: meeting.id } }))
          .map((r) => [r.itemId, r])
      );
      const newReceipts = [];
      for (const { number, file } of spFiles) {
        const modified = file.modifiedAt ? new Date(file.modifiedAt) : new Date();
        let receipt = receipts.get(file.id);
        if (!receipt) {
          receipt = {
            meetingId: meeting.id,
            itemId: file.id,
            name: file.name,
            receivedAt: modified,
            lastModifiedAt: modified,
          };
          newReceipts.push(receipt);
        } else if (modified > new Date(receipt.lastModifiedAt)) {
          await prisma.packFileReceipt.update({
            where: { id: receipt.id },
            data: { lastModifiedAt: modified, name: file.name },
          });
          receipt.lastModifiedAt = modified;
        }
        const updatedAt =
          new Date(receipt.lastModifiedAt) - new Date(receipt.receivedAt) > UPDATED_SLACK_MS
            ? receipt.lastModifiedAt
            : null;
        stamp(number, receipt.receivedAt, { name: file.name, receivedAt: receipt.receivedAt, updatedAt });
      }
      if (newReceipts.length) {
        await prisma.packFileReceipt.createMany({ data: newReceipts, skipDuplicates: true });
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

/**
 * Build (or refresh) the agenda from the pack's numbered folders.
 *
 * "03 Conflict of Interest" becomes item 3; "10.01 Grand Registrar" item
 * 10.01. Each generated item remembers its folder, so re-syncing after a
 * rename updates the item, and a deleted folder removes it. Items added by
 * hand carry no folder and are never touched — the two ways of building an
 * agenda coexist on one meeting.
 */
router.post('/:meetingId/sync-agenda', requireAdmin, async (req, res) => {
  try {
    const meeting = await loadMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const driveId = meeting.sharepointDriveId || meeting.board?.sharepointDriveId;
    let folderId = meeting.sharepointFolderId;
    const { token } = await getGraphToken();

    if (!folderId && meeting.board?.sharepointDriveId && meeting.board?.sharepointFolderId) {
      const children = await sp.listChildren(token, meeting.board.sharepointDriveId, meeting.board.sharepointFolderId);
      folderId = matchMeetingFolder(children.filter((c) => c.isFolder), meeting)?.id || null;
    }
    if (!driveId || !folderId) {
      return res.status(400).json({ error: 'Link this meeting to its pack folder first (Edit Meeting)' });
    }

    const entries = (await sp.listChildren(token, driveId, folderId)).filter((e) => e.isFolder);
    const existing = await prisma.agendaItem.findMany({ where: { meetingId: meeting.id } });
    const bySource = new Map(existing.filter((i) => i.sourceFolderId).map((i) => [i.sourceFolderId, i]));

    let created = 0;
    let updated = 0;
    const seen = new Set();

    for (const entry of entries) {
      const parsed = agendaItemFromFolderName(entry.name);
      if (!parsed) continue; // unnumbered folders are reference material
      seen.add(entry.id);

      const prior = bySource.get(entry.id);
      if (prior) {
        if (prior.number !== parsed.number || prior.title !== parsed.title || prior.order !== parsed.sort) {
          await prisma.agendaItem.update({
            where: { id: prior.id },
            data: { number: parsed.number, title: parsed.title, order: parsed.sort },
          });
          updated += 1;
        }
      } else {
        await prisma.agendaItem.create({
          data: {
            meetingId: meeting.id,
            sourceFolderId: entry.id,
            number: parsed.number,
            title: parsed.title,
            order: parsed.sort,
          },
        });
        created += 1;
      }
    }

    // Folder gone → its derived item goes; hand-made items are untouched.
    const stale = existing.filter((i) => i.sourceFolderId && !seen.has(i.sourceFolderId));
    if (stale.length) {
      await prisma.agendaItem.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });
    }

    res.json({ created, updated, removed: stale.length, followed: entries.length });
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
 * this service's disk for a LOCAL meeting.
 *
 * Who may put it where follows the boardroom rule: an administrator can file a
 * paper anywhere in the pack (the folder they have open in the browser), but
 * everyone else's papers — and anything tabled on the floor — go into the
 * meeting's "Late papers" folder, the one place in the pack that accepts
 * papers after it went out.
 */
router.post('/:meetingId/upload', async (req, res) => {
  try {
    const meeting = await loadMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const file = req.files?.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded (expected field "file")' });

    const admin = req.session?.role === 'ADMIN';
    const source = packs.effectiveSource(meeting, meeting.board);
    let { name, tags, agendaItemId, relativePath, folderId: requestedFolderId } = req.body || {};

    // Only an administrator chooses where a paper goes or what it attaches to.
    if (!admin) {
      agendaItemId = null;
      requestedFolderId = null;
      relativePath = null;
      tags = [tags, 'late-paper'].filter(Boolean).join(',');
    }

    const tabled = /\btabled\b/i.test(tags || '');
    const lateBound = tabled || !admin;

    // A late or tabled paper is business arising on the day — attach it to the
    // agenda item where the meeting will actually address it: Late papers if
    // the agenda has one, else General business / Any other business.
    if (!agendaItemId && lateBound) {
      for (const title of ['Late papers', 'General business', 'other business']) {
        const item = await prisma.agendaItem.findFirst({
          where: { meetingId: meeting.id, title: { contains: title, mode: 'insensitive' } },
        });
        if (item) { agendaItemId = item.id; break; }
      }
    }

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

    // SharePoint. Resolve the meeting's folder first: its own pin, or matched
    // by date under the board library, created if it does not exist yet.
    const board = meeting.board;
    const driveId = meeting.sharepointDriveId || board?.sharepointDriveId;
    if (!driveId) {
      return res.status(400).json({ error: 'No SharePoint library linked to this board' });
    }

    const { token } = await getGraphToken();

    let baseFolderId = meeting.sharepointFolderId;
    let segments = [];
    if (!baseFolderId) {
      if (!board?.sharepointFolderId) {
        return res.status(400).json({ error: 'Pin a SharePoint folder to this meeting first.' });
      }
      baseFolderId = board.sharepointFolderId;
      const children = await sp.listChildren(token, driveId, baseFolderId);
      const matched = matchMeetingFolder(children.filter((c) => c.isFolder), meeting);
      if (matched) baseFolderId = matched.id;
      else segments = [meetingFolderName(meeting)];
    }

    let targetFolderId = baseFolderId;
    let folderLabel = segments.join('/') || null;

    if (admin && requestedFolderId && !lateBound) {
      // Wherever the administrator has navigated to — anywhere in the pack.
      targetFolderId = requestedFolderId;
      segments = [];
      folderLabel = null;
    } else if (lateBound) {
      // The one writable folder for everyone else. Reuse the pack's own late
      // folder whatever it is numbered ("15. Late papers"), create otherwise.
      let late = null;
      if (!segments.length) {
        const children = await sp.listChildren(token, driveId, baseFolderId);
        late = children.find((c) => c.isFolder && /late\s*papers/i.test(c.name)) || null;
      }
      if (late) {
        targetFolderId = late.id;
        segments = [];
        folderLabel = late.name;
        // If the agenda follows the pack, the late folder IS an agenda item.
        if (!agendaItemId) {
          const item = await prisma.agendaItem.findFirst({
            where: { meetingId: meeting.id, sourceFolderId: late.id },
          });
          if (item) agendaItemId = item.id;
        }
      } else {
        segments = [...segments, 'Late papers'];
        folderLabel = segments.join('/');
      }
    }

    const uploaded = await sp.uploadDocument(
      token,
      { driveId, folderId: targetFolderId },
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
      meetingId: meeting.id,
      agendaItemId: agendaItemId || null,
      source: 'SHAREPOINT',
      sharepointDriveId: driveId,
      sharepointItemId: uploaded.itemId,
      sharepointWebUrl: uploaded.webUrl,
      sharepointFolder: folderLabel,
      etag: uploaded.etag,
      modifiedAt: uploaded.modifiedAt ? new Date(uploaded.modifiedAt) : new Date(),
      lastSyncedAt: new Date(),
    };

    const document = await prisma.document.upsert({
      where: {
        sharepointDriveId_sharepointItemId: {
          sharepointDriveId: driveId,
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

/**
 * A windowed preview for a paper: the embeddable SharePoint viewer for
 * library files, plus a direct download link as the fallback for anything
 * the viewer cannot render. Read-only — editing stays on the SharePoint side.
 */
router.get('/:meetingId/preview', async (req, res) => {
  try {
    const { itemId } = req.query;
    if (!itemId) return res.status(400).json({ error: 'itemId is required' });

    const meeting = await loadMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const driveId = meeting.sharepointDriveId || meeting.board?.sharepointDriveId;
    if (!driveId) return res.status(400).json({ error: 'No SharePoint library linked to this meeting' });

    const { token } = await getGraphToken();
    const [url, downloadUrl] = await Promise.all([
      sp.previewItem(token, driveId, String(itemId)),
      sp.getDownloadUrl(token, driveId, String(itemId)).catch(() => null),
    ]);
    res.json({ url, downloadUrl });
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
