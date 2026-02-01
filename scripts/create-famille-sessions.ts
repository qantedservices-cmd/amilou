/**
 * Create GroupSession entries for Famille group
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/create-famille-sessions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Calculate date from week number (ISO week)
function getDateFromWeek(weekNumber: number, year: number): Date {
  // January 4th is always in week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // 1=Mon, 7=Sun
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  // Add weeks
  const targetDate = new Date(firstMonday);
  targetDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

  // Return Saturday (day 6) as session day
  targetDate.setDate(targetDate.getDate() + 5);
  return targetDate;
}

async function createSessions() {
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Famille' } }
  });

  if (!group) {
    console.log('Groupe Famille non trouvé');
    return;
  }

  console.log('Groupe:', group.name, group.id);

  // Weeks from Excel comments + recent weeks
  const weeksData = [
    { week: 49, year: 2025 },
    { week: 50, year: 2025 },
    { week: 51, year: 2025 },
    { week: 52, year: 2025 },
    { week: 1, year: 2026 },
    { week: 2, year: 2026 },
    { week: 3, year: 2026 },
    { week: 4, year: 2026 },
    { week: 5, year: 2026 },
  ];

  let created = 0;

  for (const { week, year } of weeksData) {
    const date = getDateFromWeek(week, year);

    // Check if session already exists
    const existing = await prisma.groupSession.findFirst({
      where: {
        groupId: group.id,
        weekNumber: week,
        date: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1)
        }
      }
    });

    if (existing) {
      console.log('Semaine', week, '(' + year + ') - existe déjà');
      continue;
    }

    const session = await prisma.groupSession.create({
      data: {
        groupId: group.id,
        date: date,
        weekNumber: week,
        notes: 'Séance Famille'
      }
    });

    console.log('Créé: Semaine', week, '-', date.toISOString().split('T')[0]);
    created++;
  }

  console.log('\n✨ Terminé!', created, 'séances créées');
}

createSessions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
