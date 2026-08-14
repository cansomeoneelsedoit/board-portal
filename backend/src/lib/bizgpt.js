const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('./prisma');
const sp = require('./graph/sharepoint');
const { getGraphToken } = require('./graph/auth');
const { matchMeetingFolder, receivedStatus } = require('./board-pack');
const { textFromFile } = require('./motion-scan');

/*
 * Ask me anything — powered by BizGPT.
 *
 * One question, answered from everything the meeting knows: its details,
 * agenda, roll, quorum, motions, declared conflicts, and the text of every
 * readable paper in its pack. The model sees only THIS meeting's record, so
 * answers stay grounded in the pack rather than the model's imagination.
 */

const READABLE = /\.(docx|txt|md|csv|pdf)$/i;
const MAX_FILE_CHARS = 12_000; // one paper's contribution to the context
const MAX_PACK_CHARS = 150_000; // all papers together
const CONTEXT_TTL_MS = 5 * 60 * 1000;

// Building the context means downloading and reading the whole pack —
// cache it per meeting so a conversation costs one build, not one per turn.
const contextCache = new Map(); // meetingId -> { at, text }

function apiKeyMissing() {
  return !process.env.ANTHROPIC_API_KEY;
}

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
  let total = 0;

  const push = (name, text) => {
    if (!text) return;
    const clipped = text.length > MAX_FILE_CHARS ? `${text.slice(0, MAX_FILE_CHARS)}\n[…truncated]` : text;
    if (total + clipped.length > MAX_PACK_CHARS) return;
    total += clipped.length;
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
        for (const f of files) {
          if (!READABLE.test(f.name)) continue;
          try {
            const url = await sp.getDownloadUrl(token, driveId, f.id);
            if (!url) continue;
            const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
            push(f.name, await textFromFile(f.name, buffer));
          } catch { /* one unreadable paper never sinks the answer */ }
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
      push(d.name, await textFromFile(d.filename || d.name, buffer));
    } catch { /* skip */ }
  }

  return parts.join('\n\n');
}

/** The meeting's own record: agenda, roll, quorum rule, motions, conflicts. */
async function meetingRecord(meeting) {
  const [agenda, invitations, attendance, motions, cois, proxies, receipts] = await Promise.all([
    prisma.agendaItem.findMany({ where: { meetingId: meeting.id }, orderBy: { order: 'asc' } }),
    prisma.invitation.findMany({ where: { meetingId: meeting.id }, include: { user: true } }),
    prisma.attendance.findMany({ where: { meetingId: meeting.id }, include: { user: true } }),
    prisma.motion.findMany({ where: { meetingId: meeting.id }, include: { votes: { include: { user: true } } } }),
    prisma.cOI.findMany({ where: { meetingId: meeting.id }, include: { user: true, agendaItem: true } }),
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
    lines.push('\nDECLARED CONFLICTS OF INTEREST:');
    for (const c of cois) {
      lines.push(`  ${c.user?.name || 'Member'}: ${c.description} — effect: ${c.effect}${c.agendaItem ? `; pinned to item ${c.agendaItem.number} ${c.agendaItem.title}` : ''}${c.resolution ? `; resolution: ${c.resolution}` : ''}`);
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
  'Keep answers concise and boardroom-ready; use a short list only when it genuinely helps.';

/**
 * Answer one question about the meeting, continuing a short conversation.
 * The pack context carries a cache breakpoint so follow-up questions in the
 * same conversation reuse the cached prefix instead of re-billing the pack.
 */
async function askBizGpt(meeting, question, history = []) {
  const client = new Anthropic();
  const context = await meetingContext(meeting);

  const messages = [
    ...history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-8)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
    { role: 'user', content: String(question).slice(0, 4000) },
  ];

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 2048,
    output_config: { effort: 'medium' },
    system: [
      { type: 'text', text: PERSONA },
      { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
    ],
    messages,
  });

  if (response.stop_reason === 'refusal') {
    return { answer: 'BizGPT declined to answer that question.', refused: true };
  }

  const answer = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  return { answer, usage: response.usage };
}

module.exports = { askBizGpt, apiKeyMissing };
