const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

/**
 * Attendance as a roll call.
 *
 * The list is built from who was INVITED, not from who happens to have an
 * attendance row — the secretary works down the invitation list marking people
 * present or apology. Anyone who turns up uninvited still appears once marked.
 */
router.get('/', async (req, res) => {
  try {
    const where = req.query.meetingId ? { meetingId: req.query.meetingId } : {};
    const records = await prisma.attendance.findMany({
      where,
      include: { user: true, meeting: true },
      orderBy: { id: 'asc' },
    });
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * The roll for one meeting: every invited person, joined with whatever
 * attendance has been recorded for them, plus any walk-ins.
 */
router.get('/roll/:meetingId', async (req, res) => {
  try {
    const meetingId = req.params.meetingId;
    const [invitations, records] = await Promise.all([
      prisma.invitation.findMany({
        where: { meetingId },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.attendance.findMany({ where: { meetingId }, include: { user: true } }),
    ]);

    const byUser = new Map(records.map((r) => [r.userId, r]));
    const invitedIds = new Set(invitations.map((i) => i.userId));

    const roll = invitations.map((inv) => {
      const rec = byUser.get(inv.userId);
      return {
        userId: inv.userId,
        member: inv.user?.name || 'Unknown',
        initials: inv.user?.initials || null,
        role: inv.role,
        rsvp: inv.rsvp,
        invited: true,
        // null = not yet marked; true/false once the roll is taken.
        present: rec ? rec.present : null,
        mode: rec?.mode || null,
        attendanceId: rec?.id || null,
      };
    });

    // Walk-ins: recorded attendance for people who were never invited.
    for (const rec of records) {
      if (invitedIds.has(rec.userId)) continue;
      roll.push({
        userId: rec.userId,
        member: rec.user?.name || 'Unknown',
        initials: rec.user?.initials || null,
        role: null,
        rsvp: null,
        invited: false,
        present: rec.present,
        mode: rec.mode,
        attendanceId: rec.id,
      });
    }

    const marked = roll.filter((r) => r.present !== null);
    res.json({
      meetingId,
      roll,
      summary: {
        invited: invitations.length,
        marked: marked.length,
        present: marked.filter((r) => r.present).length,
        apologies: marked.filter((r) => !r.present).length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Mark one person on the roll. Upserts, so re-marking just changes the state —
 * and present:null clears the mark entirely (mis-click during roll call).
 */
router.post('/mark', requireAdmin, async (req, res) => {
  try {
    const { meetingId, userId, present, mode } = req.body || {};
    if (!meetingId || !userId) {
      return res.status(400).json({ error: 'meetingId and userId are required' });
    }

    const existing = await prisma.attendance.findFirst({ where: { meetingId, userId } });

    if (present === null || present === undefined) {
      if (existing) await prisma.attendance.delete({ where: { id: existing.id } });
      return res.json({ cleared: true });
    }

    const data = {
      present: Boolean(present),
      mode: mode || existing?.mode || 'IN_PERSON',
      joinedAt: Boolean(present) ? existing?.joinedAt || new Date() : null,
    };

    const record = existing
      ? await prisma.attendance.update({ where: { id: existing.id }, data })
      : await prisma.attendance.create({ data: { meetingId, userId, ...data } });

    res.json(record);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
