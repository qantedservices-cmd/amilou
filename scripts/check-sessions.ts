import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.groupSession.findMany({
    where: { group: { name: { contains: 'Amilou' } } },
    orderBy: { date: 'desc' },
    take: 10,
    include: { group: { select: { name: true } } }
  });

  console.log('=== 10 dernières séances Amilou ===');
  for (const s of sessions) {
    console.log(s.date.toISOString().split('T')[0] + ' | weekNumber=' + s.weekNumber + ' | id=' + s.id);
  }

  // Count total
  const total = await prisma.groupSession.count({
    where: { group: { name: { contains: 'Amilou' } } }
  });
  console.log('\nTotal séances Amilou:', total);

  // Check other groups too
  const allGroups = await prisma.group.findMany({
    include: { _count: { select: { sessions: true } } }
  });
  console.log('\n=== Tous les groupes ===');
  for (const g of allGroups) {
    console.log(g.name + ': ' + g._count.sessions + ' séances');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
