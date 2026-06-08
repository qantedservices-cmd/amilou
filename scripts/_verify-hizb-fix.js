const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function hizbToPosition(hizb) {
  if (hizb <= 1) {
    const first = await prisma.verse.findFirst({
      orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
      include: { surah: true }
    });
    return first ? { surah: first.surahNumber, nameAr: first.surah.nameAr, verse: first.verseNumber, page: first.page } : null;
  }
  // FIXED: use hizb directly, not hizb + 0.05
  const marker = await prisma.verse.findFirst({
    where: { hizb: { gte: hizb } },
    orderBy: { hizb: 'asc' }
  });
  if (!marker) return null;
  const firstOfPage = await prisma.verse.findFirst({
    where: { page: marker.page },
    orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
    include: { surah: true }
  });
  return firstOfPage ? { surah: firstOfPage.surahNumber, nameAr: firstOfPage.surah.nameAr, verse: firstOfPage.verseNumber, page: firstOfPage.page } : null;
}

async function main() {
  console.log('Hizb | Surah | Name       | Verse | Page');
  console.log('-----|-------|------------|-------|-----');
  for (const h of [1, 2, 3, 10, 16, 19, 20, 21, 30, 40, 50, 60]) {
    const pos = await hizbToPosition(h);
    if (pos) {
      console.log(`${String(h).padStart(4)} | S${String(pos.surah).padStart(3)}  | ${pos.nameAr.padEnd(10)} | v${String(pos.verse).padStart(3)}  | p${pos.page}`);
    }
  }

  // Verify against actual DB boundaries
  console.log('\n--- Verification: first verse at each hizb boundary ---');
  for (const h of [2, 19, 20, 21]) {
    const boundary = await prisma.verse.findFirst({
      where: { hizb: { gte: h, lt: h + 0.01 } },
      orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
      include: { surah: true }
    });
    const pos = await hizbToPosition(h);
    const match = boundary && pos && boundary.page === pos.page ? 'MATCH' : 'MISMATCH';
    console.log(`Hizb ${h}: DB boundary S${boundary?.surahNumber}:${boundary?.verseNumber} p${boundary?.page} | Function S${pos?.surah}:${pos?.verse} p${pos?.page} | ${match}`);
  }

  // Samir's positions
  console.log('\n--- Samir dashboard display ---');
  const readingPos = await hizbToPosition(19); // readingCurrentHizb=18, display hizb+1=19
  const revisionPos = await hizbToPosition(1); // startHizb=1 + revisionCurrentHizb=0
  console.log('Lecture (hizb 19):', readingPos);
  console.log('Révision (hizb 1):', revisionPos);
}

main().catch(console.error).finally(() => prisma.$disconnect());
