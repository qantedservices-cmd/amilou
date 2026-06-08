/**
 * Fix hizb and juz values in the Verse table.
 *
 * The current values are incorrect - they are offset from the correct
 * Quran.com API boundaries. This script:
 * 1. Fetches correct hizb (60) and juz (30) boundaries from Quran.com API v4
 * 2. Assigns integer hizb (1-60) and juz (1-30) to each verse
 * 3. Updates the database
 * 4. Verifies the results
 *
 * Usage: node scripts/fix-hizb-juz.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Correct boundaries from Quran.com API v4
// Each entry: [hizbNumber, surahNumber, verseNumber]
const CORRECT_HIZB_BOUNDARIES = [
  [1, 1, 1], [2, 2, 75], [3, 2, 142], [4, 2, 203], [5, 2, 253],
  [6, 3, 15], [7, 3, 93], [8, 3, 171], [9, 4, 24], [10, 4, 88],
  [11, 4, 148], [12, 5, 27], [13, 5, 82], [14, 6, 36], [15, 6, 111],
  [16, 7, 1], [17, 7, 88], [18, 7, 171], [19, 8, 41], [20, 9, 34],
  [21, 9, 93], [22, 10, 26], [23, 11, 6], [24, 11, 84], [25, 12, 53],
  [26, 13, 19], [27, 15, 1], [28, 16, 51], [29, 17, 1], [30, 17, 99],
  [31, 18, 75], [32, 20, 1], [33, 21, 1], [34, 22, 1], [35, 23, 1],
  [36, 24, 21], [37, 25, 21], [38, 26, 111], [39, 27, 56], [40, 28, 51],
  [41, 29, 46], [42, 31, 22], [43, 33, 31], [44, 34, 24], [45, 36, 28],
  [46, 37, 145], [47, 39, 32], [48, 40, 41], [49, 41, 47], [50, 43, 24],
  [51, 46, 1], [52, 48, 18], [53, 51, 31], [54, 55, 1], [55, 58, 1],
  [56, 62, 1], [57, 67, 1], [58, 72, 1], [59, 78, 1], [60, 87, 1]
];

// Correct juz boundaries from Quran.com API v4
// Each entry: [juzNumber, surahNumber, verseNumber]
const CORRECT_JUZ_BOUNDARIES = [
  [1, 1, 1], [2, 2, 142], [3, 2, 253], [4, 3, 93], [5, 4, 24],
  [6, 4, 148], [7, 5, 82], [8, 6, 111], [9, 7, 88], [10, 8, 41],
  [11, 9, 93], [12, 11, 6], [13, 12, 53], [14, 15, 1], [15, 17, 1],
  [16, 18, 75], [17, 21, 1], [18, 23, 1], [19, 25, 21], [20, 27, 56],
  [21, 29, 46], [22, 33, 31], [23, 36, 28], [24, 39, 32], [25, 41, 47],
  [26, 46, 1], [27, 51, 31], [28, 58, 1], [29, 67, 1], [30, 78, 1]
];

/**
 * Compare two verse positions: returns -1, 0, or 1
 */
function compareVerses(s1, v1, s2, v2) {
  if (s1 !== s2) return s1 < s2 ? -1 : 1;
  if (v1 !== v2) return v1 < v2 ? -1 : 1;
  return 0;
}

/**
 * Get the correct hizb number for a verse given its surah and verse number
 */
function getCorrectHizb(surahNumber, verseNumber) {
  let hizb = 1;
  for (const [h, s, v] of CORRECT_HIZB_BOUNDARIES) {
    if (compareVerses(surahNumber, verseNumber, s, v) >= 0) {
      hizb = h;
    } else {
      break;
    }
  }
  return hizb;
}

/**
 * Get the correct juz number for a verse given its surah and verse number
 */
function getCorrectJuz(surahNumber, verseNumber) {
  let juz = 1;
  for (const [j, s, v] of CORRECT_JUZ_BOUNDARIES) {
    if (compareVerses(surahNumber, verseNumber, s, v) >= 0) {
      juz = j;
    } else {
      break;
    }
  }
  return juz;
}

async function showBeforeState() {
  console.log('=== BEFORE: JUZ BOUNDARIES ===');
  console.log('Juz  | DB Start        | Correct Start   | Status');
  console.log('-----|-----------------|-----------------|--------');

  let juzMismatches = 0;
  for (const [j, cs, cv] of CORRECT_JUZ_BOUNDARIES) {
    const firstVerse = await prisma.verse.findFirst({
      where: { juz: j },
      orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }]
    });
    const dbStr = firstVerse ? `${firstVerse.surahNumber}:${firstVerse.verseNumber}` : 'NOT FOUND';
    const correctStr = `${cs}:${cv}`;
    const match = firstVerse && firstVerse.surahNumber === cs && firstVerse.verseNumber === cv;
    if (!match) juzMismatches++;
    console.log(`${String(j).padStart(5)} | ${dbStr.padEnd(15)} | ${correctStr.padEnd(15)} | ${match ? 'MATCH' : 'MISMATCH'}`);
  }
  console.log(`\nJuz mismatches: ${juzMismatches}/30\n`);

  console.log('=== BEFORE: HIZB BOUNDARIES ===');
  console.log('Hizb | DB Start (gte)  | Correct Start   | Status');
  console.log('-----|-----------------|-----------------|--------');

  let hizbMismatches = 0;
  for (const [h, cs, cv] of CORRECT_HIZB_BOUNDARIES) {
    const firstVerse = await prisma.verse.findFirst({
      where: { hizb: { gte: h } },
      orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }]
    });
    const dbStr = firstVerse ? `${firstVerse.surahNumber}:${firstVerse.verseNumber}` : 'NOT FOUND';
    const correctStr = `${cs}:${cv}`;
    const match = firstVerse && firstVerse.surahNumber === cs && firstVerse.verseNumber === cv;
    if (!match) hizbMismatches++;
    console.log(`${String(h).padStart(5)} | ${dbStr.padEnd(15)} | ${correctStr.padEnd(15)} | ${match ? 'MATCH' : 'MISMATCH'}`);
  }
  console.log(`\nHizb mismatches: ${hizbMismatches}/60\n`);
}

async function fixValues() {
  console.log('=== FIXING HIZB AND JUZ VALUES ===\n');

  // Load all verses ordered by surah then verse
  const allVerses = await prisma.verse.findMany({
    orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
    select: { id: true, surahNumber: true, verseNumber: true, hizb: true, juz: true }
  });

  console.log(`Total verses to process: ${allVerses.length}`);

  // Calculate correct values for each verse
  let hizbChanges = 0;
  let juzChanges = 0;
  const updates = [];

  for (const verse of allVerses) {
    const correctHizb = getCorrectHizb(verse.surahNumber, verse.verseNumber);
    const correctJuz = getCorrectJuz(verse.surahNumber, verse.verseNumber);

    const hizbChanged = verse.hizb !== correctHizb;
    const juzChanged = verse.juz !== correctJuz;

    if (hizbChanged || juzChanged) {
      updates.push({
        id: verse.id,
        hizb: correctHizb,
        juz: correctJuz
      });
      if (hizbChanged) hizbChanges++;
      if (juzChanged) juzChanges++;
    }
  }

  console.log(`Verses needing hizb update: ${hizbChanges}`);
  console.log(`Verses needing juz update: ${juzChanges}`);
  console.log(`Total verses to update: ${updates.length}`);

  if (updates.length === 0) {
    console.log('\nNo updates needed - all values are already correct!');
    return;
  }

  // Apply updates in batches
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(updates.length / BATCH_SIZE);
  console.log(`\nApplying ${updates.length} updates in ${totalBatches} batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    // Use a transaction for each batch
    await prisma.$transaction(
      batch.map(u => prisma.verse.update({
        where: { id: u.id },
        data: { hizb: u.hizb, juz: u.juz }
      }))
    );

    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      console.log(`  Batch ${batchNum}/${totalBatches} done`);
    }
  }

  console.log('\nAll updates applied successfully!\n');
}

async function showAfterState() {
  console.log('=== AFTER: JUZ BOUNDARIES VERIFICATION ===');
  console.log('Juz  | DB Start        | Correct Start   | Status');
  console.log('-----|-----------------|-----------------|--------');

  let juzMismatches = 0;
  for (const [j, cs, cv] of CORRECT_JUZ_BOUNDARIES) {
    const firstVerse = await prisma.verse.findFirst({
      where: { juz: j },
      orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }]
    });
    const dbStr = firstVerse ? `${firstVerse.surahNumber}:${firstVerse.verseNumber}` : 'NOT FOUND';
    const correctStr = `${cs}:${cv}`;
    const match = firstVerse && firstVerse.surahNumber === cs && firstVerse.verseNumber === cv;
    if (!match) juzMismatches++;
    console.log(`${String(j).padStart(5)} | ${dbStr.padEnd(15)} | ${correctStr.padEnd(15)} | ${match ? 'MATCH' : 'MISMATCH'}`);
  }
  console.log(`\nJuz mismatches: ${juzMismatches}/30\n`);

  console.log('=== AFTER: HIZB BOUNDARIES VERIFICATION ===');
  console.log('Hizb | DB Start        | Correct Start   | Status');
  console.log('-----|-----------------|-----------------|--------');

  let hizbMismatches = 0;
  for (const [h, cs, cv] of CORRECT_HIZB_BOUNDARIES) {
    const firstVerse = await prisma.verse.findFirst({
      where: { hizb: { gte: h } },
      orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }]
    });
    const dbStr = firstVerse ? `${firstVerse.surahNumber}:${firstVerse.verseNumber}` : 'NOT FOUND';
    const correctStr = `${cs}:${cv}`;
    const match = firstVerse && firstVerse.surahNumber === cs && firstVerse.verseNumber === cv;
    if (!match) hizbMismatches++;
    console.log(`${String(h).padStart(5)} | ${dbStr.padEnd(15)} | ${correctStr.padEnd(15)} | ${match ? 'MATCH' : 'MISMATCH'}`);
  }
  console.log(`\nHizb mismatches: ${hizbMismatches}/60`);

  // Also check verse count per hizb
  console.log('\n=== VERSE COUNT PER HIZB ===');
  for (let h = 1; h <= 60; h++) {
    const count = await prisma.verse.count({ where: { hizb: h } });
    if (count === 0) {
      console.log(`  WARNING: Hizb ${h} has 0 verses!`);
    }
  }

  // Check max hizb value
  const maxHizb = await prisma.$queryRaw`SELECT MAX(hizb) as max_hizb, MIN(hizb) as min_hizb FROM "Verse"`;
  console.log('\nHizb range after fix:', maxHizb);
}

async function main() {
  try {
    await showBeforeState();
    await fixValues();
    await showAfterState();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
