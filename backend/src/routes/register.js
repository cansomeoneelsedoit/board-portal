const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');
const { COI_TYPE_IDS } = require('../lib/governance');

const router = express.Router();

/*
 * The register of interests.
 *
 * One row per interest per member, standing between meetings — the shape the
 * AF&AM Inc register already uses: who, what the interest is, whether the board
 * has been notified, the steps the board takes, and what the member does about
 * it.
 *
 * Distinct from a per-meeting declaration (routes/coi.js): the register is what
 * a member holds; a declaration is what they said when a relevant item came up.
 */

/** The register, grouped by member so it reads like the document. */
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.userId) where.userId = req.query.userId;
    // ?boardId= narrows to interests relevant to one body: standing
    // all-bodies disclosures plus ones scoped to that body specifically.
    if (req.query.boardId) {
      where.OR = [
        { disclosedToAll: true },
        { disclosures: { some: { boardId: req.query.boardId } } },
      ];
    }
    // Default to standing interests; ?status=ALL includes ones that have ended.
    const status = (req.query.status || 'ACTIVE').toUpperCase();
    if (status !== 'ALL') where.status = status;

    const interests = await prisma.memberInterest.findMany({
      where,
      include: {
        user: true,
        disclosures: { include: { board: { select: { id: true, name: true, shortName: true, kind: true } } } },
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
    });

    const byMember = new Map();
    for (const i of interests) {
      const key = i.userId;
      if (!byMember.has(key)) {
        byMember.set(key, {
          userId: key,
          member: i.user?.name || 'Unknown member',
          email: i.user?.email || null,
          initials: i.user?.initials || null,
          notified: true,
          interests: [],
        });
      }
      const entry = byMember.get(key);
      entry.interests.push({
        id: i.id,
        interest: i.interest,
        category: i.category,
        disclosedToAll: i.disclosedToAll,
        boards: (i.disclosures || []).map((d) => d.board).filter(Boolean),
        notified: i.notified,
        notifiedAt: i.notifiedAt,
        boardSteps: i.boardSteps,
        memberActions: i.memberActions,
        status: i.status,
        endedAt: i.endedAt,
        updatedAt: i.updatedAt,
      });
      // The register's "has the board been notified?" column is per member and
      // is only a yes when every one of their interests has been notified.
      if (!i.notified) entry.notified = false;
    }

    res.json({
      members: [...byMember.values()].sort((a, b) => a.member.localeCompare(b.member)),
      total: interests.length,
      outstanding: interests.filter((i) => !i.notified).length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Add an interest. Accepts several at once, because members declare their
 * positions in a list rather than one at a time.
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      userId, boardId, interests, interest, category, notified, boardSteps, memberActions,
      disclosedToAll, boardIds,
    } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Member is required' });

    // Scope: standing (all bodies) unless specific bodies were chosen.
    const scopeAll = disclosedToAll !== false;
    const scopeBoards = Array.isArray(boardIds) ? boardIds.filter(Boolean) : [];
    if (!scopeAll && scopeBoards.length === 0) {
      return res.status(400).json({ error: 'Choose at least one board or committee, or disclose to all' });
    }

    // "Director, X\nMember, Y" or an array — both mean several interests.
    const list = Array.isArray(interests)
      ? interests
      : String(interest || '').split('\n').map((s) => s.trim()).filter(Boolean);

    if (!list.length) return res.status(400).json({ error: 'Describe at least one interest' });

    const cat = category && COI_TYPE_IDS.includes(category) ? category : 'DUTY_TO_DUTY';
    const isNotified = Boolean(notified);

    let added = 0;
    for (const text of list) {
      const row = await prisma.memberInterest.create({
        data: {
          userId,
          boardId: boardId || null,
          interest: typeof text === 'string' ? text : text.interest,
          category: cat,
          notified: isNotified,
          notifiedAt: isNotified ? new Date() : null,
          boardSteps: boardSteps || null,
          memberActions: memberActions || null,
          disclosedToAll: scopeAll,
          ...(scopeAll
            ? {}
            : { disclosures: { create: scopeBoards.map((b) => ({ boardId: b })) } }),
        },
      });
      added += row ? 1 : 0;
    }

    res.status(201).json({ added });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      interest, category, notified, boardSteps, memberActions, status,
      disclosedToAll, boardIds,
    } = req.body || {};

    const current = await prisma.memberInterest.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Not found' });

    // Scope change: replace the disclosure set wholesale — it is small and a
    // partial diff would invite drift.
    if (disclosedToAll !== undefined || boardIds !== undefined) {
      const scopeAll = disclosedToAll !== false;
      const scopeBoards = Array.isArray(boardIds) ? boardIds.filter(Boolean) : [];
      if (!scopeAll && scopeBoards.length === 0) {
        return res.status(400).json({ error: 'Choose at least one board or committee, or disclose to all' });
      }
      await prisma.interestDisclosure.deleteMany({ where: { interestId: current.id } });
      if (!scopeAll) {
        await prisma.interestDisclosure.createMany({
          data: scopeBoards.map((b) => ({ interestId: current.id, boardId: b })),
        });
      }
      await prisma.memberInterest.update({
        where: { id: current.id },
        data: { disclosedToAll: scopeAll },
      });
    }

    const updated = await prisma.memberInterest.update({
      where: { id: req.params.id },
      data: {
        ...(interest !== undefined ? { interest } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(boardSteps !== undefined ? { boardSteps: boardSteps || null } : {}),
        ...(memberActions !== undefined ? { memberActions: memberActions || null } : {}),
        ...(notified !== undefined
          ? {
              notified: Boolean(notified),
              // Stamp the moment it was first notified, and keep that stamp.
              notifiedAt: notified ? current.notifiedAt || new Date() : null,
            }
          : {}),
        ...(status !== undefined
          ? { status, endedAt: status === 'ENDED' ? new Date() : null }
          : {}),
      },
      include: { user: true },
    });

    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Close an interest rather than deleting it — the register is a historical
 * record, and a position someone held last year still explains past votes.
 */
router.post('/:id/end', requireAdmin, async (req, res) => {
  try {
    const ended = await prisma.memberInterest.update({
      where: { id: req.params.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    res.json(ended);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Only for entries made in error. Use /end when the position simply finished. */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.memberInterest.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
