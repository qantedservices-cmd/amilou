const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const groupId = 'cml308ot60000dvh9r83thotk'; // Cours Montmagny

async function main() {
  const sessions = await prisma.groupSession.findMany({
    where: { groupId },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, weekNumber: true }
  });

  console.log('=== Sessions list ===');
  sessions.forEach((s, idx) => {
    console.log('S' + (idx+1) + ': ' + s.date.toISOString().split('T')[0] + ' (W' + s.weekNumber + ')');
  });

  // Count comments per session
  console.log('\n=== Comments per session ===');
  const sessionIds = sessions.map(s => s.id);
  const sessionNumberMap = new Map(sessions.map((s, idx) => [s.id, idx + 1]));

  const recitations = await prisma.surahRecitation.findMany({
    where: { sessionId: { in: sessionIds }, comment: { not: null } },
    select: { id: true, userId: true, surahNumber: true, comment: true, sessionId: true },
  });

  const bySession = {};
  for (const r of recitations) {
    const sn = sessionNumberMap.get(r.sessionId);
    if (!bySession[sn]) bySession[sn] = [];
    bySession[sn].push(r);
  }

  for (const sn of Object.keys(bySession).sort((a,b) => a-b)) {
    console.log('S' + sn + ': ' + bySession[sn].length + ' comments');
  }

  // Test S14 (latest)
  console.log('\n=== S14 sample comments ===');
  const s14 = sessions[13];
  if (s14) {
    const recs = await prisma.surahRecitation.findMany({
      where: { sessionId: s14.id, comment: { not: null } },
      include: { user: { select: { name: true } } },
      take: 5
    });
    for (const r of recs) {
      console.log(r.user.name + ' | Surah ' + r.surahNumber + ' | ' + (r.comment || '').substring(0, 80));
    }
  }

  // Test S10
  console.log('\n=== S10 sample comments ===');
  const s10 = sessions[9];
  if (s10) {
    const recs = await prisma.surahRecitation.findMany({
      where: { sessionId: s10.id, comment: { not: null } },
      include: { user: { select: { name: true } } },
      take: 5
    });
    for (const r of recs) {
      console.log(r.user.name + ' | Surah ' + r.surahNumber + ' | ' + (r.comment || '').substring(0, 80));
    }
  }

  // Test session report data
  console.log('\n=== Session report data ===');
  for (const idx of [13, 9, 0]) {
    const s = sessions[idx];
    if (!s) continue;
    const full = await prisma.groupSession.findUnique({
      where: { id: s.id },
      select: { nextSurahNumber: true, homework: true, sessionTopics: true }
    });
    const commentCount = await prisma.surahRecitation.count({
      where: { sessionId: s.id, comment: { not: null } }
    });
    console.log('S' + (idx+1) + ': date=' + s.date.toISOString().split('T')[0] +
      ' nextSurah=' + full?.nextSurahNumber +
      ' homework=' + (full?.homework ? 'yes' : 'no') +
      ' topics=' + (full?.sessionTopics ? 'yes' : 'no') +
      ' comments=' + commentCount);
  }

  // Verify the commentsMap structure matches what frontend expects
  console.log('\n=== Verify commentsMap for S14 ===');
  const members = await prisma.groupMember.findMany({
    where: { groupId, role: 'MEMBER' },
    include: { user: { select: { id: true, name: true } } }
  });

  if (s14) {
    for (const m of members) {
      const memberRecs = await prisma.surahRecitation.findMany({
        where: { sessionId: s14.id, userId: m.userId, comment: { not: null } },
        select: { surahNumber: true, comment: true }
      });
      if (memberRecs.length > 0) {
        console.log(m.user.name + ': ' + memberRecs.length + ' recs');
        for (const r of memberRecs) {
          console.log('  Surah ' + r.surahNumber + ': ' + (r.comment || '').substring(0, 60));
        }
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
