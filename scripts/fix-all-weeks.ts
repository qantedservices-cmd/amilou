/**
 * Fix all week numbers and merge duplicates for Amilou
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Correct Sun-Sat week number calculation
function getWeekNumber(date: Date): number {
  // Use UTC to avoid timezone issues
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const d = new Date(Date.UTC(year, month, day));

  // Get the day of week (0 = Sunday)
  const dayOfWeek = d.getUTCDay();

  // Get the Sunday that starts this week
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - dayOfWeek);

  // Get January 1st of the year of that Sunday
  const jan1 = new Date(Date.UTC(sunday.getUTCFullYear(), 0, 1));

  // Get the Sunday of week 1 (Sunday on or before Jan 1)
  const jan1DayOfWeek = jan1.getUTCDay();
  const week1Sunday = new Date(jan1);
  week1Sunday.setUTCDate(jan1.getUTCDate() - jan1DayOfWeek);

  // Calculate weeks between
  const diffTime = sunday.getTime() - week1Sunday.getTime();
  const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));

  return diffWeeks + 1;
}

async function main() {
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Amilou' } }
  });

  if (!group) {
    console.log('Groupe Amilou non trouvé!');
    return;
  }

  // First, recalculate all week numbers
  console.log('=== Recalcul des numéros de semaine ===\n');

  const sessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    include: { attendance: true },
    orderBy: { date: 'asc' }
  });

  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  for (const s of sessions) {
    const correctWeek = getWeekNumber(s.date);
    const dayName = days[s.date.getUTCDay()];

    if (s.weekNumber !== correctWeek) {
      console.log(
        s.date.toISOString().split('T')[0] + ' (' + dayName + '): S' +
        s.weekNumber + ' → S' + correctWeek
      );

      await prisma.groupSession.update({
        where: { id: s.id },
        data: { weekNumber: correctWeek }
      });
    }
  }

  // Now find and merge duplicates
  console.log('\n=== Fusion des doublons ===\n');

  // Reload sessions with updated week numbers
  const updatedSessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    include: { attendance: true },
    orderBy: { date: 'asc' }
  });

  // Group by year-week
  const byYearWeek: Record<string, typeof updatedSessions> = {};

  for (const s of updatedSessions) {
    const year = s.date.getUTCFullYear();
    const key = year + '-S' + s.weekNumber;
    if (!byYearWeek[key]) byYearWeek[key] = [];
    byYearWeek[key].push(s);
  }

  let merged = 0;
  let deleted = 0;

  for (const [key, arr] of Object.entries(byYearWeek)) {
    if (arr.length <= 1) continue;

    console.log('Doublons pour ' + key + ':');
    arr.forEach(s => console.log('  - ' + s.date.toISOString().split('T')[0]));

    // Keep the first (earliest) session
    const keep = arr[0];
    const duplicates = arr.slice(1);

    for (const dup of duplicates) {
      // Merge attendance
      for (const att of dup.attendance) {
        const existing = keep.attendance.find(a => a.userId === att.userId);

        if (existing) {
          if (att.present && !existing.present) {
            await prisma.sessionAttendance.update({
              where: { id: existing.id },
              data: { present: true, note: att.note || existing.note }
            });
            merged++;
          }
        } else {
          await prisma.sessionAttendance.create({
            data: {
              sessionId: keep.id,
              userId: att.userId,
              present: att.present,
              excused: att.excused,
              note: att.note
            }
          });
          merged++;
        }
      }

      // Delete duplicate
      await prisma.groupSession.delete({ where: { id: dup.id } });
      console.log('  Supprimé: ' + dup.date.toISOString().split('T')[0]);
      deleted++;
    }
  }

  // Final verification
  console.log('\n=== Résultat final ===\n');

  const final = await prisma.groupSession.findMany({
    where: {
      groupId: group.id,
      date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-10') }
    },
    orderBy: { date: 'asc' }
  });

  for (const s of final) {
    const dayName = days[s.date.getUTCDay()];
    console.log('S' + s.weekNumber + ' - ' + s.date.toISOString().split('T')[0] + ' (' + dayName + ')');
  }

  const total = await prisma.groupSession.count({ where: { groupId: group.id } });
  console.log('\nTotal séances Amilou:', total);
  console.log('Présences fusionnées:', merged);
  console.log('Séances supprimées:', deleted);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
