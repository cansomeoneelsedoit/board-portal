const prisma = require('./prisma');
const sp = require('./graph/sharepoint');
const { resilientFetch } = require('./graph/client');
const { textFromFile } = require('./motion-scan');

/*
 * Text of a SharePoint pack file, remembered.
 *
 * Downloading and parsing every paper is what makes "Ask me anything" and
 * the motion scan slow. A paper rarely changes once it is in the pack, so
 * its text is kept in the database against the item id + SharePoint
 * modified stamp + size: same stamp, same text — no download. Only a file
 * SharePoint reports as changed is fetched and read again.
 */

const MAX_BYTES = 40 * 1024 * 1024;

// Unknown stamp (a file opened outside the listing) trusts whatever is cached.
const isFresh = (row, file) =>
  row && (file.modifiedAt == null
    ? true
    : row.modifiedAt === file.modifiedAt && row.size === (file.size || 0));

/**
 * Text for one file ({ id, name, size, modifiedAt } as listChildren gives).
 * Returns { text, cached } — text is '' when nothing could be extracted.
 */
async function fileText(token, driveId, file) {
  const row = await prisma.packFileText.findUnique({
    where: { driveId_itemId: { driveId, itemId: file.id } },
  }).catch(() => null);
  if (isFresh(row, file)) return { text: row.text, cached: true };

  if ((file.size || 0) > MAX_BYTES) return { text: '', cached: false };
  const url = await sp.getDownloadUrl(token, driveId, file.id);
  if (!url) throw new Error('no download url');
  const r = await resilientFetch(url, {}, { target: 'SharePoint' });
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  const buffer = Buffer.from(await r.arrayBuffer());
  const text = (await textFromFile(file.name, buffer)) || '';

  const data = {
    driveId, itemId: file.id, name: file.name, size: file.size || buffer.length,
    modifiedAt: file.modifiedAt || null, text, chars: text.length, extractedAt: new Date(),
  };
  await prisma.packFileText.upsert({
    where: { driveId_itemId: { driveId, itemId: file.id } },
    update: data,
    create: data,
  }).catch(() => { /* cache is best-effort */ });
  return { text, cached: false };
}

/**
 * Read many files a few at a time, in the order given. Each result is
 * { file, text, cached, error }.
 */
async function manyFileTexts(token, driveId, files, concurrency = 5) {
  const out = new Array(files.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const i = cursor++;
      const file = files[i];
      try {
        out[i] = { file, ...(await fileText(token, driveId, file)) };
      } catch (error) {
        out[i] = { file, text: '', cached: false, error: error.message };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) || 0 }, worker));
  return out;
}

// Warm the cache in the background whenever a pack is looked at, so the
// first question already finds the papers read. One warm per meeting per
// few minutes is plenty.
const warmedAt = new Map();
function warmInBackground(key, files, token, driveId, readable) {
  const last = warmedAt.get(key) || 0;
  if (Date.now() - last < 3 * 60 * 1000) return;
  warmedAt.set(key, Date.now());
  const list = files.filter((f) => readable.test(f.name));
  if (!list.length) return;
  manyFileTexts(token, driveId, list, 3).catch(() => {});
}

module.exports = { fileText, manyFileTexts, warmInBackground, MAX_BYTES };
