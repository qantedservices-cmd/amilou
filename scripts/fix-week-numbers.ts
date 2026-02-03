/**
 * Fix week numbers in Amilou sessions to use Sun-Sat system
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-week-numbers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sun-Sat week number calculation
function getWeekNumber(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);

  // Get the Sunday that starts this week
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);

  // Get January 1st of the year
  const jan1 = new Date(sunday.getFullYear(), 0, 1);
  const jan1DayOfWeek = jan1.getDay();
  const jan1Sunday = new Date(jan1);
  jan1Sunday.setDate(jan1.getDate() - jan1DayOfWeek);

  // Calculate weeks between
  const diffTime = sunday.getTime() - jan1Sunday.getTime();
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

  const sessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    orderBy: { date: 'asc' }
  });

  console.log('Mise à jour des numéros de semaine (Dim-Sam)...\n');

  let updated = 0;

  for (const session of sessions) {
    const correctWeek = getWeekNumber(session.date);

    if (session.weekNumber !== correctWeek) {
      await prisma.groupSession.update({
        where: { id: session.id },
        data: { weekNumber: correctWeek }
      });

      console.log(
        session.date.toISOString().split('T')[0] +
        ': S' + session.weekNumber + ' → S' + correctWeek
      );
      updated++;
    }
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log('Séances mises à jour:', updated);
  console.log('Total séances:', sessions.length);

  // Verify recent sessions
  console.log('\n=== Vérification (5 dernières) ===');
  const recent = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    orderBy: { date: 'desc' },
    take: 5
  });

  for (const s of recent) {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const dayName = days[s.date.getDay()];
    console.log('S' + s.weekNumber + ' - ' + s.date.toISOString().split('T')[0] + ' (' + dayName + ')');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
