const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.join(__dirname, 'verses_seed.json');
  const verses = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`Chargement de ${verses.length} versets...`);

  // Delete existing verses
  const deleted = await prisma.verse.deleteMany({});
  console.log(`${deleted.count} versets existants supprimés.`);

  // Batch insert (chunks of 500)
  const chunkSize = 500;
  let imported = 0;

  for (let i = 0; i < verses.length; i += chunkSize) {
    const chunk = verses.slice(i, i + chunkSize);
    await prisma.verse.createMany({
      data: chunk.map(v => ({
        surahNumber: v.surahNumber,
        verseNumber: v.verseNumber,
        page: v.page,
        juz: v.juz,
        hizb: v.hizb
      }))
    });
    imported += chunk.length;
    console.log(`  ${imported}/${verses.length} importés...`);
  }

  console.log(`\nTerminé: ${imported} versets seedés.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
