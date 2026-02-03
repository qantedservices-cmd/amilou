/**
 * Fix Amilou session attendance based on Progress entries
 * Updates present=true and copies comments for users who submitted Progress
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-amilou-attendance.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAttendance() {
  // Find Groupe Amilou
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Amilou' } }
  });

  if (!group) {
    console.log('Groupe Amilou non trouvé!');
    return;
  }

  console.log('Groupe:', group.name);

  // Get all members (including REFERENT)
  const allMembers = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: { select: { id: true, name: true } } }
  });

  const memberUserIds = allMembers.map(m => m.userId);
  console.log('Membres (tous rôles):', allMembers.length);

  // Get all Amilou sessions
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    include: {
      attendance: true
    },
    orderBy: { date: 'asc' }
  });

  console.log('Séances à vérifier:', sessions.length);

  let updated = 0;
  let attendanceCreated = 0;

  for (const session of sessions) {
    const dateStart = new Date(session.date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    // Find Progress entries for this date from any member
    const progressEntries = await prisma.progress.findMany({
      where: {
        userId: { in: memberUserIds },
        date: {
          gte: dateStart,
          lt: dateEnd
        }
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    if (progressEntries.length === 0) continue;

    // Group by user, get first comment
    const userProgress: Record<string, string | null> = {};
    for (const p of progressEntries) {
      if (!userProgress[p.userId]) {
        userProgress[p.userId] = p.comment;
      }
    }

    for (const [userId, comment] of Object.entries(userProgress)) {
      // Check if attendance exists for this user
      const existingAttendance = session.attendance.find(a => a.userId === userId);

      if (existingAttendance) {
        // Update if not already present or comment is missing
        if (!existingAttendance.present || (comment && !existingAttendance.note)) {
          await prisma.sessionAttendance.update({
            where: { id: existingAttendance.id },
            data: {
              present: true,
              note: comment || existingAttendance.note
            }
          });
          const userName = allMembers.find(m => m.userId === userId)?.user.name || userId;
          console.log('  Mis à jour:', session.date.toISOString().split('T')[0], '-', userName);
          updated++;
        }
      } else {
        // Create attendance record (for REFERENT who wasn't included)
        await prisma.sessionAttendance.create({
          data: {
            sessionId: session.id,
            userId: userId,
            present: true,
            excused: false,
            note: comment
          }
        });
        const userName = allMembers.find(m => m.userId === userId)?.user.name || userId;
        console.log('  Créé:', session.date.toISOString().split('T')[0], '-', userName, '(REFERENT)');
        attendanceCreated++;
      }
    }
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log('Présences mises à jour:', updated);
  console.log('Présences créées (REFERENT):', attendanceCreated);
}

fixAttendance()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
