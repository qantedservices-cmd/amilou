/**
 * Merge duplicate Amilou sessions (same week, different dates)
 * Keeps the earliest session and moves attendance to it
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/merge-duplicate-sessions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mergeDuplicateSessions() {
  // Find Groupe Amilou
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Amilou' } }
  });

  if (!group) {
    console.log('Groupe Amilou non trouvé!');
    return;
  }

  console.log('Groupe:', group.name);

  // Get all sessions grouped by year and week
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    include: {
      attendance: true
    },
    orderBy: { date: 'asc' }
  });

  console.log('Total séances:', sessions.length);

  // Group by year-week
  const sessionsByWeek: Record<string, typeof sessions> = {};

  for (const s of sessions) {
    const year = s.date.getFullYear();
    const week = s.weekNumber || 0;
    const key = `${year}-W${week}`;

    if (!sessionsByWeek[key]) {
      sessionsByWeek[key] = [];
    }
    sessionsByWeek[key].push(s);
  }

  // Find duplicates
  let merged = 0;
  let deleted = 0;

  for (const [weekKey, weekSessions] of Object.entries(sessionsByWeek)) {
    if (weekSessions.length <= 1) continue;

    console.log('\n=== Duplicates pour', weekKey, '===');
    weekSessions.forEach(s => {
      console.log('  -', s.date.toISOString().split('T')[0], '| attendance:', s.attendance.length);
    });

    // Keep the first (earliest) session
    const keepSession = weekSessions[0];
    const duplicates = weekSessions.slice(1);

    for (const dup of duplicates) {
      // Move attendance from duplicate to main session
      for (const att of dup.attendance) {
        // Check if attendance already exists in main session
        const existingAtt = keepSession.attendance.find(a => a.userId === att.userId);

        if (existingAtt) {
          // Update if the duplicate has present=true and main doesn't
          if (att.present && !existingAtt.present) {
            await prisma.sessionAttendance.update({
              where: { id: existingAtt.id },
              data: {
                present: true,
                note: att.note || existingAtt.note
              }
            });
            console.log('  Mis à jour présence:', att.userId);
            merged++;
          } else if (att.note && !existingAtt.note) {
            // Just update note if missing
            await prisma.sessionAttendance.update({
              where: { id: existingAtt.id },
              data: { note: att.note }
            });
            console.log('  Mis à jour note:', att.userId);
          }
        } else {
          // Create new attendance in main session
          await prisma.sessionAttendance.create({
            data: {
              sessionId: keepSession.id,
              userId: att.userId,
              present: att.present,
              excused: att.excused,
              note: att.note
            }
          });
          console.log('  Créé présence:', att.userId);
          merged++;
        }
      }

      // Delete the duplicate session (cascade will delete its attendance)
      await prisma.groupSession.delete({
        where: { id: dup.id }
      });
      console.log('  Supprimé séance:', dup.date.toISOString().split('T')[0]);
      deleted++;
    }
  }

  // Final count
  const finalCount = await prisma.groupSession.count({
    where: { groupId: group.id }
  });

  console.log('\n=== RÉSUMÉ ===');
  console.log('Présences fusionnées:', merged);
  console.log('Séances supprimées:', deleted);
  console.log('Séances restantes:', finalCount);
}

mergeDuplicateSessions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
