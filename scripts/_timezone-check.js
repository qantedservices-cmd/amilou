const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get all sessions Feb 7-9
  const sessions = await prisma.groupSession.findMany({
    where: { date: { gte: new Date('2026-02-06'), lt: new Date('2026-02-10') } },
    include: { group: { select: { name: true } } },
    orderBy: { date: 'asc' }
  });

  console.log('=== Sessions 6-9 fév (raw dates) ===');
  for (const s of sessions) {
    console.log('  ', s.group.name);
    console.log('    Raw:', s.date);
    console.log('    ISO:', s.date.toISOString());
    console.log('    Local:', s.date.toLocaleString('fr-CA', { timeZone: 'America/Montreal' }));
    console.log('    ID:', s.id);
  }

  // Check specifically the Montmagny S6 session
  const montS6 = await prisma.groupSession.findUnique({
    where: { id: 'cmldi1i21001q11oxeq696a2a' },
    include: {
      attendance: { where: { present: true }, include: { user: { select: { name: true } } } },
      recitations: { include: { user: { select: { name: true } } } }
    }
  });
  if (montS6) {
    console.log('\n=== Montmagny S6 (id: cmldi1i21001q11oxeq696a2a) ===');
    console.log('Date raw:', montS6.date);
    console.log('Date ISO:', montS6.date.toISOString());
    console.log('Présents:', montS6.attendance.length, montS6.attendance.map(a => a.user.name).join(', '));
    console.log('Récitations:', montS6.recitations.length);
  }

  // The empty Montmagny on Feb 7
  const montEmpty = await prisma.groupSession.findUnique({
    where: { id: 'cmlc1r5490001dmzj2o2f5ce8' }
  });
  if (montEmpty) {
    console.log('\n=== Montmagny vide (id: cmlc1r5490001dmzj2o2f5ce8) ===');
    console.log('Date raw:', montEmpty.date);
    console.log('Date ISO:', montEmpty.date.toISOString());
    console.log('weekNumber:', montEmpty.weekNumber);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
