const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const m = await prisma.group.findFirst({ where: { name: { contains: 'Montmagny' } }, include: { members: true } });
  const userIds = m.members.map(x => x.userId);
  const mastery = await prisma.surahMastery.count({ where: { userId: { in: userIds } } });
  console.log('SurahMastery pour Montmagny:', mastery);
}
check().finally(() => prisma.$disconnect());
