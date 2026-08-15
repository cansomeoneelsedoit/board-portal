const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('./prisma');

/*
 * The brains behind "Ask me anything".
 *
 * Several providers can be configured at once — Anthropic, OpenAI, Google
 * Gemini, and any OpenAI-compatible endpoint (a BizGPT / gpu.ai instance).
 * One is the ACTIVE provider; the rest are fallbacks. If the active one
 * fails to answer, the next configured provider that does answer takes the
 * question, and the chat says who answered. One dead endpoint never takes
 * the feature down.
 *
 * Config lives in the Integration table (provider = "AI_PROVIDERS") so keys
 * are managed from the app; environment variables seed it and remain the
 * fallback when nothing has been saved.
 */

const PROVIDERS = {
  bizgpt: {
    label: 'BizGPT (OpenAI-compatible endpoint)',
    kind: 'openai-compatible',
    defaultModel: 'nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4',
    needsBaseUrl: true,
    env: { baseUrl: 'BIZGPT_BASE_URL', apiKey: 'BIZGPT_API_KEY', model: 'BIZGPT_MODEL' },
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    kind: 'anthropic',
    defaultModel: 'claude-opus-5',
    env: { apiKey: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL' },
  },
  openai: {
    label: 'OpenAI',
    kind: 'openai-compatible',
    defaultModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    env: { apiKey: 'OPENAI_API_KEY', model: 'OPENAI_MODEL' },
  },
  gemini: {
    label: 'Google Gemini',
    kind: 'gemini',
    defaultModel: 'gemini-2.0-flash',
    env: { apiKey: 'GEMINI_API_KEY', model: 'GEMINI_MODEL' },
  },
};

const ORDER = ['bizgpt', 'anthropic', 'openai', 'gemini'];

const mask = (key) => (key ? `${String(key).slice(0, 4)}…${String(key).slice(-4)}` : null);

/* ------------------------------------------------------------- settings */

async function loadSettings() {
  const row = await prisma.integration.findUnique({ where: { provider: 'AI_PROVIDERS' } }).catch(() => null);
  const saved = row ? JSON.parse(row.config || '{}') : {};
  const providers = {};
  for (const id of ORDER) {
    const def = PROVIDERS[id];
    const s = saved.providers?.[id] || {};
    providers[id] = {
      apiKey: s.apiKey || process.env[def.env.apiKey] || '',
      model: s.model || process.env[def.env.model] || def.defaultModel,
      baseUrl: def.needsBaseUrl
        ? (s.baseUrl || process.env[def.env.baseUrl] || '')
        : def.baseUrl,
      enabled: s.enabled !== false,
      status: s.status || 'UNTESTED',
      lastDetail: s.lastDetail || null,
      lastTestedAt: s.lastTestedAt || null,
    };
  }
  return { active: saved.active || null, providers, row };
}

async function saveSettings(next) {
  const { row, ...rest } = next;
  await prisma.integration.upsert({
    where: { provider: 'AI_PROVIDERS' },
    update: { config: JSON.stringify(rest), status: 'CONNECTED' },
    create: { provider: 'AI_PROVIDERS', config: JSON.stringify(rest), status: 'CONNECTED' },
  });
}

const isConfigured = (id, p) =>
  Boolean(p.apiKey) && (!PROVIDERS[id].needsBaseUrl || Boolean(p.baseUrl));

/** Public view: masked keys, plus which providers are usable. */
async function describeSettings() {
  const s = await loadSettings();
  const active = s.active || ORDER.find((id) => isConfigured(id, s.providers[id])) || null;
  return {
    active,
    providers: ORDER.map((id) => ({
      id,
      label: PROVIDERS[id].label,
      kind: PROVIDERS[id].kind,
      needsBaseUrl: Boolean(PROVIDERS[id].needsBaseUrl),
      configured: isConfigured(id, s.providers[id]),
      enabled: s.providers[id].enabled,
      baseUrl: s.providers[id].baseUrl || '',
      model: s.providers[id].model,
      apiKeyMasked: mask(s.providers[id].apiKey),
      status: s.providers[id].status,
      lastDetail: s.providers[id].lastDetail,
      lastTestedAt: s.providers[id].lastTestedAt,
    })),
  };
}

/** Save one provider's fields. Blank key/model keeps what is stored. */
async function updateProvider(id, patch) {
  if (!PROVIDERS[id]) throw new Error(`Unknown provider ${id}`);
  const s = await loadSettings();
  const cur = s.providers[id];
  const next = {
    apiKey: patch.apiKey?.trim() || cur.apiKey,
    model: patch.model?.trim() || cur.model,
    baseUrl: PROVIDERS[id].needsBaseUrl ? (patch.baseUrl?.trim().replace(/\/+$/, '') || cur.baseUrl) : undefined,
    enabled: patch.enabled === undefined ? cur.enabled : Boolean(patch.enabled),
    status: 'UNTESTED',
    lastDetail: null,
    lastTestedAt: null,
  };
  const saved = { active: s.active, providers: { ...(await rawSavedProviders()), [id]: next } };
  await saveSettings(saved);
  return describeSettings();
}

async function rawSavedProviders() {
  const row = await prisma.integration.findUnique({ where: { provider: 'AI_PROVIDERS' } }).catch(() => null);
  return row ? (JSON.parse(row.config || '{}').providers || {}) : {};
}

async function setActive(id) {
  if (!PROVIDERS[id]) throw new Error(`Unknown provider ${id}`);
  const s = await loadSettings();
  await saveSettings({ active: id, providers: await rawSavedProviders(), _seen: s.active });
  return describeSettings();
}

async function recordTest(id, result) {
  const providers = await rawSavedProviders();
  const s = await loadSettings();
  providers[id] = {
    ...(providers[id] || {}),
    status: result.ok ? 'CONNECTED' : 'ERROR',
    lastDetail: result.detail,
    lastTestedAt: new Date().toISOString(),
  };
  await saveSettings({ active: s.active, providers });
}

/* --------------------------------------------------------- error wording */

function hostOf(url) { try { return new URL(url).host; } catch { return url; } }

function friendlyStatusError(label, status, baseUrl, body = '') {
  const host = hostOf(baseUrl);
  if ([502, 503, 504].includes(status)) {
    return `${label}: the gateway at ${host} is up but the model behind it is not answering (HTTP ${status}) — the instance is starting or stopped.`;
  }
  if (status === 401 || status === 403) return `${label}: the API key was rejected (HTTP ${status}).`;
  if (status === 404) return `${label}: no model at that path or name (HTTP 404) — check the base URL ends in /v1 and the model name.`;
  if (status === 429) return `${label}: rate limited or out of credit (HTTP 429).`;
  return `${label}: endpoint returned ${status}${body ? `: ${body.slice(0, 200)}` : ''}`;
}

function friendlyTransportError(label, error, baseUrl) {
  const code = error?.cause?.code || error?.code || '';
  const host = hostOf(baseUrl);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `${label}: ${host} could not be found — instance stopped or address wrong.`;
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') return `${label}: ${host} refused the connection — the service may still be starting.`;
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT') return `${label}: ${host} timed out — the model may be loading.`;
  return `${label}: ${error?.message || 'request failed'}`;
}

/* -------------------------------------------------------------- calling */

const TIMEOUT_MS = 120_000;

async function callOpenAiCompatible(id, p, system, messages, maxTokens) {
  const label = PROVIDERS[id].label;
  const base = p.baseUrl.replace(/\/+$/, '');
  let response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: p.model,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(friendlyTransportError(label, error, base));
  }
  if (!response.ok) throw new Error(friendlyStatusError(label, response.status, base, await response.text().catch(() => '')));
  const data = await response.json();
  const answer = (data.choices?.[0]?.message?.content || '').trim();
  if (!answer) throw new Error(`${label}: the model returned an empty answer`);
  return { answer, usage: data.usage };
}

async function callAnthropic(id, p, systemBlocks, messages, maxTokens) {
  const label = PROVIDERS[id].label;
  const client = new Anthropic({ apiKey: p.apiKey, timeout: TIMEOUT_MS });
  let response;
  try {
    response = await client.messages.create({
      model: p.model,
      max_tokens: maxTokens,
      system: systemBlocks,
      messages,
    });
  } catch (error) {
    const status = error?.status;
    if (status) throw new Error(friendlyStatusError(label, status, 'https://api.anthropic.com', error.message));
    throw new Error(friendlyTransportError(label, error, 'https://api.anthropic.com'));
  }
  if (response.stop_reason === 'refusal') return { answer: `${label} declined to answer that question.`, refused: true };
  const answer = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return { answer, usage: response.usage };
}

async function callGemini(id, p, system, messages, maxTokens) {
  const label = PROVIDERS[id].label;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(friendlyTransportError(label, error, 'https://generativelanguage.googleapis.com'));
  }
  if (!response.ok) throw new Error(friendlyStatusError(label, response.status, 'https://generativelanguage.googleapis.com', await response.text().catch(() => '')));
  const data = await response.json();
  const answer = (data.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('').trim();
  if (!answer) throw new Error(`${label}: the model returned an empty answer`);
  return { answer, usage: data.usageMetadata };
}

/**
 * Ask with the active provider, then each remaining enabled provider in
 * turn if it fails. Returns { answer, provider, model, fellBack, errors }.
 */
async function askWithFailover({ persona, context, messages, maxTokens = 2048 }) {
  const s = await loadSettings();
  const activeId = s.active || ORDER.find((id) => isConfigured(id, s.providers[id]));
  const chain = [activeId, ...ORDER.filter((id) => id !== activeId)]
    .filter((id) => id && s.providers[id].enabled && isConfigured(id, s.providers[id]));

  if (!chain.length) {
    const err = new Error('No AI provider is configured yet — add a key under Integrations → Ask me anything.');
    err.status = 503;
    throw err;
  }

  const errors = [];
  for (const id of chain) {
    const p = s.providers[id];
    const kind = PROVIDERS[id].kind;
    try {
      let result;
      if (kind === 'anthropic') {
        result = await callAnthropic(id, p, [
          { type: 'text', text: persona },
          { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
        ], messages, maxTokens);
      } else if (kind === 'gemini') {
        result = await callGemini(id, p, `${persona}\n\n${context}`, messages, maxTokens);
      } else {
        result = await callOpenAiCompatible(id, p, `${persona}\n\n${context}`, messages, maxTokens);
      }
      return { ...result, provider: id, providerLabel: PROVIDERS[id].label, model: p.model, fellBack: id !== activeId, errors };
    } catch (error) {
      errors.push(error.message);
    }
  }

  const err = new Error(`No AI provider could answer.\n${errors.join('\n')}`);
  err.status = 502;
  err.errors = errors;
  throw err;
}

/** One-shot connectivity check for one provider; records the outcome. */
async function testProvider(id) {
  const s = await loadSettings();
  const p = s.providers[id];
  if (!PROVIDERS[id]) return { ok: false, detail: 'Unknown provider' };
  if (!isConfigured(id, p)) return { ok: false, detail: 'Not configured — add a key first.' };

  const started = Date.now();
  let result;
  try {
    const kind = PROVIDERS[id].kind;
    const messages = [{ role: 'user', content: 'Reply with the single word OK.' }];
    if (kind === 'anthropic') await callAnthropic(id, p, [{ type: 'text', text: 'You are a connectivity check.' }], messages, 8);
    else if (kind === 'gemini') await callGemini(id, p, 'You are a connectivity check.', messages, 8);
    else await callOpenAiCompatible(id, p, 'You are a connectivity check.', messages, 8);
    result = { ok: true, detail: `Model answered (${Date.now() - started}ms)` };
  } catch (error) {
    result = { ok: false, detail: error.message };
  }
  await recordTest(id, result);
  return result;
}

module.exports = {
  PROVIDERS, ORDER,
  describeSettings, updateProvider, setActive, testProvider, askWithFailover,
};
