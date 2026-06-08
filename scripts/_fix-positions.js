const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // S40V41 = hizb 48.1 for reading
  const s40v41 = await p.verse.findUnique({ where: { surahNumber_verseNumber: { surahNumber: 40, verseNumber: 41 } } })
  console.log('S40V41 hizb:', s40v41.hizb)

  // S3V93 = hizb 7.1 for revision, zone starts at hizb 1
  const s3v93 = await p.verse.findUnique({ where: { surahNumber_verseNumber: { surahNumber: 3, verseNumber: 93 } } })
  console.log('S3V93 hizb:', s3v93.hizb)

  // revision offset = hizb - startHizb (startHizb = 1)
  const revisionOffset = s3v93.hizb - 1
  console.log('Revision offset:', revisionOffset)

  await p.user.update({
    where: { id: 'cmkfmco0d00026pa5hf7nzwwq' },
    data: {
      readingCurrentHizb: s40v41.hizb,
      revisionCurrentHizb: revisionOffset
    }
  })

  const u = await p.user.findUnique({
    where: { id: 'cmkfmco0d00026pa5hf7nzwwq' },
    select: { readingCurrentHizb: true, revisionCurrentHizb: true }
  })
  console.log('Updated:', u)

  // Verify display
  const readV = await p.verse.findFirst({ where: { hizb: { gte: u.readingCurrentHizb } }, orderBy: { hizb: 'asc' }, include: { surah: true } })
  console.log('Reading display:', 'S' + readV.surahNumber + ' ' + readV.surah.nameAr + ' V' + readV.verseNumber)

  const absRevHizb = 1 + u.revisionCurrentHizb
  const revV = await p.verse.findFirst({ where: { hizb: { gte: absRevHizb } }, orderBy: { hizb: 'asc' }, include: { surah: true } })
  console.log('Revision display:', 'S' + revV.surahNumber + ' ' + revV.surah.nameAr + ' V' + revV.verseNumber)

  await p.$disconnect()
}
main()
