const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');
const { BOARD_KIND_IDS } = require('../lib/governance');

const router = express.Router();

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
    const { name, description, kind, parentId, shortName } = req.body || {};

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
