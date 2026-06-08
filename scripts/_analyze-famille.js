const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const famille = await prisma.group.findFirst({ where: { name: { contains: 'Famille' } } });

  // All sessions
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: famille.id },
    orderBy: { date: 'asc' }
  });
  console.log('=== Toutes les séances Famille (' + sessions.length + ') ===');
  sessions.forEach((s, i) => {
    console.log('  #' + (i+1), s.date.toISOString().slice(0,10), 'sem.' + s.weekNumber, s.id);
  });

  // Duplicates by weekNumber
  const byWeekNum = {};
  for (const s of sessions) {
    const key = s.weekNumber;
    if (byWeekNum[key] === undefined) byWeekNum[key] = [];
    byWeekNum[key].push(s);
  }
  const weekDupes = Object.entries(byWeekNum).filter(([k, v]) => v.length > 1);
  if (weekDupes.length > 0) {
    console.log('\n=== Doublons par numéro de semaine ===');
    weekDupes.forEach(([week, ss]) => {
      console.log('  Semaine', week, ':', ss.length, 'séances');
      ss.forEach(s => console.log('    ', s.date.toISOString().slice(0,10), s.id));
    });
  } else {
    console.log('\nAucun doublon par numéro de semaine.');
  }

  // Members
  const members = await prisma.groupMember.findMany({
    where: { groupId: famille.id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { user: { name: 'asc' } }
  });
  console.log('\n=== Membres Famille (' + members.length + ') ===');
  members.forEach(m => console.log('  ', m.user.name, '|', m.role, '|', m.user.email));

  // Recitation count per session + who recited
  console.log('\n=== Détails par séance ===');
  for (const s of sessions) {
    const recitations = await prisma.surahRecitation.findMany({
      where: { sessionId: s.id },
      include: { user: { select: { name: true } } }
    });
    const attList = await prisma.sessionAttendance.findMany({
      where: { sessionId: s.id },
      include: { user: { select: { name: true } } }
    });
    const presentNames = attList.filter(a => a.present).map(a => a.user.name);
    const reciters = [...new Set(recitations.map(r => r.user.name))];
    console.log('\n  ' + s.date.toISOString().slice(0,10) + ' sem.' + s.weekNumber);
    console.log('    Présents (' + presentNames.length + '):', presentNames.join(', ') || 'aucun');
    console.log('    Récitations (' + recitations.length + '):', reciters.join(', ') || 'aucune');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
