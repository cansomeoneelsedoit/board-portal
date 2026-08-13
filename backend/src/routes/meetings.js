const express = require('express');
const makeRouter = require('./_base');
const prisma = require('../lib/prisma');

const router = express.Router();

/**
 * Venues to offer when scheduling: every place a meeting has been held before.
 * Embedded in Mason-View the host's venue rooms are merged in on the client —
 * this list keeps the picker useful standalone. (Declared before the CRUD
 * routes so /:id never shadows it.)
 */
router.get('/venues', async (req, res) => {
  try {
    const rows = await prisma.meeting.findMany({
      where: { location: { not: null } },
      select: { location: true },
      distinct: ['location'],
      orderBy: { location: 'asc' },
    });
    res.json(rows.map((r) => r.location).filter((l) => l && l.trim()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.use(makeRouter('meeting', {
  include: {
    board: true,
    agendaItems: { orderBy: { order: 'asc' }, include: { documents: true } },
    invitations: { include: { user: true } },
    attendances: { include: { user: true } },
    motions: { include: { votes: { include: { user: true } } } },
    minutes: true,
  },
  orderBy: { date: 'desc' },
}));

module.exports = router;
