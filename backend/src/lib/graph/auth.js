const { getMicrosoftAppCredentials } = require('./config');
const { MicrosoftGraphAuthError } = require('./errors');

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

// tenantId -> { token, expiresAt }
const tokenCache = new Map();

/**
 * Application (client-credentials) token.
 *
 * The SMSF platform treats this as transitional and prefers delegated user
 * tokens, but Board Portal has no user login to delegate from — the host
 * vertical authenticates people, and this service acts as itself.
 */
async function getAppAccessToken() {
  const { clientId, clientSecret, tenantId } = getMicrosoftAppCredentials();

  const cached = tokenCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: GRAPH_SCOPE,
        grant_type: 'client_credentials',
      }),
    }
  );

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body.error_description || body.error || '';
    } catch {
      /* non-JSON error body */
    }
    throw new MicrosoftGraphAuthError(
      `Failed to obtain Microsoft Graph application token${detail ? `: ${detail.split('\n')[0]}` : ''}`
    );
  }

  const data = await response.json();

  tokenCache.set(tenantId, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

/** Drop cached tokens — used after credentials change. */
function resetTokenCache() {
  tokenCache.clear();
}

/**
 * Application roles baked into a token.
 *
 * Client credentials happily issues a token for any valid app+secret, even one
 * with no application permissions at all — that token then 401s on every call.
 * Reading the `roles` claim is how we tell "credentials are wrong" apart from
 * "admin consent was never granted", which are very different fixes.
 */
function getTokenRoles(accessToken) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    return Array.isArray(payload.roles) ? payload.roles : [];
  } catch {
    return [];
  }
}

/**
 * The token everything else should use.
 *
 * Prefers a signed-in Microsoft account (delegated) because that works with the
 * delegated permissions an app registration usually already has. Falls back to
 * app-only, which is tidier for a service but needs an Azure admin to grant an
 * application permission first.
 */
async function getGraphToken() {
  // Required lazily: auth-device pulls in Prisma, which this module must not
  // depend on for the pure app-only path.
  const { getDelegatedAccessToken } = require('./auth-device');

  const delegated = await getDelegatedAccessToken();
  if (delegated) return { token: delegated, mode: 'delegated' };

  return { token: await getAppAccessToken(), mode: 'application' };
}

module.exports = { getAppAccessToken, getGraphToken, resetTokenCache, getTokenRoles };
