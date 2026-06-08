const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const famille = await prisma.group.findFirst({ where: { name: { contains: 'Famille' } } });
  console.log('Groupe:', famille.name, famille.id);

  const sessions = await prisma.groupSession.findMany({
    where: { groupId: famille.id },
    orderBy: { date: 'desc' },
    take: 5
  });
  console.log('\nSéances récentes:');
  sessions.forEach(s => console.log(' ', s.date.toISOString().slice(0,10), 'S' + s.weekNumber, 'id:', s.id));

  const feb7 = sessions.find(s => s.date.toISOString().startsWith('2026-02-07'));
  if (!feb7) { console.log('Pas de séance le 7 février'); return; }
  console.log('\n=== Séance du 7 février ===');
  console.log('ID:', feb7.id);
  console.log('Semaine:', feb7.weekNumber);

  // Attendance
  const attendance = await prisma.sessionAttendance.findMany({
    where: { sessionId: feb7.id },
    include: { user: { select: { name: true } } }
  });
  const presents = attendance.filter(a => a.present);
  const absents = attendance.filter(a => !a.present);
  console.log('\n--- Présence:', presents.length + '/' + attendance.length, '---');
  presents.forEach(a => console.log('  [P]', a.user.name));
  absents.forEach(a => console.log('  [A]', a.user.name));

  // Recitations
  const recitations = await prisma.surahRecitation.findMany({
    where: { sessionId: feb7.id },
    include: { user: { select: { name: true } } },
    orderBy: [{ user: { name: 'asc' } }, { surahNumber: 'asc' }]
  });

  const surahNums = [...new Set(recitations.map(r => r.surahNumber))];
  const surahs = await prisma.surah.findMany({ where: { number: { in: surahNums } }, select: { number: true, nameAr: true, nameFr: true, totalVerses: true } });
  const surahMap = new Map(surahs.map(s => [s.number, s]));

  console.log('\n--- Récitations (' + recitations.length + ') ---');
  let currentUser = '';
  for (const r of recitations) {
    if (r.user.name !== currentUser) {
      currentUser = r.user.name;
      console.log('\n  ' + currentUser + ':');
    }
    const s = surahMap.get(r.surahNumber);
    const surahName = s ? s.nameFr : String(r.surahNumber);
    const verses = (r.verseStart === 1 && r.verseEnd === (s ? s.totalVerses : 0)) ? 'complète' : 'v.' + r.verseStart + '-' + r.verseEnd;
    const comment = r.comment ? r.comment.replace(/<[^>]*>/g, '').substring(0, 120) : '';
    console.log('    S' + r.surahNumber + ' ' + surahName + ' (' + verses + ') - ' + r.status + (comment ? ' | ' + comment : ''));
  }

  // Mastery for these members
  const memberIds = [...new Set(attendance.map(a => a.userId))];
  const mastery = await prisma.surahMastery.findMany({
    where: { userId: { in: memberIds } },
    include: { user: { select: { name: true } } },
    orderBy: [{ user: { name: 'asc' } }, { surahNumber: 'asc' }]
  });
  if (mastery.length > 0) {
    console.log('\n--- Mastery ---');
    let curUser = '';
    for (const m of mastery) {
      if (m.user.name !== curUser) {
        curUser = m.user.name;
        console.log('\n  ' + curUser + ':');
      }
      const s = surahMap.get(m.surahNumber) || { nameFr: '?' };
      console.log('    S' + m.surahNumber + ' ' + s.nameFr + ' | ' + m.status + (m.validatedWeek ? ' (sem.' + m.validatedWeek + ')' : ''));
    }
  } else {
    console.log('\nAucune donnée SurahMastery pour ces membres.');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
