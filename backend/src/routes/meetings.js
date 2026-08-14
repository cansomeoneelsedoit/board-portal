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

/**
 * Erase a meeting and everything recorded against it — agenda, invitations,
 * attendance, motions and votes, minutes, declarations, proxies, uploaded
 * papers and received stamps. Top-level access only: a secretary administers
 * meetings, the host platform's top roles delete them.
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session?.capabilities?.deleteMeetings) {
      return res.status(403).json({
        error: 'Deleting a meeting needs top-level administrator access.',
      });
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    await prisma.$transaction([
      prisma.vote.deleteMany({ where: { motion: { meetingId: meeting.id } } }),
      prisma.motion.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.minutesApproval.deleteMany({ where: { minutes: { meetingId: meeting.id } } }),
      prisma.minutes.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.attendance.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.invitation.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.cOI.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.proxy.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.document.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.packFileReceipt.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.agendaItem.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.meeting.delete({ where: { id: meeting.id } }),
    ]);

    res.json({ deleted: true, title: meeting.title });
  } catch (e) {
    res.status(400).json({ error: e.message });
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
