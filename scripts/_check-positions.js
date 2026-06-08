const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { id: 'cmkfmco0d00026pa5hf7nzwwq' },
    select: { readingCurrentHizb: true, revisionCurrentHizb: true, memorizationStartSurah: true, memorizationStartVerse: true }
  })
  console.log('User positions:', user)

  // What does hizb 44 map to?
  const v44 = await prisma.verse.findFirst({
    where: { hizb: { gte: 44 } },
    orderBy: { hizb: 'asc' },
    include: { surah: true }
  })
  console.log('hizbToPosition(44):', `S${v44.surahNumber} ${v44.surah.nameAr} V${v44.verseNumber} hizb=${v44.hizb} page=${v44.page}`)

  // What is S40V41?
  const s40v41 = await prisma.verse.findUnique({
    where: { surahNumber_verseNumber: { surahNumber: 40, verseNumber: 41 } }
  })
  console.log('S40V41:', `hizb=${s40v41.hizb} page=${s40v41.page}`)

  // Revision: check zone
  const startVerse = await prisma.verse.findUnique({
    where: { surahNumber_verseNumber: { surahNumber: user.memorizationStartSurah || 78, verseNumber: user.memorizationStartVerse || 1 } }
  })
  console.log('Memorization start:', `S${user.memorizationStartSurah}V${user.memorizationStartVerse} hizb=${startVerse?.hizb}`)

  const startHizb = Math.floor(startVerse?.hizb || 1)
  const revisionHizb = user.revisionCurrentHizb || 0
  console.log('Revision absolute hizb:', startHizb + revisionHizb)

  const revPos = await prisma.verse.findFirst({
    where: { hizb: { gte: startHizb + revisionHizb } },
    orderBy: { hizb: 'asc' },
    include: { surah: true }
  })
  console.log('Revision position:', `S${revPos.surahNumber} ${revPos.surah.nameAr} V${revPos.verseNumber} hizb=${revPos.hizb} page=${revPos.page}`)

  // Count reading days since last cycle
  const readingProg = await prisma.program.findFirst({ where: { code: 'READING' } })
  const lastCycle = await prisma.completionCycle.findFirst({
    where: { userId: 'cmkfmco0d00026pa5hf7nzwwq', type: 'LECTURE' },
    orderBy: { completedAt: 'desc' }
  })
  console.log('Last LECTURE cycle:', lastCycle?.completedAt)

  const days = await prisma.dailyProgramCompletion.count({
    where: {
      userId: 'cmkfmco0d00026pa5hf7nzwwq',
      programId: readingProg.id,
      completed: true,
      date: { gt: lastCycle?.completedAt || new Date(2020, 0, 1) }
    }
  })
  console.log('Reading days since cycle:', days, '=> expected hizbs:', days * 2)

  await prisma.$disconnect()
}

main()
