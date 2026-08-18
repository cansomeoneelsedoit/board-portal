/*
 * Matching meetings to their SharePoint folders.
 *
 * The folders are named by whoever maintains the filing cabinet, not by this
 * app, so the job is to READ their convention rather than impose one. Real
 * examples from the BOM INC library:
 *
 *   02 - 4 February 2026          <- ordinal prefix, then a full date
 *   03 - 4 March 2026
 *   Southern FM - Meeting 6.12.25 <- d.m.yy buried in a title
 *   2026-08-19 August Ordinary    <- ISO, if this app created it
 *
 * A folder is matched to a meeting when the date in its name is the same day.
 * Anything undated (00 Duty statements, 01 Policies) is reference material and
 * is deliberately never matched to a meeting.
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Two-digit years are this century — these are current board papers. */
const fullYear = (y) => (y < 100 ? 2000 + y : y);

const asDate = (y, m, d) => {
  const date = new Date(Date.UTC(fullYear(y), m, d));
  // Reject rolled-over nonsense like 31 February.
  return date.getUTCMonth() === m && date.getUTCDate() === d ? date : null;
};

/**
 * Pull a calendar date out of a folder name, or null when there isn't one.
 */
function dateFromFolderName(name) {
  if (!name) return null;
  const text = String(name);

  // 2026-08-19 or 2026_08_19
  const iso = text.match(/(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})/);
  if (iso) {
    const d = asDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (d) return d;
  }

  // 4 February 2026  /  4 Feb 2026
  const named = text.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      const d = asDate(Number(named[3]), month, Number(named[1]));
      if (d) return d;
    }
  }

  // February 2026 — month precision only, day defaults to the 1st
  const monthOnly = text.match(/\b([A-Za-z]{3,9})\.?\s+(20\d{2})\b/);
  if (monthOnly) {
    const month = MONTHS[monthOnly[1].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      const d = asDate(Number(monthOnly[2]), month, 1);
      if (d) return { date: d, monthOnly: true };
    }
  }

  // 6.12.25 or 6/12/2025 — day-first, as written in Australia
  const numeric = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/);
  if (numeric) {
    const d = asDate(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));
    if (d) return d;
  }

  return null;
}

const sameDay = (a, b) =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

const sameMonth = (a, b) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

/**
 * Best folder for a meeting, or null.
 *
 * Prefers an exact day match; falls back to a month match only when exactly one
 * folder in that month exists, so an ambiguous month never picks the wrong pack.
 *
 * @param {Array<{id:string,name:string}>} folders  candidates (folders only)
 * @param {{date: Date|string}} meeting
 */
function matchMeetingFolder(folders, meeting) {
  if (!meeting?.date || !Array.isArray(folders)) return null;
  const target = new Date(meeting.date);

  const dated = folders
    .map((folder) => {
      const parsed = dateFromFolderName(folder.name);
      if (!parsed) return null;
      const date = parsed instanceof Date ? parsed : parsed.date;
      const monthOnly = !(parsed instanceof Date);
      return { folder, date, monthOnly };
    })
    .filter(Boolean);

  const exact = dated.find((d) => !d.monthOnly && sameDay(d.date, target));
  if (exact) return exact.folder;

  // Fall back to a month match ONLY for folders that never named a day
  // ("February 2026"). A folder that names a different day is a different
  // meeting — a 15 July meeting must not pick up the 1 July pack.
  const inMonth = dated.filter((d) => d.monthOnly && sameMonth(d.date, target));
  return inMonth.length === 1 ? inMonth[0].folder : null;
}

/**
 * Folder name to CREATE for a meeting that has no folder yet.
 *
 * Follows the library's own convention — ordinal prefix, then the date — so a
 * folder this app makes sits correctly alongside the hand-made ones.
 * Example: "09 - 2 September 2026".
 */
function meetingFolderName(meeting) {
  if (!meeting) return 'General';
  const date = meeting.date ? new Date(meeting.date) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return String(meeting.title || 'Meeting').replace(/[\\/:*?"<>|#%]/g, '-').trim();
  }

  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const monthName = date.toLocaleString('en-AU', { month: 'long', timeZone: 'UTC' });
  return `${month} - ${date.getUTCDate()} ${monthName} ${date.getUTCFullYear()}`;
}

/** Reference folders (policies, duty statements) carry no date. */
const isReferenceFolder = (name) => dateFromFolderName(name) === null;

/**
 * Agenda-item number at the front of a pack sub-folder name.
 * "05 Financial & Grand Treasurer's Reports" -> 5, "10.01 Grand Registrar" -> 10.
 */
function agendaNumberFromFolderName(name) {
  // Dotted numbers are sub-items: "10.01 Grand Registrar" -> 10.01.
  const m = String(name || '').match(/^\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/**
 * Split a pack folder name into an agenda number and title.
 * "03 Conflict of Interest" -> { number: "3", title: "Conflict of Interest" }
 * "10.01 Grand Registrar"  -> { number: "10.01", title: "Grand Registrar" }
 */
function agendaItemFromFolderName(name) {
  const m = String(name || '').trim().match(/^(\d+(?:\.\d+)?)[.\s\-–—]*(.*)$/);
  if (!m || !m[2]) return null;
  // Strip a leading zero on whole numbers ("03" -> "3") but keep dotted parts.
  const number = m[1].includes('.') ? m[1] : String(Number(m[1]));
  return { number, title: m[2].trim(), sort: Number(m[1]) };
}

/**
 * Stamp a received time against the papers-due window.
 *
 *   ON_TIME        in hand before papers were due
 *   LATE           inside the due window but before the meeting
 *   AFTER_MEETING  arrived after the board sat
 */
function receivedStatus(receivedAt, meetingDate, dueDays = 4) {
  if (!receivedAt || !meetingDate) return null;
  const received = new Date(receivedAt);
  const meeting = new Date(meetingDate);
  const due = new Date(meeting.getTime() - dueDays * 24 * 60 * 60 * 1000);
  if (received <= due) return 'ON_TIME';
  if (received <= meeting) return 'LATE';
  return 'AFTER_MEETING';
}

/**
 * Undo double-encoded UTF-8 in a name ("Ã¢Â€Â”" -> "—"). The mangling
 * happens via Windows-1252 (that is where "€" and "”" come from), so the
 * characters are mapped back to those bytes and decoded as UTF-8, repeated
 * until the name stops changing. A clean name comes back untouched.
 */
// Windows-1252 0x80–0x9F, the characters that betray a mangled name.
const CP1252 = new Map(Object.entries({
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F,
}));

function fixMojibake(name) {
  let cur = String(name || '');
  for (let i = 0; i < 4 && /[-ÿ]/.test(cur); i++) {
    const bytes = [];
    let ok = true;
    for (const ch of cur) {
      const cp = ch.codePointAt(0);
      if (cp < 0x100) bytes.push(cp);
      else if (CP1252.has(ch)) bytes.push(CP1252.get(ch));
      else { ok = false; break; }
    }
    if (!ok) break;
    let next;
    try { next = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes)); } catch { break; }
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

module.exports = {
  fixMojibake,
  dateFromFolderName,
  matchMeetingFolder,
  meetingFolderName,
  isReferenceFolder,
  agendaNumberFromFolderName,
  agendaItemFromFolderName,
  receivedStatus,
};
