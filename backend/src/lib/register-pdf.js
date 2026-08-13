const PDFDocument = require('pdfkit');

/*
 * The conflict register as a PDF, in the shape of the board's own
 * "Conflict of Interest" document: a landscape table, one row per member —
 * name | description of interests | has the board been notified | steps taken
 * by the board | member actions. Generated from the live register, so the
 * printout circulated with the pack can never drift from the system.
 */

const COLS = [
  { key: 'member',    label: 'Name of board member',                 width: 105 },
  { key: 'interests', label: 'Description of interest',              width: 250 },
  { key: 'notified',  label: 'Has the board been notified?',         width: 70 },
  { key: 'steps',     label: 'Steps taken by board for dealing with the conflict', width: 180 },
  { key: 'actions',   label: 'Board member actions to address the conflict',       width: 180 },
];

const PAGE = { size: 'A4', layout: 'landscape', margin: 36 };
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

function rowHeight(doc, row) {
  let h = 0;
  let x = 0;
  for (const col of COLS) {
    doc.font(col.key === 'member' ? FONT_BOLD : FONT).fontSize(8);
    const height = doc.heightOfString(row[col.key] || '—', { width: col.width - 10 });
    h = Math.max(h, height);
    x += col.width;
  }
  return h + 12;
}

function drawRow(doc, row, y, { header = false } = {}) {
  const height = header ? 26 : rowHeight(doc, row);
  let x = PAGE.margin;

  if (header) {
    doc.rect(x, y, COLS.reduce((s, c) => s + c.width, 0), height).fill('#1c3a66');
  }

  for (const col of COLS) {
    doc
      .font(header || col.key === 'member' ? FONT_BOLD : FONT)
      .fontSize(8)
      .fillColor(header ? '#ffffff' : '#1a1a1a')
      .text(header ? col.label : row[col.key] || '—', x + 5, y + 6, {
        width: col.width - 10,
        lineGap: 1,
      });
    x += col.width;
  }

  // Row rule
  doc
    .moveTo(PAGE.margin, y + height)
    .lineTo(PAGE.margin + COLS.reduce((s, c) => s + c.width, 0), y + height)
    .lineWidth(0.5)
    .strokeColor('#c9c9c9')
    .stroke();

  return height;
}

/**
 * Stream the register PDF into `res`.
 *
 * @param {object} opts
 * @param {string} opts.title     e.g. "Board of Management"
 * @param {string} [opts.subtitle] e.g. the meeting it was produced for
 * @param {Array}  opts.members   [{ member, notified, interests:[{interest, standing, boards[]}], boardSteps, memberActions }]
 */
function streamRegisterPdf(res, { title, subtitle, members }) {
  const doc = new PDFDocument({ ...PAGE, bufferPages: true });
  doc.pipe(res);

  // Title block, in the document's own voice.
  doc.font(FONT_BOLD).fontSize(16).fillColor('#1c3a66').text('Register of Conflicts of Interest');
  doc.font(FONT).fontSize(10).fillColor('#444444').text(title);
  if (subtitle) doc.text(subtitle);
  doc
    .fontSize(8)
    .fillColor('#777777')
    .text(
      `Generated from the live register on ${new Date().toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })}`
    );
  doc.moveDown(0.8);

  let y = doc.y;
  y += drawRow(doc, {}, y, { header: true });

  for (const m of members) {
    const interests = m.interests
      .map((i) => {
        const scope = i.standing
          ? ''
          : ` (${(i.boards || []).map((b) => b.shortName || b.name).join(', ') || 'specific bodies'} only)`;
        return `• ${i.interest}${scope}`;
      })
      .join('\n');

    const row = {
      member: m.member,
      interests,
      notified: m.notified ? 'Yes' : 'No',
      steps: m.boardSteps || '—',
      actions: m.memberActions || '—',
    };

    const needed = rowHeight(doc, row);
    if (y + needed > doc.page.height - PAGE.margin - 20) {
      doc.addPage();
      y = PAGE.margin;
      y += drawRow(doc, {}, y, { header: true });
    }
    y += drawRow(doc, row, y);
  }

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font(FONT)
      .fontSize(7)
      .fillColor('#999999')
      .text(`Page ${i + 1} of ${range.count}`, PAGE.margin, doc.page.height - 26, {
        width: doc.page.width - PAGE.margin * 2,
        align: 'right',
      });
  }

  doc.end();
}

module.exports = { streamRegisterPdf };
