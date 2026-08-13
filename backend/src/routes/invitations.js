const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

/** Invitations, optionally for one meeting. */
router.get('/', async (req, res) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: req.query.meetingId ? { meetingId: req.query.meetingId } : {},
      include: { user: true, meeting: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(invitations);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Invite one or more people to a meeting.
 *
 * Takes userIds so the picker can add several at once. Re-inviting somebody is
 * a no-op rather than an error — the caller should not have to care whether a
 * person was already on the list.
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { meetingId, userIds, role, votingRights } = req.body || {};
    if (!meetingId) return res.status(400).json({ error: 'meetingId is required' });

    const ids = Array.isArray(userIds) ? userIds : [req.body.userId].filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'Pick at least one person' });

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const already = await prisma.invitation.findMany({
      where: { meetingId, userId: { in: ids } },
      select: { userId: true },
    });
    const skip = new Set(already.map((a) => a.userId));
    const toAdd = ids.filter((id) => !skip.has(id));

    let added = 0;
    if (toAdd.length) {
      const users = await prisma.user.findMany({ where: { id: { in: toAdd } } });

      // Report ids that match nobody rather than silently succeeding — a typo'd
      // or stale id should not look like a successful invitation.
      if (users.length !== toAdd.length) {
        const found = new Set(users.map((u) => u.id));
        return res.status(400).json({
          error: 'Some of those people no longer exist',
          unknownUserIds: toAdd.filter((id) => !found.has(id)),
        });
      }

      const result = await prisma.invitation.createMany({
        data: users.map((u) => ({
          meetingId,
          userId: u.id,
          // Default each person's meeting role to the one they hold on the board.
          role: role || u.role || 'DIRECTOR',
          votingRights: votingRights !== undefined ? votingRights : true,
        })),
      });
      added = result.count;
    }

    const invitations = await prisma.invitation.findMany({
      where: { meetingId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    res.status(201).json({ added, skipped: ids.length - toAdd.length, invitations });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


/**
 * Import attendees from a CSV — the AGM case: a membership list uploaded once,
 * each row invited and marked voting or non-voting.
 *
 * Columns (header row optional): name, email[, role][, voting]
 *   role    defaults to MEMBER
 *   voting  yes/no, true/false, 1/0 — defaults to voting
 * People are matched by email; anyone new joins the directory first.
 */
router.post('/import', requireAdmin, async (req, res) => {
  try {
    const meetingId = req.query.meetingId || req.body?.meetingId;
    if (!meetingId) return res.status(400).json({ error: 'meetingId is required' });
    const file = req.files?.file;
    if (!file) return res.status(400).json({ error: 'No CSV uploaded (expected field "file")' });

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Minimal CSV parse with quoted-field support.
    const parseLine = (line) => {
      const out = [];
      let cur = '';
      let q = false;
      for (const ch of line) {
        if (ch === '"') { q = !q; continue; }
        if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      out.push(cur.trim());
      return out;
    };

    const lines = file.data.toString('utf8').split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return res.status(400).json({ error: 'The file is empty' });

    let rows = lines.map(parseLine);
    let cols = { name: 0, email: 1, role: 2, voting: 3 };
    if (!lines[0].includes('@')) {
      const header = rows[0].map((h) => h.toLowerCase());
      cols = {
        name: header.findIndex((h) => h.includes('name')),
        email: header.findIndex((h) => h.includes('mail')),
        role: header.findIndex((h) => h.includes('role')),
        voting: header.findIndex((h) => h.includes('vot')),
      };
      if (cols.name === -1 || cols.email === -1) {
        return res.status(400).json({ error: 'Could not find name and email columns' });
      }
      rows = rows.slice(1);
    }

    const VALID = new Set(['CHAIR','SECRETARY','TREASURER','DIRECTOR','COMMITTEE_MEMBER','OBSERVER','INVITEE','GUEST','MEMBER']);
    const truthy = (v) => /^(y|yes|true|1)$/i.test(String(v || '').trim());

    let invited = 0, created = 0, skipped = 0;
    const problems = [];

    for (const row of rows) {
      const name = row[cols.name];
      const email = (row[cols.email] || '').toLowerCase();
      if (!name || !email.includes('@')) { problems.push('Skipped: ' + row.join(', ').slice(0, 60)); continue; }

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            name,
            email,
            role: 'MEMBER',
            initials: name.split(/\s+/).map((seg) => seg[0]).slice(0, 2).join('').toUpperCase(),
          },
        });
        created += 1;
      }

      const existing = await prisma.invitation.findFirst({ where: { meetingId, userId: user.id } });
      if (existing) { skipped += 1; continue; }

      const roleRaw = String(row[cols.role] || '').toUpperCase().replace(/\s+/g, '_');
      await prisma.invitation.create({
        data: {
          meetingId,
          userId: user.id,
          role: VALID.has(roleRaw) ? roleRaw : 'MEMBER',
          votingRights: cols.voting >= 0 && row[cols.voting]
            ? truthy(row[cols.voting])
            : true,
        },
      });
      invited += 1;
    }

    res.json({ invited, created, skipped, problems: problems.slice(0, 10) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Change someone's role, voting rights or RSVP. */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { role, rsvp, votingRights } = req.body || {};
    const invitation = await prisma.invitation.update({
      where: { id: req.params.id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(rsvp !== undefined ? { rsvp } : {}),
        ...(votingRights !== undefined ? { votingRights } : {}),
      },
      include: { user: true },
    });
    res.json(invitation);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.invitation.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Mark a meeting's invitations as sent.
 *
 * IMPORTANT: this records that invitations went out; it does not deliver email.
 * Board Portal has no mail transport of its own — inside a vertical the host
 * mailer sends, and standalone you would wire a provider here. The response
 * says so plainly so the UI never claims more than happened.
 */
router.post('/send', requireAdmin, async (req, res) => {
  try {
    const { meetingId, invitationIds } = req.body || {};
    if (!meetingId && !invitationIds?.length) {
      return res.status(400).json({ error: 'meetingId or invitationIds is required' });
    }

    const where = invitationIds?.length
      ? { id: { in: invitationIds } }
      : { meetingId, sentAt: null };

    const { count } = await prisma.invitation.updateMany({
      where,
      data: { sentAt: new Date() },
    });

    res.json({
      marked: count,
      delivered: false,
      message:
        count === 0
          ? 'Everyone had already been sent an invitation.'
          : `Marked ${count} invitation${count === 1 ? '' : 's'} as sent. ` +
            'Email delivery is handled by the host system — nothing was emailed from here.',
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
