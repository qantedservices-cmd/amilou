const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const tafsirProg = await prisma.program.findFirst({ where: { code: 'TAFSIR' } })

  const entries = await prisma.progress.findMany({
    where: { programId: tafsirProg.id },
    include: {
      user: { select: { name: true } },
      surah: { select: { nameFr: true, nameAr: true } }
    },
    orderBy: [{ userId: 'asc' }, { date: 'asc' }, { surahNumber: 'asc' }, { verseStart: 'asc' }]
  })

  console.log(`${entries.length} entrées tafsir au total:\n`)

  // Group by user
  const byUser = {}
  for (const e of entries) {
    const name = e.user.name
    if (!byUser[name]) byUser[name] = []
    byUser[name].push(e)
  }

  for (const [name, userEntries] of Object.entries(byUser)) {
    console.log(`--- ${name} (${userEntries.length} entrées) ---`)

    // Detect duplicates: same date + surah + verse range
    const seen = new Map()
    for (const e of userEntries) {
      const d = e.date.toISOString().split('T')[0]
      const key = `${d}_S${e.surahNumber}_v${e.verseStart}-${e.verseEnd}`
      const isDup = seen.has(key)
      if (isDup) {
        console.log(`  ** DOUBLON ** ${d} | ${e.surah.nameFr} (${e.surah.nameAr}) v.${e.verseStart}-${e.verseEnd} | id: ${e.id}`)
      } else {
        console.log(`  ${d} | ${e.surah.nameFr} (${e.surah.nameAr}) v.${e.verseStart}-${e.verseEnd} | id: ${e.id}`)
      }
      seen.set(key, [...(seen.get(key) || []), e.id])
    }

    // Summary of duplicates
    const dups = [...seen.entries()].filter(([, ids]) => ids.length > 1)
    if (dups.length > 0) {
      console.log(`\n  ${dups.length} doublons détectés:`)
      for (const [key, ids] of dups) {
        console.log(`    ${key} → ${ids.length} entrées (garder ${ids[0]}, supprimer ${ids.slice(1).join(', ')})`)
      }
    }
    console.log()
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
