const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

/**
 * Proxies live on the meeting: a member who cannot attend assigns their vote
 * to someone who can, for that sitting only — and only when the meeting was
 * scheduled with proxy voting allowed.
 */
router.get('/', async (req, res) => {
  try {
    const proxies = await prisma.proxy.findMany({
      where: req.query.meetingId ? { meetingId: req.query.meetingId } : {},
      include: { fromUser: true, toUser: true },
      orderBy: { lodgedAt: 'desc' },
    });
    res.json(proxies);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Register a proxy for a meeting. */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { meetingId, fromUserId, toUserId } = req.body || {};
    if (!meetingId || !fromUserId || !toUserId) {
      return res.status(400).json({ error: 'Meeting, grantor and holder are all required' });
    }
    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'A member cannot hold their own proxy' });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { invitations: true },
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!meeting.proxiesAllowed) {
      return res.status(400).json({
        error: 'Proxy voting is not allowed for this meeting. An administrator can change that in Edit Meeting.',
      });
    }

    const invited = new Set(meeting.invitations.map((i) => i.userId));
    if (!invited.has(fromUserId) || !invited.has(toUserId)) {
      return res.status(400).json({ error: 'Both people must be on the invitation list for this meeting' });
    }

    // One proxy per grantor per meeting — re-registering replaces the holder.
    const existing = await prisma.proxy.findFirst({ where: { meetingId, fromUserId } });
    const proxy = existing
      ? await prisma.proxy.update({
          where: { id: existing.id },
          data: { toUserId, lodgedAt: new Date() },
          include: { fromUser: true, toUser: true },
        })
      : await prisma.proxy.create({
          data: { meetingId, fromUserId, toUserId },
          include: { fromUser: true, toUser: true },
        });

    res.status(existing ? 200 : 201).json(proxy);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.proxy.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
