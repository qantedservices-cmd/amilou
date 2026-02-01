/**
 * Migrate old recitation status codes to new format
 *
 * Old codes: PARTIAL, VALIDATED, KNOWN, MEMORIZATION
 * New codes: X, AM, 50%, 51%, 90%, V, S
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-recitation-statuses.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping from old status codes to new ones
const STATUS_MIGRATION: Record<string, string> = {
  'PARTIAL': '50%',      // Partiellement acquis
  'VALIDATED': 'V',      // Validé
  'KNOWN': 'X',          // Supposé connu
  'MEMORIZATION': 'AM',  // À mémoriser
};

async function main() {
  console.log('🚀 Migrating recitation statuses...\n');

  // 1. Migrate SurahRecitation
  console.log('📝 SurahRecitation:');
  for (const [oldCode, newCode] of Object.entries(STATUS_MIGRATION)) {
    const count = await prisma.surahRecitation.count({
      where: { status: oldCode }
    });

    if (count > 0) {
      await prisma.surahRecitation.updateMany({
        where: { status: oldCode },
        data: { status: newCode }
      });
      console.log(`   ${oldCode} → ${newCode}: ${count} records`);
    }
  }

  // 2. Migrate SurahMastery
  console.log('\n📚 SurahMastery:');
  for (const [oldCode, newCode] of Object.entries(STATUS_MIGRATION)) {
    const count = await prisma.surahMastery.count({
      where: { status: oldCode }
    });

    if (count > 0) {
      await prisma.surahMastery.updateMany({
        where: { status: oldCode },
        data: { status: newCode }
      });
      console.log(`   ${oldCode} → ${newCode}: ${count} records`);
    }
  }

  // 3. Summary
  console.log('\n📊 Final status distribution:');

  const recitationStats = await prisma.surahRecitation.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  console.log('\nSurahRecitation:');
  for (const stat of recitationStats) {
    console.log(`   ${stat.status}: ${stat._count.status}`);
  }

  const masteryStats = await prisma.surahMastery.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  console.log('\nSurahMastery:');
  for (const stat of masteryStats) {
    console.log(`   ${stat.status}: ${stat._count.status}`);
  }

  console.log('\n✨ Migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
