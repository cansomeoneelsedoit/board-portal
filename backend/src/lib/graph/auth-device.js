const prisma = require('../prisma');
const { getMicrosoftAppCredentials } = require('./config');
const { MicrosoftGraphAuthError } = require('./errors');
const { resilientFetch } = require('./client');

/*
 * Delegated Graph access via the OAuth device authorization grant.
 *
 * Why this exists: the app-only path needs an Azure admin to add an
 * application permission and grant admin consent. Delegated access borrows a
 * signed-in person's own rights, so it works with the delegated permissions an
 * app registration typically already has. Device code specifically needs no
 * redirect URI, which means no Azure configuration change at all.
 *
 * Board Portal signs in once as a service account (or Boyd) and keeps the
 * refresh token. Nobody signs in again unless the token is revoked.
 */

const SCOPES = [
  'https://graph.microsoft.com/Files.ReadWrite.All',
  'https://graph.microsoft.com/Sites.ReadWrite.All',
  'offline_access',
].join(' ');

// accessToken cache, keyed by clientId
const accessCache = new Map();

const tokenUrl = (tenantId) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

/** Ask Azure for a user code. The caller shows it to a human to approve. */
async function startDeviceLogin() {
  const { clientId, tenantId } = getMicrosoftAppCredentials();

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, scope: SCOPES }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new MicrosoftGraphAuthError(
      data.error_description?.split('\r\n')[0] || data.error || 'Could not start Microsoft sign-in'
    );
  }

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
    message: data.message,
  };
}

/**
 * Exchange a device code for tokens. Returns {pending:true} while the user has
 * not finished approving, so the UI can poll without treating it as an error.
 */
async function completeDeviceLogin(deviceCode) {
  const { clientId, tenantId } = getMicrosoftAppCredentials();

  const response = await fetch(tokenUrl(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (data.error === 'authorization_pending') return { pending: true };
    if (data.error === 'slow_down') return { pending: true, slowDown: true };
    throw new MicrosoftGraphAuthError(
      data.error_description?.split('\r\n')[0] || data.error || 'Microsoft sign-in failed'
    );
  }

  // Identify who signed in, for display.
  let account = null;
  try {
    const payload = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64').toString());
    account = payload.upn || payload.preferred_username || payload.unique_name || null;
  } catch {
    /* token shape is not our concern beyond display */
  }

  await prisma.graphAccount.upsert({
    where: { tenantId_clientId: { tenantId, clientId } },
    update: { refreshToken: data.refresh_token, scopes: data.scope || SCOPES, account },
    create: {
      tenantId,
      clientId,
      account,
      refreshToken: data.refresh_token,
      scopes: data.scope || SCOPES,
    },
  });

  accessCache.set(clientId, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return { pending: false, account, scopes: data.scope || SCOPES };
}

/** The stored account, or null if nobody has signed in. */
async function getConnectedAccount() {
  try {
    const { clientId, tenantId } = getMicrosoftAppCredentials();
    return await prisma.graphAccount.findUnique({
      where: { tenantId_clientId: { tenantId, clientId } },
    });
  } catch {
    return null;
  }
}

/** Access token for the signed-in account, refreshing when needed. */
async function getDelegatedAccessToken() {
  const { clientId, clientSecret, tenantId } = getMicrosoftAppCredentials();

  const cached = accessCache.get(clientId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const stored = await prisma.graphAccount.findUnique({
    where: { tenantId_clientId: { tenantId, clientId } },
  });
  if (!stored) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: stored.refreshToken,
    scope: SCOPES,
  });
  // Confidential clients must send the secret; public ones must not. Sending it
  // when the app allows both is harmless, so include it when we have one.
  if (clientSecret) body.set('client_secret', clientSecret);

  const response = await resilientFetch(tokenUrl(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }, { target: 'Microsoft sign-in' });

  const data = await response.json();

  if (!response.ok) {
    // Refresh tokens die when revoked, expired, or the password changes.
    await prisma.graphAccount.deleteMany({ where: { id: stored.id } });
    throw new MicrosoftGraphAuthError(
      `Microsoft sign-in expired, please reconnect: ${data.error_description?.split('\r\n')[0] || data.error}`
    );
  }

  if (data.refresh_token && data.refresh_token !== stored.refreshToken) {
    await prisma.graphAccount.update({
      where: { id: stored.id },
      data: { refreshToken: data.refresh_token, scopes: data.scope || stored.scopes },
    });
  }

  accessCache.set(clientId, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

async function disconnectAccount() {
  const { clientId, tenantId } = getMicrosoftAppCredentials();
  accessCache.delete(clientId);
  await prisma.graphAccount.deleteMany({ where: { tenantId, clientId } });
}

module.exports = {
  SCOPES,
  startDeviceLogin,
  completeDeviceLogin,
  getConnectedAccount,
  getDelegatedAccessToken,
  disconnectAccount,
};
