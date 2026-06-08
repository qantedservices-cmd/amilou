const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const samir = await prisma.user.findFirst({ where: { name: { contains: 'Samir' } } })
  const amilou = await prisma.group.findFirst({ where: { name: { contains: 'Amilou' } } })
  const tafsirProg = await prisma.program.findFirst({ where: { code: 'TAFSIR' } })

  // All tafsir progress entries with createdAt
  const tafsirEntries = await prisma.progress.findMany({
    where: { programId: tafsirProg.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, date: true, createdAt: true, surahNumber: true, verseStart: true, verseEnd: true, userId: true }
  })

  console.log(`${tafsirEntries.length} entrées tafsir:\n`)
  for (const e of tafsirEntries) {
    console.log(`  date: ${e.date.toISOString().split('T')[0]} | créé le: ${e.createdAt.toISOString()} | S${e.surahNumber} v.${e.verseStart}-${e.verseEnd}`)
  }

  // All Amilou sessions with createdAt
  const sessions = await prisma.groupSession.findMany({
    where: { groupId: amilou.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, date: true, createdAt: true, weekNumber: true, createdBy: true }
  })

  console.log(`\n${sessions.length} séances Amilou:\n`)

  // For each tafsir entry, check if a session was created within 1 minute
  console.log('=== Corrélation tafsir → séance (créé dans la même minute) ===\n')

  for (const e of tafsirEntries) {
    const eTime = e.createdAt.getTime()
    const matching = sessions.filter(s => {
      const sTime = s.createdAt.getTime()
      return Math.abs(sTime - eTime) < 60000 // within 1 minute
    })
    if (matching.length > 0) {
      console.log(`  Tafsir ${e.date.toISOString().split('T')[0]} S${e.surahNumber} v.${e.verseStart}-${e.verseEnd}`)
      console.log(`    créé: ${e.createdAt.toISOString()}`)
      for (const m of matching) {
        console.log(`    → Séance ${m.date.toISOString().split('T')[0]} sem ${m.weekNumber} créée: ${m.createdAt.toISOString()} | id: ${m.id}`)
      }
      console.log()
    }
  }

  // Also check: sessions created AFTER the app launch (2026-01-08) that are NOT from import
  // Import sessions have very similar createdAt timestamps
  const recentSessions = sessions.filter(s => s.createdAt >= new Date('2026-01-08'))
  if (recentSessions.length > 0) {
    console.log(`\n=== Séances créées depuis le lancement de l'app (${recentSessions.length}) ===\n`)
    for (const s of recentSessions) {
      console.log(`  ${s.date.toISOString().split('T')[0]} | sem ${s.weekNumber} | créé: ${s.createdAt.toISOString()} | createdBy: ${s.createdBy} | id: ${s.id}`)
    }
  } else {
    console.log('\nAucune séance créée depuis le lancement de l\'app.')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
