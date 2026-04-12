/**
 * Rebuild Riyad As-Salihin with babs (sub-chapters) and re-create hadiths
 * Structure: kitab (depth 0) > bab (depth 1) > hadiths (items)
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const BOOK_ID = 'book-riyad-as-salihin'

async function main() {
  const babsData = require('./data/riyad-babs.json')
  const riyadData = require('./data/riyad-full.json')

  // Build hadith lookup: idInBook -> { arabic, english }
  const hadithMap = new Map()
  for (const h of riyadData.hadiths) {
    hadithMap.set(h.idInBook, {
      arabic: h.arabic,
      english: h.english ? `${h.english.narrator || ''} ${h.english.text || ''}`.trim() : '',
    })
  }
  console.log('Hadiths in source:', hadithMap.size)

  // Verify book exists
  const book = await prisma.book.findUnique({ where: { id: BOOK_ID } })
  if (!book) { console.error('Book not found'); return }

  // Save existing user progress before delete
  const existingProgress = await prisma.userItemProgress.findMany({
    where: { item: { chapter: { bookId: BOOK_ID } } },
    select: { userId: true, completed: true, completedAt: true, notes: true, rating: true, item: { select: { itemNumber: true } } },
  })
  const progressMap = new Map()
  for (const p of existingProgress) {
    const key = `${p.userId}:${p.item.itemNumber}`
    progressMap.set(key, { completed: p.completed, completedAt: p.completedAt, notes: p.notes, rating: p.rating })
  }
  console.log('User progress records saved:', progressMap.size)

  // Delete everything and rebuild
  // UserItemProgress cascades from BookItem, BookItem cascades from BookChapter
  await prisma.bookChapter.deleteMany({ where: { bookId: BOOK_ID } })
  console.log('Cleared all chapters and items')

  // Sort books: 0 (Intro/Muqaddimat) comes first, then 1-19
  const sortedBooks = [...babsData.books].sort((a: any, b: any) => {
    if (a.bookNumber === 0) return -1
    if (b.bookNumber === 0) return 1
    return a.bookNumber - b.bookNumber
  })

  let totalBabs = 0
  let totalItems = 0

  for (let ki = 0; ki < sortedBooks.length; ki++) {
    const bookData = sortedBooks[ki]

    // Create kitab
    const kitab = await prisma.bookChapter.create({
      data: {
        bookId: BOOK_ID,
        title: bookData.bookNameEn,
        titleAr: bookData.bookNameAr,
        chapterNumber: bookData.bookNumber,
        depth: 0,
        totalItems: 0,
        sortOrder: ki,
      }
    })

    let kitabItemCount = 0

    for (let bi = 0; bi < bookData.babs.length; bi++) {
      const bab = bookData.babs[bi]
      const babItemCount = bab.hadithEnd - bab.hadithStart + 1

      // Create bab
      const babChapter = await prisma.bookChapter.create({
        data: {
          bookId: BOOK_ID,
          parentId: kitab.id,
          title: bab.babNameEn,
          titleAr: bab.babNameAr,
          chapterNumber: bab.babNumber,
          depth: 1,
          totalItems: babItemCount,
          sortOrder: bi,
        }
      })

      // Create hadith items in batch
      const items = []
      for (let h = bab.hadithStart; h <= bab.hadithEnd; h++) {
        const hadith = hadithMap.get(h)
        items.push({
          chapterId: babChapter.id,
          itemNumber: h,
          title: `Hadith ${h}`,
          textAr: hadith?.arabic || null,
          textEn: hadith?.english || null,
        })
      }

      if (items.length > 0) {
        await prisma.bookItem.createMany({ data: items })
      }

      kitabItemCount += babItemCount
      totalBabs++
      totalItems += items.length
    }

    // Update kitab totalItems
    await prisma.bookChapter.update({
      where: { id: kitab.id },
      data: { totalItems: kitabItemCount },
    })

    console.log(`  Kitab ${bookData.bookNumber}: ${bookData.bookNameEn.substring(0, 40)} — ${bookData.babs.length} babs, ${kitabItemCount} hadiths`)
  }

  // Restore user progress
  if (progressMap.size > 0) {
    console.log('Restoring user progress...')
    const allNewItems = await prisma.bookItem.findMany({
      where: { chapter: { bookId: BOOK_ID } },
      select: { id: true, itemNumber: true },
    })

    const itemNumberToId = new Map()
    for (const item of allNewItems) {
      itemNumberToId.set(item.itemNumber, item.id)
    }

    let restored = 0
    for (const [key, prog] of progressMap.entries()) {
      const [userId, itemNumStr] = key.split(':')
      const itemId = itemNumberToId.get(parseInt(itemNumStr))
      if (itemId && prog.completed) {
        await prisma.userItemProgress.upsert({
          where: { userId_itemId: { userId, itemId } },
          update: { completed: prog.completed, completedAt: prog.completedAt, notes: prog.notes, rating: prog.rating },
          create: { userId, itemId, completed: prog.completed, completedAt: prog.completedAt, notes: prog.notes, rating: prog.rating },
        })
        restored++
      }
    }
    console.log('Progress records restored:', restored)
  }

  // Update book totalItems
  await prisma.book.update({
    where: { id: BOOK_ID },
    data: { totalItems: totalItems },
  })

  console.log('\n--- Summary ---')
  console.log('Kitabs:', sortedBooks.length)
  console.log('Babs:', totalBabs)
  console.log('Hadiths:', totalItems)
  console.log('Done!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
