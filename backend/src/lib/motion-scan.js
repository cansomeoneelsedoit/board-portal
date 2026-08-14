const AdmZip = require('adm-zip');

/*
 * Reading suggested motions out of board papers.
 *
 * Papers put their asks in recognisable shapes — "RECOMMENDATION: That the
 * Board approve…", "It is moved that…", "RESOLVED that…" — and the motion
 * list wants exactly those sentences. This module turns a paper into text
 * and pulls out anything that reads like a motion, so the secretary reviews
 * a short list instead of re-reading the whole pack.
 */

/** Plain text from a .docx: paragraphs from word/document.xml. */
function docxToText(buffer) {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  const xml = entry.getData().toString('utf8');
  return xml
    .replace(/<w:tab[^>]*\/>/g, ' ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function textFromFile(name, buffer) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.docx')) {
    try { return docxToText(buffer); } catch { return ''; }
  }
  if (/\.(txt|md|csv)$/.test(lower)) return buffer.toString('utf8');
  // Binary formats we cannot read (pdf, images, xlsx) are skipped, not errors.
  return '';
}

const clean = (s) =>
  s.replace(/\s+/g, ' ').replace(/^[\s:—–-]+/, '').trim();

/** "that the board…" -> "That the board…" for the motion list. */
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Motion-shaped sentences in a body of text, matching how board papers
 * actually write them (from the real packs):
 *
 *   Motion: That the minutes … be confirmed as a true and accurate record.
 *   Recommended Resolution: That the Board receive and note …
 *   Recommendation:
 *   That the Board approve …          <- clause on the next paragraph
 *   Recommendation: All applicants on schedule.   <- plain ask, no That
 *   That the Board move into camera.  <- bare written-resolution form
 */
function findMotions(text) {
  if (!text) return [];
  const found = [];
  let m;

  // A label followed by a That-clause, possibly on the next paragraph.
  const strong =
    /(?:recommended\s+resolutions?|recommendations?|motions?|resolutions?|it\s+is\s+(?:recommended|moved|resolved))\b[\s:—–-]*(that\b[^\n]{10,600}?[.;](?=\s|$))/gi;
  while ((m = strong.exec(text)) !== null) found.push(sentence(clean(m[1])));

  // "Recommendation:" with the ask written plainly, no That-clause. Must
  // read like a sentence — a table cell of digits is not a recommendation.
  const weak = /recommendations?\s*:\s*\n?\s*([^\n]{10,400})/gi;
  while ((m = weak.exec(text)) !== null) {
    const t = clean(m[1]);
    if (!/^that\b/i.test(t) && /[a-z]{3}/i.test(t) && t.includes(' ')) found.push(sentence(t));
  }

  // The bare written-resolution form at the start of a paragraph.
  const bare =
    /(?:^|\n)\s*(that\s+the\s+(?:board|committee|trust|company|members?|meeting)\b[^\n]{10,600}?[.;](?=\s|$))/gi;
  while ((m = bare.exec(text)) !== null) found.push(sentence(clean(m[1])));

  // Dedup near-identical hits (a labelled match usually also matches bare).
  const seen = new Set();
  return found.filter((t) => {
    const key = t.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 120);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { textFromFile, findMotions };
