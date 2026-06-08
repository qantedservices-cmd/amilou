const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const samir = await prisma.user.findFirst({
    where: { email: 'sinlatourelle@gmail.com' },
    select: { id: true, readingCurrentHizb: true, revisionCurrentHizb: true, revisionSuspendedHizb: true }
  });
  console.log('Before:', samir);

  // Get zone
  const memProg = await prisma.program.findFirst({ where: { code: 'MEMORIZATION' } });
  const lastMem = await prisma.progress.findFirst({
    where: { userId: samir.id, programId: memProg.id },
    orderBy: [{ date: 'desc' }, { surahNumber: 'desc' }, { verseEnd: 'desc' }]
  });
  const endVerse = await prisma.verse.findUnique({
    where: { surahNumber_verseNumber: { surahNumber: lastMem.surahNumber, verseNumber: lastMem.verseEnd } }
  });
  const startVerse = await prisma.verse.findUnique({
    where: { surahNumber_verseNumber: { surahNumber: 1, verseNumber: 1 } }
  });
  const startHizb = Math.floor(startVerse.hizb);
  const endHizb = Math.ceil(endVerse.hizb);
  const totalHizbs = endHizb - startHizb + 1;
  console.log('Zone mémorisée:', { startHizb, endHizb, totalHizbs });

  // Get last cycles
  const lastRevision = await prisma.completionCycle.findFirst({
    where: { userId: samir.id, type: 'REVISION' }, orderBy: { completedAt: 'desc' }
  });
  const lastLecture = await prisma.completionCycle.findFirst({
    where: { userId: samir.id, type: 'LECTURE' }, orderBy: { completedAt: 'desc' }
  });
  console.log('Last REVISION:', lastRevision.completedAt.toISOString().split('T')[0]);
  console.log('Last LECTURE:', lastLecture.completedAt.toISOString().split('T')[0]);

  // Get completed days since last cycles
  const revProg = await prisma.program.findFirst({ where: { code: 'REVISION' } });
  const readProg = await prisma.program.findFirst({ where: { code: 'READING' } });
  
  const readingDays = await prisma.dailyProgramCompletion.findMany({
    where: { userId: samir.id, programId: readProg.id, completed: true, date: { gt: lastLecture.completedAt } },
    orderBy: { date: 'asc' },
    select: { date: true }
  });
  const revisionDays = await prisma.dailyProgramCompletion.findMany({
    where: { userId: samir.id, programId: revProg.id, completed: true, date: { gt: lastRevision.completedAt } },
    orderBy: { date: 'asc' },
    select: { date: true }
  });

  console.log('Reading days since cycle:', readingDays.length, readingDays.map(d => d.date.toISOString().split('T')[0]));
  console.log('Revision days since cycle:', revisionDays.length, revisionDays.map(d => d.date.toISOString().split('T')[0]));

  // Simulate combined phase day by day
  // Both cycles completed same day, so positions start at 0
  let readingHizb = 0;
  let revisionHizb = 0;
  let revisionSuspended = null;
  const readingHizbPerDay = 2;
  const revisionHizbPerDay = 2;
  const autoCreatedCycles = [];

  function isInZone(hizb) {
    return hizb >= startHizb && hizb <= endHizb;
  }

  console.log('\n=== Simulation jour par jour ===');
  
  // Process reading days
  for (let i = 0; i < readingDays.length; i++) {
    const dateStr = readingDays[i].date.toISOString().split('T')[0];
    const wasInZone = isInZone(readingHizb);
    const speed = wasInZone ? 2 : 1;
    readingHizb += speed * readingHizbPerDay;

    // Check wrap
    if (readingHizb >= 60) {
      readingHizb -= 60;
      autoCreatedCycles.push({ type: 'LECTURE', date: dateStr });
      if (revisionSuspended !== null) {
        autoCreatedCycles.push({ type: 'REVISION', date: dateStr, notes: 'Mode combiné' });
        revisionHizb = revisionSuspended;
        revisionSuspended = null;
      }
      if (isInZone(readingHizb) && revisionSuspended === null) {
        revisionSuspended = revisionHizb;
      }
    } else {
      const isNowInZone = isInZone(readingHizb);
      if (!wasInZone && isNowInZone && revisionSuspended === null) {
        revisionSuspended = revisionHizb;
        console.log(`  ${dateStr}: READING ${readingHizb} → entre dans zone, révision suspendue à ${revisionHizb}`);
      } else if (wasInZone && !isNowInZone && revisionSuspended !== null) {
        autoCreatedCycles.push({ type: 'REVISION', date: dateStr, notes: 'Mode combiné' });
        revisionHizb = revisionSuspended;
        revisionSuspended = null;
        console.log(`  ${dateStr}: READING ${readingHizb} → sort de zone, cycle REVISION "Mode combiné", révision reprend à ${revisionHizb}`);
      } else {
        console.log(`  ${dateStr}: READING ${readingHizb} (speed ${speed}x, ${wasInZone ? 'in zone' : 'out of zone'})`);
      }
    }
  }

  // Process revision days (only if not suspended)
  console.log('\n--- Revision days ---');
  for (let i = 0; i < revisionDays.length; i++) {
    const dateStr = revisionDays[i].date.toISOString().split('T')[0];
    if (revisionSuspended !== null) {
      console.log(`  ${dateStr}: REVISION suspendue, pas d'avancement`);
    } else {
      revisionHizb += revisionHizbPerDay;
      if (revisionHizb >= totalHizbs) {
        revisionHizb -= totalHizbs;
        autoCreatedCycles.push({ type: 'REVISION', date: dateStr });
        console.log(`  ${dateStr}: REVISION cycle complet! reprend à ${revisionHizb}`);
      } else {
        console.log(`  ${dateStr}: REVISION ${revisionHizb}/${totalHizbs}`);
      }
    }
  }

  console.log('\n=== Résultats ===');
  console.log('readingCurrentHizb:', readingHizb);
  console.log('revisionCurrentHizb:', revisionHizb);
  console.log('revisionSuspendedHizb:', revisionSuspended);
  console.log('Auto-created cycles:', autoCreatedCycles);

  // Apply
  await prisma.user.update({
    where: { id: samir.id },
    data: {
      readingCurrentHizb: Math.round(readingHizb),
      revisionCurrentHizb: Math.round(revisionHizb),
      revisionSuspendedHizb: revisionSuspended !== null ? Math.round(revisionSuspended) : null,
    }
  });

  const after = await prisma.user.findUnique({
    where: { id: samir.id },
    select: { readingCurrentHizb: true, revisionCurrentHizb: true, revisionSuspendedHizb: true }
  });
  console.log('\nAfter:', after);
}

main().catch(console.error).finally(() => prisma.$disconnect());
