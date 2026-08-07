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

module.exports = { getAppAccessToken, resetTokenCache };
