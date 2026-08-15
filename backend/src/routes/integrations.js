const express = require('express');
const makeRouter = require('./_base');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

const mask = (key) => (key ? `${key.slice(0, 4)}…${key.slice(-4)}` : null);

const loadBizGpt = async () => {
  const row = await prisma.integration.findUnique({ where: { provider: 'BIZGPT' } });
  const cfg = row ? JSON.parse(row.config || '{}') : {};
  return { row, cfg };
};

/**
 * The BizGPT model endpoint — where "Ask me anything" gets its brain.
 * Saved here so a dead link is fixed from the app, not from .env.
 * (Declared before the generic CRUD so /:id never shadows it.)
 */
router.get('/bizgpt', async (req, res) => {
  try {
    const { resolveConfig } = require('../lib/bizgpt');
    const { row, cfg } = await loadBizGpt();
    const active = await resolveConfig();
    res.json({
      configured: Boolean(active.mode),
      source: active.source, // integration | env | anthropic | null
      status: row?.status || 'DISCONNECTED',
      baseUrl: cfg.baseUrl || process.env.BIZGPT_BASE_URL || '',
      model: cfg.model || process.env.BIZGPT_MODEL || '',
      apiKeyMasked: mask(cfg.apiKey || process.env.BIZGPT_API_KEY || ''),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Save the endpoint. A blank API key keeps the one already stored. */
router.put('/bizgpt', requireAdmin, async (req, res) => {
  try {
    const { baseUrl, apiKey, model } = req.body || {};
    if (!baseUrl?.trim()) return res.status(400).json({ error: 'Base URL is required' });

    const { cfg } = await loadBizGpt();
    const next = {
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      apiKey: apiKey?.trim() || cfg.apiKey || process.env.BIZGPT_API_KEY || '',
      model: model?.trim() || cfg.model || process.env.BIZGPT_MODEL || 'default',
    };
    if (!next.apiKey) return res.status(400).json({ error: 'An API key is required the first time' });

    await prisma.integration.upsert({
      where: { provider: 'BIZGPT' },
      update: { config: JSON.stringify(next), status: 'DISCONNECTED' },
      create: { provider: 'BIZGPT', config: JSON.stringify(next), status: 'DISCONNECTED' },
    });
    res.json({ saved: true, baseUrl: next.baseUrl, model: next.model, apiKeyMasked: mask(next.apiKey) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Reach out and touch the endpoint; record the outcome. */
router.post('/bizgpt/test', requireAdmin, async (req, res) => {
  try {
    const { resolveConfig, testEndpoint } = require('../lib/bizgpt');
    const active = await resolveConfig();
    if (active.mode !== 'openai') {
      return res.status(400).json({
        ok: false,
        detail: active.mode === 'anthropic'
          ? 'Running on the Anthropic API — nothing to test here.'
          : 'No endpoint saved yet.',
      });
    }

    const result = await testEndpoint(active);
    await prisma.integration.updateMany({
      where: { provider: 'BIZGPT' },
      data: { status: result.ok ? 'CONNECTED' : 'ERROR' },
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, detail: e.message });
  }
});

router.use(makeRouter('integration', { orderBy: { provider: 'asc' } }));

module.exports = router;
