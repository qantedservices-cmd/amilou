const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 'cmkfmco0000006pa58m9fbvlj'; // Mohamed B. - Amilou

  const [lastCompletion, lastProgress, lastAttendance, lastMastery, lastRecitation, lastSession] = await Promise.all([
    prisma.dailyProgramCompletion.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true }
    }),
    prisma.progress.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true }
    }),
    prisma.dailyAttendance.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true }
    }),
    prisma.surahMastery.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    }),
    prisma.surahRecitation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    prisma.sessionAttendance.findFirst({
      where: { userId, present: true },
      include: { session: { select: { date: true } } },
      orderBy: { session: { date: 'desc' } }
    })
  ]);

  console.log('=== Mohamed B. (Amilou) - Dernière activité ===');
  console.log('DailyProgramCompletion:', lastCompletion?.date || 'AUCUNE');
  console.log('Progress:', lastProgress?.date || 'AUCUNE');
  console.log('DailyAttendance:', lastAttendance?.date || 'AUCUNE');
  console.log('SurahMastery updatedAt:', lastMastery?.updatedAt || 'AUCUNE');
  console.log('SurahRecitation createdAt:', lastRecitation?.createdAt || 'AUCUNE');
  console.log('SessionAttendance (present):', lastSession?.session?.date || 'AUCUNE');

  // Count entries
  const counts = await Promise.all([
    prisma.dailyProgramCompletion.count({ where: { userId } }),
    prisma.progress.count({ where: { userId } }),
    prisma.dailyAttendance.count({ where: { userId } }),
    prisma.surahMastery.count({ where: { userId } }),
    prisma.surahRecitation.count({ where: { userId } }),
    prisma.sessionAttendance.count({ where: { userId } }),
  ]);

  console.log('\n=== Nombre d\'entrées ===');
  console.log('DailyProgramCompletion:', counts[0]);
  console.log('Progress:', counts[1]);
  console.log('DailyAttendance:', counts[2]);
  console.log('SurahMastery:', counts[3]);
  console.log('SurahRecitation:', counts[4]);
  console.log('SessionAttendance:', counts[5]);

  // Check last 5 progress entries
  const recentProgress = await prisma.progress.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 5,
    select: { date: true, surahNumber: true, verseStart: true, verseEnd: true, program: { select: { code: true } } }
  });
  console.log('\n=== 5 derniers Progress ===');
  for (const p of recentProgress) {
    console.log(`  ${p.date.toISOString().split('T')[0]} - ${p.program.code} - Sourate ${p.surahNumber} v${p.verseStart}-${p.verseEnd}`);
  }

  // Check last 5 DailyAttendance
  const recentAttendance = await prisma.dailyAttendance.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 5,
    select: { date: true, sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true }
  });
  console.log('\n=== 5 dernières DailyAttendance ===');
  for (const a of recentAttendance) {
    console.log(`  ${a.date.toISOString().split('T')[0]} - D${a.sunday} L${a.monday} M${a.tuesday} M${a.wednesday} J${a.thursday} V${a.friday} S${a.saturday}`);
  }

  // Check last 5 DailyProgramCompletion
  const recentCompletion = await prisma.dailyProgramCompletion.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 5,
    select: { date: true, program: { select: { code: true } } }
  });
  console.log('\n=== 5 dernières DailyProgramCompletion ===');
  for (const c of recentCompletion) {
    console.log(`  ${c.date.toISOString().split('T')[0]} - ${c.program.code}`);
  }

  // Now check ALL Amilou members
  const amilouMembers = await prisma.groupMember.findMany({
    where: { group: { name: 'Groupe Amilou' } },
    include: { user: { select: { id: true, name: true } } }
  });

  console.log('\n\n=== TOUS les membres Amilou - Dernière activité ===');
  for (const member of amilouMembers) {
    const [lc, lp, la] = await Promise.all([
      prisma.dailyProgramCompletion.findFirst({
        where: { userId: member.userId },
        orderBy: { date: 'desc' },
        select: { date: true }
      }),
      prisma.progress.findFirst({
        where: { userId: member.userId },
        orderBy: { date: 'desc' },
        select: { date: true }
      }),
      prisma.dailyAttendance.findFirst({
        where: { userId: member.userId },
        orderBy: { date: 'desc' },
        select: { date: true }
      }),
    ]);

    const dates = [];
    if (lc?.date) dates.push(new Date(lc.date));
    if (lp?.date) dates.push(new Date(lp.date));
    if (la?.date) dates.push(new Date(la.date));
    const lastActivity = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    const now = new Date();
    const daysSince = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : 999;

    console.log(`  ${(member.user.name || '?').padEnd(25)} | Completion: ${lc?.date?.toISOString().split('T')[0] || '-'.padEnd(10)} | Progress: ${lp?.date?.toISOString().split('T')[0] || '-'.padEnd(10)} | Attendance: ${la?.date?.toISOString().split('T')[0] || '-'.padEnd(10)} | ${daysSince}j`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
