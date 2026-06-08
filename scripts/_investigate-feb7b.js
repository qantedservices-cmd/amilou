const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get ALL sessions on Feb 7
  const sessions = await prisma.groupSession.findMany({
    where: { date: { gte: new Date('2026-02-07'), lt: new Date('2026-02-08') } },
    include: {
      group: { select: { name: true } },
      attendance: { include: { user: { select: { name: true } } } },
      recitations: { include: { user: { select: { name: true } } } }
    }
  });

  for (const s of sessions) {
    console.log('=== ' + s.group.name + ' | ' + s.date.toISOString().slice(0,10) + ' | sem.' + s.weekNumber + ' ===');
    console.log('ID:', s.id);
    console.log('Attendances:', s.attendance.length);
    const present = s.attendance.filter(a => a.present);
    console.log('  Présents:', present.length, present.map(a => a.user.name).join(', '));
    console.log('Recitations:', s.recitations.length);
    const reciters = [...new Set(s.recitations.map(r => r.user.name))];
    console.log('  Récitants:', reciters.join(', '));
    console.log('');
  }

  // Check the Montmagny session on Feb 8 too
  const feb8sessions = await prisma.groupSession.findMany({
    where: { date: { gte: new Date('2026-02-08'), lt: new Date('2026-02-09') } },
    include: {
      group: { select: { name: true } },
      attendance: { include: { user: { select: { name: true } } } },
      recitations: { include: { user: { select: { name: true } } } }
    }
  });

  console.log('=== Séances du 8 février ===');
  for (const s of feb8sessions) {
    console.log(s.group.name + ' | sem.' + s.weekNumber + ' | id:', s.id);
    const present = s.attendance.filter(a => a.present);
    console.log('  Présents:', present.length, present.map(a => a.user.name).join(', '));
    console.log('  Récitations:', s.recitations.length);
  }

  // Check what the sessions page API actually returns
  // Simulate: get user Samir's groups
  const samir = await prisma.user.findFirst({ where: { name: 'Samir' } });
  const samirGroups = await prisma.groupMember.findMany({
    where: { userId: samir.id },
    select: { groupId: true, group: { select: { name: true } } }
  });
  console.log('\n=== Groupes de Samir ===');
  samirGroups.forEach(g => console.log('  ', g.group.name, g.groupId));

  // Check: Montmagny session on Feb 7 - who are the recitation users?
  const montSession = sessions.find(s => s.group.name.includes('Montmagny'));
  if (montSession) {
    console.log('\n=== Montmagny 7 fév - détail récitations ===');
    const byUser = {};
    for (const r of montSession.recitations) {
      if (!byUser[r.user.name]) byUser[r.user.name] = 0;
      byUser[r.user.name]++;
    }
    Object.entries(byUser).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
      console.log('  ', name, ':', count, 'récitations');
    });
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
