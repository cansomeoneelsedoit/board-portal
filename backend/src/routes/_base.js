const express = require('express');
const prisma = require('../lib/prisma');

/**
 * Generic CRUD router.
 *
 * @param {string} model      Prisma model accessor (e.g. 'meeting')
 * @param {object} [opts]
 * @param {object} [opts.include]  Relations to hydrate on list/detail reads
 * @param {object} [opts.orderBy]  Default ordering for list reads
 */
const makeRouter = (model, opts = {}) => {
  const { include, orderBy } = opts;
  const r = express.Router();

  const fail = (res, e) => {
    // Prisma validation/constraint errors are client mistakes, not 500s.
    const clientError = typeof e.code === 'string' && e.code.startsWith('P2');
    res.status(clientError ? 400 : 500).json({ error: e.message, code: e.code });
  };

  r.get('/', async (req, res) => {
    try {
      // Any query param matching a scalar filter is applied as an equality
      // filter, so the SPA can do /api/meetings?boardId=... without new routes.
      const where = {};
      for (const [k, v] of Object.entries(req.query)) {
        if (['include', 'orderBy', 'take', 'skip'].includes(k)) continue;
        where[k] = v === 'true' ? true : v === 'false' ? false : v;
      }
      const items = await prisma[model].findMany({
        where,
        include,
        orderBy,
        take: req.query.take ? Number(req.query.take) : undefined,
        skip: req.query.skip ? Number(req.query.skip) : undefined,
      });
      res.json(items);
    } catch (e) { fail(res, e); }
  });

  r.get('/:id', async (req, res) => {
    try {
      const item = await prisma[model].findUnique({
        where: { id: req.params.id },
        include,
      });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (e) { fail(res, e); }
  });

  r.post('/', async (req, res) => {
    try {
      const item = await prisma[model].create({ data: req.body });
      res.status(201).json(item);
    } catch (e) { fail(res, e); }
  });

  r.put('/:id', async (req, res) => {
    try {
      const item = await prisma[model].update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json(item);
    } catch (e) { fail(res, e); }
  });

  r.delete('/:id', async (req, res) => {
    try {
      await prisma[model].delete({ where: { id: req.params.id } });
      res.json({ deleted: true });
    } catch (e) { fail(res, e); }
  });

  return r;
};

module.exports = makeRouter;
