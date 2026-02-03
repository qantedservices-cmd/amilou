/**
 * Create GroupSession entries for Groupe Amilou
 * Based on existing Progress dates from members
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/create-amilou-sessions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Calculate ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function createSessions() {
  // Find Groupe Amilou
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Amilou' } }
  });

  if (!group) {
    console.log('Groupe Amilou non trouvé!');
    return;
  }

  console.log('Groupe:', group.name, '(ID:', group.id + ')');

  // Get all members (exclude REFERENT and ADMIN for attendance)
  const allMembers = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: { select: { id: true, name: true } } }
  });

  const studentMembers = allMembers.filter(m => m.role === 'MEMBER');
  const referent = allMembers.find(m => m.role === 'REFERENT');

  console.log('Référent:', referent?.user.name || 'Non défini');
  console.log('Étudiants:', studentMembers.length);

  const memberIds = allMembers.map(m => m.userId);

  // Get all distinct Progress dates for these members
  const progressDates = await prisma.progress.groupBy({
    by: ['date'],
    where: { userId: { in: memberIds } },
    orderBy: { date: 'asc' }
  });

  console.log('\nDates de progression trouvées:', progressDates.length);

  let created = 0;
  let skipped = 0;

  for (const { date } of progressDates) {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekNumber = getWeekNumber(dateOnly);

    // Check if session already exists for this date
    const existing = await prisma.groupSession.findFirst({
      where: {
        groupId: group.id,
        date: {
          gte: dateOnly,
          lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    if (existing) {
      console.log('  Existe déjà:', dateOnly.toISOString().split('T')[0]);
      skipped++;
      continue;
    }

    // Find who submitted progress on this date
    const progressOnDate = await prisma.progress.findMany({
      where: {
        userId: { in: memberIds },
        date: {
          gte: dateOnly,
          lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      select: { userId: true },
      distinct: ['userId']
    });

    const presentUserIds = progressOnDate.map(p => p.userId);

    // Create session with attendance
    const session = await prisma.groupSession.create({
      data: {
        groupId: group.id,
        date: dateOnly,
        weekNumber: weekNumber,
        notes: null,
        attendance: {
          create: studentMembers.map(m => ({
            userId: m.userId,
            present: presentUserIds.includes(m.userId),
            excused: false
          }))
        }
      }
    });

    const dateStr = dateOnly.toISOString().split('T')[0];
    console.log('  Créé: S' + weekNumber + ' - ' + dateStr + ' (' + presentUserIds.length + '/' + studentMembers.length + ' présents)');
    created++;
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log('Séances créées:', created);
  console.log('Séances existantes:', skipped);
  console.log('Total séances Amilou:', created + skipped);
}

createSessions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
