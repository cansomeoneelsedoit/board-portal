const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

/**
 * People, for the invite picker.
 *
 * ?search= matches name or email, case-insensitively, so the picker behaves
 * like every other type-ahead: start typing a surname and the person appears.
 */
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const take = Math.min(Number(req.query.take) || 50, 200);

    // Optionally exclude people already invited to a meeting, so the picker
    // never offers someone twice.
    let excludeIds = [];
    if (req.query.notInMeeting) {
      const invited = await prisma.invitation.findMany({
        where: { meetingId: req.query.notInMeeting },
        select: { userId: true },
      });
      excludeIds = invited.map((i) => i.userId);
    }

    const users = await prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: { name: 'asc' },
      take,
    });

    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Adding people to the directory is an administrator's job. */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, email, role, initials } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Someone already has that email address' });

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role || 'DIRECTOR',
        initials:
          initials ||
          name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
      },
    });
    res.status(201).json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: req.body });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (e) {
    // Almost always a foreign key: the person is on a meeting somewhere.
    res.status(409).json({
      error: 'Cannot remove someone who is already on a meeting, vote or declaration.',
    });
  }
});

module.exports = router;
