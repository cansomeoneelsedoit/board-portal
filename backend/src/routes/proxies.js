const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

const GRANTOR_KINDS = ['MEMBER', 'LODGE', 'COMPANY', 'ASSOCIATION', 'OTHER'];

/**
 * Proxies live on the meeting. The holder is always a member on the invitation
 * list; the grantor is a member, or an entity — lodge, company, association —
 * recorded by name, exactly as the count sheets are kept.
 */
router.get('/', async (req, res) => {
  try {
    const where = req.query.meetingId ? { meetingId: req.query.meetingId } : {};
    const proxies = await prisma.proxy.findMany({
      where,
      include: { fromUser: true, toUser: true },
      orderBy: { lodgedAt: 'desc' },
    });

    // The count-sheet view: each holder's own vote plus the proxies they hold.
    const byHolder = new Map();
    for (const p of proxies) {
      const key = p.toUserId;
      if (!byHolder.has(key)) {
        byHolder.set(key, { holder: p.toUser?.name || 'Unknown', ownVote: 1, proxyVotes: 0 });
      }
      byHolder.get(key).proxyVotes += p.votes || 1;
    }
    const summary = [...byHolder.values()]
      .map((h) => ({ ...h, total: h.ownVote + h.proxyVotes }))
      .sort((a, b) => b.total - a.total);

    res.json({ proxies, summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Register a proxy: from a member, or from a lodge/company by name. */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { meetingId, fromUserId, grantorName, grantorKind, toUserId, votes } = req.body || {};
    if (!meetingId || !toUserId) {
      return res.status(400).json({ error: 'Meeting and holder are required' });
    }
    if (!fromUserId && !grantorName?.trim()) {
      return res.status(400).json({ error: 'Name the member or entity granting the proxy' });
    }
    if (fromUserId && fromUserId === toUserId) {
      return res.status(400).json({ error: 'A member cannot hold their own proxy' });
    }

    const kind = fromUserId ? 'MEMBER' : String(grantorKind || 'LODGE').toUpperCase();
    if (!GRANTOR_KINDS.includes(kind)) {
      return res.status(400).json({ error: `Grantor kind must be one of ${GRANTOR_KINDS.join(', ')}` });
    }

    const voteCount = Math.max(1, Math.min(1000, Number(votes) || 1));

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
    if (!invited.has(toUserId)) {
      return res.status(400).json({ error: 'The proxy holder must be on the invitation list' });
    }
    if (fromUserId && !invited.has(fromUserId)) {
      return res.status(400).json({ error: 'The granting member must be on the invitation list' });
    }

    // One lodgement per grantor per meeting: re-registering replaces it, for
    // members and for named entities alike.
    const existing = fromUserId
      ? await prisma.proxy.findFirst({ where: { meetingId, fromUserId } })
      : await prisma.proxy.findFirst({
          where: { meetingId, grantorName: { equals: grantorName.trim(), mode: 'insensitive' } },
        });

    const data = {
      fromUserId: fromUserId || null,
      grantorName: fromUserId ? null : grantorName.trim(),
      grantorKind: kind,
      toUserId,
      votes: voteCount,
      lodgedAt: new Date(),
    };

    const proxy = existing
      ? await prisma.proxy.update({ where: { id: existing.id }, data, include: { fromUser: true, toUser: true } })
      : await prisma.proxy.create({ data: { meetingId, ...data }, include: { fromUser: true, toUser: true } });

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
