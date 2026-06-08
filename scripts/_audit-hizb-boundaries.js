// Audit hizb boundaries: compare hizbToPosition() logic vs actual DB data
// Usage: node scripts/_audit-hizb-boundaries.js

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== HIZB BOUNDARY AUDIT ===\n');

  // -------------------------------------------------------
  // 1. Get ALL verses ordered, with surah names
  // -------------------------------------------------------
  const allVerses = await prisma.verse.findMany({
    orderBy: [{ surahNumber: 'asc' }, { verseNumber: 'asc' }],
    include: { surah: true },
  });

  console.log(`Total verses in DB: ${allVerses.length}\n`);

  // Quick index: page -> first verse of that page
  const firstVerseOfPage = {};
  for (const v of allVerses) {
    if (!firstVerseOfPage[v.page]) {
      firstVerseOfPage[v.page] = v;
    }
  }

  // -------------------------------------------------------
  // 2. For each hizb 1-60, simulate hizbToPosition() logic
  //    and find the actual DB boundary
  // -------------------------------------------------------
  const results = [];

  for (let hizb = 1; hizb <= 60; hizb++) {
    // --- A) hizbToPosition() logic ---
    let funcResult;
    if (hizb <= 1) {
      // Special case: returns first verse
      const first = allVerses[0];
      funcResult = {
        surahNumber: first.surahNumber,
        surahNameAr: first.surah.nameAr,
        verseNumber: first.verseNumber,
        page: first.page,
        hizb: first.hizb || 1,
        juz: first.juz || 1,
      };
    } else {
      // Find first verse where hizb >= N + 0.05
      const marker = allVerses.find(v => v.hizb !== null && v.hizb >= hizb + 0.05);
      if (marker) {
        const fop = firstVerseOfPage[marker.page];
        funcResult = {
          surahNumber: fop.surahNumber,
          surahNameAr: fop.surah.nameAr,
          verseNumber: fop.verseNumber,
          page: fop.page,
          hizb: fop.hizb || 0,
          juz: fop.juz || 0,
        };
      } else {
        // Beyond last hizb
        const last = allVerses[allVerses.length - 1];
        funcResult = {
          surahNumber: last.surahNumber,
          surahNameAr: last.surah.nameAr,
          verseNumber: last.verseNumber,
          page: last.page,
          hizb: last.hizb || 60,
          juz: last.juz || 30,
        };
      }
    }

    // --- B) Actual DB boundary: first verse with hizb >= N (integer start) ---
    const actualBoundary = allVerses.find(v => v.hizb !== null && v.hizb >= hizb);

    // --- C) Also find first verse where Math.floor(hizb) === hizb (exact integer) ---
    const exactIntegerVerse = allVerses.find(v => v.hizb !== null && v.hizb === hizb);

    // --- D) Find first verse where hizb value has floor = N (first in that hizb group) ---
    const firstInHizbGroup = allVerses.find(v => v.hizb !== null && Math.floor(v.hizb) === hizb);

    // Compare
    const match = funcResult && actualBoundary &&
      funcResult.surahNumber === actualBoundary.surahNumber &&
      funcResult.verseNumber === actualBoundary.verseNumber;

    results.push({
      hizb,
      func: funcResult,
      actual: actualBoundary ? {
        surahNumber: actualBoundary.surahNumber,
        surahNameAr: actualBoundary.surah.nameAr,
        verseNumber: actualBoundary.verseNumber,
        page: actualBoundary.page,
        hizbValue: actualBoundary.hizb,
      } : null,
      exactInt: exactIntegerVerse ? {
        surahNumber: exactIntegerVerse.surahNumber,
        verseNumber: exactIntegerVerse.verseNumber,
        page: exactIntegerVerse.page,
      } : null,
      firstInGroup: firstInHizbGroup ? {
        surahNumber: firstInHizbGroup.surahNumber,
        surahNameAr: firstInHizbGroup.surah.nameAr,
        verseNumber: firstInHizbGroup.verseNumber,
        page: firstInHizbGroup.page,
        hizbValue: firstInHizbGroup.hizb,
      } : null,
      match,
    });
  }

  // -------------------------------------------------------
  // 3. Print results table
  // -------------------------------------------------------
  console.log('='.repeat(160));
  console.log(
    'Hizb'.padEnd(6) +
    '| hizbToPosition() Result'.padEnd(50) +
    '| Actual DB (first hizb >= N)'.padEnd(50) +
    '| First in group (floor=N)'.padEnd(40) +
    '| Match?'
  );
  console.log('='.repeat(160));

  let mismatches = 0;
  for (const r of results) {
    const funcStr = r.func
      ? `S${r.func.surahNumber}:${r.func.verseNumber} ${r.func.surahNameAr} p${r.func.page}`
      : 'N/A';
    const actualStr = r.actual
      ? `S${r.actual.surahNumber}:${r.actual.verseNumber} ${r.actual.surahNameAr} p${r.actual.page} (hizb=${r.actual.hizbValue})`
      : 'N/A';
    const groupStr = r.firstInGroup
      ? `S${r.firstInGroup.surahNumber}:${r.firstInGroup.verseNumber} ${r.firstInGroup.surahNameAr} p${r.firstInGroup.page} (hizb=${r.firstInGroup.hizbValue})`
      : 'N/A';
    const matchStr = r.match ? 'YES' : 'NO';

    if (!r.match) mismatches++;

    console.log(
      `${r.hizb}`.padEnd(6) +
      `| ${funcStr}`.padEnd(50) +
      `| ${actualStr}`.padEnd(50) +
      `| ${groupStr}`.padEnd(40) +
      `| ${matchStr}`
    );
  }

  console.log('='.repeat(160));
  console.log(`\nTotal mismatches: ${mismatches} / 60\n`);

  // -------------------------------------------------------
  // 4. Detailed mismatch analysis
  // -------------------------------------------------------
  if (mismatches > 0) {
    console.log('=== MISMATCH DETAILS ===\n');
    for (const r of results) {
      if (!r.match) {
        console.log(`Hizb ${r.hizb}:`);
        console.log(`  hizbToPosition() -> S${r.func.surahNumber}:${r.func.verseNumber} (${r.func.surahNameAr}), page ${r.func.page}`);
        if (r.actual) {
          console.log(`  Actual boundary  -> S${r.actual.surahNumber}:${r.actual.verseNumber} (${r.actual.surahNameAr}), page ${r.actual.page}, hizb value=${r.actual.hizbValue}`);
        }
        if (r.firstInGroup) {
          console.log(`  First in group   -> S${r.firstInGroup.surahNumber}:${r.firstInGroup.verseNumber} (${r.firstInGroup.surahNameAr}), page ${r.firstInGroup.page}, hizb value=${r.firstInGroup.hizbValue}`);
        }
        console.log();
      }
    }
  }

  // -------------------------------------------------------
  // 5. Check hizb value distribution around boundaries
  // -------------------------------------------------------
  console.log('=== HIZB VALUE DISTRIBUTION (around integer boundaries) ===\n');
  for (let hizb = 1; hizb <= 5; hizb++) {
    console.log(`--- Around hizb ${hizb} ---`);
    const around = allVerses.filter(v =>
      v.hizb !== null && v.hizb >= hizb - 0.2 && v.hizb <= hizb + 0.2
    );
    for (const v of around) {
      console.log(`  S${v.surahNumber}:${v.verseNumber} (${v.surah.nameAr}) page=${v.page} hizb=${v.hizb} juz=${v.juz}`);
    }
    console.log();
  }

  // -------------------------------------------------------
  // 6. Unique hizb values in DB
  // -------------------------------------------------------
  const uniqueHizbValues = [...new Set(allVerses.map(v => v.hizb).filter(h => h !== null))].sort((a, b) => a - b);
  console.log(`\n=== UNIQUE HIZB VALUES IN DB (${uniqueHizbValues.length} values) ===`);
  console.log(uniqueHizbValues.join(', '));

  // Show the fractional parts
  const fractions = [...new Set(uniqueHizbValues.map(h => h % 1))].sort((a, b) => a - b);
  console.log(`\nFractional parts used: ${fractions.map(f => f.toFixed(3)).join(', ')}`);

  // -------------------------------------------------------
  // 7. Samir's specific positions
  // -------------------------------------------------------
  console.log('\n=== SAMIR POSITION CHECKS ===\n');

  // readingCurrentHizb=18, so next position = hizbToPosition(19)
  console.log('--- Samir Reading: readingCurrentHizb=18, checking hizbToPosition(19) ---');
  const hizb19 = results.find(r => r.hizb === 19);
  if (hizb19) {
    console.log(`  hizbToPosition(19) = S${hizb19.func.surahNumber}:${hizb19.func.verseNumber} (${hizb19.func.surahNameAr}), page ${hizb19.func.page}`);
    console.log(`  Actual DB boundary = S${hizb19.actual?.surahNumber}:${hizb19.actual?.verseNumber} (${hizb19.actual?.surahNameAr}), page ${hizb19.actual?.page}, hizb=${hizb19.actual?.hizbValue}`);
    console.log(`  Match: ${hizb19.match ? 'YES' : 'NO'}`);
  }

  // revisionCurrentHizb=0, zone startHizb=1, so hizbToPosition(1+0) = hizbToPosition(1)
  console.log('\n--- Samir Revision: revisionCurrentHizb=0, startHizb=1, checking hizbToPosition(1) ---');
  const hizb1 = results.find(r => r.hizb === 1);
  if (hizb1) {
    console.log(`  hizbToPosition(1) = S${hizb1.func.surahNumber}:${hizb1.func.verseNumber} (${hizb1.func.surahNameAr}), page ${hizb1.func.page}`);
    console.log(`  This should be Al-Fatiha 1:1, page 1`);
    console.log(`  Correct: ${hizb1.func.surahNumber === 1 && hizb1.func.verseNumber === 1 ? 'YES' : 'NO'}`);
  }

  // -------------------------------------------------------
  // 8. Cross-check: does the function skip the first verse of each hizb?
  // -------------------------------------------------------
  console.log('\n=== ANALYSIS: hizbToPosition() uses hizb >= N + 0.05 ===');
  console.log('This means it SKIPS verses with hizb = N.0 (exact integer)');
  console.log('and finds the first verse with hizb >= N.05\n');

  // Check what the first hizb value >= N.05 actually is for each hizb
  console.log('Hizb | First verse with hizb >= N+0.05 | That verse\'s hizb value | Its page | First verse of that page');
  console.log('-'.repeat(120));
  for (let hizb = 2; hizb <= 60; hizb++) {
    const marker = allVerses.find(v => v.hizb !== null && v.hizb >= hizb + 0.05);
    if (marker) {
      const fop = firstVerseOfPage[marker.page];
      console.log(
        `${hizb}`.padEnd(6) +
        `| S${marker.surahNumber}:${marker.verseNumber} (${marker.surah.nameAr})`.padEnd(40) +
        `| ${marker.hizb}`.padEnd(25) +
        `| p${marker.page}`.padEnd(10) +
        `| S${fop.surahNumber}:${fop.verseNumber} (${fop.surah.nameAr}) p${fop.page}`
      );
    }
  }

  // -------------------------------------------------------
  // 9. Summary table: DB boundary vs hizbToPosition()
  // -------------------------------------------------------
  console.log('\n=== SUMMARY: DB boundary vs hizbToPosition() ===\n');
  console.log('Hizb | DB first verse (hizb>=N) | Exact hizb value | hizbToPosition() returns | Diff?');
  console.log('-'.repeat(110));

  for (let hizb = 1; hizb <= 60; hizb++) {
    const r = results.find(rr => rr.hizb === hizb);
    const dbFirst = r.actual;
    const funcR = r.func;
    const diff = (dbFirst && funcR && (dbFirst.surahNumber !== funcR.surahNumber || dbFirst.verseNumber !== funcR.verseNumber))
      ? ' *** MISMATCH ***'
      : '';
    console.log(
      `${hizb}`.padEnd(6) +
      `| S${dbFirst?.surahNumber || '?'}:${dbFirst?.verseNumber || '?'} p${dbFirst?.page || '?'}`.padEnd(25) +
      `| ${dbFirst?.hizbValue || '?'}`.padEnd(20) +
      `| S${funcR?.surahNumber || '?'}:${funcR?.verseNumber || '?'} p${funcR?.page || '?'}`.padEnd(28) +
      diff
    );
  }

  // -------------------------------------------------------
  // 10. The key question: does hizbToPosition(N) point to
  //     the START of hizb N, or somewhere else?
  // -------------------------------------------------------
  console.log('\n=== KEY ANALYSIS ===');
  console.log('The function hizbToPosition(N) for N >= 2:');
  console.log('1. Finds first verse with hizb >= N + 0.05');
  console.log('2. Gets that verse\'s page number');
  console.log('3. Returns the first verse of that page');
  console.log('');
  console.log('This means:');
  console.log('- If hizb N starts at a verse that is NOT the first verse of its page,');
  console.log('  the function returns an EARLIER verse (first of the same page).');
  console.log('- The +0.05 offset means it skips the N.0 value and looks for N.125 or higher.');
  console.log('- This is INTENTIONAL because the traditional hizb boundary is at the');
  console.log('  beginning of the page, not at the exact verse where the hizb value changes.');
  console.log('');

  // Check if the +0.05 is correct by seeing what the minimum fractional value > 0 is
  const minFractionAboveZero = Math.min(...uniqueHizbValues.filter(h => h % 1 > 0).map(h => h % 1));
  console.log(`Minimum fractional part > 0: ${minFractionAboveZero}`);
  console.log(`This confirms +0.05 threshold is ${minFractionAboveZero > 0.05 ? 'CORRECT (fractions > 0.05)' : 'POSSIBLY WRONG (some fractions <= 0.05)'}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
