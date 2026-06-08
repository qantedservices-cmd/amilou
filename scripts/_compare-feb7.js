const XLSX = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wb = XLSX.readFile(path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx'));

  // Read Famille Commentaires
  const famComments = XLSX.utils.sheet_to_json(wb.Sheets['Suivi Famille Commentaires'], { header: 1, defval: '' });
  console.log('=== Excel: Commentaires Famille S5 ===');
  for (const row of famComments) {
    if (String(row[0]) === 'S5') {
      console.log('  ', row[1], '|', row[2], '|', row[3]);
    }
  }

  // Read Montmagny Séances
  const montComments = XLSX.utils.sheet_to_json(wb.Sheets['Suivi Sécances'], { header: 1, defval: '' });
  console.log('\n=== Excel: Commentaires Montmagny S5 et S6 ===');
  for (const row of montComments) {
    if (String(row[0]) === 'S5' || String(row[0]) === 'S6') {
      console.log('  ', row[0], '|', row[1], '|', row[2], '|', String(row[3]).substring(0, 80));
    }
  }

  // Now check DB: Feb 7 session Famille recitations
  const famille = await prisma.group.findFirst({ where: { name: { contains: 'Famille' } } });
  const feb7session = await prisma.groupSession.findFirst({
    where: { groupId: famille.id, date: { gte: new Date('2026-02-07'), lt: new Date('2026-02-08') } }
  });

  if (feb7session) {
    const recitations = await prisma.surahRecitation.findMany({
      where: { sessionId: feb7session.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' }
    });
    console.log('\n=== DB: Récitations séance Famille 7 fév (id:', feb7session.id, ') ===');
    for (const r of recitations) {
      console.log('  ', r.user.name, '(id:', r.userId.substring(0, 10) + '...)', '| S' + r.surahNumber, '|', r.status, '|', (r.comment || '').replace(/<[^>]*>/g, '').substring(0, 80));
    }

    // Check if any of these users are NOT in the Famille group
    const famMembers = await prisma.groupMember.findMany({ where: { groupId: famille.id } });
    const famMemberIds = new Set(famMembers.map(m => m.userId));
    console.log('\n=== Vérification appartenance au groupe Famille ===');
    for (const r of recitations) {
      const isMember = famMemberIds.has(r.userId);
      if (!isMember) {
        // Check which group this user belongs to
        const memberships = await prisma.groupMember.findMany({
          where: { userId: r.userId },
          include: { group: { select: { name: true } } }
        });
        const groups = memberships.map(m => m.group.name).join(', ');
        console.log('  *** PAS MEMBRE FAMILLE:', r.user.name, '| groupes:', groups);
      } else {
        console.log('  OK:', r.user.name);
      }
    }
  }

  // Check who CREATED the Feb 7 session
  if (feb7session) {
    console.log('\n=== Séance créée par ===');
    console.log('  createdBy:', feb7session.createdBy);
    if (feb7session.createdBy) {
      const creator = await prisma.user.findUnique({ where: { id: feb7session.createdBy }, select: { name: true } });
      console.log('  Nom:', creator ? creator.name : 'inconnu');
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
