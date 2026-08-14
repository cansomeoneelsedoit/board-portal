const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');
const { BOARD_KIND_IDS } = require('../lib/governance');
const { UPLOAD_DIR } = require('../lib/pack-sources');
const { textFromFile } = require('../lib/motion-scan');

const router = express.Router();

/* ------------------------------------------------------------ constitution */

/**
 * Attach the board's constitution. It is kept with the board — readable from
 * the quorum-rules card any time — and mined for suggested rules below.
 */
router.post('/:id/constitution', requireAdmin, async (req, res) => {
  try {
    const file = req.files?.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded (expected field "file")' });
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      return res.status(400).json({ error: 'Upload the constitution as PDF, Word (.docx) or text' });
    }

    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const dir = path.join(UPLOAD_DIR, 'boards', board.id);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = path.basename(file.name).replace(/[\\/:*?"<>|#%]/g, '-');
    await fs.promises.writeFile(path.join(dir, safeName), file.data);

    const updated = await prisma.board.update({
      where: { id: board.id },
      data: {
        constitutionName: file.name,
        constitutionPath: ['boards', board.id, safeName].join('/'),
      },
    });
    res.status(201).json({
      constitutionName: updated.constitutionName,
      constitutionPath: updated.constitutionPath,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Word-numbers a constitution writes quorums in. */
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * Read the constitution for its quorum rules.
 *
 * Finds every clause that mentions a quorum, and where one names a number of
 * directors ("a quorum is two Directors") proposes it as the board's minimum.
 * Suggestions only — nothing changes until they are applied.
 */
router.get('/:id/constitution/suggest', requireAdmin, async (req, res) => {
  try {
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!board.constitutionPath) {
      return res.status(400).json({ error: 'Upload the constitution first' });
    }

    const buffer = await fs.promises.readFile(path.join(UPLOAD_DIR, board.constitutionPath));
    const text = await textFromFile(board.constitutionName || board.constitutionPath, buffer);
    if (!text) return res.status(400).json({ error: 'Could not read any text out of that file' });

    // Sentences around every mention of a quorum.
    const flat = text.replace(/\s+/g, ' ');
    const clauses = [];
    const re = /[^.]*\bquorum\b[^.]*\./gi;
    let m;
    while ((m = re.exec(flat)) !== null) {
      const clause = m[0].trim();
      if (clause.length > 20 && clause.length < 500) clauses.push(clause);
    }

    // The board-meeting quorum: a clause about DIRECTORS naming a number.
    let minimum = null;
    let basis = null;
    for (const clause of clauses) {
      if (!/director/i.test(clause)) continue;
      const num = clause.match(/quorum\s+(?:is|shall\s+be|of)\s+(?:at\s+least\s+)?(\w+)/i);
      if (!num) continue;
      const value = NUMBER_WORDS[num[1].toLowerCase()] ?? (Number(num[1]) || null);
      if (value) {
        minimum = value;
        basis = clause;
        break;
      }
    }

    res.json({ minimum, basis, clauses: clauses.slice(0, 8) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Boards and committees.
 *
 * A committee is a board with a parent — same meetings, same register, same
 * rules — so one model serves both and the hierarchy is just parentId.
 */
router.get('/', async (req, res) => {
  try {
    const boards = await prisma.board.findMany({
      where: req.query.kind ? { kind: String(req.query.kind).toUpperCase() } : {},
      include: {
        parent: { select: { id: true, name: true } },
        members: true,
        meetings: { select: { id: true }, orderBy: { date: 'desc' } },
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    res.json(
      boards.map((b) => ({
        ...b,
        meetingCount: b.meetings.length,
        memberCount: b.members.length,
        meetings: undefined,
        members: undefined,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.id },
      include: { parent: true, children: true },
    });
    if (!board) return res.status(404).json({ error: 'Not found' });
    res.json(board);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, kind, parentId, shortName, orgKey } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const boardKind = (kind || 'BOARD').toUpperCase();
    if (!BOARD_KIND_IDS.includes(boardKind)) {
      return res.status(400).json({ error: `Kind must be one of ${BOARD_KIND_IDS.join(', ')}` });
    }

    // A committee without a parent is just a board by another name; requiring
    // the link keeps the hierarchy meaningful.
    if (boardKind !== 'BOARD' && !parentId) {
      return res.status(400).json({ error: 'Choose the body this committee reports to' });
    }

    const board = await prisma.board.create({
      data: {
        name: name.trim(),
        description: description || null,
        kind: boardKind,
        parentId: parentId || null,
        shortName: shortName || null,
        orgKey: orgKey || null,
      },
      include: { parent: { select: { id: true, name: true } } },
    });

    res.status(201).json(board);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name, description, kind, parentId, shortName,
      quorumMinimum, quorumRequiredRoles, quorumExOfficioRoles, quorumMandatoryUserIds,
    } = req.body || {};

    // Nothing may be its own parent, directly or otherwise.
    if (parentId && parentId === req.params.id) {
      return res.status(400).json({ error: 'A body cannot report to itself' });
    }
    if (parentId) {
      let cursor = await prisma.board.findUnique({ where: { id: parentId } });
      const seen = new Set([req.params.id]);
      while (cursor) {
        if (seen.has(cursor.id)) {
          return res.status(400).json({ error: 'That would create a loop in the hierarchy' });
        }
        seen.add(cursor.id);
        cursor = cursor.parentId
          ? await prisma.board.findUnique({ where: { id: cursor.parentId } })
          : null;
      }
    }

    const board = await prisma.board.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(kind !== undefined ? { kind: String(kind).toUpperCase() } : {}),
        ...(parentId !== undefined ? { parentId: parentId || null } : {}),
        ...(shortName !== undefined ? { shortName: shortName || null } : {}),
        // The board's standing quorum rule — what every new meeting inherits.
        ...(quorumMinimum !== undefined ? { quorumMinimum: Math.max(1, Number(quorumMinimum) || 1) } : {}),
        ...(quorumRequiredRoles !== undefined ? { quorumRequiredRoles: String(quorumRequiredRoles || '') } : {}),
        ...(quorumExOfficioRoles !== undefined ? { quorumExOfficioRoles: String(quorumExOfficioRoles || '') } : {}),
        ...(quorumMandatoryUserIds !== undefined ? { quorumMandatoryUserIds: String(quorumMandatoryUserIds || '') } : {}),
      },
      include: { parent: { select: { id: true, name: true } } },
    });

    res.json(board);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [meetings, children] = await Promise.all([
      prisma.meeting.count({ where: { boardId: req.params.id } }),
      prisma.board.count({ where: { parentId: req.params.id } }),
    ]);

    if (meetings > 0) {
      return res.status(409).json({
        error: `This body has ${meetings} meeting${meetings === 1 ? '' : 's'}. Its history would be lost.`,
      });
    }
    if (children > 0) {
      return res.status(409).json({
        error: 'Move or remove its committees first.',
      });
    }

    await prisma.boardMember.deleteMany({ where: { boardId: req.params.id } });
    await prisma.board.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
