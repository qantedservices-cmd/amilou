const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const famille = await prisma.group.findFirst({ where: { name: { contains: 'Famille' } } });
  const montmagny = await prisma.group.findFirst({ where: { name: { contains: 'Montmagny' } } });

  // ALL sessions on Feb 7 across all groups
  const allSessions = await prisma.groupSession.findMany({
    where: { date: { gte: new Date('2026-02-07'), lt: new Date('2026-02-08') } },
    include: { group: { select: { name: true } } }
  });
  console.log('=== Toutes les séances du 7 février ===');
  for (const s of allSessions) {
    console.log('  ', s.group.name, '| sem.' + s.weekNumber, '| id:', s.id);
  }

  // Check the Famille session
  const famSession = allSessions.find(s => s.groupId === famille.id);
  if (!famSession) { console.log('Pas de séance Famille le 7 fév'); return; }

  // All recitations for this session
  const recitations = await prisma.surahRecitation.findMany({
    where: { sessionId: famSession.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ user: { name: 'asc' } }, { surahNumber: 'asc' }]
  });

  // All attendance for this session
  const attendance = await prisma.sessionAttendance.findMany({
    where: { sessionId: famSession.id },
    include: { user: { select: { id: true, name: true } } }
  });

  console.log('\n=== Présences séance Famille 7 fév (' + attendance.length + ') ===');

  // Check membership of each attendee
  const famMembers = await prisma.groupMember.findMany({ where: { groupId: famille.id } });
  const famMemberIds = new Set(famMembers.map(m => m.userId));
  const montMembers = await prisma.groupMember.findMany({ where: { groupId: montmagny.id } });
  const montMemberIds = new Set(montMembers.map(m => m.userId));

  for (const a of attendance) {
    const inFam = famMemberIds.has(a.userId);
    const inMont = montMemberIds.has(a.userId);
    const tag = inFam && inMont ? 'FAMILLE+MONTMAGNY' : inFam ? 'FAMILLE' : inMont ? 'MONTMAGNY' : 'AUTRE';
    console.log('  ', a.user.name, '| present:', a.present, '|', tag);
  }

  // Unique reciters
  const reciters = [...new Set(recitations.map(r => r.userId))];
  console.log('\n=== Récitants séance Famille 7 fév (' + reciters.length + ' personnes, ' + recitations.length + ' récitations) ===');
  for (const uid of reciters) {
    const userRecs = recitations.filter(r => r.userId === uid);
    const name = userRecs[0].user.name;
    const inFam = famMemberIds.has(uid);
    const inMont = montMemberIds.has(uid);
    const tag = inFam && inMont ? 'FAMILLE+MONTMAGNY' : inFam ? 'FAMILLE' : inMont ? 'MONTMAGNY' : 'AUTRE';
    console.log('  ', name, '|', userRecs.length, 'récit |', tag);
  }

  // Check the import script to understand why
  console.log('\n=== Séance 30 janvier (S5 doublon) ===');
  const jan30 = await prisma.groupSession.findFirst({
    where: { groupId: famille.id, date: { gte: new Date('2026-01-30'), lt: new Date('2026-01-31') } }
  });
  if (jan30) {
    const jan30recs = await prisma.surahRecitation.findMany({
      where: { sessionId: jan30.id },
      include: { user: { select: { name: true } } }
    });
    const jan30att = await prisma.sessionAttendance.findMany({
      where: { sessionId: jan30.id },
      include: { user: { select: { name: true } } }
    });
    console.log('  Présences:', jan30att.length, jan30att.map(a => a.user.name).join(', '));
    console.log('  Récitations:', jan30recs.length);
    for (const r of jan30recs) {
      const inFam = famMemberIds.has(r.userId);
      const inMont = montMemberIds.has(r.userId);
      const tag = inFam ? 'FAM' : inMont ? 'MONT' : '?';
      console.log('    ', r.user.name, '| S' + r.surahNumber, '|', tag);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
