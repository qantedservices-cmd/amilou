/**
 * Seed Tajweed colored text for all verses from quran.com API
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-quran-tajweed.ts
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fetchSurahTajweed(surahNumber: number): Promise<Array<{ verse_key: string; text_uthmani_tajweed: string }>> {
  const url = `https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?chapter_number=${surahNumber}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch surah ${surahNumber}: ${res.status}`)
  const data = await res.json()
  return data.verses
}

async function main() {
  console.log('Starting Tajweed text seed...')

  const withTajweed = await prisma.verse.count({ where: { textTajweed: { not: null } } })
  const total = await prisma.verse.count()
  console.log(`${withTajweed}/${total} verses already have tajweed text`)

  if (withTajweed === total) {
    console.log('All verses already have tajweed text. Skipping.')
    return
  }

  let updated = 0

  for (let surah = 1; surah <= 114; surah++) {
    try {
      const verses = await fetchSurahTajweed(surah)

      const operations = verses.map(v => {
        const [, verseNum] = v.verse_key.split(':')
        return prisma.verse.updateMany({
          where: { surahNumber: surah, verseNumber: parseInt(verseNum) },
          data: { textTajweed: v.text_uthmani_tajweed }
        })
      })

      await Promise.all(operations)
      updated += verses.length

      if (surah % 10 === 0) {
        console.log(`  Sourate ${surah}/114 done (${updated} versets)`)
      }

      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`Error on surah ${surah}:`, err)
      await new Promise(r => setTimeout(r, 2000))
      try {
        const verses = await fetchSurahTajweed(surah)
        const operations = verses.map(v => {
          const [, verseNum] = v.verse_key.split(':')
          return prisma.verse.updateMany({
            where: { surahNumber: surah, verseNumber: parseInt(verseNum) },
            data: { textTajweed: v.text_uthmani_tajweed }
          })
        })
        await Promise.all(operations)
        updated += verses.length
        console.log(`  Sourate ${surah} retried OK`)
      } catch (retryErr) {
        console.error(`Failed retry for surah ${surah}:`, retryErr)
      }
    }
  }

  const finalCount = await prisma.verse.count({ where: { textTajweed: { not: null } } })
  console.log(`\nDone! ${finalCount}/${total} verses now have tajweed text.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
