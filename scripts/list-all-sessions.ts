import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.groupSession.findMany({
    where: {
      group: { name: { contains: 'Amilou' } }
    },
    orderBy: { date: 'asc' }
  });

  console.log('Toutes les séances Amilou (' + sessions.length + '):');
  console.log('');
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  for (const s of sessions) {
    const d = s.date;
    const wk = String(s.weekNumber).padStart(2, ' ');
    console.log('S' + wk + ' - ' + d.toISOString().split('T')[0] + ' (' + days[d.getUTCDay()] + ')');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
