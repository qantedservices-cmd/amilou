const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check the actual formula: hizb = page / 10 + something?
  // 604 pages / 60 hizbs = ~10.07 pages per hizb
  // If 1 hizb = 10 pages, then page 1 -> hizb 1, page 2 -> hizb 1.1, etc.
  // Let's verify: hizb = Math.floor((page-1)/10) + ((page-1)%10)/10 + 1
  //             = (page-1)/10 + 1

  const samples = await prisma.verse.findMany({
    where: { hizb: { not: null } },
    select: { surahNumber: true, verseNumber: true, page: true, hizb: true },
    orderBy: [{ page: 'asc' }, { surahNumber: 'asc' }, { verseNumber: 'asc' }],
  });

  // Group by page, check first verse of each page
  const byPage = {};
  for (const v of samples) {
    if (!byPage[v.page]) byPage[v.page] = v;
  }

  console.log('page | hizb (DB) | computed=(page-1)/10+1 | match?');
  let mismatches = 0;
  for (let p = 1; p <= 604; p++) {
    if (!byPage[p]) continue;
    const v = byPage[p];
    // The formula seems to be: whole part = ceil(page/10), decimal = (page-1)%10 / 10
    // Actually let's just check: round((page-1)/10 + 1, 1)
    const computed = Math.round(((v.page - 1) / 10 + 1) * 10) / 10;
    const match = Math.abs(v.hizb - computed) < 0.01;
    if (!match) {
      mismatches++;
      if (mismatches <= 20) {
        console.log(`${v.page} | ${v.hizb} | ${computed} | NO`);
      }
    }
  }

  if (mismatches === 0) {
    console.log('ALL pages match formula: hizb = (page-1)/10 + 1');
  } else {
    console.log(`Mismatches: ${mismatches}`);
  }

  // Let me check specifically: are there 600 or 604 distinct pages?
  const distinctPages = Object.keys(byPage).length;
  console.log(`\nDistinct pages with verses: ${distinctPages}`);

  // Show the last few pages
  console.log('\nLast 15 pages:');
  for (let p = 590; p <= 604; p++) {
    if (byPage[p]) {
      console.log(`  page ${p}: hizb=${byPage[p].hizb} | ${byPage[p].surahNumber}:${byPage[p].verseNumber}`);
    }
  }

  // Show pages around the transitions between integer hizbs
  console.log('\nPages around hizb transitions (pages 9-12):');
  for (let p = 9; p <= 12; p++) {
    if (byPage[p]) {
      console.log(`  page ${p}: hizb=${byPage[p].hizb} | ${byPage[p].surahNumber}:${byPage[p].verseNumber}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
