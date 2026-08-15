const express = require('express');
const makeRouter = require('./_base');
const { requireAdmin } = require('../lib/session');

const router = express.Router();

/**
 * The AI providers behind "Ask me anything" — Anthropic, OpenAI, Gemini,
 * and any OpenAI-compatible endpoint (BizGPT / gpu.ai). Managed here so a
 * dead link or a new key is fixed in the app, not in .env. (Declared before
 * the generic CRUD so /:id never shadows these.)
 */
router.get('/ai', async (req, res) => {
  try {
    const { describeSettings } = require('../lib/ai-providers');
    res.json(await describeSettings());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Save one provider's key / model / base URL. Blank fields keep stored values. */
router.put('/ai/:provider', requireAdmin, async (req, res) => {
  try {
    const { updateProvider } = require('../lib/ai-providers');
    res.json(await updateProvider(req.params.provider, req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Choose which provider answers first; the rest are fallbacks. */
router.post('/ai/:provider/activate', requireAdmin, async (req, res) => {
  try {
    const { setActive } = require('../lib/ai-providers');
    res.json(await setActive(req.params.provider));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** Reach out and touch one provider; the outcome is recorded on it. */
router.post('/ai/:provider/test', requireAdmin, async (req, res) => {
  try {
    const { testProvider } = require('../lib/ai-providers');
    res.json(await testProvider(req.params.provider));
  } catch (e) {
    res.status(500).json({ ok: false, detail: e.message });
  }
});

router.use(makeRouter('integration', { orderBy: { provider: 'asc' } }));

module.exports = router;
