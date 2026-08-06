/**
 * Demo data for Board Portal.
 *
 * Idempotent: safe to run repeatedly. Keyed on stable emails / board name so a
 * re-run updates rather than duplicates. Invoked by `npm run db:seed`, and on
 * Railway boot when SEED_DEMO_DATA=1.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ORG_KEY = process.env.SEED_ORG_KEY || null;
const BOARD_NAME = 'Board of Management';

const people = [
  { email: 'boyd.sparrow@gmail.com',   name: 'Boyd Sparrow',      role: 'CHAIR',     initials: 'BS' },
  { email: 'secretary@bominc.test',    name: 'Margaret Whitlock', role: 'SECRETARY', initials: 'MW' },
  { email: 'treasurer@bominc.test',    name: 'Alan Prentice',     role: 'TREASURER', initials: 'AP' },
  { email: 'director1@bominc.test',    name: 'Helen Cardoso',     role: 'DIRECTOR',  initials: 'HC' },
  { email: 'director2@bominc.test',    name: 'Raj Balakrishnan',  role: 'DIRECTOR',  initials: 'RB' },
  { email: 'director3@bominc.test',    name: 'Fiona Mackay',      role: 'DIRECTOR',  initials: 'FM' },
];

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(18, 30, 0, 0);
  return d;
};

async function main() {
  console.log('Seeding Board Portal demo data...');

  // --- Users -------------------------------------------------------------
  const users = {};
  for (const p of people) {
    users[p.email] = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name, role: p.role, initials: p.initials },
      create: p,
    });
  }
  const list = Object.values(users);
  const chair = users['boyd.sparrow@gmail.com'];
  const secretary = users['secretary@bominc.test'];
  const treasurer = users['treasurer@bominc.test'];

  // --- Board -------------------------------------------------------------
  let board = await prisma.board.findFirst({ where: { name: BOARD_NAME } });
  if (!board) {
    board = await prisma.board.create({
      data: {
        name: BOARD_NAME,
        description: 'Principal governing body. Meets monthly.',
        orgKey: ORG_KEY,
      },
    });
  }

  await prisma.boardMember.deleteMany({ where: { boardId: board.id } });
  for (const u of list) {
    await prisma.boardMember.create({
      data: { boardId: board.id, userId: u.id, role: u.role },
    });
  }

  // --- Meetings ----------------------------------------------------------
  // Wipe prior demo meetings for this board so re-seeding stays clean.
  const priorMeetings = await prisma.meeting.findMany({ where: { boardId: board.id } });
  const priorIds = priorMeetings.map((m) => m.id);
  if (priorIds.length) {
    const minutes = await prisma.minutes.findMany({ where: { meetingId: { in: priorIds } } });
    await prisma.minutesApproval.deleteMany({ where: { minutesId: { in: minutes.map((m) => m.id) } } });
    await prisma.minutes.deleteMany({ where: { meetingId: { in: priorIds } } });
    const motions = await prisma.motion.findMany({ where: { meetingId: { in: priorIds } } });
    await prisma.vote.deleteMany({ where: { motionId: { in: motions.map((m) => m.id) } } });
    await prisma.motion.deleteMany({ where: { meetingId: { in: priorIds } } });
    const agenda = await prisma.agendaItem.findMany({ where: { meetingId: { in: priorIds } } });
    await prisma.document.deleteMany({ where: { agendaItemId: { in: agenda.map((a) => a.id) } } });
    await prisma.document.deleteMany({ where: { meetingId: { in: priorIds } } });
    await prisma.agendaItem.deleteMany({ where: { meetingId: { in: priorIds } } });
    await prisma.attendance.deleteMany({ where: { meetingId: { in: priorIds } } });
    await prisma.invitation.deleteMany({ where: { meetingId: { in: priorIds } } });
    await prisma.cOI.deleteMany({ where: { meetingId: { in: priorIds } } });
    await prisma.proxy.deleteMany({ where: { meetingId: { in: priorIds } } });
    await prisma.auditLog.deleteMany({ where: { meetingId: { in: priorIds } } });
    await prisma.meeting.deleteMany({ where: { id: { in: priorIds } } });
  }

  const upcoming = await prisma.meeting.create({
    data: {
      boardId: board.id,
      title: 'August Ordinary Meeting',
      date: daysFromNow(12),
      location: 'Freemasons Hall, 254 North Terrace — Committee Room 1',
      status: 'SCHEDULED',
      videoUrl: 'https://meet.google.com/demo-board-link',
    },
  });

  const past = await prisma.meeting.create({
    data: {
      boardId: board.id,
      title: 'July Ordinary Meeting',
      date: daysFromNow(-18),
      location: 'Freemasons Hall, 254 North Terrace — Committee Room 1',
      status: 'COMPLETED',
    },
  });

  const draft = await prisma.meeting.create({
    data: {
      boardId: board.id,
      title: 'Special Meeting — Capital Works',
      date: daysFromNow(33),
      location: 'Video conference',
      status: 'DRAFT',
    },
  });

  // --- Agenda ------------------------------------------------------------
  const agendaSpec = [
    { number: '1',   title: 'Opening and apologies',                   presenter: 'Boyd Sparrow',      duration: 5 },
    { number: '2',   title: 'Confirmation of previous minutes',        presenter: 'Margaret Whitlock', duration: 5 },
    { number: '3',   title: 'Conflicts of interest',                   presenter: 'Margaret Whitlock', duration: 5 },
    { number: '4',   title: 'Treasurer’s report',                      presenter: 'Alan Prentice',     duration: 20 },
    { number: '5',   title: 'Capital works — North Terrace roof',      presenter: 'Helen Cardoso',     duration: 30 },
    { number: '6',   title: 'Membership and engagement update',        presenter: 'Raj Balakrishnan',  duration: 15 },
    { number: '7',   title: 'General business',                        presenter: null,                duration: 10 },
    { number: '8',   title: 'Close',                                   presenter: 'Boyd Sparrow',      duration: 5 },
  ];

  const agendaItems = [];
  for (const [i, spec] of agendaSpec.entries()) {
    agendaItems.push(
      await prisma.agendaItem.create({
        data: { ...spec, meetingId: upcoming.id, order: i },
      })
    );
  }

  // --- Documents (metadata only — no binaries in the demo set) -----------
  const docs = [
    { name: 'Board Pack — August 2026',        filename: 'board-pack-aug-2026.pdf',   mimetype: 'application/pdf', size: 2_412_889, agendaIdx: null, tags: 'pack,august' },
    { name: 'Minutes — July Ordinary Meeting', filename: 'minutes-jul-2026.pdf',      mimetype: 'application/pdf', size: 184_220,   agendaIdx: 1,    tags: 'minutes' },
    { name: 'Financial Statements — July',     filename: 'financials-jul-2026.xlsx',  mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 96_512, agendaIdx: 3, tags: 'finance' },
    { name: 'Roof Remediation — Quotation A',  filename: 'roof-quote-a.pdf',          mimetype: 'application/pdf', size: 743_010,   agendaIdx: 4,    tags: 'capital,quote' },
    { name: 'Roof Remediation — Quotation B',  filename: 'roof-quote-b.pdf',          mimetype: 'application/pdf', size: 812_336,   agendaIdx: 4,    tags: 'capital,quote' },
    { name: 'Membership Dashboard — Q2',       filename: 'membership-q2.pdf',         mimetype: 'application/pdf', size: 331_002,   agendaIdx: 5,    tags: 'membership' },
  ];
  for (const d of docs) {
    await prisma.document.create({
      data: {
        name: d.name,
        filename: d.filename,
        mimetype: d.mimetype,
        size: d.size,
        path: `demo/${d.filename}`,
        tags: d.tags,
        meetingId: upcoming.id,
        agendaItemId: d.agendaIdx === null ? null : agendaItems[d.agendaIdx].id,
      },
    });
  }

  // --- Invitations + attendance -----------------------------------------
  for (const u of list) {
    await prisma.invitation.create({
      data: {
        meetingId: upcoming.id,
        userId: u.id,
        role: u.role,
        rsvp: u.id === users['director3@bominc.test'].id ? 'DECLINED' : 'ACCEPTED',
        votingRights: true,
        sentAt: new Date(),
      },
    });
    await prisma.attendance.create({
      data: {
        meetingId: past.id,
        userId: u.id,
        mode: u.id === users['director2@bominc.test'].id ? 'VIDEO' : 'IN_PERSON',
        present: u.id !== users['director3@bominc.test'].id,
        joinedAt: daysFromNow(-18),
      },
    });
  }

  // --- Motions and votes -------------------------------------------------
  const motionSpec = [
    { number: 'M2026-14', title: 'That the minutes of the July Ordinary Meeting be confirmed', status: 'CARRIED', result: 'CARRIED' },
    { number: 'M2026-15', title: 'That the Treasurer’s report be received',                    status: 'CARRIED', result: 'CARRIED' },
    { number: 'M2026-16', title: 'That Quotation A for roof remediation be accepted',          status: 'PENDING', result: null },
  ];

  for (const spec of motionSpec) {
    const motion = await prisma.motion.create({
      data: {
        ...spec,
        meetingId: spec.status === 'PENDING' ? upcoming.id : past.id,
        description: 'Refer to the accompanying board pack for supporting papers.',
        moverId: chair.id,
        seconderId: treasurer.id,
        passedAt: spec.result === 'CARRIED' ? daysFromNow(-18) : null,
      },
    });

    if (spec.result === 'CARRIED') {
      for (const u of list) {
        await prisma.vote.create({
          data: {
            motionId: motion.id,
            userId: u.id,
            vote: u.id === users['director1@bominc.test'].id ? 'ABSTAIN' : 'FOR',
            proxy: false,
          },
        });
      }
    }
  }

  // --- Minutes -----------------------------------------------------------
  const minutes = await prisma.minutes.create({
    data: {
      meetingId: past.id,
      status: 'APPROVED',
      lockedAt: daysFromNow(-4),
      content: JSON.stringify({
        present: list.slice(0, 5).map((u) => u.name),
        apologies: ['Fiona Mackay'],
        sections: [
          { heading: 'Opening', body: 'The Chair opened the meeting at 6.32pm and welcomed members.' },
          { heading: 'Previous minutes', body: 'The minutes of the June Ordinary Meeting were confirmed without amendment.' },
          { heading: 'Treasurer’s report', body: 'The Treasurer presented the July statements. Operating position remains ahead of budget.' },
          { heading: 'Capital works', body: 'Two quotations for roof remediation were tabled. Decision deferred to the August meeting.' },
          { heading: 'Close', body: 'There being no further business the Chair closed the meeting at 7.58pm.' },
        ],
      }),
    },
  });

  for (const u of [chair, secretary]) {
    await prisma.minutesApproval.create({
      data: { minutesId: minutes.id, userId: u.id, approvedAt: daysFromNow(-4) },
    });
  }

  // --- Conflicts of interest --------------------------------------------
  await prisma.cOI.create({
    data: {
      meetingId: upcoming.id,
      userId: users['director1@bominc.test'].id,
      type: 'MATERIAL_PERSONAL',
      description: 'Director is a shareholder in the parent company of Quotation A tenderer.',
      effect: 'ABSTAIN',
    },
  });
  await prisma.cOI.create({
    data: {
      meetingId: upcoming.id,
      userId: users['director2@bominc.test'].id,
      type: 'PERCEIVED',
      description: 'Long-standing personal association with the Quotation B tenderer’s director.',
      effect: 'DECLARE_ONLY',
    },
  });

  // --- Proxies -----------------------------------------------------------
  await prisma.proxy.create({
    data: {
      meetingId: upcoming.id,
      fromUserId: users['director3@bominc.test'].id,
      toUserId: chair.id,
    },
  });

  // --- Integrations ------------------------------------------------------
  const integrations = [
    { provider: 'sharepoint', status: 'CONNECTED',    config: JSON.stringify({ site: 'BOM Inc / Board Packs' }) },
    { provider: 'outlook',    status: 'CONNECTED',    config: JSON.stringify({ calendar: 'Board of Management' }) },
    { provider: 'teams',      status: 'DISCONNECTED', config: '{}' },
    { provider: 'docusign',   status: 'DISCONNECTED', config: '{}' },
  ];
  for (const i of integrations) {
    await prisma.integration.upsert({
      where: { provider: i.provider },
      update: { status: i.status, config: i.config },
      create: i,
    });
  }

  // --- Audit -------------------------------------------------------------
  await prisma.auditLog.create({
    data: {
      meetingId: past.id,
      userId: secretary.id,
      action: 'MINUTES_APPROVED',
      entity: 'Minutes',
      entityId: minutes.id,
      data: JSON.stringify({ approvals: 2 }),
    },
  });

  const counts = {
    users: await prisma.user.count(),
    boards: await prisma.board.count(),
    meetings: await prisma.meeting.count(),
    agendaItems: await prisma.agendaItem.count(),
    documents: await prisma.document.count(),
    motions: await prisma.motion.count(),
    votes: await prisma.vote.count(),
    coi: await prisma.cOI.count(),
    proxies: await prisma.proxy.count(),
  };
  console.log('Seed complete:', counts);
  void draft;
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
