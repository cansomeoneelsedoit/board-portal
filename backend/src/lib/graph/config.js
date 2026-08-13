const { MicrosoftGraphConfigError } = require('./errors');

/**
 * Board Portal talks to Graph as *itself* (client credentials), not as a signed-in
 * user, because the app has no user login. That means the Azure app registration
 * needs the APPLICATION permission `Sites.ReadWrite.All` with admin consent —
 * not the delegated `Files.ReadWrite` the SMSF platform uses.
 */
function getMicrosoftAppCredentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  // Optional: only the app-only (client credentials) path needs a secret.
  // "Sign in with Microsoft" (device code) is a public-client flow and works
  // with just tenant + client id.
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() || null;
  // A tenant id, a domain ("masonicservices.com.au"), or "organizations" when
  // the app registration is multi-tenant and each board's people sign in with
  // their own tenant's accounts.
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim();

  if (!clientId || !tenantId) {
    throw new MicrosoftGraphConfigError(
      'SharePoint is not configured. Set MICROSOFT_TENANT_ID and MICROSOFT_CLIENT_ID on the ' +
        'backend service (MICROSOFT_CLIENT_SECRET is only needed for app-only access).'
    );
  }

  return { clientId, clientSecret, tenantId };
}

/** Cheap check for status endpoints — never throws. */
function isConfigured() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_TENANT_ID?.trim()
  );
}

/**
 * Default site for browsing, e.g. "contoso.sharepoint.com:/sites/BoardPacks".
 * Optional: a board can point at any drive once one is picked.
 */
function getDefaultSiteId() {
  return process.env.SHAREPOINT_SITE_ID?.trim() || null;
}

/** Graph caps a simple PUT upload at 4 MB; larger needs an upload session. */
const SIMPLE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

module.exports = {
  getMicrosoftAppCredentials,
  isConfigured,
  getDefaultSiteId,
  SIMPLE_UPLOAD_MAX_BYTES,
};
