import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get Amilou group
  const group = await prisma.group.findFirst({
    where: { name: { contains: 'Amilou' } },
    include: { members: { select: { userId: true } } }
  });

  if (!group) {
    console.log('Groupe Amilou non trouvé');
    return;
  }

  const userIds = group.members.map(m => m.userId);
  console.log('Membres Amilou:', userIds.length);

  const progress = await prisma.progress.findMany({
    where: {
      userId: { in: userIds },
      date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-10') }
    },
    include: { user: { select: { name: true } } },
    orderBy: { date: 'asc' }
  });

  console.log('\nProgress entries Jan-Feb 2026 (' + progress.length + '):');
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  for (const p of progress) {
    const d = p.date;
    console.log(d.toISOString().split('T')[0] + ' (' + days[d.getUTCDay()] + ') - ' + p.user.name);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
