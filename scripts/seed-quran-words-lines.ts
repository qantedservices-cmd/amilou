/**
 * Seed word-by-word data with line numbers for Mushaf layout
 * Fetches from quran.com API page by page (604 pages)
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-quran-words-lines.ts
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fetchPageWords(pageNumber: number): Promise<Array<{
  verse_key: string
  words: Array<{ text_uthmani: string; line_number: number; char_type_name: string }>
}>> {
  const url = `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&word_fields=line_number,text_uthmani&per_page=50`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch page ${pageNumber}: ${res.status}`)
  const data = await res.json()
  return data.verses
}

async function main() {
  console.log('Starting word-line seed (604 pages)...')

  const withWords = await prisma.verse.count({ where: { wordsLines: { not: null } } })
  const total = await prisma.verse.count({ where: { textAr: { not: null } } })
  console.log(`${withWords}/${total} verses already have word-line data`)

  if (withWords >= total - 10) {
    console.log('Most verses already have word-line data. Skipping.')
    return
  }

  let updated = 0

  for (let page = 1; page <= 604; page++) {
    try {
      const verses = await fetchPageWords(page)

      const operations = verses.map(v => {
        const [surahStr, verseStr] = v.verse_key.split(':')
        const surahNumber = parseInt(surahStr)
        const verseNumber = parseInt(verseStr)

        // Filter out "end" markers (verse number glyphs) — keep only actual words
        const words = v.words
          .filter(w => w.char_type_name === 'word')
          .map(w => ({ t: w.text_uthmani, l: w.line_number }))

        return prisma.verse.updateMany({
          where: { surahNumber, verseNumber },
          data: { wordsLines: words }
        })
      })

      await Promise.all(operations)
      updated += verses.length

      if (page % 50 === 0) {
        console.log(`  Page ${page}/604 done (${updated} versets)`)
      }

      // Small delay
      await new Promise(r => setTimeout(r, 150))
    } catch (err) {
      console.error(`Error on page ${page}:`, err)
      await new Promise(r => setTimeout(r, 3000))
      try {
        const verses = await fetchPageWords(page)
        const operations = verses.map(v => {
          const [surahStr, verseStr] = v.verse_key.split(':')
          const words = v.words
            .filter(w => w.char_type_name === 'word')
            .map(w => ({ t: w.text_uthmani, l: w.line_number }))
          return prisma.verse.updateMany({
            where: { surahNumber: parseInt(surahStr), verseNumber: parseInt(verseStr) },
            data: { wordsLines: words }
          })
        })
        await Promise.all(operations)
        updated += verses.length
        console.log(`  Page ${page} retried OK`)
      } catch (retryErr) {
        console.error(`Failed retry for page ${page}:`, retryErr)
      }
    }
  }

  const finalCount = await prisma.verse.count({ where: { wordsLines: { not: null } } })
  console.log(`\nDone! ${finalCount}/${total} verses now have word-line data.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
