const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

/**
 * Aggregate feed for the dashboard.
 *
 * Exists so the landing page is one request rather than six, and so the
 * "recent activity" stream can be assembled server-side from several tables.
 */
router.get('/', async (req, res) => {
  try {
    const now = new Date();

    const [
      upcomingMeetings,
      documentCount,
      openMotions,
      memberCount,
      recentDocuments,
      recentMotions,
      recentCois,
      recentMinutes,
    ] = await Promise.all([
      prisma.meeting.findMany({
        where: { date: { gte: now }, status: { not: 'DRAFT' } },
        orderBy: { date: 'asc' },
        take: 5,
        include: { board: true, invitations: true },
      }),
      prisma.document.count(),
      prisma.motion.findMany({
        where: { status: 'PENDING' },
        include: { meeting: true, votes: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.boardMember.count(),
      prisma.document.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.motion.findMany({
        where: { result: { not: null } },
        orderBy: { passedAt: 'desc' },
        take: 5,
        include: { votes: true },
      }),
      prisma.cOI.findMany({
        orderBy: { declaredAt: 'desc' },
        take: 5,
        include: { user: true },
      }),
      prisma.minutes.findMany({
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { meeting: true },
      }),
    ]);

    // Fold several tables into one reverse-chronological stream.
    const activity = [
      ...recentDocuments.map((d) => ({
        id: `doc-${d.id}`,
        kind: 'DOCUMENT_UPLOADED',
        action: 'Document uploaded',
        detail: d.name,
        at: d.createdAt,
      })),
      ...recentMotions.map((m) => {
        const forVotes = m.votes.filter((v) => v.vote === 'FOR').length;
        const against = m.votes.filter((v) => v.vote === 'AGAINST').length;
        return {
          id: `motion-${m.id}`,
          kind: m.result === 'CARRIED' ? 'MOTION_CARRIED' : 'MOTION_LOST',
          action: m.result === 'CARRIED' ? 'Motion carried' : 'Motion lost',
          detail: `${m.number} — ${m.title} (${forVotes}-${against})`,
          at: m.passedAt || m.createdAt,
        };
      }),
      ...recentMinutes.map((m) => ({
        id: `minutes-${m.id}`,
        kind: 'MINUTES_APPROVED',
        action: 'Minutes approved',
        detail: m.meeting ? m.meeting.title : 'Meeting minutes',
        at: m.lockedAt || m.createdAt,
      })),
      ...recentCois.map((c) => ({
        id: `coi-${c.id}`,
        kind: 'COI_DECLARED',
        action: 'COI declaration submitted',
        detail: `${c.user ? c.user.name : 'Member'} — ${c.type.replace(/_/g, ' ').toLowerCase()}`,
        at: c.declaredAt,
      })),
    ]
      .filter((a) => a.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8);

    const pendingVote = openMotions.filter((m) => m.votes.length === 0).length;
    const next = upcomingMeetings[0];

    res.json({
      stats: {
        upcomingMeetings: upcomingMeetings.length,
        nextMeetingDate: next ? next.date : null,
        nextMeetingTitle: next ? next.title : null,
        documents: documentCount,
        openMotions: openMotions.length,
        motionsPendingVote: pendingVote,
        boardMembers: memberCount,
      },
      upcomingMeetings,
      activity,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
