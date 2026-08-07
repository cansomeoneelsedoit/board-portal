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

async function graphFetch(accessToken, path, init = {}) {
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
}

module.exports = { GRAPH_BASE, encodeDrivePath, graphFetch };
