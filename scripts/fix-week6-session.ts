/**
 * Create/fix Week 6 2026 session for Amilou
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

async function main() {
  // Find Groupe Amilou
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Amilou' } }
  });

  if (!group) {
    console.log('Groupe Amilou non trouvé!');
    return;
  }

  // Check Progress for Feb 1, 2026
  const feb1Progress = await prisma.progress.findMany({
    where: {
      date: {
        gte: new Date('2026-02-01'),
        lt: new Date('2026-02-02')
      }
    },
    include: { user: { select: { id: true, name: true } } }
  });

  console.log('Progress du 1er février 2026:');
  for (const p of feb1Progress) {
    const weekNum = getWeekNumber(p.date);
    console.log('  ' + p.user.name + ' | weekNumber=' + weekNum + ' | ' + p.comment);
  }

  // Calculate week number for Feb 1
  const feb1 = new Date('2026-02-01');
  const weekNumber = getWeekNumber(feb1);
  console.log('\nSemaine ISO du 1er février 2026:', weekNumber);

  // Check if session S6 exists
  const existingSession = await prisma.groupSession.findFirst({
    where: {
      groupId: group.id,
      weekNumber: 6,
      date: { gte: new Date('2026-01-01'), lt: new Date('2027-01-01') }
    }
  });

  if (existingSession) {
    console.log('\nSéance S6 existe déjà:', existingSession.date.toISOString().split('T')[0]);
    return;
  }

  // Create session for Week 6
  console.log('\nCréation de la séance S6...');

  // Get all participating members
  const members = await prisma.groupMember.findMany({
    where: {
      groupId: group.id,
      role: { in: ['MEMBER', 'REFERENT'] }
    },
    select: { userId: true }
  });

  // Find users who have Progress on Feb 1
  const presentUserIds = feb1Progress.map(p => p.userId);

  const session = await prisma.groupSession.create({
    data: {
      groupId: group.id,
      date: feb1,
      weekNumber: 6,
      notes: null,
      attendance: {
        create: members.map(m => ({
          userId: m.userId,
          present: presentUserIds.includes(m.userId),
          excused: false,
          note: feb1Progress.find(p => p.userId === m.userId)?.comment || null
        }))
      }
    }
  });

  console.log('Séance S6 créée:', session.date.toISOString().split('T')[0]);

  // Verify
  const allSessions = await prisma.groupSession.findMany({
    where: {
      groupId: group.id,
      date: { gte: new Date('2026-01-20'), lt: new Date('2026-02-10') }
    },
    orderBy: { date: 'asc' }
  });

  console.log('\nSéances janvier-février 2026:');
  for (const s of allSessions) {
    console.log('S' + s.weekNumber + ' - ' + s.date.toISOString().split('T')[0]);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
