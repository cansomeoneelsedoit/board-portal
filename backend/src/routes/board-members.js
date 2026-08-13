const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

const boardFor = async (boardId) =>
  boardId
    ? prisma.board.findUnique({ where: { id: boardId } })
    : prisma.board.findFirst({ orderBy: { createdAt: 'asc' } });

/** How a tenure may end. ACTIVE is the one live state. */
const END_STATUSES = ['RESIGNED', 'RETIRED', 'TERM_ENDED', 'REMOVED', 'DECEASED'];

/**
 * Who sits — and who has sat — on the board.
 *
 * Returns every tenure for the board, current first. Past members are part of
 * the answer on purpose: they stay choosable for that board, with their
 * status, because history is the point of the register.
 */
router.get('/', async (req, res) => {
  try {
    const board = await boardFor(req.query.boardId);
    if (!board) return res.json([]);

    const members = await prisma.boardMember.findMany({
      where: { boardId: board.id },
      include: { user: true },
    });

    members.sort((a, b) => {
      const aCurrent = a.endedAt ? 1 : 0;
      const bCurrent = b.endedAt ? 1 : 0;
      if (aCurrent !== bCurrent) return aCurrent - bCurrent;
      return (a.user?.name || '').localeCompare(b.user?.name || '');
    });

    res.json(members);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * One person's service record across every board and committee — the history
 * section of their profile.
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const tenures = await prisma.boardMember.findMany({
      where: { userId: req.params.userId },
      include: { board: true },
      orderBy: [{ endedAt: { sort: 'desc', nulls: 'first' } }, { startedAt: 'desc' }],
    });
    res.json(tenures);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Appoint someone to the board — a new tenure, dated from today by default. */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { userId, userIds, role, boardId, startedAt } = req.body || {};
    const board = await boardFor(boardId);
    if (!board) return res.status(404).json({ error: 'No board found' });

    const ids = Array.isArray(userIds) ? userIds : [userId].filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'Pick at least one person' });

    // Only a CURRENT tenure blocks re-appointment — someone who served before
    // can be appointed again, and both rows stay in their history.
    const existing = await prisma.boardMember.findMany({
      where: { boardId: board.id, userId: { in: ids }, endedAt: null },
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
        data: users.map((u) => ({
          boardId: board.id,
          userId: u.id,
          role: role || u.role || 'DIRECTOR',
          startedAt: startedAt ? new Date(startedAt) : new Date(),
          status: 'ACTIVE',
        })),
      });
      added = result.count;
    }

    res.status(201).json({ added, skipped: ids.length - toAdd.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Amend a tenure: role, dates, status. Ending it keeps it on the record. */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { role, status, startedAt, endedAt, notes } = req.body || {};

    const data = {};
    if (role !== undefined) data.role = role;
    if (notes !== undefined) data.notes = notes || null;
    if (startedAt !== undefined) data.startedAt = startedAt ? new Date(startedAt) : null;
    if (endedAt !== undefined) data.endedAt = endedAt ? new Date(endedAt) : null;
    if (status !== undefined) {
      const next = String(status).toUpperCase();
      if (next !== 'ACTIVE' && !END_STATUSES.includes(next)) {
        return res.status(400).json({
          error: `Status must be ACTIVE or one of ${END_STATUSES.join(', ')}`,
        });
      }
      data.status = next;
      // The status and the end date move together.
      if (next === 'ACTIVE' && endedAt === undefined) data.endedAt = null;
      if (next !== 'ACTIVE' && endedAt === undefined) data.endedAt = new Date();
    }

    const member = await prisma.boardMember.update({
      where: { id: req.params.id },
      data,
      include: { user: true, board: true },
    });
    res.json(member);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Erase a tenure entirely — for rows added by mistake. Standing someone down
 * is PUT with a status, which keeps the history.
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.boardMember.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
