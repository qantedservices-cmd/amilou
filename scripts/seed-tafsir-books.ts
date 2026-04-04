const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const books = [
    { nameAr: 'تفسير ابن كثير', nameFr: 'Tafsir Ibn Kathir', author: 'Ibn Kathir', sortOrder: 1 },
    { nameAr: 'تفسير السعدي', nameFr: "Tafsir As-Sa'di", author: "Abdurrahman As-Sa'di", sortOrder: 2 },
    { nameAr: 'تفسير الطبري', nameFr: 'Tafsir At-Tabari', author: 'Ibn Jarir At-Tabari', sortOrder: 3 },
    { nameAr: 'تفسير الجلالين', nameFr: 'Tafsir Al-Jalalayn', author: 'Al-Mahalli & As-Suyuti', sortOrder: 4 },
    { nameAr: 'تفسير القرطبي', nameFr: 'Tafsir Al-Qurtubi', author: 'Al-Qurtubi', sortOrder: 5 },
    { nameAr: 'تفسير البغوي', nameFr: 'Tafsir Al-Baghawi', author: 'Al-Baghawi', sortOrder: 6 },
    { nameAr: 'أضواء البيان', nameFr: 'Tafsir Ash-Shanqiti', author: 'Ash-Shanqiti', sortOrder: 7 },
    { nameAr: 'زاد المسير', nameFr: 'Tafsir Ibn Al-Jawzi', author: 'Ibn Al-Jawzi', sortOrder: 8 },
  ]

  await prisma.tafsirBook.deleteMany({})
  console.log('Cleared existing tafsir books.')

  for (const book of books) {
    await prisma.tafsirBook.create({ data: book })
    console.log(`Created: ${book.nameFr}`)
  }

  const count = await prisma.tafsirBook.count()
  console.log(`Done: ${count} tafsir books in DB`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
