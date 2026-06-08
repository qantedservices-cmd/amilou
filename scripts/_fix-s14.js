const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const group = await prisma.group.findFirst({ where: { name: { contains: 'Montmagny' } } });
  const sessions = await prisma.groupSession.findMany({ where: { groupId: group.id }, orderBy: { date: 'asc' }, select: { id: true } });
  const s14Id = sessions[13].id; // index 13 = session 14

  // Move the 2 topics from S13 to S14
  const result = await prisma.researchTopic.updateMany({
    where: {
      groupId: group.id,
      sessionId: sessions[12].id, // S13
      assignedTo: 'Tous'
    },
    data: {
      sessionId: s14Id
    }
  });
  console.log('Moved ' + result.count + ' topics from S13 to S14');
}

main().finally(() => prisma.$disconnect());
