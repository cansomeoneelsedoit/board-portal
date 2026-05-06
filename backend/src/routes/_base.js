const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generic CRUD handler
const makeRouter = (model, include) => {
  const r = express.Router();
  r.get('/', async (req, res) => {
    try {
      const items = await prisma[model].findMany({ include });
      res.json(items);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  r.get('/:id', async (req, res) => {
    try {
      const item = await prisma[model].findUnique({ where: { id: req.params.id }, include });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  r.post('/', async (req, res) => {
    try {
      const item = await prisma[model].create({ data: req.body });
      res.status(201).json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  r.put('/:id', async (req, res) => {
    try {
      const item = await prisma[model].update({ where: { id: req.params.id }, data: req.body });
      res.json(item);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  r.delete('/:id', async (req, res) => {
    try {
      await prisma[model].delete({ where: { id: req.params.id } });
      res.json({ deleted: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  return r;
};

module.exports = makeRouter;
