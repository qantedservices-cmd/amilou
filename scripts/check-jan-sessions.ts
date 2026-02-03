import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.groupSession.findMany({
    where: {
      group: { name: { contains: 'Amilou' } },
      date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-10') }
    },
    orderBy: { date: 'asc' }
  });

  console.log('Séances janvier-février 2026:');
  for (const s of sessions) {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const d = new Date(s.date);
    console.log('S' + s.weekNumber + ' - ' + s.date.toISOString().split('T')[0] + ' (' + days[d.getUTCDay()] + ') id=' + s.id.slice(-8));
  }

  // Check for duplicates by weekNumber
  const byWeek: Record<number, typeof sessions> = {};
  for (const s of sessions) {
    const wk = s.weekNumber || 0;
    if (!byWeek[wk]) byWeek[wk] = [];
    byWeek[wk].push(s);
  }

  console.log('\n=== Doublons ===');
  for (const [wk, arr] of Object.entries(byWeek)) {
    if (arr.length > 1) {
      console.log('Semaine ' + wk + ': ' + arr.length + ' séances');
      arr.forEach(s => console.log('  - ' + s.date.toISOString().split('T')[0]));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
