const prisma = require('./prisma');
const sp = require('./graph/sharepoint');
const { getGraphToken } = require('./graph/auth');
const { matchMeetingFolder, receivedStatus } = require('./board-pack');
const { textFromFile } = require('./motion-scan');
const { resilientFetch } = require('./graph/client');
const { manyFileTexts, fileText } = require('./pack-text');

/*
 * Ask me anything — powered by BizGPT.
 *
 * One question, answered from everything the meeting knows: its details,
 * agenda, roll, quorum, motions, declared conflicts, and the text of every
 * readable paper in its pack. The model sees only THIS meeting's record, so
 * answers stay grounded in the pack rather than the model's imagination.
 */

const READABLE = /\.(docx|txt|md|csv|pdf|msg)$/i;
// Generous: modern models hold the whole pack. A single paper up to ~40
// pages, the whole pack up to ~600k characters (~150k tokens) — nothing a
// board pack contains should be cut mid-section.
const MAX_FILE_CHARS = 200_000;
const MAX_PACK_CHARS = 600_000;
const CONTEXT_TTL_MS = 5 * 60 * 1000;

// Building the context means downloading and reading the whole pack —
// cache it per meeting so a conversation costs one build, not one per turn.
const contextCache = new Map(); // meetingId -> { at, text }

/** Every file under a folder, sub-folders included. */
async function listFilesDeep(token, driveId, folderId, prefix = '', depth = 3) {
  const out = [];
  const entries = await sp.listChildren(token, driveId, folderId);
  for (const entry of entries) {
    if (entry.isFolder) {
      if (depth > 0) {
        out.push(...await listFilesDeep(token, driveId, entry.id, `${prefix}${entry.name}/`, depth - 1));
      }
    } else {
      out.push({ ...entry, name: `${prefix}${entry.name}` });
    }
  }
  return out;
}

/** The papers, as text: SharePoint pack (deep) plus locally uploaded docs. */
async function packText(meeting) {
  const parts = [];
  const manifest = [];
  let total = 0;

  // Every file is listed in a manifest — read in full, read but truncated,
  // unreadable format, or a cover sheet — so the model knows exactly what it
  // holds and can say so instead of guessing.
  const push = (name, text, sizeBytes) => {
    if (!text || !text.trim()) {
      manifest.push(`  ${name} — ${/\.(docx|pdf|txt|md|csv|msg)$/i.test(name) ? 'no extractable text (scanned or image-only)' : 'binary — not readable as text'}`);
      return;
    }
    const truncated = text.length > MAX_FILE_CHARS;
    const clipped = truncated ? `${text.slice(0, MAX_FILE_CHARS)}\n[…truncated at ${MAX_FILE_CHARS} characters]` : text;
    if (total + clipped.length > MAX_PACK_CHARS) {
      manifest.push(`  ${name} — omitted: pack context full`);
      return;
    }
    total += clipped.length;
    // A large file yielding little text is a cover sheet / mostly images —
    // the attachment it names may not be in the pack at all.
    const coverSheet = sizeBytes > 150_000 && text.length < 1_500;
    manifest.push(`  ${name} — ${text.length.toLocaleString()} characters${truncated ? ' (truncated)' : ' (read in full)'}${coverSheet ? ' — appears to be a COVER SHEET only; the report it refers to is not in the pack as a separate readable file' : ''}`);
    parts.push(`--- FILE: ${name} ---\n${clipped}`);
  };

  const board = meeting.board;
  const driveId = meeting.sharepointDriveId || board?.sharepointDriveId;
  if (driveId) {
    try {
      const { token } = await getGraphToken();
      let folderId = meeting.sharepointFolderId;
      if (!folderId && board?.sharepointDriveId && board?.sharepointFolderId) {
        const children = await sp.listChildren(token, board.sharepointDriveId, board.sharepointFolderId);
        folderId = matchMeetingFolder(children.filter((c) => c.isFolder), meeting)?.id || null;
      }
      if (folderId) {
        const files = await listFilesDeep(token, driveId, folderId);
        const readable = files.filter((f) => READABLE.test(f.name));
        for (const f of files) {
          if (!READABLE.test(f.name)) manifest.push(`  ${f.name} — binary (${f.size || 0} bytes), not readable as text`);
        }
        // Text comes from the cache when the file is unchanged in
        // SharePoint; only new or edited papers are downloaded and read.
        const results = await manyFileTexts(token, driveId, readable, 5);
        for (const r of results) {
          if (r.error) {
            manifest.push(`  ${r.file.name} — could not be downloaded (${r.error.slice(0, 60)})`);
            continue;
          }
          push(r.file.name, r.text, r.file.size || 0);
          if (total >= MAX_PACK_CHARS) break;
        }
      }
    } catch { /* SharePoint down — answer from the meeting record alone */ }
  }

  // Papers uploaded straight into the portal.
  const fs = require('fs');
  const path = require('path');
  const { UPLOAD_DIR } = require('./pack-sources');
  const docs = await prisma.document.findMany({ where: { meetingId: meeting.id, source: 'LOCAL' } });
  for (const d of docs) {
    if (!d.path || !READABLE.test(d.filename || d.name)) continue;
    try {
      const buffer = await fs.promises.readFile(path.join(UPLOAD_DIR, d.path));
      push(d.name, await textFromFile(d.filename || d.name, buffer), buffer.length);
    } catch { /* skip */ }
  }

  const header = manifest.length
    ? `PACK MANIFEST — every file in the pack and how much of it you hold:\n${manifest.join('\n')}\n\n`
    : '';
  return header + parts.join('\n\n');
}

/** The meeting's own record: agenda, roll, quorum rule, motions, conflicts. */
async function meetingRecord(meeting) {
  const [agenda, invitations, attendance, motions, cois, proxies, receipts] = await Promise.all([
    prisma.agendaItem.findMany({ where: { meetingId: meeting.id }, orderBy: { order: 'asc' } }),
    prisma.invitation.findMany({ where: { meetingId: meeting.id }, include: { user: true } }),
    prisma.attendance.findMany({ where: { meetingId: meeting.id }, include: { user: true } }),
    prisma.motion.findMany({ where: { meetingId: meeting.id }, include: { votes: { include: { user: true } } } }),
    prisma.cOI.findMany({ where: { meetingId: meeting.id }, include: { user: true } }),
    prisma.proxy.findMany({ where: { meetingId: meeting.id }, include: { fromUser: true, toUser: true } }),
    prisma.packFileReceipt.findMany({ where: { meetingId: meeting.id } }),
  ]);

  const board = meeting.board;
  const dueDays = board?.papersDueDays ?? 4;
  const lines = [];

  lines.push(`MEETING: ${meeting.title}`);
  lines.push(`Board/committee: ${board?.name || 'unknown'}`);
  lines.push(`Date: ${meeting.date}`);
  if (meeting.location) lines.push(`Location: ${meeting.location}`);
  lines.push(`Status: ${meeting.status}`);
  lines.push(`Proxies allowed: ${meeting.proxiesAllowed ? 'yes' : 'no'}`);
  lines.push(`Quorum rule: minimum ${meeting.quorumMinimum ?? board?.quorumMinimum ?? 4} counting members` +
    `; required offices: ${meeting.quorumRequiredRoles ?? board?.quorumRequiredRoles ?? 'none'}` +
    `; ex officio (not counted): ${meeting.quorumExOfficioRoles ?? board?.quorumExOfficioRoles ?? 'none'}`);

  lines.push('\nAGENDA:');
  for (const item of agenda) {
    lines.push(`  ${item.number}. ${item.title}${item.presenter ? ` — presenter: ${item.presenter}` : ''}${item.duration ? ` (${item.duration} min)` : ''}`);
  }

  if (receipts.length) {
    lines.push('\nPAPERS RECEIVED (received time is locked at first arrival; an edit shows as updated):');
    for (const r of receipts) {
      const status = receivedStatus(r.receivedAt, meeting.date, dueDays);
      const updated = new Date(r.lastModifiedAt) - new Date(r.receivedAt) > 60_000
        ? `, updated ${new Date(r.lastModifiedAt).toISOString()}` : '';
      lines.push(`  ${r.name}: received ${new Date(r.receivedAt).toISOString()} (${status || 'n/a'})${updated}`);
    }
  }

  lines.push('\nINVITATIONS / ROLL:');
  const marked = new Map(attendance.map((a) => [a.userId, a]));
  for (const inv of invitations) {
    const att = marked.get(inv.userId);
    lines.push(`  ${inv.user?.name || 'Unknown'} — ${inv.role}${inv.votingRights ? ', voting' : ', non-voting'}; RSVP ${inv.rsvp}` +
      (att ? `; ${att.present ? 'present' : 'apology'}${att.mode ? ` (${att.mode})` : ''}` : '; not yet marked'));
  }

  if (motions.length) {
    lines.push('\nMOTIONS:');
    for (const m of motions) {
      const votes = m.votes || [];
      lines.push(`  ${m.number} [${m.status}${m.result && m.result !== m.status ? ` / ${m.result}` : ''}]: ${m.title}` +
        (votes.length ? ` — for ${votes.filter((v) => v.vote === 'FOR').length}, against ${votes.filter((v) => v.vote === 'AGAINST').length}, abstain ${votes.filter((v) => v.vote === 'ABSTAIN').length}` : ''));
      if (m.description && m.description !== m.title) lines.push(`     ${m.description}`);
    }
  }

  if (cois.length) {
    const itemById = new Map(agenda.map((a) => [a.id, a]));
    lines.push('\nDECLARED CONFLICTS OF INTEREST:');
    for (const c of cois) {
      const item = c.agendaItemId ? itemById.get(c.agendaItemId) : null;
      lines.push(`  ${c.user?.name || 'Member'}: ${c.description} — effect: ${c.effect}${item ? `; pinned to item ${item.number} ${item.title}` : ''}${c.resolution ? `; resolution: ${c.resolution}` : ''}`);
    }
  }

  if (proxies.length) {
    lines.push('\nPROXIES:');
    for (const p of proxies) {
      lines.push(`  ${p.fromUser?.name || p.grantorName} (${p.grantorKind}) → ${p.toUser?.name || 'Unknown'}${p.votes > 1 ? ` — ${p.votes} votes` : ''}`);
    }
  }

  return lines.join('\n');
}

/** The full context for a meeting, cached briefly per meeting. */
async function meetingContext(meeting) {
  const cached = contextCache.get(meeting.id);
  if (cached && Date.now() - cached.at < CONTEXT_TTL_MS) return cached.text;

  const [record, papers] = await Promise.all([meetingRecord(meeting), packText(meeting)]);
  const text = `${record}\n\n=== BOARD PACK PAPERS (full text) ===\n\n${papers || '(no readable papers found)'}`;
  contextCache.set(meeting.id, { at: Date.now(), text });
  return text;
}

const PERSONA =
  'You are BizGPT, the board assistant inside Board Portal — "Ask me anything" for this meeting. ' +
  'Answer from the meeting record and board pack supplied below, and only from them. When your answer draws on a paper, ' +
  'name the file it came from. If the pack does not contain the answer, say so plainly rather than guessing. ' +
  'You serve company directors and secretaries: be precise about dates, figures, motions and who said or holds what. ' +
  'Keep answers concise and boardroom-ready. Format in Markdown, rendered as a page: lead with a one-line answer in bold, ' +
  'then supporting detail; use short headings and bullet lists for anything with more than two points, and a table only for ' +
  'genuinely tabular facts (figures, dates, names). Cite files by name in bold. No preamble, no sign-off.';

/**
 * Answer one question about the meeting, continuing a short conversation.
 *
 * `focusFile` names one paper the user has open: the answer is about THAT
 * paper first, with the rest of the pack still available for context. If
 * the file was not readable in the pack, its text is read now so the
 * question can still be answered.
 */
async function askBizGpt(meeting, question, history = [], focusFile = null) {
  const { askWithFailover } = require('./ai-providers');
  let context = await meetingContext(meeting);
  let persona = PERSONA;

  if (focusFile?.name) {
    const inPack = context.includes(`--- FILE: ${focusFile.name} ---`) ||
      context.split('\n').some((l) => l.startsWith('--- FILE: ') && l.endsWith(`/${focusFile.name} ---`));
    if (!inPack && focusFile.itemId) {
      // Not in the cached pack (e.g. outside the meeting folder) — read it now.
      try {
        const driveId = meeting.sharepointDriveId || meeting.board?.sharepointDriveId;
        const { token } = await getGraphToken();
        const { text } = await fileText(token, driveId, { id: focusFile.itemId, name: focusFile.name });
        if (text) context += `\n\n--- FILE: ${focusFile.name} (opened by the user) ---\n${text.slice(0, MAX_FILE_CHARS)}`;
      } catch { /* answer from what we have */ }
    }
    persona +=
      ` The user currently has the paper "${focusFile.name}" open and is asking about it. ` +
      'Answer about that paper first and cite it; bring in other papers only where they bear on the question.';
  }

  const messages = [
    ...history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-8)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
    { role: 'user', content: String(question).slice(0, 4000) },
  ];

  return askWithFailover({ persona, context, messages, maxTokens: 2048 });
}

module.exports = { askBizGpt };
