const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const u = await p.user.findUnique({
    where: { id: 'cmkfmco0d00026pa5hf7nzwwq' },
    select: { memorizationStartSurah: true, memorizationStartVerse: true, memorizationDirection: true, readingCurrentHizb: true, revisionCurrentHizb: true }
  })
  console.log('Config:', JSON.stringify(u))

  const memProg = await p.program.findFirst({ where: { code: 'MEMORIZATION' } })
  const last = await p.progress.findFirst({
    where: { userId: 'cmkfmco0d00026pa5hf7nzwwq', programId: memProg.id },
    orderBy: [{ date: 'desc' }, { surahNumber: 'desc' }, { verseEnd: 'desc' }]
  })
  console.log('Last memorization:', last ? `S${last.surahNumber}V${last.verseEnd} (${last.date.toISOString().slice(0,10)})` : 'none')

  const startS = u.memorizationStartSurah || 1
  const startVN = u.memorizationStartVerse || 1
  const startV = await p.verse.findUnique({ where: { surahNumber_verseNumber: { surahNumber: startS, verseNumber: startVN } } })
  console.log('Start:', `S${startS}V${startVN} hizb=${startV?.hizb}`)

  if (last) {
    const endV = await p.verse.findUnique({ where: { surahNumber_verseNumber: { surahNumber: last.surahNumber, verseNumber: last.verseEnd } } })
    console.log('End:', `S${last.surahNumber}V${last.verseEnd} hizb=${endV?.hizb}`)

    if (u.memorizationDirection === 'FORWARD') {
      const startH = Math.floor(startV?.hizb || 1)
      const endH = Math.ceil(endV?.hizb || 1)
      console.log('Zone FORWARD:', startH, '->', endH, '=', endH - startH + 1, 'hizbs')
    } else {
      const startH = Math.ceil(startV?.hizb || 1)
      const endH = Math.floor(endV?.hizb || 1)
      console.log('Zone BACKWARD:', endH, '->', startH, '=', startH - endH + 1, 'hizbs')
    }
  }

  await p.$disconnect()
}
main()
