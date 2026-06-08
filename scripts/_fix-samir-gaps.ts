/**
 * Fix memorization gaps for Samir in the Amilou project.
 *
 * Creates missing Progress entries for:
 * 1. Surah 1 (Al-Fatiha): v.1-7
 * 2. Surah 2 (Al-Baqara): v.1-262, v.272-281
 * 3. Surah 4 (An-Nisa): v.24-24
 * 4. Surah 5 (Al-Ma'ida): v.41-42, v.51-66
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/_fix-samir-gaps.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAMIR_USER_ID = 'cmkfmco0d00026pa5hf7nzwwq';
const ENTRY_DATE = new Date('2024-09-15T00:00:00.000Z');

interface GapEntry {
  surahNumber: number;
  verseStart: number;
  verseEnd: number;
  label: string;
}

const GAPS: GapEntry[] = [
  { surahNumber: 1, verseStart: 1, verseEnd: 7, label: 'Surah 1 (Al-Fatiha) v.1-7' },
  { surahNumber: 2, verseStart: 1, verseEnd: 262, label: 'Surah 2 (Al-Baqara) v.1-262' },
  { surahNumber: 2, verseStart: 272, verseEnd: 281, label: 'Surah 2 (Al-Baqara) v.272-281' },
  { surahNumber: 4, verseStart: 24, verseEnd: 24, label: 'Surah 4 (An-Nisa) v.24-24' },
  { surahNumber: 5, verseStart: 41, verseEnd: 42, label: 'Surah 5 (Al-Ma\'ida) v.41-42' },
  { surahNumber: 5, verseStart: 51, verseEnd: 66, label: 'Surah 5 (Al-Ma\'ida) v.51-66' },
];

async function main() {
  // 1. Find the MEMORIZATION program
  const program = await prisma.program.findUnique({
    where: { code: 'MEMORIZATION' },
  });

  if (!program) {
    console.error('ERROR: MEMORIZATION program not found!');
    process.exit(1);
  }

  console.log(`Found MEMORIZATION program: ${program.id} (${program.nameFr})`);
  console.log(`User ID: ${SAMIR_USER_ID}`);
  console.log(`Date: ${ENTRY_DATE.toISOString()}`);
  console.log('');

  // 2. Check for existing entries that overlap with the gaps
  console.log('=== CHECKING EXISTING ENTRIES ===');
  const existingEntries = await prisma.progress.findMany({
    where: {
      userId: SAMIR_USER_ID,
      programId: program.id,
      surahNumber: { in: [...new Set(GAPS.map(g => g.surahNumber))] },
    },
    orderBy: [{ surahNumber: 'asc' }, { verseStart: 'asc' }],
  });

  console.log(`Found ${existingEntries.length} existing MEMORIZATION entries for surahs 1, 2, 4, 5:`);
  for (const entry of existingEntries) {
    console.log(`  Surah ${entry.surahNumber}: v.${entry.verseStart}-${entry.verseEnd} (date: ${entry.date.toISOString().split('T')[0]})`);
  }
  console.log('');

  // 3. Check each gap for overlaps
  console.log('=== DRY RUN: ENTRIES TO CREATE ===');
  const toCreate: GapEntry[] = [];

  for (const gap of GAPS) {
    // Check if an entry already exists that exactly matches or overlaps
    const overlapping = existingEntries.filter(e =>
      e.surahNumber === gap.surahNumber &&
      e.verseStart <= gap.verseEnd &&
      e.verseEnd >= gap.verseStart
    );

    if (overlapping.length > 0) {
      console.log(`SKIP ${gap.label} - overlapping entries exist:`);
      for (const o of overlapping) {
        console.log(`  -> v.${o.verseStart}-${o.verseEnd} (${o.date.toISOString().split('T')[0]})`);
      }
    } else {
      console.log(`WILL CREATE: ${gap.label}`);
      toCreate.push(gap);
    }
  }

  console.log('');

  if (toCreate.length === 0) {
    console.log('Nothing to create - all gaps are already covered.');
    return;
  }

  console.log(`Will create ${toCreate.length} new Progress entries.`);
  console.log('');

  // 4. Actually create the entries
  console.log('=== CREATING ENTRIES ===');
  const created: string[] = [];

  for (const gap of toCreate) {
    const entry = await prisma.progress.create({
      data: {
        userId: SAMIR_USER_ID,
        programId: program.id,
        date: ENTRY_DATE,
        surahNumber: gap.surahNumber,
        verseStart: gap.verseStart,
        verseEnd: gap.verseEnd,
        createdBy: SAMIR_USER_ID,
      },
    });
    console.log(`CREATED: ${gap.label} -> id: ${entry.id}`);
    created.push(entry.id);
  }

  console.log('');
  console.log(`Successfully created ${created.length} entries.`);

  // 5. Verify by querying back
  console.log('');
  console.log('=== VERIFICATION ===');
  const verification = await prisma.progress.findMany({
    where: {
      id: { in: created },
    },
    orderBy: [{ surahNumber: 'asc' }, { verseStart: 'asc' }],
  });

  console.log(`Verified ${verification.length} entries in database:`);
  for (const v of verification) {
    console.log(`  Surah ${v.surahNumber}: v.${v.verseStart}-${v.verseEnd} | date: ${v.date.toISOString().split('T')[0]} | id: ${v.id}`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
