/**
 * Update Riyad as-Salihin with complete 1896 hadiths (Arabic + English)
 *
 * Source: AhmedBaset/hadith-json (GitHub)
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/update-riyad-salihin.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface FullHadith {
  id: number
  idInBook: number
  chapterId: number
  bookId: number
  arabic: string
  english: {
    narrator: string
    text: string
  }
}

interface FullChapter {
  id: number
  bookId: number
  arabic: string
  english: string
}

interface FullData {
  id: number
  metadata: {
    id: number
    length: number
    arabic: { title: string; author: string }
    english: { title: string; author: string }
  }
  chapters: FullChapter[]
  hadiths: FullHadith[]
}

// Chapter order: Introduction (0) goes first, then books 1-19
// But hadith numbering has books 1-19 first (#1-1217) then Introduction (#1218-1896)
// We keep the hadith numbering as-is and order chapters by first hadith number
const CHAPTER_ORDER = [
  // Books 1-19 first (hadiths 1-1217)
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  // Introduction/Miscellany last (hadiths 1218-1896)
  0
]

async function main() {
  console.log('=== Update Riyad as-Salihin ===')
  console.log(`Time: ${new Date().toISOString()}`)

  // Load full data
  const dataPath = path.join(__dirname, 'data', 'riyad-full.json')
  if (!fs.existsSync(dataPath)) {
    console.error('ERROR: riyad-full.json not found. Download it first.')
    process.exit(1)
  }

  const data: FullData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  console.log(`Source: ${data.hadiths.length} hadiths, ${data.chapters.length} chapters`)

  // Group hadiths by chapter
  const hadithsByChapter: Record<number, FullHadith[]> = {}
  for (const h of data.hadiths) {
    if (!hadithsByChapter[h.chapterId]) hadithsByChapter[h.chapterId] = []
    hadithsByChapter[h.chapterId].push(h)
  }

  // Sort each chapter's hadiths by idInBook
  for (const chId of Object.keys(hadithsByChapter)) {
    hadithsByChapter[Number(chId)].sort((a, b) => a.idInBook - b.idInBook)
  }

  // Find the Riyad book
  const bookId = 'book-riyad-as-salihin'
  const book = await prisma.book.findUnique({ where: { id: bookId } })
  if (!book) {
    console.error(`ERROR: Book ${bookId} not found. Run seed-books.ts first.`)
    process.exit(1)
  }

  console.log(`Found book: ${book.title} (current totalItems: ${book.totalItems})`)

  // Delete existing user progress for this book's items
  const existingChapters = await prisma.bookChapter.findMany({
    where: { bookId },
    select: { id: true }
  })
  const chapterIds = existingChapters.map(c => c.id)

  if (chapterIds.length > 0) {
    const deletedProgress = await prisma.userItemProgress.deleteMany({
      where: { item: { chapterId: { in: chapterIds } } }
    })
    console.log(`Deleted ${deletedProgress.count} existing progress records`)
  }

  // Delete existing chapters (cascades to items)
  await prisma.bookChapter.deleteMany({ where: { bookId } })
  console.log('Deleted existing chapters and items')

  // Create new chapters and items
  let totalItems = 0
  let chapterNumber = 1

  for (const chId of CHAPTER_ORDER) {
    const chapterInfo = data.chapters.find(c => c.id === chId)
    if (!chapterInfo) continue

    const hadiths = hadithsByChapter[chId] || []
    if (hadiths.length === 0) continue

    // French chapter name (mapped from English)
    const titleFr = chapterInfo.english

    const chapter = await prisma.bookChapter.create({
      data: {
        bookId,
        title: titleFr,
        titleAr: chapterInfo.arabic,
        titleEn: chapterInfo.english,
        chapterNumber,
        depth: 0,
        totalItems: hadiths.length,
        sortOrder: chapterNumber,
      }
    })

    // Create items in batches
    const batchSize = 50
    for (let i = 0; i < hadiths.length; i += batchSize) {
      const batch = hadiths.slice(i, i + batchSize)
      await prisma.bookItem.createMany({
        data: batch.map(h => ({
          chapterId: chapter.id,
          itemNumber: h.idInBook,
          title: `Hadith ${h.idInBook}`,
          textAr: h.arabic,
          textEn: [h.english.narrator, h.english.text].filter(Boolean).join('\n\n'),
        }))
      })
    }

    totalItems += hadiths.length
    console.log(`  Ch ${chapterNumber}. ${chapterInfo.arabic} — ${hadiths.length} hadiths (#${hadiths[0].idInBook}-${hadiths[hadiths.length - 1].idInBook})`)
    chapterNumber++
  }

  // Update book totalItems
  await prisma.book.update({
    where: { id: bookId },
    data: { totalItems }
  })

  console.log(`\nDone! ${chapterNumber - 1} chapters, ${totalItems} hadiths total`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
