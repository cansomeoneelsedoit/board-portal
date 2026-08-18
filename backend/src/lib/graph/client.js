const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Percent-encode each path segment but keep the separators, so
 * "Board Packs/2026" survives as "Board%20Packs/2026".
 */
function encodeDrivePath(...segments) {
  return segments
    .map((segment) => encodeURIComponent(segment).replace(/%2F/g, '/'))
    .join('/');
}

/** Network-level failures that a short retry usually cures. */
const TRANSIENT_CODES = new Set([
  'ENETUNREACH', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN',
  'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET',
]);

function transientCode(error) {
  const direct = error?.cause?.code || error?.code;
  if (direct && TRANSIENT_CODES.has(direct)) return direct;
  // AggregateError from happy-eyeballs: look inside.
  const inner = error?.cause?.errors || error?.errors || [];
  for (const e of inner) if (e?.code && TRANSIENT_CODES.has(e.code)) return e.code;
  return null;
}

/** Plain words for a network failure — what a secretary can act on. */
class NetworkUnavailableError extends Error {
  constructor(code, target) {
    super(
      code === 'ENETUNREACH' || code === 'EAI_AGAIN' || code === 'ENOTFOUND'
        ? `Cannot reach ${target} right now — the network connection appears to be down. Check the connection and try again.`
        : `The connection to ${target} dropped (${code}). Try again in a moment.`
    );
    this.name = 'NetworkUnavailableError';
    this.code = code;
    this.status = 503;
  }
}

/**
 * fetch with a short retry on transient network errors — a blip in the
 * connection to Microsoft (or anywhere) should not fail a page. Three
 * attempts, backing off 400ms → 1.2s.
 */
async function resilientFetch(url, init = {}, { attempts = 3, target = 'the service' } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      const code = transientCode(error);
      if (!code) throw error;
      last = code;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1) * (i + 1)));
    }
  }
  throw new NetworkUnavailableError(last, target);
}

async function graphFetch(accessToken, path, init = {}) {
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;

  return resilientFetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  }, { target: 'Microsoft SharePoint' });
}

module.exports = { GRAPH_BASE, encodeDrivePath, graphFetch, resilientFetch, NetworkUnavailableError, transientCode };
