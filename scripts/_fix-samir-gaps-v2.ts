import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAMIR_ID = 'cmkfmco0d00026pa5hf7nzwwq';

async function main() {
  // Find MEMORIZATION program
  const memProg = await prisma.program.findFirstOrThrow({ where: { code: 'MEMORIZATION' } });
  console.log('MEMORIZATION program ID:', memProg.id);

  // ============================================================
  // STEP 1: Analyze surrounding entries for each gap
  // ============================================================
  console.log('\n========== STEP 1: ANALYZE SURROUNDING ENTRIES ==========\n');

  // --- An-Nisa (surah 4) v.24 ---
  console.log('--- An-Nisa (surah 4) v.24 ---');
  const nisa_entries = await prisma.progress.findMany({
    where: { userId: SAMIR_ID, programId: memProg.id, surahNumber: 4 },
    orderBy: [{ verseStart: 'asc' }],
  });
  console.log('All Surah 4 entries:');
  for (const e of nisa_entries) {
    console.log(`  id=${e.id} v.${e.verseStart}-${e.verseEnd} date=${e.date.toISOString().slice(0, 10)} comment=${e.comment || ''}`);
  }

  // Find entry containing v.23 (before the gap)
  const nisa_before = nisa_entries.filter(e => e.verseEnd <= 23 || (e.verseStart <= 23 && e.verseEnd >= 23));
  const nisa_after = nisa_entries.filter(e => e.verseStart >= 25 || (e.verseStart <= 25 && e.verseEnd >= 25));

  // Pick the closest before and after
  const nisa_closest_before = nisa_before.length > 0
    ? nisa_before.reduce((best, e) => e.verseEnd > best.verseEnd ? e : best)
    : null;
  const nisa_closest_after = nisa_after.length > 0
    ? nisa_after.reduce((best, e) => e.verseStart < best.verseStart ? e : best)
    : null;

  console.log(`  Closest before v.24: ${nisa_closest_before ? `v.${nisa_closest_before.verseStart}-${nisa_closest_before.verseEnd} date=${nisa_closest_before.date.toISOString().slice(0, 10)}` : 'NONE'}`);
  console.log(`  Closest after v.24: ${nisa_closest_after ? `v.${nisa_closest_after.verseStart}-${nisa_closest_after.verseEnd} date=${nisa_closest_after.date.toISOString().slice(0, 10)}` : 'NONE'}`);

  const nisa24_date = nisa_closest_before?.date || nisa_closest_after?.date || new Date('2024-09-15');
  console.log(`  => Date for v.24: ${nisa24_date.toISOString().slice(0, 10)}`);

  // --- Al-Ma'ida (surah 5) v.41-42 ---
  console.log('\n--- Al-Ma\'ida (surah 5) v.41-42 ---');
  const maida_entries = await prisma.progress.findMany({
    where: { userId: SAMIR_ID, programId: memProg.id, surahNumber: 5 },
    orderBy: [{ verseStart: 'asc' }],
  });
  console.log('All Surah 5 entries:');
  for (const e of maida_entries) {
    console.log(`  id=${e.id} v.${e.verseStart}-${e.verseEnd} date=${e.date.toISOString().slice(0, 10)} comment=${e.comment || ''}`);
  }

  // Find entry containing/ending at v.40
  const maida41_before = maida_entries.filter(e => e.verseEnd <= 40 || (e.verseStart <= 40 && e.verseEnd >= 40));
  const maida41_closest_before = maida41_before.length > 0
    ? maida41_before.reduce((best, e) => e.verseEnd > best.verseEnd ? e : best)
    : null;
  // Find entry containing/starting at v.43
  const maida41_after = maida_entries.filter(e => e.verseStart >= 43 || (e.verseStart <= 43 && e.verseEnd >= 43));
  const maida41_closest_after = maida41_after.length > 0
    ? maida41_after.reduce((best, e) => e.verseStart < best.verseStart ? e : best)
    : null;

  console.log(`  Closest before v.41: ${maida41_closest_before ? `v.${maida41_closest_before.verseStart}-${maida41_closest_before.verseEnd} date=${maida41_closest_before.date.toISOString().slice(0, 10)}` : 'NONE'}`);
  console.log(`  Closest after v.42: ${maida41_closest_after ? `v.${maida41_closest_after.verseStart}-${maida41_closest_after.verseEnd} date=${maida41_closest_after.date.toISOString().slice(0, 10)}` : 'NONE'}`);

  const maida41_date = maida41_closest_before?.date || maida41_closest_after?.date || new Date('2024-09-15');
  console.log(`  => Date for v.41-42: ${maida41_date.toISOString().slice(0, 10)}`);

  // --- Al-Ma'ida (surah 5) v.51-66 ---
  console.log('\n--- Al-Ma\'ida (surah 5) v.51-66 ---');
  const maida51_before = maida_entries.filter(e => e.verseEnd <= 50 || (e.verseStart <= 50 && e.verseEnd >= 50));
  const maida51_closest_before = maida51_before.length > 0
    ? maida51_before.reduce((best, e) => e.verseEnd > best.verseEnd ? e : best)
    : null;
  const maida51_after = maida_entries.filter(e => e.verseStart >= 67 || (e.verseStart <= 67 && e.verseEnd >= 67));
  const maida51_closest_after = maida51_after.length > 0
    ? maida51_after.reduce((best, e) => e.verseStart < best.verseStart ? e : best)
    : null;

  console.log(`  Closest before v.51: ${maida51_closest_before ? `v.${maida51_closest_before.verseStart}-${maida51_closest_before.verseEnd} date=${maida51_closest_before.date.toISOString().slice(0, 10)}` : 'NONE'}`);
  console.log(`  Closest after v.66: ${maida51_closest_after ? `v.${maida51_closest_after.verseStart}-${maida51_closest_after.verseEnd} date=${maida51_closest_after.date.toISOString().slice(0, 10)}` : 'NONE'}`);

  const maida51_date = maida51_closest_before?.date || maida51_closest_after?.date || new Date('2024-09-15');
  console.log(`  => Date for v.51-66: ${maida51_date.toISOString().slice(0, 10)}`);

  // ============================================================
  // STEP 2: Delete the bad entries (date = 2024-09-15)
  // ============================================================
  console.log('\n========== STEP 2: DELETE BAD ENTRIES ==========\n');

  const badDate = new Date('2024-09-15T00:00:00.000Z');

  // Define the 6 gap entries to delete
  const gapSpecs = [
    { surahNumber: 1, verseStart: 1, verseEnd: 7 },
    { surahNumber: 2, verseStart: 1, verseEnd: 262 },
    { surahNumber: 2, verseStart: 272, verseEnd: 281 },
    { surahNumber: 4, verseStart: 24, verseEnd: 24 },
    { surahNumber: 5, verseStart: 41, verseEnd: 42 },
    { surahNumber: 5, verseStart: 51, verseEnd: 66 },
  ];

  let deletedCount = 0;
  for (const spec of gapSpecs) {
    const found = await prisma.progress.findMany({
      where: {
        userId: SAMIR_ID,
        programId: memProg.id,
        surahNumber: spec.surahNumber,
        verseStart: spec.verseStart,
        verseEnd: spec.verseEnd,
        date: badDate,
      },
    });

    if (found.length === 0) {
      console.log(`  NOT FOUND: Surah ${spec.surahNumber} v.${spec.verseStart}-${spec.verseEnd} date=2024-09-15`);
    } else {
      for (const entry of found) {
        await prisma.progress.delete({ where: { id: entry.id } });
        console.log(`  DELETED: id=${entry.id} Surah ${spec.surahNumber} v.${spec.verseStart}-${spec.verseEnd} date=2024-09-15`);
        deletedCount++;
      }
    }
  }
  console.log(`\nTotal deleted: ${deletedCount}`);

  // ============================================================
  // STEP 3: Recreate with correct dates
  // ============================================================
  console.log('\n========== STEP 3: RECREATE WITH CORRECT DATES ==========\n');

  const preTrackingDate = new Date('2024-09-15T00:00:00.000Z');

  const entriesToCreate = [
    { surahNumber: 1, verseStart: 1, verseEnd: 7, date: preTrackingDate, label: 'Al-Fatiha v.1-7 (pre-tracking)' },
    { surahNumber: 2, verseStart: 1, verseEnd: 262, date: preTrackingDate, label: 'Al-Baqara v.1-262 (pre-tracking)' },
    { surahNumber: 2, verseStart: 272, verseEnd: 281, date: preTrackingDate, label: 'Al-Baqara v.272-281 (pre-tracking)' },
    { surahNumber: 4, verseStart: 24, verseEnd: 24, date: nisa24_date, label: `An-Nisa v.24 (from neighbor)` },
    { surahNumber: 5, verseStart: 41, verseEnd: 42, date: maida41_date, label: `Al-Ma'ida v.41-42 (from neighbor)` },
    { surahNumber: 5, verseStart: 51, verseEnd: 66, date: maida51_date, label: `Al-Ma'ida v.51-66 (from neighbor)` },
  ];

  const created: { id: string; label: string; date: string }[] = [];

  for (const entry of entriesToCreate) {
    const p = await prisma.progress.create({
      data: {
        userId: SAMIR_ID,
        programId: memProg.id,
        surahNumber: entry.surahNumber,
        verseStart: entry.verseStart,
        verseEnd: entry.verseEnd,
        date: entry.date,
        createdBy: SAMIR_ID,
        comment: 'Gap fill - coherent date',
      },
    });
    const dateStr = entry.date.toISOString().slice(0, 10);
    console.log(`  CREATED: id=${p.id} ${entry.label} date=${dateStr}`);
    created.push({ id: p.id, label: entry.label, date: dateStr });
  }

  // ============================================================
  // STEP 4: Print summary and verification
  // ============================================================
  console.log('\n========== STEP 4: SUMMARY & VERIFICATION ==========\n');

  console.log('--- Created entries ---');
  for (const c of created) {
    console.log(`  ${c.label} => date=${c.date} (id=${c.id})`);
  }

  // Verify: All Surah 4 entries
  console.log('\n--- Verification: Surah 4 (An-Nisa) all entries ---');
  const verify4 = await prisma.progress.findMany({
    where: { userId: SAMIR_ID, programId: memProg.id, surahNumber: 4 },
    orderBy: [{ verseStart: 'asc' }],
  });
  for (const e of verify4) {
    console.log(`  v.${e.verseStart}-${e.verseEnd} date=${e.date.toISOString().slice(0, 10)} id=${e.id}`);
  }

  // Verify: All Surah 5 entries
  console.log('\n--- Verification: Surah 5 (Al-Ma\'ida) all entries ---');
  const verify5 = await prisma.progress.findMany({
    where: { userId: SAMIR_ID, programId: memProg.id, surahNumber: 5 },
    orderBy: [{ verseStart: 'asc' }],
  });
  for (const e of verify5) {
    console.log(`  v.${e.verseStart}-${e.verseEnd} date=${e.date.toISOString().slice(0, 10)} id=${e.id}`);
  }

  // Also show Surahs 1 and 2 for completeness
  console.log('\n--- Verification: Surah 1 (Al-Fatiha) all entries ---');
  const verify1 = await prisma.progress.findMany({
    where: { userId: SAMIR_ID, programId: memProg.id, surahNumber: 1 },
    orderBy: [{ verseStart: 'asc' }],
  });
  for (const e of verify1) {
    console.log(`  v.${e.verseStart}-${e.verseEnd} date=${e.date.toISOString().slice(0, 10)} id=${e.id}`);
  }

  console.log('\n--- Verification: Surah 2 (Al-Baqara) all entries ---');
  const verify2 = await prisma.progress.findMany({
    where: { userId: SAMIR_ID, programId: memProg.id, surahNumber: 2 },
    orderBy: [{ verseStart: 'asc' }],
  });
  for (const e of verify2) {
    console.log(`  v.${e.verseStart}-${e.verseEnd} date=${e.date.toISOString().slice(0, 10)} id=${e.id}`);
  }

  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
