const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const amilou = await prisma.group.findFirst({ where: { name: { contains: 'Amilou' } } })
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: amilou.id, date: { gte: new Date('2026-02-15') } },
    include: {
      attendance: { where: { present: true }, include: { user: { select: { name: true } } } },
      recitations: { include: { surah: { select: { nameFr: true, nameAr: true } } } }
    },
    orderBy: { date: 'asc' }
  })

  console.log(sessions.length + ' séances Amilou depuis le 15 fév:\n')
  for (const s of sessions) {
    console.log('  Date:', s.date.toISOString().split('T')[0])
    console.log('  createdAt:', s.createdAt.toISOString())
    console.log('  createdBy:', s.createdBy)
    console.log('  id:', s.id)
    console.log('  Présents:', s.attendance.map(a => a.user.name).join(', ') || 'aucun')
    console.log('  Récitations:', s.recitations.length)
    for (const r of s.recitations) {
      console.log('    -', r.surah.nameFr, '(' + r.surah.nameAr + ')', 'v.' + r.verseStart + '-' + r.verseEnd, '| type:', r.type, '| createdBy:', r.createdBy, '| createdAt:', r.createdAt.toISOString())
    }
    console.log()
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
