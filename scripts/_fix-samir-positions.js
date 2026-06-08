const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get Samir
  const samir = await prisma.user.findFirst({
    where: { email: 'sinlatourelle@gmail.com' },
    select: { id: true, readingCurrentHizb: true, revisionCurrentHizb: true }
  });
  console.log('Before:', samir);

  // Get last REVISION and LECTURE cycles
  const lastRevision = await prisma.completionCycle.findFirst({
    where: { userId: samir.id, type: 'REVISION' },
    orderBy: { completedAt: 'desc' }
  });
  const lastLecture = await prisma.completionCycle.findFirst({
    where: { userId: samir.id, type: 'LECTURE' },
    orderBy: { completedAt: 'desc' }
  });
  console.log('Last REVISION cycle:', lastRevision?.completedAt);
  console.log('Last LECTURE cycle:', lastLecture?.completedAt);

  // Get REVISION and READING program IDs
  const revisionProgram = await prisma.program.findFirst({ where: { code: 'REVISION' } });
  const readingProgram = await prisma.program.findFirst({ where: { code: 'READING' } });

  // Count completed days since last cycles
  const revisionDays = await prisma.dailyProgramCompletion.count({
    where: {
      userId: samir.id,
      programId: revisionProgram.id,
      completed: true,
      date: { gt: lastRevision.completedAt }
    }
  });
  const readingDays = await prisma.dailyProgramCompletion.count({
    where: {
      userId: samir.id,
      programId: readingProgram.id,
      completed: true,
      date: { gt: lastLecture.completedAt }
    }
  });
  console.log('Completed days since last REVISION cycle:', revisionDays);
  console.log('Completed days since last LECTURE cycle:', readingDays);

  // Get objectives (2 hizbs/day for both)
  const revisionSettings = await prisma.userProgramSettings.findFirst({
    where: { userId: samir.id, programId: revisionProgram.id, isActive: true }
  });
  const readingSettings = await prisma.userProgramSettings.findFirst({
    where: { userId: samir.id, programId: readingProgram.id, isActive: true }
  });
  console.log('REVISION objective:', revisionSettings?.quantity, revisionSettings?.unit, '/', revisionSettings?.period);
  console.log('READING objective:', readingSettings?.quantity, readingSettings?.unit, '/', readingSettings?.period);

  // Calculate: 2 HIZB per DAY = 2 hizbs/day
  const revisionHizbPerDay = 2;
  const readingHizbPerDay = 2;

  const newRevisionHizb = revisionDays * revisionHizbPerDay;
  const newReadingHizb = readingDays * readingHizbPerDay;
  console.log('\nCalculated positions:');
  console.log('  revisionCurrentHizb:', newRevisionHizb, '(was', samir.revisionCurrentHizb, ')');
  console.log('  readingCurrentHizb:', newReadingHizb, '(was', samir.readingCurrentHizb, ')');

  // Update
  await prisma.user.update({
    where: { id: samir.id },
    data: {
      revisionCurrentHizb: newRevisionHizb,
      readingCurrentHizb: newReadingHizb
    }
  });

  const after = await prisma.user.findUnique({
    where: { id: samir.id },
    select: { readingCurrentHizb: true, revisionCurrentHizb: true }
  });
  console.log('\nAfter:', after);
}

main().catch(console.error).finally(() => prisma.$disconnect());
