/**
 * Seed Books, Chapters, and Items from JSON data files.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-books.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface ChapterData {
  title: string
  titleAr?: string
  titleEn?: string
  chapterNumber: number
  items: any[] | string
}

interface BookData {
  title: string
  titleAr?: string
  titleEn?: string
  author?: string
  authorAr?: string
  type: string
  discipline: string
  collectionLevel?: number
  sourceRef?: string
  sortOrder: number
  chapters: ChapterData[]
}

async function seedMutunCollection() {
  const dataPath = path.join(__dirname, 'data', 'mutun-collection.json')
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const collectionId = data.collection.id

  console.log(`\nSeeding collection: ${data.collection.title}`)
  console.log(`  ${data.books.length} books to process`)

  // Load nawawi40 items if needed
  const nawawi40Path = path.join(__dirname, 'data', 'nawawi40-items.json')
  const nawawi40Data = JSON.parse(fs.readFileSync(nawawi40Path, 'utf-8'))

  for (const bookData of data.books as BookData[]) {
    console.log(`\n  Processing: ${bookData.title}`)

    // Upsert the book
    const book = await prisma.book.upsert({
      where: {
        id: `book-${bookData.sourceRef || bookData.title.toLowerCase().replace(/\s+/g, '-')}`
      },
      create: {
        id: `book-${bookData.sourceRef || bookData.title.toLowerCase().replace(/\s+/g, '-')}`,
        title: bookData.title,
        titleAr: bookData.titleAr,
        titleEn: bookData.titleEn,
        author: bookData.author,
        authorAr: bookData.authorAr,
        type: bookData.type,
        discipline: bookData.discipline,
        collectionId,
        collectionLevel: bookData.collectionLevel,
        source: 'MANUAL',
        sourceRef: bookData.sourceRef,
        totalItems: 0,
        isSystem: true,
        sortOrder: bookData.sortOrder,
      },
      update: {
        title: bookData.title,
        titleAr: bookData.titleAr,
        titleEn: bookData.titleEn,
        author: bookData.author,
        authorAr: bookData.authorAr,
        type: bookData.type,
        discipline: bookData.discipline,
        collectionId,
        collectionLevel: bookData.collectionLevel,
        sortOrder: bookData.sortOrder,
      },
    })

    // Delete existing chapters and items for this book (cascade)
    await prisma.bookChapter.deleteMany({ where: { bookId: book.id } })

    let totalBookItems = 0

    for (const chapterData of bookData.chapters) {
      // Resolve items - special case for nawawi40
      let items: any[] = []
      if (chapterData.items === 'FETCH_FROM_API') {
        items = nawawi40Data.items
      } else if (Array.isArray(chapterData.items)) {
        items = chapterData.items
      }

      const chapter = await prisma.bookChapter.create({
        data: {
          bookId: book.id,
          title: chapterData.title,
          titleAr: chapterData.titleAr,
          titleEn: chapterData.titleEn,
          chapterNumber: chapterData.chapterNumber,
          depth: 0,
          totalItems: items.length,
          sortOrder: chapterData.chapterNumber,
        },
      })

      // Create items
      for (const item of items) {
        await prisma.bookItem.create({
          data: {
            chapterId: chapter.id,
            itemNumber: item.itemNumber,
            title: item.title,
            textAr: item.textAr || null,
            textFr: item.textFr || null,
            textEn: item.textEn || null,
            reference: item.reference || null,
          },
        })
      }

      totalBookItems += items.length
    }

    // Update totalItems on book
    await prisma.book.update({
      where: { id: book.id },
      data: { totalItems: totalBookItems },
    })

    console.log(`    ${bookData.chapters.length} chapters, ${totalBookItems} items`)
  }
}

async function seedRiyadAsSalihin() {
  const dataPath = path.join(__dirname, 'data', 'riyad-as-salihin.json')
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const bookInfo = data.book

  console.log(`\nSeeding: ${bookInfo.title}`)

  const bookId = `book-${bookInfo.sourceRef}`

  const book = await prisma.book.upsert({
    where: { id: bookId },
    create: {
      id: bookId,
      title: bookInfo.title,
      titleAr: bookInfo.titleAr,
      titleEn: bookInfo.titleEn,
      author: bookInfo.author,
      authorAr: bookInfo.authorAr,
      type: bookInfo.type,
      discipline: bookInfo.discipline,
      source: bookInfo.source,
      sourceRef: bookInfo.sourceRef,
      totalItems: 0,
      isSystem: true,
      sortOrder: bookInfo.sortOrder,
    },
    update: {
      title: bookInfo.title,
      titleAr: bookInfo.titleAr,
      titleEn: bookInfo.titleEn,
      author: bookInfo.author,
      authorAr: bookInfo.authorAr,
    },
  })

  // Delete existing chapters
  await prisma.bookChapter.deleteMany({ where: { bookId: book.id } })

  let totalItems = 0

  for (const chapter of data.chapters) {
    // Create parent chapter (Livre/Kitab)
    const parentChapter = await prisma.bookChapter.create({
      data: {
        bookId: book.id,
        title: chapter.title,
        titleAr: chapter.titleAr,
        chapterNumber: chapter.chapterNumber,
        depth: 0,
        totalItems: 0,
        sortOrder: chapter.chapterNumber,
      },
    })

    let parentTotalItems = 0

    if (chapter.subchapters) {
      for (const sub of chapter.subchapters) {
        const subChapter = await prisma.bookChapter.create({
          data: {
            bookId: book.id,
            parentId: parentChapter.id,
            title: sub.title,
            titleAr: sub.titleAr,
            chapterNumber: sub.chapterNumber,
            depth: 1,
            totalItems: sub.itemCount || 0,
            sortOrder: sub.chapterNumber,
          },
        })

        // Create placeholder items based on count
        const itemCount = sub.itemCount || 0
        for (let i = 1; i <= itemCount; i++) {
          await prisma.bookItem.create({
            data: {
              chapterId: subChapter.id,
              itemNumber: i,
              title: `Hadith ${i}`,
            },
          })
        }

        parentTotalItems += itemCount
        totalItems += itemCount
      }
    }

    // Update parent chapter total
    await prisma.bookChapter.update({
      where: { id: parentChapter.id },
      data: { totalItems: parentTotalItems },
    })
  }

  await prisma.book.update({
    where: { id: book.id },
    data: { totalItems: totalItems },
  })

  console.log(`  ${data.chapters.length} livres, ${totalItems} items`)
}

async function main() {
  console.log('=== Seed Books ===')
  console.log(`Time: ${new Date().toISOString()}`)

  await seedMutunCollection()
  await seedRiyadAsSalihin()

  // Summary
  const bookCount = await prisma.book.count()
  const chapterCount = await prisma.bookChapter.count()
  const itemCount = await prisma.bookItem.count()

  console.log('\n=== Summary ===')
  console.log(`Books: ${bookCount}`)
  console.log(`Chapters: ${chapterCount}`)
  console.log(`Items: ${itemCount}`)
  console.log('\nDone!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
