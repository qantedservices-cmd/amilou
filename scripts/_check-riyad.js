const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const book = await p.book.findUnique({
    where: { id: 'book-riyad-as-salihin' },
    include: {
      chapters: {
        where: { parentId: null },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { items: true } } }
      }
    }
  });
  console.log('Title:', book.title);
  console.log('TotalItems:', book.totalItems);
  console.log('Chapters:', book.chapters.length);
  for (const c of book.chapters) {
    console.log('  Ch', c.chapterNumber, '|', c.titleAr, '|', c._count.items, 'items');
  }

  // Check a sample item
  const sampleItem = await p.bookItem.findFirst({
    where: { chapter: { bookId: 'book-riyad-as-salihin' } },
    orderBy: { itemNumber: 'asc' }
  });
  console.log('\nSample item:');
  console.log('  #', sampleItem.itemNumber, sampleItem.title);
  console.log('  Arabic:', (sampleItem.textAr || '').substring(0, 100));
  console.log('  English:', (sampleItem.textEn || '').substring(0, 100));
}

main().catch(console.error).finally(() => p.$disconnect());
