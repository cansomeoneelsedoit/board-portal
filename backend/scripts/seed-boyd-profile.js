/*
 * Fill in Boyd Sparrow's profile with sample data so the member profile page
 * has something real-looking to show: contact details, a bio, and a service
 * history across a board and a committee — including one past tenure, so the
 * "served before, still choosable, with status" behaviour is visible.
 *
 * Run: node scripts/seed-boyd-profile.js
 */
const prisma = require('../src/lib/prisma');

async function main() {
  const boyd = await prisma.user.findFirst({ where: { name: { contains: 'Boyd', mode: 'insensitive' } } });
  if (!boyd) throw new Error('No Boyd Sparrow in the directory — run the register import first');

  await prisma.user.update({
    where: { id: boyd.id },
    data: {
      phone: '0412 345 678',
      title: 'Grand Registrar',
      organisation: 'Lodge Reynell 243',
      bio:
        'Company director and past master with twenty years of service across masonic ' +
        'charities and property boards. Chairs the capital works programme and sits on ' +
        'the audit committee of two associations.',
    },
  });

  const afam = await prisma.board.findFirst({ where: { name: { contains: 'AFAM', mode: 'insensitive' } } });
  const bom = await prisma.board.findFirst({ where: { name: { contains: 'Board of Management', mode: 'insensitive' } } });

  // A committee under AFAM, so the hierarchy shows on the profile too.
  let committee = await prisma.board.findFirst({ where: { name: { contains: 'Audit', mode: 'insensitive' } } });
  if (!committee && afam) {
    committee = await prisma.board.create({
      data: {
        name: 'Audit & Risk Committee',
        shortName: 'A&R',
        kind: 'COMMITTEE',
        parentId: afam.id,
        orgKey: afam.orgKey,
      },
    });
    console.log('created Audit & Risk Committee');
  }

  const ensureTenure = async (board, data) => {
    if (!board) return;
    const existing = await prisma.boardMember.findFirst({
      where: { boardId: board.id, userId: boyd.id, endedAt: data.endedAt ? { not: null } : null },
    });
    if (existing) {
      await prisma.boardMember.update({ where: { id: existing.id }, data });
      console.log(`updated tenure on ${board.name}`);
    } else {
      await prisma.boardMember.create({ data: { boardId: board.id, userId: boyd.id, ...data } });
      console.log(`created tenure on ${board.name}`);
    }
  };

  // Current: director of AFAM since 2021.
  await ensureTenure(afam, {
    role: 'DIRECTOR',
    status: 'ACTIVE',
    startedAt: new Date(Date.UTC(2021, 2, 17)),
    endedAt: null,
  });

  // Current: chairs the audit committee since 2024.
  await ensureTenure(committee, {
    role: 'CHAIR',
    status: 'ACTIVE',
    startedAt: new Date(Date.UTC(2024, 6, 1)),
    endedAt: null,
  });

  // Past: served on the Board of Management 2016–2020, retired. He stays
  // choosable for that board, badged with this status.
  await ensureTenure(bom, {
    role: 'TREASURER',
    status: 'RETIRED',
    startedAt: new Date(Date.UTC(2016, 8, 14)),
    endedAt: new Date(Date.UTC(2020, 10, 25)),
  });

  console.log(`done — profile filled for ${boyd.name} (${boyd.id})`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
