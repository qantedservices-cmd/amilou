const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check if hizb was assigned based on page number formula
  // From the DB results, hizb 1 starts at page 1, hizb 2 at page 11, hizb 3 at page 21, etc.
  // That means hizb = FLOOR((page - 1) / 10) + 1

  const samples = await prisma.verse.findMany({
    where: { hizb: { not: null } },
    select: { surahNumber: true, verseNumber: true, page: true, hizb: true },
    orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
    take: 30
  });

  console.log('Sample verses with computed hizb check:');
  console.log('surah:verse | page | hizb (DB) | floor((page-1)/10)+1 | match?');
  let allMatch = true;
  for (const v of samples) {
    const computed = Math.floor((v.page - 1) / 10) + 1;
    const match = v.hizb === computed;
    if (!match) allMatch = false;
    console.log(`${v.surahNumber}:${v.verseNumber} | ${v.page} | ${v.hizb} | ${computed} | ${match ? 'YES' : 'NO'}`);
  }

  // Full check: are ALL verses following the page-based formula?
  const allVerses = await prisma.verse.findMany({
    where: { hizb: { not: null } },
    select: { surahNumber: true, verseNumber: true, page: true, hizb: true }
  });

  let mismatches = 0;
  for (const v of allVerses) {
    const computed = Math.floor((v.page - 1) / 10) + 1;
    if (v.hizb !== computed) {
      mismatches++;
      if (mismatches <= 5) {
        console.log(`MISMATCH: ${v.surahNumber}:${v.verseNumber} page=${v.page} hizb=${v.hizb} computed=${computed}`);
      }
    }
  }

  console.log(`\nTotal verses with hizb: ${allVerses.length}`);
  console.log(`Mismatches with page formula: ${mismatches}`);
  console.log(`All follow page formula: ${mismatches === 0 ? 'YES' : 'NO'}`);

  // Max page
  const maxPage = await prisma.verse.aggregate({ _max: { page: true } });
  console.log(`\nMax page in DB: ${maxPage._max.page}`);

  // Distinct hizb values
  const hizbValues = await prisma.verse.findMany({
    where: { hizb: { not: null } },
    select: { hizb: true },
    distinct: ['hizb'],
    orderBy: { hizb: 'asc' }
  });
  console.log(`\nDistinct hizb values: ${hizbValues.length}`);
  console.log(`Range: ${hizbValues[0].hizb} to ${hizbValues[hizbValues.length - 1].hizb}`);

  // Check for fractional values
  const fractional = hizbValues.filter(h => h.hizb % 1 !== 0);
  console.log(`Fractional hizb values: ${fractional.length}`);
  if (fractional.length > 0) {
    console.log('Examples:', fractional.slice(0, 10).map(h => h.hizb));
  }

  // Also check: how many verses have NULL hizb?
  const nullCount = await prisma.verse.count({ where: { hizb: null } });
  const totalCount = await prisma.verse.count();
  console.log(`\nTotal verses: ${totalCount}`);
  console.log(`Verses with hizb: ${allVerses.length}`);
  console.log(`Verses with NULL hizb: ${nullCount}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
