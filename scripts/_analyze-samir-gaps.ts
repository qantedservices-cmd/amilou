import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Find Samir's user
  const samir = await prisma.user.findFirst({
    where: { name: { contains: 'Samir', mode: 'insensitive' } },
  });

  if (!samir) {
    console.log('ERROR: No user found with name containing "Samir"');
    return;
  }

  console.log(`\n========================================`);
  console.log(`User found: ${samir.name} (ID: ${samir.id})`);
  console.log(`Role: ${samir.role}`);
  console.log(`Memorization direction: ${samir.memorizationDirection || 'not set'}`);
  console.log(`Memorization start: Surah ${samir.memorizationStartSurah || 'not set'}, Verse ${samir.memorizationStartVerse || 'not set'}`);
  console.log(`========================================\n`);

  // 2. Get MEMORIZATION program
  const memProgram = await prisma.program.findUnique({
    where: { code: 'MEMORIZATION' },
  });

  if (!memProgram) {
    console.log('ERROR: MEMORIZATION program not found');
    return;
  }

  console.log(`MEMORIZATION program ID: ${memProgram.id}`);
  console.log(`Name (FR): ${memProgram.nameFr}\n`);

  // 3. Get ALL Progress entries for Samir with MEMORIZATION for surahs 1-8
  const progressEntries = await prisma.progress.findMany({
    where: {
      userId: samir.id,
      programId: memProgram.id,
      surahNumber: { gte: 1, lte: 8 },
    },
    orderBy: [
      { surahNumber: 'asc' },
      { verseStart: 'asc' },
      { date: 'asc' },
    ],
  });

  console.log(`Total MEMORIZATION Progress entries for surahs 1-8: ${progressEntries.length}\n`);

  // 4. Get total verse count for each surah 1-8
  const surahs = await prisma.surah.findMany({
    where: { number: { gte: 1, lte: 8 } },
    orderBy: { number: 'asc' },
  });

  console.log(`=== SURAH REFERENCE DATA (1-8) ===`);
  for (const s of surahs) {
    console.log(`  Surah ${s.number} - ${s.nameAr} (${s.nameFr}): ${s.totalVerses} verses`);
  }
  console.log();

  // 5. Build a Set of memorized verses from Progress entries
  const memorizedVerses = new Set<string>();
  const surahVerseMap: Record<number, Set<number>> = {};

  for (const entry of progressEntries) {
    if (!surahVerseMap[entry.surahNumber]) {
      surahVerseMap[entry.surahNumber] = new Set();
    }
    for (let v = entry.verseStart; v <= entry.verseEnd; v++) {
      const key = `${entry.surahNumber}:${v}`;
      memorizedVerses.add(key);
      surahVerseMap[entry.surahNumber].add(v);
    }
  }

  // 6. For each surah 1-8, find gaps
  console.log(`=== MEMORIZATION GAPS ANALYSIS (Surahs 1-8) ===\n`);

  const completelySurahsMissing: number[] = [];

  for (const surah of surahs) {
    const totalVerses = surah.totalVerses;
    const memorizedSet = surahVerseMap[surah.number] || new Set();
    const memorizedCount = memorizedSet.size;
    const missingVerses: number[] = [];

    for (let v = 1; v <= totalVerses; v++) {
      if (!memorizedSet.has(v)) {
        missingVerses.push(v);
      }
    }

    if (memorizedCount === 0) {
      completelySurahsMissing.push(surah.number);
    }

    // Format missing verses as ranges
    const missingRanges = formatRanges(missingVerses);

    console.log(`--- Surah ${surah.number} - ${surah.nameAr} (${surah.nameFr}) ---`);
    console.log(`  Total verses: ${totalVerses}`);
    console.log(`  Memorized: ${memorizedCount} / ${totalVerses} (${((memorizedCount / totalVerses) * 100).toFixed(1)}%)`);
    console.log(`  Missing: ${missingVerses.length} verses`);
    if (missingVerses.length > 0 && missingVerses.length < totalVerses) {
      console.log(`  Missing ranges: ${missingRanges}`);
    } else if (missingVerses.length === totalVerses) {
      console.log(`  ** COMPLETELY MISSING - No memorization entries **`);
    } else {
      console.log(`  ** FULLY MEMORIZED **`);
    }
    console.log();
  }

  // 7. Summary of all Progress entries with dates
  console.log(`=== PROGRESS ENTRIES DETAIL (sorted by date) ===\n`);

  const entriesByDate = [...progressEntries].sort((a, b) => a.date.getTime() - b.date.getTime());

  const dateSet = new Set<string>();
  for (const entry of entriesByDate) {
    const dateStr = entry.date.toISOString().split('T')[0];
    dateSet.add(dateStr);
    console.log(`  ${dateStr} | Surah ${entry.surahNumber} v.${entry.verseStart}-${entry.verseEnd} (${entry.verseEnd - entry.verseStart + 1} verses)${entry.comment ? ` [${entry.comment}]` : ''}`);
  }

  const dates = Array.from(dateSet).sort();
  console.log(`\n=== DATE RANGE SUMMARY ===`);
  console.log(`Total unique dates with entries: ${dates.length}`);
  if (dates.length > 0) {
    console.log(`First entry: ${dates[0]}`);
    console.log(`Last entry: ${dates[dates.length - 1]}`);
  }

  // Identify date gaps (days between consecutive entries)
  if (dates.length > 1) {
    console.log(`\n=== DATE GAPS (>7 days between entries) ===`);
    let hasGaps = false;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        hasGaps = true;
        console.log(`  Gap: ${dates[i - 1]} -> ${dates[i]} (${diffDays} days)`);
      }
    }
    if (!hasGaps) {
      console.log(`  No gaps greater than 7 days found.`);
    }
  }

  // Summary of completely missing surahs
  if (completelySurahsMissing.length > 0) {
    console.log(`\n=== COMPLETELY MISSING SURAHS ===`);
    for (const sNum of completelySurahsMissing) {
      const s = surahs.find(x => x.number === sNum)!;
      console.log(`  Surah ${s.number} - ${s.nameAr} (${s.nameFr}): ${s.totalVerses} verses - NO ENTRIES`);
    }
  } else {
    console.log(`\n=== No surahs completely missing. All surahs 1-8 have at least one entry. ===`);
  }

  // Also check entries by surah for overlap detection
  console.log(`\n=== ENTRIES PER SURAH (checking for overlaps) ===\n`);
  for (const surah of surahs) {
    const surahEntries = progressEntries.filter(e => e.surahNumber === surah.number);
    if (surahEntries.length === 0) continue;

    console.log(`Surah ${surah.number} - ${surah.nameAr}: ${surahEntries.length} entries`);
    for (const entry of surahEntries) {
      const dateStr = entry.date.toISOString().split('T')[0];
      console.log(`  ${dateStr} | v.${entry.verseStart}-${entry.verseEnd}`);
    }
    console.log();
  }
}

function formatRanges(numbers: number[]): string {
  if (numbers.length === 0) return '';

  const ranges: string[] = [];
  let start = numbers[0];
  let end = numbers[0];

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === end + 1) {
      end = numbers[i];
    } else {
      ranges.push(start === end ? `v.${start}` : `v.${start}-${end}`);
      start = numbers[i];
      end = numbers[i];
    }
  }
  ranges.push(start === end ? `v.${start}` : `v.${start}-${end}`);

  return ranges.join(', ');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
