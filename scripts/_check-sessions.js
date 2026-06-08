const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const group = await prisma.group.findFirst({ where: { name: { contains: 'Montmagny' } } });
  const sessions = await prisma.groupSession.findMany({ where: { groupId: group.id }, orderBy: { date: 'asc' }, select: { id: true, date: true, weekNumber: true } });
  sessions.forEach((s, i) => console.log('S' + (i+1) + ' -> id:' + s.id.slice(0,8) + ' week:' + s.weekNumber + ' date:' + s.date.toISOString().slice(0,10)));

  const s13 = sessions[12];
  const s14 = sessions[13];

  console.log('');
  console.log('Topics linked to S13 (id=' + (s13 ? s13.id.slice(0,8) : 'N/A') + '):');
  if (s13) {
    const t = await prisma.researchTopic.findMany({ where: { groupId: group.id, sessionId: s13.id } });
    t.forEach(x => console.log('  ' + x.id.slice(0,8) + ' | ' + x.assignedTo + ' | ' + x.question.slice(0,60)));
    if (t.length === 0) console.log('  (aucun)');
  }

  console.log('');
  console.log('Topics linked to S14 (id=' + (s14 ? s14.id.slice(0,8) : 'N/A') + '):');
  if (s14) {
    const t = await prisma.researchTopic.findMany({ where: { groupId: group.id, sessionId: s14.id } });
    t.forEach(x => console.log('  ' + x.id.slice(0,8) + ' | ' + x.assignedTo + ' | ' + x.question.slice(0,60)));
    if (t.length === 0) console.log('  (aucun)');
  } else {
    console.log('  S14 does not exist yet');
  }
}

main().finally(() => prisma.$disconnect());
