/**
 * Script to fix session dates: shift from Monday to Sunday
 *
 * The getSundayOfWeek function had a bug that stored dates as Monday instead of Sunday.
 * This script corrects all affected records by subtracting 1 day.
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-session-dates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDates() {
  console.log('🔧 Fixing session dates (Monday → Sunday)...\n');

  // 1. Fix Progress table dates
  console.log('📊 Fixing Progress table...');
  const progressRecords = await prisma.progress.findMany({
    select: { id: true, date: true }
  });

  let progressFixed = 0;
  for (const record of progressRecords) {
    const oldDate = new Date(record.date);
    const dayOfWeek = oldDate.getUTCDay();

    // Only fix if it's a Monday (day 1)
    if (dayOfWeek === 1) {
      const newDate = new Date(oldDate);
      newDate.setUTCDate(oldDate.getUTCDate() - 1); // Shift to Sunday

      await prisma.progress.update({
        where: { id: record.id },
        data: { date: newDate }
      });
      progressFixed++;
    }
  }
  console.log(`   ✅ Fixed ${progressFixed}/${progressRecords.length} Progress records\n`);

  // 2. Fix DailyAttendance table dates
  console.log('📊 Fixing DailyAttendance table...');
  const attendanceRecords = await prisma.dailyAttendance.findMany({
    select: { id: true, date: true }
  });

  let attendanceFixed = 0;
  for (const record of attendanceRecords) {
    const oldDate = new Date(record.date);
    const dayOfWeek = oldDate.getUTCDay();

    // Only fix if it's a Monday (day 1)
    if (dayOfWeek === 1) {
      const newDate = new Date(oldDate);
      newDate.setUTCDate(oldDate.getUTCDate() - 1);

      await prisma.dailyAttendance.update({
        where: { id: record.id },
        data: { date: newDate }
      });
      attendanceFixed++;
    }
  }
  console.log(`   ✅ Fixed ${attendanceFixed}/${attendanceRecords.length} DailyAttendance records\n`);

  // 3. Fix DailyProgramCompletion table dates
  console.log('📊 Fixing DailyProgramCompletion table...');
  const completionRecords = await prisma.dailyProgramCompletion.findMany({
    select: { id: true, date: true }
  });

  let completionFixed = 0;
  for (const record of completionRecords) {
    const oldDate = new Date(record.date);
    const dayOfWeek = oldDate.getUTCDay();

    // Only fix if it's a Monday (day 1) - these are week start dates
    if (dayOfWeek === 1) {
      const newDate = new Date(oldDate);
      newDate.setUTCDate(oldDate.getUTCDate() - 1);

      await prisma.dailyProgramCompletion.update({
        where: { id: record.id },
        data: { date: newDate }
      });
      completionFixed++;
    }
  }
  console.log(`   ✅ Fixed ${completionFixed}/${completionRecords.length} DailyProgramCompletion records\n`);

  // 4. Fix WeeklyObjectiveCompletion table dates
  console.log('📊 Fixing WeeklyObjectiveCompletion table...');
  const weeklyRecords = await prisma.weeklyObjectiveCompletion.findMany({
    select: { id: true, weekStartDate: true }
  });

  let weeklyFixed = 0;
  for (const record of weeklyRecords) {
    const oldDate = new Date(record.weekStartDate);
    const dayOfWeek = oldDate.getUTCDay();

    // Only fix if it's a Monday (day 1)
    if (dayOfWeek === 1) {
      const newDate = new Date(oldDate);
      newDate.setUTCDate(oldDate.getUTCDate() - 1);

      await prisma.weeklyObjectiveCompletion.update({
        where: { id: record.id },
        data: { weekStartDate: newDate }
      });
      weeklyFixed++;
    }
  }
  console.log(`   ✅ Fixed ${weeklyFixed}/${weeklyRecords.length} WeeklyObjectiveCompletion records\n`);

  console.log('✨ All dates fixed successfully!');
}

// Verify the fix
async function verifyDates() {
  console.log('\n📋 Verification - Sample dates after fix:\n');

  const samples = await prisma.progress.findMany({
    select: { date: true },
    orderBy: { date: 'desc' },
    take: 10
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  samples.forEach(s => {
    const d = new Date(s.date);
    const dayName = dayNames[d.getUTCDay()];
    console.log(`   ${d.toISOString().split('T')[0]} → ${dayName}`);
  });
}

async function main() {
  try {
    await fixDates();
    await verifyDates();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
