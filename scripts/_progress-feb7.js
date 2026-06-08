const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const famille = await prisma.group.findFirst({ where: { name: { contains: 'Famille' } } });
  const montmagny = await prisma.group.findFirst({ where: { name: { contains: 'Montmagny' } } });

  const famMembers = await prisma.groupMember.findMany({ where: { groupId: famille.id } });
  const famMemberIds = new Set(famMembers.map(m => m.userId));
  const montMembers = await prisma.groupMember.findMany({ where: { groupId: montmagny.id } });
  const montMemberIds = new Set(montMembers.map(m => m.userId));

  // Get ALL Progress entries on Feb 7
  const progress = await prisma.progress.findMany({
    where: { date: { gte: new Date('2026-02-07'), lt: new Date('2026-02-08') } },
    include: {
      user: { select: { id: true, name: true } },
      surah: { select: { nameFr: true } },
      program: { select: { code: true } }
    },
    orderBy: [{ user: { name: 'asc' } }, { surahNumber: 'asc' }]
  });

  console.log('=== Progress entries du 7 février (' + progress.length + ') ===');
  let currentUser = '';
  for (const p of progress) {
    if (p.user.name !== currentUser) {
      currentUser = p.user.name;
      const inFam = famMemberIds.has(p.userId);
      const inMont = montMemberIds.has(p.userId);
      const tag = inFam && inMont ? 'FAM+MONT' : inFam ? 'FAM' : inMont ? 'MONT' : '?';
      console.log('\n  ' + currentUser + ' [' + tag + ']:');
    }
    console.log('    S' + p.surahNumber + ' ' + p.surah.nameFr + ' v.' + p.verseStart + '-' + p.verseEnd + ' (' + p.program.code + ')');
  }

  // Count per user
  const byUser = {};
  for (const p of progress) {
    if (!byUser[p.user.name]) byUser[p.user.name] = { count: 0, userId: p.userId };
    byUser[p.user.name].count++;
  }
  console.log('\n=== Résumé par utilisateur ===');
  for (const [name, info] of Object.entries(byUser)) {
    const inFam = famMemberIds.has(info.userId);
    const inMont = montMemberIds.has(info.userId);
    const tag = inFam && inMont ? 'FAM+MONT' : inFam ? 'FAM' : inMont ? 'MONT' : '?';
    console.log('  ' + name + ': ' + info.count + ' entries [' + tag + ']');
  }

  // Now simulate what the calendar API does
  // It groups ALL progress by date and assigns the group based on first user
  const allGroupMembers = await prisma.groupMember.findMany({
    where: { groupId: { in: [famille.id, montmagny.id] } },
    include: { group: { select: { id: true, name: true } } }
  });
  const firstUserId = progress.length > 0 ? progress[0].userId : null;
  if (firstUserId) {
    const userGroup = allGroupMembers.find(m => m.userId === firstUserId);
    console.log('\n=== API groupMembers.find() pour premier user ===');
    console.log('Premier user:', progress[0].user.name);
    console.log('Groupe trouvé:', userGroup ? userGroup.group.name : 'null');
    console.log('GroupId:', userGroup ? userGroup.groupId : 'null');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
