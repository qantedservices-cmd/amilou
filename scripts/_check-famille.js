const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const famille = await prisma.group.findFirst({ where: { name: { contains: 'Famille' } } })
  console.log('Groupe:', famille.name, '| id:', famille.id)

  // Members
  const members = await prisma.groupMember.findMany({
    where: { groupId: famille.id },
    include: { user: { select: { id: true, name: true } } }
  })
  console.log('\nMembres:')
  for (const m of members) {
    console.log(`  ${m.user.name} (${m.role}) | id: ${m.user.id}`)
  }

  // Sessions
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: famille.id },
    include: {
      attendance: { include: { user: { select: { name: true } } } },
      recitations: { include: { surah: { select: { nameFr: true } }, user: { select: { name: true } } } }
    },
    orderBy: { date: 'desc' },
    take: 20
  })
  console.log(`\n${sessions.length} séances Famille (dernières 20):`)
  for (const s of sessions) {
    const presents = s.attendance.filter(a => a.present).map(a => a.user.name)
    console.log(`\n  ${s.date.toISOString().split('T')[0]} | sem ${s.weekNumber} | ${presents.length}/${s.attendance.length} présents (${presents.join(', ') || 'aucun'})`)
    console.log(`    Récitations: ${s.recitations.length} | Notes: ${s.notes ? 'oui' : 'non'} | createdBy: ${s.createdBy}`)
    console.log(`    createdAt: ${s.createdAt.toISOString()} | id: ${s.id}`)
    for (const r of s.recitations) {
      console.log(`    - ${r.user.name}: ${r.surah.nameFr} v.${r.verseStart}-${r.verseEnd} | status: ${r.status} | comment: ${r.comment || '-'}`)
    }
  }

  // SurahMastery entries for Famille members
  const memberIds = members.map(m => m.user.id)
  const masteryEntries = await prisma.surahMastery.findMany({
    where: { userId: { in: memberIds } },
    include: {
      user: { select: { name: true } },
      surah: { select: { nameFr: true } }
    },
    orderBy: { updatedAt: 'desc' },
    take: 20
  })
  console.log(`\n${masteryEntries.length} dernières entrées SurahMastery Famille:`)
  for (const m of masteryEntries) {
    console.log(`  ${m.user.name} | ${m.surah.nameFr} (S${m.surahNumber}) | status: ${m.status} | updatedAt: ${m.updatedAt.toISOString()}`)
  }

  // Recent SurahRecitations for Famille members
  const recitations = await prisma.surahRecitation.findMany({
    where: { userId: { in: memberIds } },
    include: {
      user: { select: { name: true } },
      surah: { select: { nameFr: true } },
      session: { select: { groupId: true, date: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })
  console.log(`\n${recitations.length} dernières SurahRecitation Famille:`)
  for (const r of recitations) {
    const isFromFamille = r.session.groupId === famille.id
    console.log(`  ${r.user.name} | ${r.surah.nameFr} v.${r.verseStart}-${r.verseEnd} | status: ${r.status} | comment: ${r.comment || '-'}`)
    console.log(`    session: ${r.session.date.toISOString().split('T')[0]} | groupe: ${isFromFamille ? 'Famille' : 'AUTRE (' + r.session.groupId + ')'} | createdAt: ${r.createdAt.toISOString()}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
