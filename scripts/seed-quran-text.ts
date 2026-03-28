/**
 * Seed Arabic text for all 6236 verses from quran.com API
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-quran-text.ts
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fetchSurahText(surahNumber: number): Promise<Array<{ verse_key: string; text_uthmani: string }>> {
  const url = `https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${surahNumber}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch surah ${surahNumber}: ${res.status}`)
  const data = await res.json()
  return data.verses
}

async function main() {
  console.log('Starting Quran text seed...')

  // Check how many verses already have text
  const withText = await prisma.verse.count({ where: { textAr: { not: null } } })
  const total = await prisma.verse.count()
  console.log(`${withText}/${total} verses already have text`)

  if (withText === total) {
    console.log('All verses already have text. Skipping.')
    return
  }

  let updated = 0

  for (let surah = 1; surah <= 114; surah++) {
    try {
      const verses = await fetchSurahText(surah)

      const operations = verses.map(v => {
        const [, verseNum] = v.verse_key.split(':')
        return prisma.verse.updateMany({
          where: { surahNumber: surah, verseNumber: parseInt(verseNum) },
          data: { textAr: v.text_uthmani }
        })
      })

      await Promise.all(operations)
      updated += verses.length

      if (surah % 10 === 0) {
        console.log(`  Sourate ${surah}/114 done (${updated} versets)`)
      }

      // Small delay to be nice to the API
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`Error on surah ${surah}:`, err)
      // Wait and retry once
      await new Promise(r => setTimeout(r, 2000))
      try {
        const verses = await fetchSurahText(surah)
        const operations = verses.map(v => {
          const [, verseNum] = v.verse_key.split(':')
          return prisma.verse.updateMany({
            where: { surahNumber: surah, verseNumber: parseInt(verseNum) },
            data: { textAr: v.text_uthmani }
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

  const finalCount = await prisma.verse.count({ where: { textAr: { not: null } } })
  console.log(`\nDone! ${finalCount}/${total} verses now have Arabic text.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
