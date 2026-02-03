import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const session = await prisma.groupSession.findFirst({
    where: {
      group: { name: { contains: 'Amilou' } },
      weekNumber: 5,
      date: { gte: new Date('2026-01-01'), lt: new Date('2027-01-01') }
    },
    include: {
      attendance: { include: { user: { select: { name: true } } } }
    }
  });

  if (session) {
    console.log('Séance S5:', session.date.toISOString().split('T')[0]);
    console.log('Présences:');
    for (const a of session.attendance) {
      console.log('  ' + a.user.name + ': présent=' + a.present + ', note=' + (a.note || '(vide)'));
    }
  } else {
    console.log('Séance S5 2026 non trouvée');
  }

  // Also check all recent sessions
  console.log('\n=== 5 dernières séances ===');
  const recent = await prisma.groupSession.findMany({
    where: { group: { name: { contains: 'Amilou' } } },
    orderBy: { date: 'desc' },
    take: 5
  });
  for (const s of recent) {
    console.log('S' + s.weekNumber + ' - ' + s.date.toISOString().split('T')[0]);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
