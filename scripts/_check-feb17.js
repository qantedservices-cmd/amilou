const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // The tafsir entry from Feb 17
  const tafsirProg = await prisma.program.findFirst({ where: { code: 'TAFSIR' } })

  const entry = await prisma.progress.findMany({
    where: {
      programId: tafsirProg.id,
      date: {
        gte: new Date('2026-02-17'),
        lt: new Date('2026-02-18')
      }
    },
    select: { id: true, date: true, createdAt: true, surahNumber: true, verseStart: true, verseEnd: true, userId: true, createdBy: true }
  })

  console.log('Entrée tafsir du 17 février:')
  for (const e of entry) {
    console.log(`  id: ${e.id}`)
    console.log(`  date: ${e.date.toISOString()}`)
    console.log(`  createdAt: ${e.createdAt.toISOString()}`)
    console.log(`  S${e.surahNumber} v.${e.verseStart}-${e.verseEnd}`)
    console.log(`  userId: ${e.userId}`)
    console.log(`  createdBy: ${e.createdBy}`)
  }

  // Check if ANY session exists near that timestamp
  if (entry.length > 0) {
    const ts = entry[0].createdAt
    const before = new Date(ts.getTime() - 5 * 60000) // 5 min before
    const after = new Date(ts.getTime() + 5 * 60000)  // 5 min after

    const nearbySessions = await prisma.groupSession.findMany({
      where: {
        createdAt: { gte: before, lte: after }
      },
      select: { id: true, date: true, createdAt: true, groupId: true, createdBy: true }
    })

    console.log(`\nSéances créées ±5min de cette entrée: ${nearbySessions.length}`)
    for (const s of nearbySessions) {
      console.log(`  ${s.date.toISOString().split('T')[0]} | créé: ${s.createdAt.toISOString()} | group: ${s.groupId} | id: ${s.id}`)
    }
  }

  // Check ALL progress entries created on Feb 17 (any program)
  console.log('\n--- Toutes les entrées Progress créées le 17 fév ---')
  const allFeb17 = await prisma.progress.findMany({
    where: {
      createdAt: {
        gte: new Date('2026-02-17'),
        lt: new Date('2026-02-18')
      }
    },
    include: { program: { select: { code: true } } },
    orderBy: { createdAt: 'asc' }
  })

  for (const e of allFeb17) {
    console.log(`  ${e.createdAt.toISOString()} | ${e.program.code} | S${e.surahNumber} v.${e.verseStart}-${e.verseEnd} | createdBy: ${e.createdBy}`)
  }

  // Check all sessions created on Feb 17
  console.log('\n--- Séances créées le 17 fév ---')
  const sessionsFeb17 = await prisma.groupSession.findMany({
    where: {
      createdAt: {
        gte: new Date('2026-02-17'),
        lt: new Date('2026-02-18')
      }
    }
  })
  console.log(`  ${sessionsFeb17.length} séances`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
