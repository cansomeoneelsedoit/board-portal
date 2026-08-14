const { encodeDrivePath, graphFetch } = require('./client');
const { MicrosoftGraphError } = require('./errors');
const { SIMPLE_UPLOAD_MAX_BYTES } = require('./config');

/*
 * Ported from the SMSF platform's lib/microsoft-graph/sharepoint.ts, with the
 * matter/financial-year folder scheme swapped for board/meeting folders, and
 * delete + download + large-file upload added.
 *
 * The governing idea is carried over unchanged and it is the important one:
 * SharePoint holds the files. This service stores pointers, never copies. That
 * is why a file uploaded in the app appears in SharePoint and a file dropped in
 * SharePoint appears in the app — there is only one copy, so there is nothing
 * to keep in sync.
 */

const drivePath = (driveId) => `/drives/${driveId.trim()}`;

const normalizeFolderId = (folderId, driveId) =>
  !folderId || folderId === 'root' || folderId === driveId ? 'root' : folderId;

const childrenUrl = (driveId, parentId) =>
  parentId === 'root'
    ? `${drivePath(driveId)}/root/children`
    : `${drivePath(driveId)}/items/${parentId}/children`;

const itemPathUrl = (driveId, parentId, itemPath) =>
  parentId === 'root'
    ? `${drivePath(driveId)}/root:/${itemPath}:`
    : `${drivePath(driveId)}/items/${parentId}:/${itemPath}:`;

async function readGraphErrorBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function permissionDeniedMessage() {
  return (
    'SharePoint access denied. The Azure app registration needs the APPLICATION permission ' +
    'Sites.ReadWrite.All with admin consent granted.'
  );
}

async function throwGraphError(response, fallback) {
  const body = await readGraphErrorBody(response);

  if (response.status === 401 || response.status === 403) {
    throw new MicrosoftGraphError(permissionDeniedMessage());
  }

  const code = body?.error?.code;
  const message = body?.error?.message;
  throw new MicrosoftGraphError(
    code && message ? `${fallback} (${code}): ${message}` : message ? `${fallback}: ${message}` : fallback
  );
}

function isMissingItem(response, body) {
  if (response.status === 404) return true;
  if (body?.error?.code?.toLowerCase() === 'itemnotfound') return true;
  return (body?.error?.message || '').toLowerCase().includes('general exception');
}

async function listFolderChildren(accessToken, driveId, parentId) {
  const results = [];
  let url = childrenUrl(driveId, parentId);

  // Graph pages at 200 items; a board pack folder can exceed that.
  while (url) {
    const response = await graphFetch(accessToken, url);
    if (!response.ok) await throwGraphError(response, 'Failed to list folder contents');
    const data = await response.json();
    results.push(...data.value);
    url = data['@odata.nextLink'] || null;
  }

  return results;
}

async function getOrCreateChildFolder(accessToken, driveId, parentId, folderName) {
  const children = await listFolderChildren(accessToken, driveId, parentId);
  const existing = children.find((item) => item.folder && item.name === folderName);
  if (existing) return existing.id;

  const response = await graphFetch(accessToken, childrenUrl(driveId, parentId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }),
  });

  if (response.ok) {
    const item = await response.json();
    return item.id;
  }

  const body = await readGraphErrorBody(response);

  if (response.status === 401 || response.status === 403) {
    throw new MicrosoftGraphError(permissionDeniedMessage());
  }

  // Someone else created it between our list and our POST.
  if (response.status === 409 || body?.error?.code?.toLowerCase() === 'namealreadyexists') {
    const retry = await listFolderChildren(accessToken, driveId, parentId);
    const found = retry.find((item) => item.folder && item.name === folderName);
    if (found) return found.id;
  }

  throw new MicrosoftGraphError(
    body?.error?.message
      ? `Failed to create folder ${folderName}: ${body.error.message}`
      : `Failed to create folder ${folderName}`
  );
}

async function ensureFolderPath(accessToken, driveId, parentFolderId, segments) {
  let parentId = normalizeFolderId(parentFolderId, driveId);
  for (const segment of segments) {
    parentId = await getOrCreateChildFolder(accessToken, driveId, parentId, segment);
  }
  return parentId;
}

// ---------------------------------------------------------------- browsing

async function getSite(accessToken, siteId) {
  const response = await graphFetch(
    accessToken,
    `/sites/${encodeURIComponent(siteId)}?$select=id,displayName,webUrl`
  );
  if (!response.ok) await throwGraphError(response, 'Failed to load SharePoint site');
  const site = await response.json();
  return { id: site.id, name: site.displayName, webUrl: site.webUrl };
}

async function listSiteDrives(accessToken, siteId) {
  const response = await graphFetch(accessToken, `/sites/${encodeURIComponent(siteId)}/drives`);
  if (!response.ok) await throwGraphError(response, 'Failed to list SharePoint document libraries');
  const data = await response.json();
  return data.value
    .filter((drive) => drive.driveType === 'documentLibrary')
    .map((drive) => ({ id: drive.id, name: drive.name, webUrl: drive.webUrl, isFolder: true }));
}

async function listFolders(accessToken, driveId, folderId) {
  const children = await listFolderChildren(accessToken, driveId, normalizeFolderId(folderId, driveId));
  return children
    .filter((item) => item.folder)
    .map((item) => ({ id: item.id, name: item.name, webUrl: item.webUrl, isFolder: true }));
}

async function getFolderDetails(accessToken, driveId, folderId) {
  const normalized = normalizeFolderId(folderId, driveId);
  const url =
    normalized === 'root' ? `${drivePath(driveId)}/root` : `${drivePath(driveId)}/items/${normalized}`;

  const response = await graphFetch(accessToken, url);
  if (!response.ok) await throwGraphError(response, 'Failed to load SharePoint folder');
  const item = await response.json();
  return { id: item.id, name: item.name, webUrl: item.webUrl };
}

async function assertFolderAccess(accessToken, driveId, folderId) {
  await getFolderDetails(accessToken, driveId, folderId);
}

/**
 * Turn a SharePoint folder URL into a drive item.
 *
 * Lets an administrator paste the address straight out of their browser
 * instead of drilling through a picker. Graph accepts a URL as a sharing
 * token when it is base64url-encoded and prefixed with "u!".
 */
async function resolveShareUrl(accessToken, url) {
  const encoded =
    'u!' + Buffer.from(url.trim()).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');

  const response = await graphFetch(
    accessToken,
    `/shares/${encoded}/driveItem?$select=id,name,webUrl,parentReference,folder`
  );

  if (!response.ok) {
    const body = await readGraphErrorBody(response);
    if (response.status === 401 || response.status === 403) {
      // A 401 here means Graph would not tell us anything — we cannot know
      // whether the folder exists, only that we were refused.
      throw new MicrosoftGraphError(
        'Refused by SharePoint. Either the connection is not authorised yet, or the connected ' +
          'account cannot see that folder.'
      );
    }
    if (isMissingItem(response, body)) {
      throw new MicrosoftGraphError(
        'Could not find that folder. Paste the address bar URL from the SharePoint folder itself.'
      );
    }
    await throwGraphError(response, 'Could not resolve that SharePoint URL');
  }

  const item = await response.json();

  if (!item.folder) {
    throw new MicrosoftGraphError('That URL points at a file. Give the URL of the folder that holds the board packs.');
  }

  const driveId = item.parentReference?.driveId;
  if (!driveId) {
    throw new MicrosoftGraphError('Resolved the item but not its document library — try the folder picker instead.');
  }

  return { driveId, folderId: item.id, name: item.name, webUrl: item.webUrl };
}

/**
 * Everything directly inside a folder — sub-folders and files together.
 *
 * This is what the read-only board-pack browser walks: one level at a time, so
 * a deep SharePoint structure appears as members open it rather than being
 * enumerated up front.
 */
async function listChildren(accessToken, driveId, folderId) {
  const children = await listFolderChildren(accessToken, driveId, normalizeFolderId(folderId, driveId));

  return children
    .map((item) => ({
      id: item.id,
      name: item.name,
      isFolder: Boolean(item.folder),
      childCount: item.folder?.childCount ?? null,
      size: item.size ?? 0,
      mimetype: item.file?.mimeType || null,
      webUrl: item.webUrl,
      modifiedAt: item.lastModifiedDateTime || null,
      modifiedBy: item.lastModifiedBy?.user?.displayName || null,
    }))
    // Folders first, then files, each alphabetical — how people expect a
    // document library to read.
    .sort((a, b) =>
      a.isFolder === b.isFolder ? a.name.localeCompare(b.name) : a.isFolder ? -1 : 1
    );
}

/** A named sub-folder directly under a parent, or null. Never creates. */
async function findChildFolder(accessToken, driveId, parentFolderId, name) {
  const children = await listFolderChildren(accessToken, driveId, normalizeFolderId(parentFolderId, driveId));
  const match = children.find((item) => item.folder && item.name === name);
  return match ? { id: match.id, name: match.name, webUrl: match.webUrl } : null;
}

// ------------------------------------------------------------------ files

const mapFile = (file, folderName) => ({
  itemId: file.id,
  name: file.name,
  size: file.size ?? 0,
  mimetype: file.file?.mimeType || null,
  folder: folderName,
  webUrl: file.webUrl,
  etag: file.eTag || null,
  modifiedAt: file.lastModifiedDateTime || null,
  createdAt: file.createdDateTime || null,
  modifiedBy: file.lastModifiedBy?.user?.displayName || null,
});

/**
 * Every file under the board's root folder, one level of sub-folders deep.
 * Sub-folder name is carried through as `folder` so the UI can group by meeting.
 */
async function listBoardDocuments(accessToken, { driveId, folderId }) {
  const rootId = normalizeFolderId(folderId, driveId);
  const entries = await listFolderChildren(accessToken, driveId, rootId);

  const documents = entries.filter((e) => e.file).map((e) => mapFile(e, null));

  for (const entry of entries) {
    if (!entry.folder) continue;
    const children = await listFolderChildren(accessToken, driveId, entry.id);
    for (const child of children) {
      if (child.file) documents.push(mapFile(child, entry.name));
    }
  }

  return documents.sort(
    (a, b) => new Date(b.modifiedAt || 0).getTime() - new Date(a.modifiedAt || 0).getTime()
  );
}

/** Simple PUT for small files; upload session for anything over 4 MB. */
async function uploadDocument(accessToken, { driveId, folderId }, folderSegments, fileName, content, contentType) {
  await assertFolderAccess(accessToken, driveId, folderId);

  const targetFolderId = await ensureFolderPath(accessToken, driveId, folderId, folderSegments);
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

  if (buffer.length <= SIMPLE_UPLOAD_MAX_BYTES) {
    const response = await graphFetch(
      accessToken,
      `${drivePath(driveId)}/items/${targetFolderId}:/${encodeDrivePath(fileName)}:/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': contentType || 'application/octet-stream' },
        body: buffer,
      }
    );
    if (!response.ok) await throwGraphError(response, 'Failed to upload document');
    const item = await response.json();
    return mapFile(item, null);
  }

  const sessionResponse = await graphFetch(
    accessToken,
    `${drivePath(driveId)}/items/${targetFolderId}:/${encodeDrivePath(fileName)}:/createUploadSession`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    }
  );
  if (!sessionResponse.ok) await throwGraphError(sessionResponse, 'Failed to start upload session');
  const { uploadUrl } = await sessionResponse.json();

  // Chunks must be a multiple of 320 KiB.
  const CHUNK = 5 * 320 * 1024;
  let uploaded = null;

  for (let start = 0; start < buffer.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, buffer.length) - 1;
    const chunk = buffer.subarray(start, end + 1);

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
      },
      body: chunk,
    });

    if (response.status === 200 || response.status === 201) {
      uploaded = await response.json();
    } else if (response.status !== 202) {
      await throwGraphError(response, 'Failed to upload document chunk');
    }
  }

  if (!uploaded) throw new MicrosoftGraphError('Upload finished without returning an item');
  return mapFile(uploaded, null);
}

async function getItem(accessToken, driveId, itemId) {
  const response = await graphFetch(accessToken, `${drivePath(driveId)}/items/${itemId}`);
  if (response.ok) return mapFile(await response.json(), null);
  const body = await readGraphErrorBody(response);
  if (isMissingItem(response, body)) return null;
  await throwGraphError(response, 'Failed to load SharePoint item');
}

/** Short-lived direct download URL, so we never proxy bytes through this service. */
async function getDownloadUrl(accessToken, driveId, itemId) {
  // No $select: Graph drops the @microsoft.graph.downloadUrl annotation when
  // it is asked for by name, but always includes it on the full item.
  const response = await graphFetch(accessToken, `${drivePath(driveId)}/items/${itemId}`);
  if (!response.ok) await throwGraphError(response, 'Failed to get download link');
  const item = await response.json();
  return item['@microsoft.graph.downloadUrl'] || null;
}

/**
 * Embeddable preview for a file — the same viewer SharePoint itself uses,
 * short-lived and read-only, so papers open in a window inside the portal
 * without being downloaded. Office documents, PDFs and images all work;
 * anything the viewer cannot render falls back to the download link.
 */
async function previewItem(accessToken, driveId, itemId) {
  const response = await graphFetch(accessToken, `${drivePath(driveId)}/items/${itemId}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!response.ok) await throwGraphError(response, 'Failed to build a preview for this file');
  const data = await response.json();
  return data.getUrl || null;
}

async function deleteItem(accessToken, driveId, itemId) {
  const response = await graphFetch(accessToken, `${drivePath(driveId)}/items/${itemId}`, {
    method: 'DELETE',
  });
  if (response.status === 204 || response.status === 404) return true;
  await throwGraphError(response, 'Failed to delete document');
}

module.exports = {
  getSite,
  listSiteDrives,
  listFolders,
  listChildren,
  findChildFolder,
  resolveShareUrl,
  getFolderDetails,
  assertFolderAccess,
  ensureFolderPath,
  listBoardDocuments,
  uploadDocument,
  getItem,
  getDownloadUrl,
  previewItem,
  deleteItem,
};
