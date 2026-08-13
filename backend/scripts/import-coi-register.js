/**
 * Import the AF&AM Inc "Conflict of Interest" register document into the
 * register of interests.
 *
 * Usage:  node scripts/import-coi-register.js "<path to Conflict of Interest V3.0.docx>"
 *
 * Reads the docx table (member | interests | notified | board steps | member
 * actions), creates any people not yet in the directory, and adds one
 * MemberInterest row per line of each member's interests column. Idempotent:
 * an interest a member already has is skipped, so re-running after the
 * document changes only adds what is new.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const prisma = require('../src/lib/prisma');

const docxPath = process.argv[2];
if (!docxPath) {
  console.error('Usage: node scripts/import-coi-register.js "<path to .docx>"');
  process.exit(1);
}

/** Pull the table out of the docx via a tiny Python helper (zip + regex). */
function extractRows(file) {
  const py = `
import zipfile, re, sys, json
sys.stdout.reconfigure(encoding='utf-8')
with zipfile.ZipFile(sys.argv[1]) as z:
    xml = z.read('word/document.xml').decode('utf8','ignore')
rows = []
for tr in re.findall(r'<w:tr[ >].*?</w:tr>', xml, re.S):
    cells = []
    for tc in re.findall(r'<w:tc[ >].*?</w:tc>', tr, re.S):
        tc = tc.replace('</w:p>', chr(10))
        text = re.sub(r'<[^>]+>', '', tc)
        text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        cells.append(text.strip())
    if cells:
        rows.append(cells)
print(json.dumps(rows))
`;
  const out = execFileSync('python', ['-c', py, file], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(out);
}

const emailFor = (name) =>
  name.toLowerCase()
    .replace(/^(mr|mrs|ms|dr|rev|prof)\.?\s+/i, '')
    .replace(/[^a-z ]/g, '')
    .trim()
    .replace(/\s+/g, '.') + '@bominc.test';

async function main() {
  const rows = extractRows(path.resolve(docxPath));

  // Skip the header row; a data row has a name in column 0.
  const dataRows = rows.filter(
    (r) => r.length >= 2 && r[0] && !/name of board member/i.test(r[0])
  );

  let people = 0;
  let added = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const rawName = row[0].replace(/\s+/g, ' ').trim();
    if (!rawName) continue;

    const displayName = rawName.replace(/^(Mr|Mrs|Ms|Dr|Rev|Prof)\.?\s+/i, '');
    const interests = (row[1] || '')
      .split('\n')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 2);
    const notified = /^y/i.test((row[2] || '').trim());
    const boardSteps = (row[3] || '').replace(/\s+/g, ' ').trim() || null;
    const memberActions = (row[4] || '').replace(/\s+/g, ' ').trim() || null;

    if (!interests.length) continue;

    // Find or create the person, matching on name to survive email guesses.
    let user = await prisma.user.findFirst({
      where: { name: { equals: displayName, mode: 'insensitive' } },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: displayName,
          email: emailFor(rawName),
          role: 'DIRECTOR',
          initials: displayName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
        },
      });
      people += 1;
    }

    for (const interest of interests) {
      const existing = await prisma.memberInterest.findFirst({
        where: { userId: user.id, interest: { equals: interest, mode: 'insensitive' } },
      });
      if (existing) { skipped += 1; continue; }

      await prisma.memberInterest.create({
        data: {
          userId: user.id,
          interest,
          category: 'DUTY_TO_DUTY',
          notified,
          notifiedAt: notified ? new Date() : null,
          boardSteps,
          memberActions,
        },
      });
      added += 1;
    }
  }

  console.log(`Imported: ${added} interests added, ${skipped} already present, ${people} people created.`);
}

main()
  .catch((e) => { console.error('Import failed:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
