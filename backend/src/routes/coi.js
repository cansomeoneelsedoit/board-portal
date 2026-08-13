const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');
const {
  COI_TYPES, COI_EFFECTS, COI_TYPE_IDS, COI_EFFECT_IDS, restrictsVote,
} = require('../lib/governance');

const router = express.Router();

/**
 * The conflicts register.
 *
 * Declaring an interest and resolving it are separate acts — the member does
 * the first, the meeting does the second — so they are separate endpoints.
 * A declaration sits at PENDING until the meeting rules on it.
 */

/** Vocabulary for the forms, so the UI never hard-codes the options. */
router.get('/options', (req, res) => res.json({ types: COI_TYPES, effects: COI_EFFECTS }));

/**
 * Conflict alerts for one meeting.
 *
 * The chair needs to know, before an item is taken: which invited members hold
 * standing register interests relevant to this body, and which declarations
 * made at this meeting are still unresolved. This powers the alert on the
 * meeting's Conflicts tab — the register page is the archive; the meeting is
 * where the information has to surface.
 */
router.get('/alerts/:meetingId', async (req, res) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.meetingId },
      include: { invitations: { include: { user: true } } },
    });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const invitedIds = meeting.invitations.map((i) => i.userId);

    const interests = invitedIds.length
      ? await prisma.memberInterest.findMany({
          where: {
            userId: { in: invitedIds },
            status: 'ACTIVE',
            OR: [
              { disclosedToAll: true },
              ...(meeting.boardId ? [{ disclosures: { some: { boardId: meeting.boardId } } }] : []),
            ],
          },
          include: { user: true },
          orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
        })
      : [];

    const byMember = new Map();
    for (const i of interests) {
      if (!byMember.has(i.userId)) {
        byMember.set(i.userId, {
          userId: i.userId,
          member: i.user?.name || 'Unknown',
          initials: i.user?.initials || null,
          interests: [],
        });
      }
      byMember.get(i.userId).interests.push({
        id: i.id,
        interest: i.interest,
        category: i.category,
        standing: i.disclosedToAll,
      });
    }

    const unresolved = await prisma.cOI.count({
      where: { meetingId: meeting.id, effect: 'PENDING' },
    });

    res.json({
      meetingId: meeting.id,
      unresolvedDeclarations: unresolved,
      standing: [...byMember.values()],
      totalStandingInterests: interests.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.meetingId) where.meetingId = req.query.meetingId;
    if (req.query.boardId) where.boardId = req.query.boardId;
    if (req.query.effect) where.effect = String(req.query.effect).toUpperCase();

    const declarations = await prisma.cOI.findMany({
      where,
      include: { user: true },
      orderBy: { declaredAt: 'desc' },
    });

    // Attach the body each interest concerns; COI has no relation to Board.
    const boardIds = [...new Set(declarations.map((d) => d.boardId).filter(Boolean))];
    const boards = boardIds.length
      ? await prisma.board.findMany({
          where: { id: { in: boardIds } },
          select: { id: true, name: true, shortName: true, kind: true },
        })
      : [];
    const byId = new Map(boards.map((b) => [b.id, b]));

    res.json(declarations.map((d) => ({ ...d, board: d.boardId ? byId.get(d.boardId) || null : null })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Declare an interest. Always lands at PENDING for the meeting to rule on. */
router.post('/', async (req, res) => {
  try {
    const { meetingId, userId, boardId, type, description, motionId, agendaItemId } = req.body || {};

    if (!userId || !description?.trim()) {
      return res.status(400).json({ error: 'Member and description are required' });
    }
    if (!COI_TYPE_IDS.includes(type)) {
      return res.status(400).json({ error: `Type must be one of ${COI_TYPE_IDS.join(', ')}` });
    }

    // Fall back to the meeting's own board when none is named.
    let resolvedBoardId = boardId || null;
    if (!resolvedBoardId && meetingId) {
      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      resolvedBoardId = meeting?.boardId || null;
    }

    const declaration = await prisma.cOI.create({
      data: {
        meetingId: meetingId || null,
        userId,
        boardId: resolvedBoardId,
        motionId: motionId || null,
        agendaItemId: agendaItemId || null,
        type,
        description: description.trim(),
        effect: 'PENDING',
      },
      include: { user: true },
    });

    res.status(201).json(declaration);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Record what the meeting resolved.
 *
 * Kept separate from the declaration so the register shows both what was
 * declared and, distinctly, what the meeting decided about it.
 */
router.post('/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const { effect, resolution, quorumAffected } = req.body || {};

    if (!COI_EFFECT_IDS.includes(effect)) {
      return res.status(400).json({ error: `Effect must be one of ${COI_EFFECT_IDS.join(', ')}` });
    }

    const declaration = await prisma.cOI.update({
      where: { id: req.params.id },
      data: {
        effect,
        resolution: resolution?.trim() || null,
        resolvedAt: effect === 'PENDING' ? null : new Date(),
        // Only a member who cannot vote can put the quorum at risk.
        quorumAffected: quorumAffected !== undefined ? Boolean(quorumAffected) : restrictsVote(effect),
      },
      include: { user: true },
    });

    res.json(declaration);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { type, description, boardId } = req.body || {};
    const declaration = await prisma.cOI.update({
      where: { id: req.params.id },
      data: {
        ...(type !== undefined ? { type } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(boardId !== undefined ? { boardId: boardId || null } : {}),
      },
      include: { user: true },
    });
    res.json(declaration);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.cOI.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
