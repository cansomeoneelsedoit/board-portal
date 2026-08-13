const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

const boardFor = async (boardId) =>
  boardId
    ? prisma.board.findUnique({ where: { id: boardId } })
    : prisma.board.findFirst({ orderBy: { createdAt: 'asc' } });

/**
 * Who sits on the board.
 *
 * BoardMember has no relation to User in the schema, so the user is joined on
 * here rather than by Prisma.
 */
router.get('/', async (req, res) => {
  try {
    const board = await boardFor(req.query.boardId);
    if (!board) return res.json([]);

    const members = await prisma.boardMember.findMany({ where: { boardId: board.id } });
    const users = await prisma.user.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    res.json(
      members
        .map((m) => ({ ...m, user: byId.get(m.userId) || null }))
        .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || ''))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Appoint someone to the board. */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { userId, userIds, role, boardId } = req.body || {};
    const board = await boardFor(boardId);
    if (!board) return res.status(404).json({ error: 'No board found' });

    const ids = Array.isArray(userIds) ? userIds : [userId].filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'Pick at least one person' });

    const existing = await prisma.boardMember.findMany({
      where: { boardId: board.id, userId: { in: ids } },
      select: { userId: true },
    });
    const skip = new Set(existing.map((e) => e.userId));
    const toAdd = ids.filter((id) => !skip.has(id));

    let added = 0;
    if (toAdd.length) {
      const users = await prisma.user.findMany({ where: { id: { in: toAdd } } });

      // Never report success for an id that matches nobody.
      if (users.length !== toAdd.length) {
        const found = new Set(users.map((u) => u.id));
        return res.status(400).json({
          error: 'Some of those people no longer exist',
          unknownUserIds: toAdd.filter((id) => !found.has(id)),
        });
      }

      const result = await prisma.boardMember.createMany({
        data: users.map((u) => ({ boardId: board.id, userId: u.id, role: role || u.role || 'DIRECTOR' })),
      });
      added = result.count;
    }

    res.status(201).json({ added, skipped: ids.length - toAdd.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const member = await prisma.boardMember.update({
      where: { id: req.params.id },
      data: { role: req.body?.role },
    });
    res.json(member);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Stand someone down. Their meeting history is untouched. */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.boardMember.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
