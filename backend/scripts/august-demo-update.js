/**
 * One-off demo shaping for the August meeting, per Boyd:
 *  - insert agenda item "Grand Secretary and General Manager Report" before
 *    General business (renumbering the tail),
 *  - attach two papers to it with different received times: the Executive
 *    Report on time, the Masonic Services Report late,
 *  - pin the two seeded conflict declarations to the Capital works item they
 *    are actually about (Quotation A / B).
 * Idempotent: safe to re-run.
 */
const prisma = require('../src/lib/prisma');

async function main() {
  const meeting = await prisma.meeting.findFirst({ where: { title: { contains: 'August' } } });
  if (!meeting) throw new Error('August meeting not found');

  const items = await prisma.agendaItem.findMany({
    where: { meetingId: meeting.id },
    orderBy: { order: 'asc' },
  });

  // The agenda in the order Boyd runs a meeting. `match` finds an existing
  // item to reuse (and rename); otherwise the item is created.
  const TARGET = [
    { title: 'Attendance',                                  presenter: 'Margaret Whitlock', duration: 3,  match: /^Attendance$/i },
    { title: 'Quorum',                                      presenter: 'Margaret Whitlock', duration: 2,  match: /^Quorum$/i },
    { title: 'Opening',                                     presenter: 'Boyd Sparrow',      duration: 3,  match: /^Opening/i },
    { title: 'Apologies',                                   presenter: 'Margaret Whitlock', duration: 2,  match: /^Apologies$/i },
    { title: 'Conflicts of interest',                       presenter: 'Margaret Whitlock', duration: 5,  match: /^Conflicts/i },
    { title: 'Confirmation of previous minutes',            presenter: 'Margaret Whitlock', duration: 5,  match: /^Confirmation/i },
    { title: 'Treasurer’s report',                          presenter: 'Alan Prentice',     duration: 20, match: /Treasurer/i },
    { title: 'Capital works — North Terrace roof',          presenter: 'Helen Cardoso',     duration: 30, match: /Capital works/i },
    { title: 'Membership and engagement update',            presenter: 'Raj Balakrishnan',  duration: 15, match: /Membership/i },
    { title: 'Grand Secretary and General Manager Report',  presenter: 'Boyd Sparrow',      duration: 15, match: /Grand Secretary/i },
    { title: 'General business',                            presenter: null,                duration: 10, match: /General business/i },
    { title: 'Close',                                       presenter: 'Boyd Sparrow',      duration: 2,  match: /^Close$/i },
  ];

  const used = new Set();
  let gsec = null;

  for (const [index, spec] of TARGET.entries()) {
    const existing = items.find((i) => !used.has(i.id) && spec.match.test(i.title));
    let item;
    if (existing) {
      used.add(existing.id);
      item = await prisma.agendaItem.update({
        where: { id: existing.id },
        data: { title: spec.title, number: String(index + 1), order: index },
      });
    } else {
      item = await prisma.agendaItem.create({
        data: {
          meetingId: meeting.id,
          number: String(index + 1),
          title: spec.title,
          presenter: spec.presenter,
          duration: spec.duration,
          order: index,
        },
      });
      console.log('agenda item added:', spec.title);
    }
    if (/Grand Secretary/.test(spec.title)) gsec = item;
  }

  // Papers: due = meeting (19 Aug 18:30) minus 4 days = 15 Aug.
  const papers = [
    { name: 'Executive Report', filename: 'executive-report-aug-2026.pdf', at: new Date('2026-08-12T14:05:00+09:30'), size: 412_330 },
    { name: 'Masonic Services Report', filename: 'masonic-services-report-aug-2026.pdf', at: new Date('2026-08-17T09:40:00+09:30'), size: 655_781 },
  ];
  for (const paper of papers) {
    const existing = await prisma.document.findFirst({
      where: { meetingId: meeting.id, name: paper.name },
    });
    if (existing) continue;
    await prisma.document.create({
      data: {
        name: paper.name,
        filename: paper.filename,
        mimetype: 'application/pdf',
        size: paper.size,
        path: `demo/${paper.filename}`,
        tags: 'gsec',
        meetingId: meeting.id,
        agendaItemId: gsec.id,
        source: 'LOCAL',
        modifiedAt: paper.at,
      },
    });
    console.log('paper added:', paper.name, paper.at.toISOString());
  }

  // Pin the seeded declarations to the item they concern.
  const capital = items.find((i) => i.title.includes('Capital works'));
  if (capital) {
    const { count } = await prisma.cOI.updateMany({
      where: { meetingId: meeting.id, agendaItemId: null },
      data: { agendaItemId: capital.id },
    });
    console.log(`linked ${count} declaration(s) to "${capital.title}"`);
  }
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
