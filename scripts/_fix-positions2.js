const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  await p.user.update({
    where: { id: 'cmkfmco0d00026pa5hf7nzwwq' },
    data: { readingCurrentHizb: 48, revisionCurrentHizb: 8 }
  })

  const u = await p.user.findUnique({
    where: { id: 'cmkfmco0d00026pa5hf7nzwwq' },
    select: { readingCurrentHizb: true, revisionCurrentHizb: true }
  })
  console.log('Positions:', u)

  // Verify: reading +1
  const r = await p.verse.findFirst({ where: { hizb: { gte: 49 } }, orderBy: { hizb: 'asc' }, include: { surah: true } })
  console.log('Lecture (hizb 49):', 'S' + r.surahNumber + ' ' + r.surah.nameAr + ' V' + r.verseNumber + ' page=' + r.page)

  // Verify: revision zone.start(1) + 8 = 9
  const v = await p.verse.findFirst({ where: { hizb: { gte: 9 } }, orderBy: { hizb: 'asc' }, include: { surah: true } })
  console.log('Revision (hizb 9):', 'S' + v.surahNumber + ' ' + v.surah.nameAr + ' V' + v.verseNumber + ' page=' + v.page)

  await p.$disconnect()
}
main()
