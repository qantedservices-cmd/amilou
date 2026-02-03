import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find progress with "Attention" comment
  const progress = await prisma.progress.findMany({
    where: {
      comment: { contains: 'Attention' }
    },
    include: { user: { select: { name: true } } }
  });

  console.log('=== Progress avec "Attention" ===');
  for (const p of progress) {
    console.log('Date:', p.date.toISOString().split('T')[0]);
    console.log('User:', p.user.name);
    console.log('Comment:', p.comment);
  }

  // Also check recent Progress entries
  console.log('\n=== Progress janvier-février 2026 ===');
  const recent = await prisma.progress.findMany({
    where: {
      date: {
        gte: new Date('2026-01-20'),
        lte: new Date('2026-02-05')
      }
    },
    include: { user: { select: { name: true } } },
    orderBy: { date: 'desc' }
  });

  for (const p of recent) {
    console.log(p.date.toISOString().split('T')[0] + ' | ' + p.user.name + ' | ' + (p.comment || '(pas de commentaire)'));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
